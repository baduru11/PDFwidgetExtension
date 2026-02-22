const list = document.getElementById('file-list');
const recentList = document.getElementById('recent-list');
const recentSection = document.getElementById('recent-section');
const breadcrumbs = document.getElementById('breadcrumbs');
const btnSelect = document.getElementById('btn-select');
const btnBack = document.getElementById('btn-back');
const btnRefresh = document.getElementById('btn-refresh');
const searchBar = document.getElementById('search-bar');
const headerCols = document.querySelectorAll('.header-col');
const contextMenu = document.getElementById('context-menu');
const globalStatus = document.getElementById('global-status');

const isMac = navigator.userAgentData?.platform === 'macOS'
    || navigator.platform?.toUpperCase().includes('MAC')
    || navigator.userAgent.includes('Mac');

let allEntries = [];
let dirStack = [];
let currentHandle = null;
let sortBy = 'date';
let sortDesc = true;
let selectedIndex = -1;
let rightClickedEntry = null;

// 1. INITIAL LOAD
const isPickerMode = new URLSearchParams(window.location.search).has('picker');

document.addEventListener('DOMContentLoaded', async () => {
    if (isPickerMode) return runPickerMode();
    try {
        const folderHandle = await getSavedFolder();
        if (folderHandle) {
            currentHandle = folderHandle;
            // Always show cached data first (populated by the helper window)
            const cached = await getCache("root");
            if (cached.length) renderList(cached);
            // Try live access — may fail if permission expired
            try {
                const perm = await folderHandle.queryPermission({ mode: 'read' });
                if (perm === 'granted') {
                    await loadFiles(folderHandle);
                } else if (!cached.length) {
                    showUnlockUI(folderHandle);
                }
            } catch (e) {
                if (!cached.length) showUnlockUI(folderHandle);
            }
        } else {
            showNoFolderMessage();
        }
        await loadRecentFiles();
    } catch (err) {
        console.error("Init failed:", err);
        showNoFolderMessage();
    }
});

function showNoFolderMessage() {
    list.innerHTML = '<li style="text-align:center; padding:20px; color:#888; font-size:11px;">No folder selected. Click <b>Change &#128194;</b> to pick one.</li>';
}

// 2. FOLDER SELECTION
// Chrome kills extension popups when native dialogs steal focus,
// so we open a tiny helper window where the picker can run safely.
btnSelect.onclick = () => {
    chrome.windows.create({
        url: chrome.runtime.getURL('popup.html?picker=1'),
        type: 'popup', width: 360, height: 140, focused: true
    });
};

function runPickerMode() {
    document.body.style.cssText = 'width:auto;height:auto;display:flex;align-items:center;justify-content:center;background:#121212;margin:0;';
    document.body.innerHTML = `
        <div style="text-align:center;padding:20px;">
            <button id="btn-pick" autofocus style="
                background:#0a84ff;color:#fff;border:none;padding:12px 28px;
                border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;
                font-family:system-ui,sans-serif;
            ">Select Folder \ud83d\udcc2</button>
            <div id="pick-status" style="margin-top:12px;font-size:12px;color:#888;font-family:system-ui,sans-serif;"></div>
        </div>`;
    document.getElementById('btn-pick').onclick = async () => {
        const status = document.getElementById('pick-status');
        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            status.textContent = 'Saving folder...';
            await saveFolder(dirHandle);

            // Cache file listing while we have permission, so the popup
            // can show files immediately without needing its own permission
            status.textContent = 'Scanning files...';
            const entries = [];
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'directory' || (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf'))) {
                    let lastModified = 0;
                    if (entry.kind === 'file') {
                        const file = await entry.getFile();
                        lastModified = file.lastModified;
                    }
                    entries.push({ name: entry.name, kind: entry.kind, lastModified });
                }
            }
            await saveCache("root", entries);

            status.style.color = '#34c759';
            status.textContent = '\u2713 Done! Reopen the widget.';
            setTimeout(() => window.close(), 800);
        } catch (err) {
            if (err.name === 'AbortError') {
                status.textContent = 'Cancelled. Try again or close this window.';
            } else {
                status.style.color = '#ff453a';
                status.textContent = 'Error: ' + err.message;
            }
        }
    };
}

