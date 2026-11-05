// Сервер «Карты знаний Go-бэкенда»: отдаёт страницу и хранит прогресс в progress.json.
//
// Запуск: gokb-server.exe [-addr 127.0.0.1:8090] [-web ПАПКА] [-data ФАЙЛ] [-open=false]
// По умолчанию страница берётся из папки web рядом с программой, прогресс — progress.json рядом с ней же.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"path/filepath"
	"runtime"
	"strings"
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
	web := flag.String("web", filepath.Join(defRoot, "web"), "папка со страницей (index.html, css, js, content)")
	data := flag.String("data", filepath.Join(defRoot, "progress.json"), "файл прогресса")
	open := flag.Bool("open", true, "открыть страницу в браузере")
	flag.Parse()

	// страница: папка web, а если её нет и exe портативный — вшитая копия
	var pages http.Handler
	if _, err := os.Stat(filepath.Join(*web, "index.html")); err == nil {
		pages = staticFiles(*web)
	} else if efs := embeddedWeb(); efs != nil {
		pages = embeddedFiles(efs)
	} else {
		log.Fatalf("не найдена страница %s: %v", filepath.Join(*web, "index.html"), err)
	}
	st := &store{path: *data}

	mux := http.NewServeMux()
	mux.Handle("GET /", pages)
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

// staticFiles отдаёт файлы страницы без листинга каталогов и без выхода за пределы папки.
func staticFiles(dir string) http.Handler {
	root, _ := filepath.Abs(dir)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := path.Clean("/" + r.URL.Path)
		if p == "/" {
			p = "/index.html"
		}
		full := filepath.Join(root, filepath.FromSlash(p))
		if rel, err := filepath.Rel(root, full); err != nil || strings.HasPrefix(rel, "..") {
			http.NotFound(w, r)
			return
		}
		fi, err := os.Stat(full)
		if err != nil || fi.IsDir() {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, full)
	})
}

// embeddedFiles отдаёт вшитые файлы без листинга каталогов.
func embeddedFiles(efs fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if p == "" {
			p = "index.html"
		}
		fi, err := fs.Stat(efs, p)
		if err != nil || fi.IsDir() {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFileFS(w, r, efs, p)
	})
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
