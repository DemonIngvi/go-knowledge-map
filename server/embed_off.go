//go:build !embedweb

package main

import "io/fs"

// Обычная сборка: страница берётся из папки web рядом с exe.
func embeddedWeb() fs.FS { return nil }