btnBack.onclick = () => goBack();
btnRefresh.onclick = async () => {
    if (!currentHandle) {
        showNoFolderMessage();
        return;
    }
    btnRefresh.classList.add('spinning');
    searchBar.value = '';
    globalStatus.textContent = '';

    try {
        const status = await currentHandle.requestPermission({ mode: 'read' });
        if (status === 'granted') {
            await loadFiles(currentHandle);
        }
    } catch(e) {
        console.error("Refresh failed:", e);
    } finally {
        setTimeout(() => btnRefresh.classList.remove('spinning'), 600);
    }
};

headerCols.forEach(col => {
    col.onclick = () => {
        const field = col.dataset.sort;
        if (sortBy === field) sortDesc = !sortDesc;
        else { sortBy = field; sortDesc = field === 'date'; }
        updateSortUI();
        loadFiles(currentHandle);
    };
});

function updateSortUI() {
    headerCols.forEach(col => {
        col.classList.toggle('active', col.dataset.sort === sortBy);
        const icon = col.querySelector('.sort-icon');
        if (icon) icon.textContent = sortBy === col.dataset.sort ? (sortDesc ? ' \u2193' : ' \u2191') : '';
    });
}

function goBack() {
    if (dirStack.length > 0) {
        currentHandle = dirStack.pop();
        loadFiles(currentHandle);
    }
}

// Keyboard Navigation
document.addEventListener('keydown', (e) => {
    if (document.activeElement === searchBar) {
        if (e.key === 'Enter') { searchBar.blur(); if (allEntries.length > 0) selectItem(0); }
        return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); selectItem(selectedIndex + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selectItem(selectedIndex - 1); }
    else if (e.key === 'Enter') {
        const items = list.querySelectorAll('.file-item');
        if (selectedIndex >= 0 && items[selectedIndex]) items[selectedIndex].click();
    }
    else if (
        e.key === 'Backspace' ||
        (e.key === 'ArrowLeft' && (e.altKey || e.metaKey)) ||
        (e.key === '[' && (isMac ? e.metaKey : e.ctrlKey))
    ) {
        if (document.activeElement !== searchBar) {
            e.preventDefault();
            goBack();
        }
    }
    else if (e.key === '/') { e.preventDefault(); searchBar.focus(); }
});

function selectItem(index) {
    const items = list.querySelectorAll('.file-item');
    if (items.length === 0) return;
    if (index < 0) index = items.length - 1;
    if (index >= items.length) index = 0;
    selectedIndex = index;
    items.forEach((item, i) => {
        item.classList.toggle('selected', i === index);
        if (i === index) item.scrollIntoView({ block: 'nearest' });
    });
}

async function loadFiles(dirHandle) {
    const isRoot = dirStack.length === 0;
    const cacheKey = isRoot ? "root" : dirHandle.name;
    btnBack.style.display = isRoot ? 'none' : 'flex';
    renderBreadcrumbs();
    selectedIndex = -1;
    updateSortUI();

    try {
        let entries = [];
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'directory' || (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf'))) {
                if (entry.kind === 'file') {
                    const file = await entry.getFile();
                    entry.lastModified = file.lastModified;
                } else { entry.lastModified = 0; }
                entries.push(entry);
            }
        }

        entries.sort((a, b) => {
            if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
            let res = 0;
            if (sortBy === 'name') res = a.name.localeCompare(b.name);
            else if (sortBy === 'date') {
                res = (a.lastModified || 0) - (b.lastModified || 0);
                if (res === 0) res = a.name.localeCompare(b.name);
            }
            return sortDesc ? -res : res;
        });

        allEntries = entries;
        saveCache(cacheKey, allEntries);
        renderList(allEntries);
    } catch (err) {
        const cached = await getCache(cacheKey);
        if (cached.length) renderList(cached);
        else if (isRoot) showUnlockUI(dirHandle);
    }
}

function renderBreadcrumbs() {
    breadcrumbs.innerHTML = '';
    const fullPath = [...dirStack, currentHandle];
    fullPath.forEach((handle, index) => {
        if (!handle) return;
        const span = document.createElement('span');
        span.className = 'breadcrumb-item';
        span.textContent = (handle.name || 'Folder') + (index < fullPath.length - 1 ? ' > ' : '');
        span.onclick = () => {
            if (index < fullPath.length - 1) {
                dirStack = dirStack.slice(0, index);
                currentHandle = handle;
                loadFiles(currentHandle);
            }
        };
        breadcrumbs.appendChild(span);
    });
}

