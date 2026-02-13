<div align="center">

# Local PDF Widget Pro

**Your local PDF library, one click away.**

A Chrome extension that turns your browser toolbar into a sleek, dark-themed PDF file explorer.
Browse, search, rename, and open PDFs from any folder on your computer — without ever leaving your browser.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?style=for-the-badge&logo=google&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![No Dependencies](https://img.shields.io/badge/Dependencies-Zero-22c55e?style=for-the-badge)](#tech-stack)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

---

<br>

> **100% local. Zero network access. Your files never leave your machine.**

<br>

</div>

## Features

| | Feature | Description |
|---|---------|-------------|
| :file_folder: | **File Explorer** | Browse folders and PDFs in an Explorer-style grid layout with breadcrumb navigation |
| :mag: | **Global Search** | Recursive search across all subfolders, triggered at 2+ characters with 300ms debounce |
| :arrows_counterclockwise: | **Sort & Filter** | Sort by name or date, toggle asc/desc — folders always float to the top |
| :computer_mouse: | **Context Menu** | Right-click for Open, Rename, Copy Name, or Delete |
| :clock3: | **Recent Files** | Last 3 opened PDFs pinned at the top for instant re-access |
| :keyboard: | **Keyboard-First** | Arrow keys to navigate, Enter to open, Backspace to go back, `/` to search |
| :lock: | **Permission Recovery** | One-click unlock when file access needs re-authorization |
| :zap: | **Offline Cache** | IndexedDB caches folder contents for instant loads — even when permissions expire |
| :new_moon: | **Dark Theme** | Clean, modern UI with smooth animations and custom scrollbars |

---

## Quick Start

### Installation

1. **Download** or clone this repository
2. Open **`chrome://extensions/`** in your browser
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `PDFwidgetExtension/` folder
5. Pin the extension icon to your toolbar

### Usage

```
1. Click the extension icon         ->  Popup opens
2. Click "Change"                   ->  Select a folder with your PDFs
3. Click any PDF                    ->  Opens in a new tab
4. Type in the search bar           ->  Searches recursively through all subfolders
5. Right-click any file             ->  Rename, copy name, or delete
```

---

## Keyboard Shortcuts

| Action | Windows / Linux | macOS |
|:-------|:----------------|:------|
| Navigate file list | `Arrow Up` / `Arrow Down` | `Arrow Up` / `Arrow Down` |
| Open selected item | `Enter` | `Enter` |
| Go back | `Backspace` / `Alt+Left` | `Backspace` / `Cmd+Left` / `Cmd+[` |
| Focus search bar | `/` | `/` |

---

## Compatibility

### Browsers

| Browser | Version | Status |
|:--------|:--------|:-------|
| Google Chrome | 86+ | :white_check_mark: Fully supported |
| Microsoft Edge | 86+ | :white_check_mark: Fully supported |
| Brave | 86+ | :white_check_mark: Fully supported |
| Opera | 72+ | :white_check_mark: Fully supported |
| Vivaldi | 3.4+ | :white_check_mark: Fully supported |
| Firefox | — | :x: No File System Access API |
| Safari | — | :x: No extension + API support |

### Operating Systems

| OS | Folder Picker | File Operations |
|:---|:--------------|:----------------|
| Windows 10/11 | Native Explorer dialog | Full support |
| macOS 11+ | Native Finder dialog | Full support |
| Linux (Ubuntu, Fedora, etc.) | Native GTK/KDE dialog | Full support |
| ChromeOS | Native Files app dialog | Full support |

---

## Tech Stack

| Technology | Purpose |
|:-----------|:--------|
| **Chrome Extension Manifest V3** | Modern extension architecture |
| **Vanilla JavaScript (ES6+)** | No frameworks, no build step, no dependencies |
| **File System Access API** | Native OS file and folder operations |
| **IndexedDB** | Persistent storage for folder handles, file cache, and recents |
| **CSS Custom Properties** | Consistent dark theme with smooth transitions |

## Project Structure

```
PDFwidgetExtension/
  manifest.json   Extension config (Manifest V3, Chrome 86+)
  background.js   Service worker (placeholder)
  popup.html      UI markup + embedded CSS (dark theme, CSS Grid layout)
  popup.js        All application logic (~550 lines)
```

## Permissions

| Permission | Reason |
|:-----------|:-------|
| `storage` | Save extension preferences |
| `tabs` | Open PDFs in new browser tabs |

No host permissions. No remote requests. No analytics. **Everything runs locally.**

---

<div align="center">

## License

MIT

<br>

Made with :heart: for PDF hoarders everywhere.

</div>
