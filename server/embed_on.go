//go:build embedweb

package main

import (
	"embed"
	"io/fs"
)

// Портативная сборка: страница (однофайловый dist/index.html) вшита в exe.
// Сборка: node scripts/portable.js (кладёт страницу в server/webfs и собирает с тегом embedweb).
//
//go:embed webfs
var embedded embed.FS

func embeddedWeb() fs.FS {
	sub, err := fs.Sub(embedded, "webfs")
	if err != nil {
		return nil
	}
	return sub
}