function escapeHtml(str) {
    return str.replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'": '&#39;' })[c]);
}

function highlightText(text, term) {
    const escaped = escapeHtml(text);
    if (!term) return escaped;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<span class="highlight">$1</span>');
}

function renderList(entries, targetList = list) {
    const term = targetList === list ? searchBar.value.toLowerCase() : '';
    targetList.innerHTML = entries.length ? '' : '<li style="text-align:center; padding:20px; color:#444; font-size:11px;">Empty</li>';

    entries.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = `file-item ${entry.kind === 'directory' ? 'folder' : ''} animate-in`;
        li.title = entry.name;

        const dateStr = entry.lastModified ? new Date(entry.lastModified).toLocaleDateString([], {month:'numeric', day:'numeric', year:'2-digit'}) : '--';
        const displayName = highlightText(entry.name, term);
        const pathInfo = entry.relativePath ? `<div class="file-path">${escapeHtml(entry.relativePath)}</div>` : '';

        li.innerHTML = `
            <div class="file-name">
                <div class="name-row">
                    <span>${entry.kind === 'directory' ? '\ud83d\udcc1' : '\ud83d\udcc4'}</span>
                    <span class="name-text">${displayName}</span>
                </div>
                ${pathInfo}
            </div>
            <div class="file-date">${dateStr}</div>
        `;

        li.onclick = () => handleEntryClick(entry, false);
        li.onauxclick = (e) => { if (e.button === 1) handleEntryClick(entry, true); };
        li.onmousedown = (e) => { if (e.button === 1) e.preventDefault(); };
        li.oncontextmenu = (e) => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, entry);
        };

        targetList.appendChild(li);
    });
}

// Global Recursive Search
async function performGlobalSearch(term) {
    if (!term) {
        globalStatus.textContent = '';
        selectedIndex = -1;
        renderList(allEntries);
        return;
    }

    globalStatus.textContent = 'Searching...';
    const results = [];
    const root = dirStack[0] || currentHandle;
    if (!root) return;

    async function search(handle, relativePath = '') {
        for await (const entry of handle.values()) {
            if (entry.name.toLowerCase().includes(term)) {
                const e = entry;
                e.parentHandle = handle;
                if (e.kind === 'file' && e.name.toLowerCase().endsWith('.pdf')) {
                    const file = await e.getFile();
                    e.lastModified = file.lastModified;
                    e.relativePath = relativePath;
                    results.push(e);
                } else if (e.kind === 'directory') {
                    e.lastModified = 0;
                    e.relativePath = relativePath;
                    results.push(e);
                }
            }
            if (entry.kind === 'directory') {
                try {
                    await search(entry, (relativePath ? relativePath + '/' : '') + entry.name);
                } catch(e) {}
            }
        }
    }

    await search(root);
    globalStatus.textContent = `${results.length} found`;
    selectedIndex = -1;
    renderList(results);
}

let searchTimeout = null;
searchBar.oninput = () => {
    clearTimeout(searchTimeout);
    const term = searchBar.value.toLowerCase();
    if (term.length > 1) {
        globalStatus.textContent = 'Searching...';
        searchTimeout = setTimeout(() => performGlobalSearch(term), 300);
    } else {
        globalStatus.textContent = '';
        selectedIndex = -1;
        const filtered = allEntries.filter(e => e.name.toLowerCase().includes(term));
        renderList(filtered);
    }
};

// Context Menu Logic
function showContextMenu(x, y, entry) {
    rightClickedEntry = entry;
    contextMenu.style.display = 'block';

    const menuWidth = 150;
    const menuHeight = 200;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    contextMenu.style.left = (x + menuWidth > winWidth ? x - menuWidth : x) + 'px';
    contextMenu.style.top = (y + menuHeight > winHeight ? y - menuHeight : y) + 'px';
}

document.onclick = () => { contextMenu.style.display = 'none'; };

