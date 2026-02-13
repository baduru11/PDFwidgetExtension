# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Local PDF Widget Pro** — a Chrome extension (Manifest V3) that provides a local file explorer for managing and opening PDF files from the browser toolbar popup.

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript (ES6+, no build step, no frameworks, no npm dependencies)
- HTML5 + CSS3 with custom properties for dark theme
- IndexedDB for persistent storage (folder handles, cache, recent files)
- File System Access API for local folder/file operations

## Development Workflow

There is no build system. The extension is loaded directly from source:

1. Go to `chrome://extensions/` → Enable Developer mode
2. Click "Load unpacked" → Select the `PDFwidgetExtension/` folder
3. After code changes, click the reload icon on the extension card

Debug via right-click extension popup icon → "Inspect" to open DevTools.

## Architecture

All source lives in `PDFwidgetExtension/`:

- **manifest.json** — Extension config; requests only `storage` and `tabs` permissions
- **background.js** — Minimal service worker placeholder
- **popup.html** — Full UI markup + CSS (dark theme, CSS Grid file explorer, breadcrumb nav, context menu, search bar, recent files section)
- **popup.js** — All application logic (~550 lines)

### popup.js Structure

State is managed via module-level globals (`allEntries`, `dirStack`, `currentHandle`, `sortBy`, `sortDesc`, `selectedIndex`, `rightClickedEntry`).

Key subsystems:
- **File Explorer** — `loadFiles()`, `renderList()`, `renderBreadcrumbs()`, `goBack()` — loads directory contents via File System Access API handles, renders sorted entries (folders first)
- **Search** — Real-time local filtering at 1 char; `performGlobalSearch()` recursive folder scanning at 2+ chars (debounced 300ms)
- **File Operations** — Open PDF (via `URL.createObjectURL`), rename, delete, copy name; all require permission checks via `requestPermission()`
- **Persistence** — IndexedDB stores: root folder handle (`saveFolder`/`getSavedFolder`), directory caches (`saveCache`/`getCache`), recent files (`saveRecentFile`/`getRecentFiles`, max 3)
- **Permission Recovery** — `showUnlockUI()` displays unlock button when file access is denied; falls back to cached data
- **Keyboard Navigation** — Arrow keys, Enter, Backspace, `/` to focus search

### Picker Window Pattern

Chrome kills extension popups when native OS dialogs (like `showDirectoryPicker()`) steal focus. To work around this, `btnSelect` opens a separate helper window (`popup.html?picker=1`) that runs `runPickerMode()`. This helper window:
1. Calls `showDirectoryPicker()` safely (survives focus loss)
2. Saves the folder handle to IndexedDB
3. Pre-caches the file listing so the main popup can render instantly
4. Closes itself after completion

The same helper window is used for the "Unlock Folder" flow when permissions expire — the user must re-select the folder via the OS picker (there is no way to silently re-grant permission in the File System Access API from a popup context).

### Permission Model

The File System Access API requires user gesture to grant permission, and permissions expire between sessions. The extension handles this with a layered approach:
- On load, `queryPermission()` checks if access is still granted
- If denied, cached data from IndexedDB is shown as a fallback
- `showUnlockUI()` provides a re-grant button (which opens the picker helper window)
- Write operations (`rename`, `delete`) request `readwrite` mode via `requestPermission()`
- Click handlers on cached entries (`handleEntryClick`, `handleRename`) detect stale/serialized entries (which lack native `FileSystemHandle` methods) and re-request permission from the parent directory handle before proceeding

### IndexedDB Schema

Database: `PDF_Manager_DB` (version 2), two object stores:
- **`handles`** — stores folder `FileSystemDirectoryHandle` objects (key: `"lastFolder"`)
- **`cache`** — stores serialized file listings (keys: `"root"`, subfolder names, `"recent_files"`)

### HTML Rendering

File names are rendered via `innerHTML` for search highlight support. All user-supplied text passes through `escapeHtml()` before insertion. `highlightText()` escapes first, then applies highlight spans. Maintain this order to prevent XSS from malicious file names.

### Sorting

Directories always sort before files. Name sort is case-insensitive alphabetical; date sort uses `lastModified` timestamp. Each column toggles ascending/descending.

### Cross-Platform

`isMac` detection enables macOS-specific keyboard shortcuts (`Cmd+[` for back). The extension requires the File System Access API, so it works on Chromium-based browsers (Chrome 86+, Edge 86+, Brave, Opera, Vivaldi) but not Firefox or Safari.
