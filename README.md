# Local PDF Widget Pro

A sleek Chrome extension that turns your browser toolbar into a local PDF file explorer. Browse, search, rename, and open PDF files from any folder on your computer — all from a compact dark-themed popup.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)
![No Dependencies](https://img.shields.io/badge/Dependencies-None-green)

---

## Features

- **One-Click Folder Selection** — Native OS folder picker opens directly from the popup
- **File Explorer** — Browse folders and PDF files in an Explorer-style grid layout
- **Breadcrumb Navigation** — Click any level to jump back instantly
- **Global Search** — Recursive search across all subfolders, triggered at 2+ characters
- **Sort by Name or Date** — Toggle ascending/descending; folders always sort first
- **Context Menu** — Right-click for Open, Rename, Copy Name, or Delete
- **Recent Files** — Last 3 opened PDFs are pinned at the top for quick access
- **Keyboard Navigation** — Arrow keys to browse, Enter to open, Backspace to go back, `/` to search
- **Permission Recovery** — Unlock button when file access needs re-authorization
- **Offline Cache** — IndexedDB caches folder contents for instant loads
- **Dark Theme** — Clean, modern UI with smooth animations

## Compatibility

### Supported Browsers

| Browser | Version | Status |
|---------|---------|--------|
| Google Chrome | 86+ | Fully supported |
| Microsoft Edge | 86+ | Fully supported |
| Brave | 86+ | Fully supported |
| Opera | 72+ | Fully supported |
| Vivaldi | 3.4+ | Fully supported |
| Firefox | -- | Not supported (no File System Access API) |
| Safari | -- | Not supported (no extension + API support) |

### Supported Operating Systems

| OS | Folder Picker | File Operations | Notes |
|----|---------------|-----------------|-------|
| Windows 10/11 | Native Explorer dialog | Full support | |
| macOS 11+ | Native Finder dialog | Full support | Cmd-based shortcuts |
| Linux (Ubuntu, Fedora, etc.) | Native GTK/KDE dialog | Full support | |
| ChromeOS | Native Files app dialog | Full support | |

### Keyboard Shortcuts

| Action | Windows / Linux | macOS |
|--------|----------------|-------|
| Navigate file list | `Arrow Up/Down` | `Arrow Up/Down` |
| Open selected item | `Enter` | `Enter` |
| Go back | `Backspace` / `Alt+Left` | `Backspace` / `Cmd+Left` / `Cmd+[` |
| Focus search bar | `/` | `/` |

## Installation

1. Download or clone this repository
2. Open `chrome://extensions/` in your Chromium browser (or `edge://extensions/` for Edge)
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select this folder
5. Click the extension icon in the toolbar to get started

## Usage

1. **Click the extension icon** in the toolbar — the popup opens
2. **Click "Change"** to select a folder containing your PDFs
3. **Browse** your files — click folders to navigate, click PDFs to open them in a new tab
4. **Search** by typing in the search bar — searches recursively through all subfolders
5. **Right-click** any file for rename, copy name, or delete options

## Tech Stack

- **Chrome Extension Manifest V3** — Modern extension architecture
- **Vanilla JavaScript** — No frameworks, no build step, no dependencies
- **File System Access API** — Native OS file/folder operations
- **IndexedDB** — Persistent storage for folder handles, cache, and recent files
- **CSS Custom Properties** — Consistent dark theme

## Project Structure

```
PDFwidgetExtension/
  manifest.json    — Extension config (Manifest V3)
  background.js    — Service worker placeholder
  popup.html       — UI markup + CSS (dark theme, grid layout)
  popup.js         — All application logic
```

## Permissions

| Permission | Why |
|-----------|-----|
| `storage` | Save extension preferences |
| `tabs` | Open PDFs in new browser tabs |

No network access. No data leaves your machine. Everything runs locally.

## License

MIT