contextMenu.onclick = async (e) => {
    const action = e.target.closest('.menu-item')?.dataset.action;
    if (!action || !rightClickedEntry) return;

    switch(action) {
        case 'open':
            handleEntryClick(rightClickedEntry, false);
            break;
        case 'rename':
            handleRename(rightClickedEntry);
            break;
        case 'copyname':
            const cleanName = rightClickedEntry.name.replace(/\.pdf$/i, '');
            try {
                await navigator.clipboard.writeText(cleanName);
            } catch {
                // Fallback for restricted clipboard contexts
                const ta = document.createElement('textarea');
                ta.value = cleanName;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
            }
            break;
        case 'delete':
            if (confirm(`Permanently delete "${rightClickedEntry.name}"?\n\nThis cannot be undone and will not go to the Recycle Bin/Trash.`)) {
                try {
                    let parent;
                    if ('relativePath' in rightClickedEntry && !rightClickedEntry.parentHandle) {
                        parent = await resolveRecentParent(rightClickedEntry, 'readwrite');
                    } else {
                        parent = rightClickedEntry.parentHandle || currentHandle;
                        const status = await parent.requestPermission({ mode: 'readwrite' });
                        if (status !== 'granted') break;
                    }
                    if (!parent) break;
                    await parent.removeEntry(rightClickedEntry.name, { recursive: true });
                    // Remove from recent files if it was a recent entry
                    if ('relativePath' in rightClickedEntry) {
                        const recent = await getRecentFiles();
                        const updated = recent.filter(f => f.name !== rightClickedEntry.name);
                        const db = await openDB();
                        await new Promise((resolve, reject) => {
                            const tx = db.transaction("cache", "readwrite");
                            tx.objectStore("cache").put(updated, "recent_files");
                            tx.oncomplete = () => resolve();
                            tx.onerror = () => reject(tx.error);
                        });
                        await loadRecentFiles();
                    }
                    await loadFiles(currentHandle);
                } catch(err) { alert("Delete failed: " + err.message); }
            }
            break;
    }
};

async function handleRename(entry) {
    if (!entry.getFile && !entry.move) {
        // Recent entry — resolve parent via relativePath
        if ('relativePath' in entry) {
            const parent = await resolveRecentParent(entry, 'readwrite');
            if (!parent) return;
            try {
                const real = await parent.getFileHandle(entry.name);
                real.parentHandle = parent;
                handleRename(real);
            } catch { return; }
            return;
        }
        // Cached entry from current directory
        const status = await currentHandle.requestPermission({ mode: 'readwrite' });
        if (status === 'granted') {
            await loadFiles(currentHandle);
            const real = allEntries.find(e => e.name === entry.name);
            if (real) handleRename(real);
        }
        return;
    }

    let newName = prompt(`Rename "${entry.name}" to:`, entry.name);
    if (newName && newName !== entry.name) {
        if (entry.kind === 'file' && !newName.toLowerCase().endsWith('.pdf')) {
            newName += '.pdf';
        }
        try {
            const parent = entry.parentHandle || currentHandle;
            // prompt() blocks the thread and can expire Chrome's transient
            // user activation, so fall back to queryPermission (no activation
            // needed) — readwrite is typically already granted by the picker
            let status;
            try {
                status = await parent.requestPermission({ mode: 'readwrite' });
            } catch {
                status = await parent.queryPermission({ mode: 'readwrite' });
            }
            if (status !== 'granted') {
                alert("Write permission expired. Please re-select the folder via Unlock.");
                return;
            }

            if (entry.move) {
                await entry.move(newName);
            } else if (entry.kind === 'file') {
                const oldFile = await entry.getFile();
                const newFileHandle = await parent.getFileHandle(newName, { create: true });
                const writable = await newFileHandle.createWritable();
                await writable.write(oldFile);
                await writable.close();
                await parent.removeEntry(entry.name);
            } else {
                alert("Folder renaming not supported in this browser.");
                return;
            }
            await loadFiles(currentHandle);
        } catch (err) { alert("Rename error: " + err.message); }
    }
}

// Resolve the parent directory of a recent entry by traversing relativePath from root
async function resolveRecentParent(entry, mode = 'read') {
    const rootHandle = dirStack[0] || currentHandle;
    try {
        const status = await rootHandle.requestPermission({ mode });
        if (status !== 'granted') return null;
    } catch { return null; }

    let targetDir = rootHandle;
    if (entry.relativePath) {
        for (const part of entry.relativePath.split('/').filter(Boolean)) {
            try {
                targetDir = await targetDir.getDirectoryHandle(part);
            } catch { return null; }
        }
    }
    return targetDir;
}

