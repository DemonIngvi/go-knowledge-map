// Сервер «Карты знаний Go-бэкенда»: отдаёт страницу и хранит прогресс в progress.json.
//
// Запуск: gokb-server.exe [-addr 127.0.0.1:8090] [-root ПАПКА] [-open=false]
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"sync"
	"syscall"
	"time"
)

const maxBody = 4 << 20 // 4 МБ хватает с огромным запасом

type store struct {
	mu   sync.Mutex
	path string
}

// progress — минимальная проверка формата, чтобы не записать на диск мусор.
type progress struct {
	Version int                        `json:"version"`
	Updated string                     `json:"updated"`
	SR      map[string]json.RawMessage `json:"sr"`
}

func (s *store) read() ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return []byte(`{"version":1,"sr":{}}`), nil
	}
	return b, err
}

// write пишет атомарно: во временный файл, затем rename. Прошлая версия остаётся в .bak.
func (s *store) write(b []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	tmp, err := os.CreateTemp(filepath.Dir(s.path), "progress-*.tmp")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(b); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if _, err := os.Stat(s.path); err == nil {
		_ = copyFile(s.path, s.path+".bak")
	}
	return os.Rename(tmp.Name(), s.path)
}

func copyFile(src, dst string) error {
	b, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, b, 0o644)
}

// localOnly защищает от DNS rebinding и запросов с чужих сайтов.
func localOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.Host)
		if err != nil {
			host = r.Host
		}
		if host != "127.0.0.1" && host != "localhost" && host != "::1" {
			http.Error(w, "forbidden host", http.StatusForbidden)
			return
		}
		if o := r.Header.Get("Origin"); o != "" && o != "http://"+r.Host {
			http.Error(w, "forbidden origin", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	exe, _ := os.Executable()
	defRoot := filepath.Dir(exe)
	addr := flag.String("addr", "127.0.0.1:8090", "адрес сервера")
	root := flag.String("root", defRoot, "папка с index.html и progress.json")
	open := flag.Bool("open", true, "открыть страницу в браузере")
	flag.Parse()

	index := filepath.Join(*root, "index.html")
	if _, err := os.Stat(index); err != nil {
		log.Fatalf("не найден %s: %v", index, err)
	}
	st := &store{path: filepath.Join(*root, "progress.json")}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		http.ServeFile(w, r, index)
	})
	mux.HandleFunc("GET /api/progress", func(w http.ResponseWriter, r *http.Request) {
		b, err := st.read()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(b)
	})
	mux.HandleFunc("PUT /api/progress", func(w http.ResponseWriter, r *http.Request) {
		b, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
		if err != nil {
			http.Error(w, "слишком большой запрос", http.StatusRequestEntityTooLarge)
			return
		}
		var p progress
		if err := json.Unmarshal(b, &p); err != nil || p.SR == nil {
			http.Error(w, "ожидается JSON вида {\"version\":1,\"sr\":{...}}", http.StatusBadRequest)
			return
		}
		if err := st.write(b); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	srv := &http.Server{
		Addr:              *addr,
		Handler:           localOnly(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	url := "http://" + *addr + "/"
	ln, err := net.Listen("tcp", *addr)
	if err != nil {
		// повторный двойной щелчок: сервер уже работает — просто открываем страницу
		if alreadyRunning(url) {
			fmt.Println("Сервер уже запущен, открываю", url)
			if *open {
				openBrowser(url)
			}
			time.Sleep(1500 * time.Millisecond)
			return
		}
		fmt.Printf("Не удалось занять %s: %v\nНажмите Enter, чтобы закрыть окно.", *addr, err)
		_, _ = fmt.Scanln()
		os.Exit(1)
	}
	fmt.Printf("Карта знаний: %s\nПрогресс: %s\nОстановить: Ctrl+C\n", url, st.path)
	if *open {
		openBrowser(url)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}

func alreadyRunning(url string) bool {
	c := &http.Client{Timeout: time.Second}
	resp, err := c.Get(url + "api/progress")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.StatusCode == http.StatusOK
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}
