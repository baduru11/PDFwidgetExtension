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

let allEntries = [];
let dirStack = [];
let currentHandle = null;
let sortBy = 'date';
let sortDesc = true;
let selectedIndex = -1;
let rightClickedEntry = null;

// 1. INITIAL LOAD
document.addEventListener('DOMContentLoaded', async () => {
    const folderHandle = await getSavedFolder();
    if (folderHandle) {
        currentHandle = folderHandle;
        const cached = await getCache("root");
        if (cached.length) renderList(cached);
        loadFiles(folderHandle);
    }
    loadRecentFiles();
});

// 2. LISTENERS
btnSelect.onclick = async () => {
    try {
        const dirHandle = await window.showDirectoryPicker();
        await saveFolder(dirHandle);
        dirStack = [];
        currentHandle = dirHandle;
        loadFiles(dirHandle);
    } catch (err) {}
};

btnBack.onclick = () => goBack();
btnRefresh.onclick = async () => {
    btnRefresh.classList.add('spinning');
    searchBar.value = ''; // Clear search on refresh
    globalStatus.textContent = '';
    
    // Force permission check before loading
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
        if (icon) icon.textContent = sortBy === col.dataset.sort ? (sortDesc ? ' ↓' : ' ↑') : '';
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
    else if (e.key === 'Backspace' || (e.key === 'ArrowLeft' && (e.altKey || e.metaKey))) {
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
            let res = 0;
            if (sortBy === 'name') res = a.name.localeCompare(b.name);
            else if (sortBy === 'date') res = (a.lastModified || 0) - (b.lastModified || 0);
            if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
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

function highlightText(text, term) {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function renderList(entries, targetList = list) {
    const term = targetList === list ? searchBar.value.toLowerCase() : '';
    targetList.innerHTML = entries.length ? '' : '<li style="text-align:center; padding:20px; color:#444; font-size:11px;">Empty</li>';
    
    entries.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = `file-item ${entry.kind === 'directory' ? 'folder' : ''} animate-in`;
        li.title = entry.fullPath || entry.name;
        
        const dateStr = entry.lastModified ? new Date(entry.lastModified).toLocaleDateString([], {month:'numeric', day:'numeric', year:'2-digit'}) : '--';
        const displayName = highlightText(entry.name, term);
        const pathInfo = entry.relativePath ? `<div class="file-path">${entry.relativePath}</div>` : '';

        li.innerHTML = `
            <div class="file-name">
                <div class="name-row">
                    <span>${entry.kind === 'directory' ? '📁' : '📄'}</span>
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
        renderList(allEntries);
        return;
    }

    globalStatus.textContent = 'Searching...';
    const results = [];
    const root = dirStack[0] || currentHandle;

    async function search(handle, relativePath = '') {
        for await (const entry of handle.values()) {
            if (entry.name.toLowerCase().includes(term)) {
                const e = entry;
                e.parentHandle = handle; // Store parent for rename/delete
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
    renderList(results);
}

searchBar.oninput = () => {
    const term = searchBar.value.toLowerCase();
    if (term.length > 1) {
        performGlobalSearch(term);
    } else {
        globalStatus.textContent = '';
        const filtered = allEntries.filter(e => e.name.toLowerCase().includes(term));
        renderList(filtered);
    }
};

// Context Menu Logic
function showContextMenu(x, y, entry) {
    rightClickedEntry = entry;
    contextMenu.style.display = 'block';
    
    // Adjust position if near edges
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
            // Copy name without .pdf extension
            const cleanName = rightClickedEntry.name.replace(/\.pdf$/i, '');
            navigator.clipboard.writeText(cleanName);
            break;
        case 'delete':
            if (confirm(`Permanently delete "${rightClickedEntry.name}"?\n\nThis cannot be undone and will not go to the Recycle Bin/Trash.`)) {
                try {
                    const status = await currentHandle.requestPermission({ mode: 'readwrite' });
                    if (status === 'granted') {
                        await currentHandle.removeEntry(rightClickedEntry.name, { recursive: true });
                        loadFiles(currentHandle);
                    }
                } catch(err) { alert("Delete failed: " + err.message); }
            }
            break;
    }
};

async function handleRename(entry) {
    // 1. Hydrate if cached (no getFile or move method)
    if (!entry.getFile && !entry.move) {
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
        // Ensure .pdf extension for files
        if (entry.kind === 'file' && !newName.toLowerCase().endsWith('.pdf')) {
            newName += '.pdf';
        }
        try {
            // Use parentHandle if from search, otherwise currentHandle
            const parent = entry.parentHandle || currentHandle;
            const status = await parent.requestPermission({ mode: 'readwrite' });
            if (status !== 'granted') return;

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
            loadFiles(currentHandle);
        } catch (err) { alert("Rename error: " + err.message); }
    }
}

async function handleEntryClick(entry, isMiddleClick = false) {
    if (!entry.queryPermission) {
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
        saveRecentFile(entry);
        chrome.tabs.create({ url: URL.createObjectURL(file) });
        if (!isMiddleClick) setTimeout(() => window.close(), 100);
    }
}

// --- HELPERS ---
async function saveRecentFile(entry) {
    const db = await openDB();
    const recent = await getRecentFiles();
    const filtered = recent.filter(f => f.name !== entry.name);
    // Include path for context
    const path = dirStack.map(h => h.name).join('/');
    filtered.unshift({ name: entry.name, kind: 'file', lastModified: entry.lastModified || Date.now(), relativePath: path });
    db.transaction("cache", "readwrite").objectStore("cache").put(filtered.slice(0, 3), "recent_files");
    loadRecentFiles();
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
    list.innerHTML = `<div style="padding:40px; text-align:center;"><button id="btn-unlock" class="btn-restore">🔓 Unlock Folder</button></div>`;
    document.getElementById('btn-unlock').onclick = async () => {
        const status = await handle.requestPermission({ mode: 'read' });
        if (status === 'granted') loadFiles(handle);
    };
}

async function openDB() {
    return new Promise(res => {
        const req = indexedDB.open("PDF_Manager_DB", 2);
        req.onupgradeneeded = (e) => {
            const db = req.result;
            if (!db.objectStoreNames.contains("handles")) db.createObjectStore("handles");
            if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache");
        };
        req.onsuccess = () => res(req.result);
    });
}
async function saveFolder(h) {
    const db = await openDB(); db.transaction("handles", "readwrite").objectStore("handles").put(h, "lastFolder");
}
async function getSavedFolder() {
    const db = await openDB(); return new Promise(res => db.transaction("handles").objectStore("handles").get("lastFolder").onsuccess = e => res(e.target.result));
}
async function saveCache(path, entries) {
    const db = await openDB();
    db.transaction("cache", "readwrite").objectStore("cache").put(entries.map(e => ({ name: e.name, kind: e.kind, lastModified: e.lastModified || 0 })), path);
}
async function getCache(path) {
    const db = await openDB(); return new Promise(res => db.transaction("cache").objectStore("cache").get(path).onsuccess = e => res(e.target.result || []));
}