async function handleEntryClick(entry, isMiddleClick = false) {
    if (!entry.queryPermission) {
        // Recent entry with stored path — traverse to the correct parent directory
        if ('relativePath' in entry) {
            const parent = await resolveRecentParent(entry);
            if (!parent) return;
            try {
                const fileHandle = await parent.getFileHandle(entry.name);
                const file = await fileHandle.getFile();
                const blobUrl = URL.createObjectURL(file);
                chrome.tabs.create({ url: blobUrl });
                setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                if (!isMiddleClick) setTimeout(() => window.close(), 100);
            } catch { return; }
            return;
        }

        // Cached entry from current directory — reload and resolve to real handle
        const status = await currentHandle.requestPermission({ mode: 'read' });
        if (status === 'granted') {
            await loadFiles(currentHandle);
            const real = allEntries.find(e => e.name === entry.name);
            if (real) handleEntryClick(real, isMiddleClick);
        }
        return;
    }
    if (entry.kind === 'directory') {
        if (isMiddleClick) return;
        dirStack.push(currentHandle); currentHandle = entry; loadFiles(entry);
    } else {
        const file = await entry.getFile();
        await saveRecentFile(entry);
        const blobUrl = URL.createObjectURL(file);
        chrome.tabs.create({ url: blobUrl });
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        if (!isMiddleClick) setTimeout(() => window.close(), 100);
    }
}

// --- HELPERS ---
async function saveRecentFile(entry) {
    const db = await openDB();
    const recent = await getRecentFiles();
    const filtered = recent.filter(f => f.name !== entry.name);
    // Path from root to the file's parent: skip root (dirStack[0]), include currentHandle
    const pathParts = dirStack.slice(1).concat(dirStack.length > 0 ? [currentHandle] : []);
    const path = pathParts.map(h => h.name).join('/');
    filtered.unshift({ name: entry.name, kind: 'file', lastModified: entry.lastModified || Date.now(), relativePath: path });
    await new Promise((resolve, reject) => {
        const tx = db.transaction("cache", "readwrite");
        tx.objectStore("cache").put(filtered.slice(0, 3), "recent_files");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    await loadRecentFiles();
}
async function getRecentFiles() {
    const db = await openDB();
    return new Promise(res => db.transaction("cache").objectStore("cache").get("recent_files").onsuccess = e => res(e.target.result || []));
}
async function loadRecentFiles() {
    const recent = await getRecentFiles();
    if (recent.length > 0) { recentSection.style.display = 'block'; renderList(recent, recentList); }
    else recentSection.style.display = 'none';
}

function showUnlockUI(handle) {
    list.innerHTML = `<div style="padding:40px; text-align:center;">
        <p style="color:#888;font-size:11px;margin-bottom:12px;">Folder access expired. Re-grant permission:</p>
        <button id="btn-unlock" class="btn-primary">\ud83d\udd13 Unlock Folder</button>
    </div>`;
    document.getElementById('btn-unlock').onclick = () => {
        // requestPermission() kills the popup (same as showDirectoryPicker),
        // so re-grant via the helper window which survives focus loss
        chrome.windows.create({
            url: chrome.runtime.getURL('popup.html?picker=1'),
            type: 'popup', width: 360, height: 140, focused: true
        });
    };
}

async function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open("PDF_Manager_DB", 2);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains("handles")) db.createObjectStore("handles");
            if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache");
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("Database blocked by another connection"));
    });
}
async function saveFolder(h) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("handles", "readwrite");
        tx.objectStore("handles").put(h, "lastFolder");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
async function getSavedFolder() {
    const db = await openDB(); return new Promise(res => db.transaction("handles").objectStore("handles").get("lastFolder").onsuccess = e => res(e.target.result));
}
async function saveCache(path, entries) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("cache", "readwrite");
        tx.objectStore("cache").put(entries.map(e => ({ name: e.name, kind: e.kind, lastModified: e.lastModified || 0 })), path);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
async function getCache(path) {
    const db = await openDB(); return new Promise(res => db.transaction("cache").objectStore("cache").get(path).onsuccess = e => res(e.target.result || []));
}
