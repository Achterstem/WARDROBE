// ==UserScript==
// @name         WARDROBE
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Гардероб, позволяющий примерить костюмы и содержащий в себе библиотеку костюмов.
// @author       RESSOR
// @match        http*://*.catwar.net/rabbit*
// @match        http*://*.catwar.su/rabbit*
// @match        http*://*.catwar.net/settings_costumes*
// @match        http*://*.catwar.su/settings_costumes*
// @updateURL    https://raw.githubusercontent.com/Achterstem/WARDROBE/main/wardrobe.user.js
// @downloadURL  https://raw.githubusercontent.com/Achterstem/WARDROBE/main/wardrobe.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=catwar.su
// @license      MIT
// @grant        none
// ==/UserScript==

const QUICK_CATEGORIES = [
    { name: "МИФИЧЕСКИЕ ЗВЕРИ", id: 12025 }, { name: "ЕГИПЕТ", id: 12053 },
    { name: "ТЁМНОЕ ФЭНТЕЗИ", id: 12119 },   { name: "ГОБЛИНКОР", id: 12335 },
    { name: "САМОЦВЕТЫ", id: 12389 },         { name: "МОРСКИЕ ГЛУБИНЫ", id: 12427 },
    { name: "ДОЛИНА ГРЁЗ", id: 12468 },       { name: "ОТТЕПЕЛЬ", id: 12524 },
    { name: "КОСМОС", id: 12604 },            { name: "СТИМПАНК", id: 12967 },
    { name: "ЯПОНИЯ", id: 13571 },            { name: "ДЖУНГЛИ", id: 13742 },
    { name: "ПИРАТЫ", id: 100000 },           { name: "ПРАЗДНИК УРОЖАЯ", id: 100494 },
    { name: "МАСКАРАД", id: 100634 },         { name: "ДИКИЙ ЗАПАД", id: 100929 },
    { name: "ЗИМНЯЯ СКАЗКА", id: 101431 },    { name: "ТЁМНЫЕ ПРОРОЧЕСТВА", id: 101970 },
    { name: "ПЕРВОБЫТНЫЙ МИР", id: 102899 },  { name: "МГНОВЕНИЯ ВЕСНЫ", id: 103309 },
    { name: "ПУТЕШЕСТВИЕ В КОСМОС", id: 103644 }, { name: "КИБЕРПАНК", id: 103813 },
    { name: "В ПОКОЯХ ЛЕСА", id: 104273 }
];

const THEMES = {
    dark: {
        gold: '#a29b8b', goldDim: '#7a6230', bg: '#1d1c19', panel: '#2d2b28',
        glass: 'rgba(255,255,255,0.03)', border: '#3c3932', borderHi: 'rgba(201,168,76,0.7)',
        text: '#e8dfc8', muted: '#998e7c', red: '#8b2020', shadow: 'rgba(0,0,0,.6)',
        labelBg: 'rgba(0,0,0,.65)', thumbHoverBg: 'rgba(201,168,76,0.06)',
    },
    light: {
        gold: '#695d45', goldDim: '#c9a84c', bg: '#d7d3c8', panel: '#cbc5b8',
        glass: 'rgba(0,0,0,0.03)', border: '#b4ab9b', borderHi: 'rgba(154,110,26,0.75)',
        text: '#2c2416', muted: '#5e5645', red: '#b03030', shadow: 'rgba(0,0,0,.18)',
        labelBg: '#dfd8cf', thumbHoverBg: 'rgba(154,110,26,0.07)',
    }
};

let currentTheme = localStorage.getItem('wd-theme') || 'dark';
let C = { ...THEMES[currentTheme] };
let DEFAULT_MODEL_URL = '';
let layerCounter = 0;
let pendingUrl = { model: null, costume: null };
let searchStartID = 1;
let searchItemsPerPage = 40;
let activeLayers = [];

function applyTheme(theme) {
    currentTheme = theme;
    C = { ...THEMES[theme] };
    localStorage.setItem('wd-theme', theme);
    rebuildPanel();
}

function injectStyles() {
    const style = document.createElement('style');
    style.id = 'wd-style';
    style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Jost:wght@300;400&display=swap');
        #try-on-panel-wrapper * { font-family: 'Jost', sans-serif; }
        #try-on-panel-wrapper h2, #try-on-panel-wrapper .wd-title { font-family: 'Cinzel', serif; }
        #try-on-panel-wrapper input:focus { border-color: ${C.gold} !important; outline: none; }
        #try-on-panel-wrapper button:hover { border-color: ${C.gold} !important; color: ${C.gold} !important; }
        .sortable-ghost { opacity: .4; background: ${C.glass}; border-radius: 2px; }
        @keyframes wd-fade-in { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        #try-on-panel-content { animation: wd-fade-in .25s ease; }
        #wd-theme-toggle {
            border: 2px solid ${C.gold}; color: ${C.gold};
            font-size: 14px; cursor: pointer; padding: 3px 7px; border-radius: 50px;
            transition: border-color .15s, color .15s; line-height: 1.4; flex-shrink: 0;
        }
        #wd-theme-toggle:hover { border-color: ${C.gold} !important; color: ${C.gold} !important; background-color: ${C.bg} !important; }
        @media (max-width: 768px) {
            .w-flex { flex-direction: column !important; align-items: stretch !important; }
            #control-col { margin-right: 0 !important; margin-bottom: 20px !important; }
            .s-ctrl { flex-direction: column !important; gap: 8px !important; }
            .s-ctrl > * { width: 100% !important; box-sizing: border-box; }
        }
    `;
    document.head.appendChild(style);
}

const thumbCSS = (url, h) =>
    `width:100%;height:${h};background:url('${url}') center/contain no-repeat;` +
    `cursor:pointer;border:1px solid ${C.border};border-radius:2px;box-sizing:border-box;` +
    `transition:border-color .15s,background-color .15s;`;

function loaderHTML(type, title, withRestore) {
    const inputS = `width:100%;padding:5px 8px;background:${C.bg};color:${C.text};border:1px solid ${C.border};` +
        `border-radius:2px;font-size:16px;box-sizing:border-box;outline:none;font-family:inherit;`;
    const btnS = col => `width:100%;padding:5px 8px;background:${col};color:${C.text};border:1px solid ${C.border};` +
        `border-radius:2px;cursor:pointer;font-size:16px;letter-spacing:.06em;font-family:inherit;transition:border-color .15s,color .15s;`;
    return `
        <div style="margin-bottom:6px;order:${type === 'model' ? 3 : 4};">
            <div id="${type}-loader-header" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:6px 0;border-top:1px solid ${C.border};">
                <span style="font-size:12px;font-weight:bolder;letter-spacing:.12em;color:${C.muted};text-transform:uppercase;">${title}</span>
                <button id="${type}-loader-toggle-btn" style="background:none;border:none;color:${C.gold};font-size:12px;cursor:pointer;padding:0;">▸</button>
            </div>
            <div id="${type}-loader-content" style="display:none;padding:6px 0;">
                <input type="text" id="${type}-url-input" placeholder="URL изображения" style="${inputS} margin-bottom:5px;">
                <input type="file" id="${type}-file-input" style="display:none;" accept="image/png,image/jpeg">
                <button id="${type}-select-file-btn" style="${btnS(C.glass)} margin-bottom:4px;">выбрать файл</button>
                ${withRestore ? `<button id="restore-model-btn" style="${btnS(C.glass)}">вернуть оригинал</button>` : ''}
            </div>
        </div>`;
}

function buildPanelInnerHTML(modelSrc) {
    const quickBtns = QUICK_CATEGORIES.map(cat =>
        `<button onclick="document.getElementById('search-start-id-input').value='${cat.id}';document.getElementById('search-range-btn').click();"
            style="padding:3px 8px;font-size:14px;letter-spacing:.08em;background:${C.glass};color:${C.muted};border:1px solid ${C.border};border-radius:2px;cursor:pointer;transition:border-color .15s,color .15s;font-family:inherit;">
            ${cat.name}</button>`
    ).join('');

    return `
        <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,${C.gold},transparent);"></div>
        <div id="main-panel-header" style="display:flex;align-items:center;cursor:pointer;padding:14px 0;gap:12px;">
            <button id="main-panel-toggle-btn" style="background:none;border:none;color:${C.gold};font-size:16px;cursor:pointer;padding:0;line-height:1;transition:transform .2s;">▸</button>
            <h2 class="wd-title" style="font-size:13px;margin:0;color:${C.gold};letter-spacing:.2em;font-weight:600;">ПРИМЕРКА КОСТЮМОВ</h2>
            <div style="flex-grow:1;height:1px;background:linear-gradient(90deg,${C.border},transparent);margin-left:8px;"></div>
            <button id="wd-theme-toggle" title="${currentTheme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}">${currentTheme === 'dark' ? '☀' : '☾'}</button>
        </div>
        <div id="try-on-panel-content" style="display:none;flex-direction:column;padding-bottom:20px;">
            <div class="w-flex" style="display:flex;align-items:flex-start;gap:24px;">
                <div id="control-col" style="display:flex;flex-direction:column;align-items:stretch;flex-shrink:0;width:190px;">
                    <div style="text-align:center;margin-bottom:16px;">
                        <div style="font-size:12px;letter-spacing:.18em;color:${C.muted};margin-bottom:35px;text-transform:uppercase;">предпросмотр</div>
                        <div class="try-on-container" style="position:relative;width:100px;height:150px;margin:0 auto 20px;transform:scale(1.4);transform-origin:center;">
                            <img id="player-model" src="${modelSrc}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;z-index:1;">
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;">
                        ${loaderHTML('model', 'Заменить модель', true)}
                        ${loaderHTML('costume', 'Загрузить костюм', false)}
                    </div>
                    <div style="margin-top:10px;">
                        <div style="font-size:12px;letter-spacing:.18em;color:${C.muted};margin-bottom:6px;text-transform:uppercase;">слои</div>
                        <div id="try-on-controller-panel" style="max-height:320px;overflow-y:auto;padding:4px;background:${C.bg};border:1px solid ${C.border};border-radius:3px;">
                            <p style="font-style:italic;color:${C.muted};font-size:13px;text-align:center;padding:10px 0;margin:0;">нажмите на костюмы</p>
                        </div>
                    </div>
                </div>
                <div style="flex-grow:1;min-width:0;">
                    <div style="font-size:12px;letter-spacing:.18em;color:${C.muted};margin-bottom:8px;text-transform:uppercase;">костюмы на странице</div>
                    <div id="try-on-thumbnails" style="display:grid;grid-template-columns:repeat(1,1fr);gap:3px;padding:8px;background:${C.bg};border:1px solid ${C.border};border-radius:3px;width:100%;box-sizing:border-box;"></div>
                </div>
            </div>
            <div style="margin-top:20px;border-top:4px solid ${C.border};padding-top:14px;">
                <div id="costume-search-header" style="display:flex;align-items:center;background:linear-gradient(to right,${C.border} 0%,transparent 100%);padding:10px;font-weight:600;border-radius:15px;cursor:pointer;gap:10px;margin-bottom:4px;">
                    <button id="costume-search-toggle-btn" style="background:none;border:none;color:${C.gold};font-size:14px;cursor:pointer;padding:0;line-height:1;">▸</button>
                    <span class="wd-title" style="font-size:13px;letter-spacing:.2em;color:${C.gold};">ПОИСК КОСТЮМОВ</span>
                </div>
                <div id="costume-search-content" style="display:none;padding-top:12px;">
                    <div id="quick-panel" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;padding:8px;background:${C.bg};border:1px solid ${C.border};border-radius:3px;">
                        ${quickBtns}
                    </div>
                    <div class="s-ctrl" style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
                        <span style="font-size:12px;letter-spacing:.08em;color:${C.muted};white-space:nowrap;">ID от:</span>
                        <input type="text" id="search-start-id-input" placeholder="число"
                            style="width:80px;padding:5px 8px;background:${C.bg};color:${C.text};border:1px solid ${C.border};border-radius:2px;font-size:12px;font-family:inherit;box-sizing:border-box;">
                        <button id="search-range-btn"
                            style="padding:5px 14px;background:${C.glass};color:${C.text};border:1px solid ${C.border};border-radius:2px;cursor:pointer;font-size:10px;letter-spacing:.1em;font-family:inherit;transition:border-color .15s,color .15s;">
                            НАЙТИ</button>
                    </div>
                    <div class="s-ctrl" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:6px 10px;background:${C.bg};border:1px solid ${C.border};border-radius:3px;">
                        <button id="prev-page-btn" style="background:none;border:none;color:${C.muted};font-size:35px;cursor:pointer;padding:0;transition:color .15s;line-height:1;">&#8592;</button>
                        <span id="current-id-display" style="font-size:12px;letter-spacing:.1em;color:${C.muted};">1 — 40</span>
                        <button id="next-page-btn" style="background:none;border:none;color:${C.muted};font-size:35px;cursor:pointer;padding:0;transition:color .15s;line-height:1;">&#8594;</button>
                    </div>
                    <div id="costume-search-thumbnails" style="display:grid;grid-template-columns:repeat(1,1fr);gap:4px;padding:8px;background:${C.bg};border:1px solid ${C.border};border-radius:3px;width:100%;box-sizing:border-box;"></div>
                </div>
            </div>
        </div>`;
}

function gridCols(panelId, minW, gap, fallback) {
    const el = document.getElementById(panelId);
    if (!el) return 1;
    return Math.max(1, Math.floor(((el.clientWidth || el.offsetWidth || fallback) + gap) / (minW + gap)));
}

function updateLayerOrder() {
    const layers = document.getElementById('try-on-controller-panel')?.querySelectorAll('.costume-controller');
    if (!layers) return;
    layers.forEach((ctrl, i) => {
        const img = document.getElementById(ctrl.dataset.layerId);
        if (img) img.style.zIndex = 1000 + (layers.length - i) * 10;
    });
}

function removeLayer(id) {
    document.getElementById(id)?.remove();
    document.querySelector(`.costume-controller[data-layer-id="${id}"]`)?.remove();
    activeLayers = activeLayers.filter(l => l.id !== id);
    updateLayerOrder();
    const panel = document.getElementById('try-on-controller-panel');
    if (panel?.children.length === 0)
        panel.innerHTML = `<p style="font-style:italic;color:${C.muted};font-size:13px;text-align:center;padding:10px 0;">нажмите на костюмы</p>`;
}

function changeModel(url) {
    const img = document.getElementById('player-model');
    if (!img || !url) return;
    img.src = url;
    document.getElementById('model-url-input').value = '';
    document.getElementById('model-file-input').value = '';
    pendingUrl.model = null;
}

function renderCostumeLayer(id, url, container, panel) {
    panel.querySelector('p')?.remove();

    const img = document.createElement('img');
    img.id = id;
    img.src = url;
    img.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;z-index:100;`;
    container.appendChild(img);

    const costumeID = url.match(/costume\/(\d+)\.png/)?.[1] ?? '—';
    const ctrl = document.createElement('div');
    ctrl.className = 'costume-controller';
    ctrl.dataset.layerId = id;
    ctrl.style.cssText =
        `display:flex;align-items:center;gap:6px;border:1px solid ${C.border};border-radius:3px;` +
        `padding:5px 6px;margin-bottom:4px;background:${C.glass};font-size:12px;cursor:move;transition:border-color .15s;`;
    ctrl.innerHTML = `
        <div style="width:24px;height:24px;flex-shrink:0;background:url('${url}') center/contain no-repeat;border:1px solid ${C.border};border-radius:2px;"></div>
        <span style="flex-grow:1;color:${C.text};letter-spacing:.04em;">ID ${costumeID}</span>
        <button class="remove-layer-btn" data-layer-id="${id}"
            style="background:${C.red};color:#fff;border:none;width:18px;height:18px;border-radius:2px;cursor:pointer;font-size:12px;line-height:1;flex-shrink:0;">✕</button>
    `;
    ctrl.addEventListener('mouseenter', () => ctrl.style.borderColor = C.goldDim);
    ctrl.addEventListener('mouseleave', () => ctrl.style.borderColor = C.border);
    ctrl.querySelector('.remove-layer-btn').addEventListener('click', e => { e.stopPropagation(); removeLayer(id); });
    panel.prepend(ctrl);
}

function addCostumeLayer(url) {
    if (!url || url.includes('/cw3/composited/')) return;
    const id = `costume-layer-${++layerCounter}`;
    const container = document.querySelector('#try-on-panel-content .try-on-container');
    const panel = document.getElementById('try-on-controller-panel');
    if (!container || !panel) return;
    activeLayers.unshift({ id, url });
    renderCostumeLayer(id, url, container, panel);
    updateLayerOrder();
}

function handleFileSelect(e, type) {
    const file = e.target.files[0];
    if (!file || !['image/png', 'image/jpeg'].includes(file.type)) return;
    const reader = new FileReader();
    reader.onload = ev => { pendingUrl[type] = ev.target.result; handleLoad(type); };
    reader.readAsDataURL(file);
}

function handleLoad(type) {
    const url = pendingUrl[type] || document.getElementById(`${type}-url-input`)?.value;
    if (!url) return;
    if (type === 'model') {
        changeModel(url);
    } else {
        addCostumeLayer(url);
        pendingUrl.costume = null;
        document.getElementById('costume-file-input').value = '';
        document.getElementById('costume-url-input').value = '';
    }
}

function togglePanel(id) {
    const content = document.getElementById(`${id}-content`);
    const arrow = document.getElementById(`${id}-toggle-btn`);
    if (!content || !arrow) return;
    const open = content.style.display === 'none' || content.style.display === '';
    content.style.display = open ? 'block' : 'none';
    arrow.textContent = open ? '▾' : '▸';
    if (open && id === 'costume-search' && !document.getElementById('costume-search-thumbnails').children.length)
        updateSearchDisplay(1);
}

function updateSearchDisplay(startId) {
    const panel = document.getElementById('costume-search-thumbnails');
    if (!panel) return;
    const cols = gridCols('costume-search-thumbnails', 100, 4, 600);
    searchItemsPerPage = cols * 5;
    searchStartID = Math.max(1, startId);
    panel.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    panel.innerHTML = '';

    for (let i = 0; i < searchItemsPerPage; i++) {
        const costumeID = searchStartID + i;
        const url = `/cw3/cats/0/costume/${costumeID}.png`;
        const thumb = document.createElement('div');
        thumb.style.cssText = thumbCSS(url, '150px') + `position:relative;background-color:${C.glass};overflow:hidden;`;

        const label = document.createElement('div');
        label.style.cssText =
            `position:absolute;bottom:0;left:0;width:100%;background:${C.labelBg};` +
            `color:${C.muted};font-size:12px;text-align:center;padding:2px 0;letter-spacing:.05em;`;
        label.textContent = costumeID;
        thumb.appendChild(label);

        thumb.addEventListener('click', () => addCostumeLayer(url));
        thumb.addEventListener('mouseenter', () => { thumb.style.borderColor = C.gold; thumb.style.backgroundColor = C.thumbHoverBg; });
        thumb.addEventListener('mouseleave', () => { thumb.style.borderColor = C.border; thumb.style.backgroundColor = C.glass; });
        panel.appendChild(thumb);
    }

    document.getElementById('current-id-display').textContent =
        `${searchStartID} — ${searchStartID + searchItemsPerPage - 1}`;
}

function handleSearchRange() {
    const raw = parseInt(document.getElementById('search-start-id-input').value.replace(/\D/g, ''), 10) || 1;
    updateSearchDisplay(Math.max(1, Math.floor((raw - 1) / searchItemsPerPage) * searchItemsPerPage + 1));
}

function navigateSearch(dir) {
    updateSearchDisplay(Math.max(1, searchStartID + dir * searchItemsPerPage));
}

function buildPageGrid(costumeUrls) {
    const panel = document.getElementById('try-on-thumbnails');
    if (!panel) return;
    const cols = gridCols('try-on-thumbnails', 50, 3, 400);
    panel.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    panel.innerHTML = '';

    costumeUrls.forEach(url => {
        const thumb = document.createElement('div');
        thumb.style.cssText = thumbCSS(url, '75px') + `background-color:${C.glass};`;
        thumb.addEventListener('click', () => addCostumeLayer(url));
        thumb.addEventListener('mouseenter', () => { thumb.style.borderColor = C.gold; thumb.style.backgroundColor = C.thumbHoverBg; });
        thumb.addEventListener('mouseleave', () => { thumb.style.borderColor = C.border; thumb.style.backgroundColor = C.glass; });
        panel.appendChild(thumb);
    });

    const rem = costumeUrls.length % cols;
    if (rem) for (let i = 0; i < cols - rem; i++) {
        const ghost = document.createElement('div');
        ghost.style.cssText = `width:100%;height:75px;box-sizing:border-box;`;
        panel.appendChild(ghost);
    }
}

function bindPanelEvents(costumeUrls) {
    document.getElementById('model-loader-header').addEventListener('click', () => togglePanel('model-loader'));
    document.getElementById('costume-loader-header').addEventListener('click', () => togglePanel('costume-loader'));
    document.getElementById('costume-search-header').addEventListener('click', () => togglePanel('costume-search'));
    document.getElementById('restore-model-btn').addEventListener('click', () => changeModel(DEFAULT_MODEL_URL));
    document.getElementById('search-range-btn').addEventListener('click', handleSearchRange);
    document.getElementById('prev-page-btn').addEventListener('click', () => navigateSearch(-1));
    document.getElementById('next-page-btn').addEventListener('click', () => navigateSearch(1));

    const navBtnHover = id => {
        const el = document.getElementById(id);
        el.addEventListener('mouseenter', () => el.style.color = C.gold);
        el.addEventListener('mouseleave', () => el.style.color = C.muted);
    };
    navBtnHover('prev-page-btn');
    navBtnHover('next-page-btn');

    ['model', 'costume'].forEach(type => {
        document.getElementById(`${type}-select-file-btn`).addEventListener('click', () => document.getElementById(`${type}-file-input`).click());
        document.getElementById(`${type}-file-input`).addEventListener('change', e => handleFileSelect(e, type));
        document.getElementById(`${type}-url-input`).addEventListener('keydown', e => { if (e.key === 'Enter') handleLoad(type); });
    });

    document.getElementById('main-panel-header').addEventListener('click', e => {
        if (e.target.closest('#wd-theme-toggle')) return;
        const content = document.getElementById('try-on-panel-content');
        const wrapper = document.getElementById('try-on-panel-wrapper');
        const toggleBtn = document.getElementById('main-panel-toggle-btn');
        const open = content.style.display === 'none';
        content.style.display = open ? 'flex' : 'none';
        toggleBtn.textContent = open ? '▾' : '▸';
        toggleBtn.style.transform = open ? 'rotate(0deg)' : '';
        wrapper.style.paddingBottom = open ? '20px' : '0';
    });

    document.getElementById('wd-theme-toggle').addEventListener('click', e => {
        e.stopPropagation();
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });

    requestAnimationFrame(() => buildPageGrid(costumeUrls));

    new ResizeObserver(() => {
        buildPageGrid(costumeUrls);
        const sp = document.getElementById('costume-search-thumbnails');
        if (sp?.children.length) updateSearchDisplay(searchStartID);
    }).observe(document.getElementById('try-on-thumbnails'));

    const initSortable = () => new Sortable(document.getElementById('try-on-controller-panel'), {
        animation: 150, ghostClass: 'sortable-ghost', onEnd: updateLayerOrder,
    });
    if (window.Sortable) {
        initSortable();
    } else if (!document.querySelector('script[src*="sortablejs"]')) {
        const sortableScript = document.createElement('script');
        sortableScript.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js';
        sortableScript.onload = initSortable;
        document.head.appendChild(sortableScript);
    }
}

function rebuildPanel() {
    const wrapper = document.getElementById('try-on-panel-wrapper');
    if (!wrapper) return;

    const wasOpen     = document.getElementById('try-on-panel-content')?.style.display !== 'none';
    const searchOpen  = document.getElementById('costume-search-content')?.style.display !== 'none';
    const modelOpen   = document.getElementById('model-loader-content')?.style.display !== 'none';
    const costumeOpen = document.getElementById('costume-loader-content')?.style.display !== 'none';
    const modelSrc    = document.getElementById('player-model')?.src ?? DEFAULT_MODEL_URL;

    document.getElementById('wd-style')?.remove();
    injectStyles();

    wrapper.style.cssText =
        `border:1px solid ${C.border};border-radius:4px;background:${C.panel};` +
        `backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);` +
        `padding:0 20px;margin:20px auto;width:90%;max-width:1300px;color:${C.text};` +
        `position:relative;overflow:hidden;`;
    wrapper.innerHTML = buildPanelInnerHTML(modelSrc);

    const costumeUrls = [];
    document.querySelectorAll('#main button div[style*="background-image: url"]').forEach(icon => {
        const m = window.getComputedStyle(icon).backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
        if (m?.[1]?.includes('/cw3/cats/')) costumeUrls.push(m[1]);
    });
    bindPanelEvents(costumeUrls);

    if (wasOpen) {
        document.getElementById('try-on-panel-content').style.display = 'flex';
        document.getElementById('main-panel-toggle-btn').textContent = '▾';
        wrapper.style.paddingBottom = '20px';
    }
    if (searchOpen) {
        document.getElementById('costume-search-content').style.display = 'block';
        document.getElementById('costume-search-toggle-btn').textContent = '▾';
        updateSearchDisplay(searchStartID);
    }
    ['model', 'costume'].forEach(t => {
        if (t === 'model' ? modelOpen : costumeOpen)
            document.getElementById(`${t}-loader-content`).style.display = 'block';
    });

    if (activeLayers.length) {
        const container = document.querySelector('#try-on-panel-content .try-on-container');
        const panel = document.getElementById('try-on-controller-panel');
        [...activeLayers].reverse().forEach(({ id, url }) => renderCostumeLayer(id, url, container, panel));
        updateLayerOrder();
    }
}

function extractModelUrl(firstDiv) {
    if (firstDiv) {
        const attr = firstDiv.getAttribute('style') || '';
        const m = attr.match(/url\(['"]?(.*?)['"]?\)/);
        if (m?.[1]) return m[1];
        const cm = window.getComputedStyle(firstDiv).backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
        if (cm?.[1]) return cm[1];
    }
    for (const el of document.querySelectorAll('div[style*="/cw3/composited/"]')) {
        const m = el.getAttribute('style').match(/url\(['"]?(.*?)['"]?\)/);
        if (m?.[1]) return m[1];
    }
    const comp = document.querySelector('div[style*="composited"]');
    if (comp) {
        const m = window.getComputedStyle(comp).backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
        if (m?.[1]) return m[1];
    }
    return '';
}

function injectPanel(anchorEl, firstDivOrPosition, costumeSourceSelector) {
    let insertPosition, firstDiv;
    if (typeof firstDivOrPosition === 'string') {
        insertPosition = firstDivOrPosition;
        firstDiv = null;
    } else {
        insertPosition = 'afterend';
        firstDiv = firstDivOrPosition;
        costumeSourceSelector = 'div[style*="background-image: url"]';
    }

    const url = extractModelUrl(firstDiv);
    if (url) DEFAULT_MODEL_URL = url;

    injectStyles();

    const wrapper = document.createElement('div');
    wrapper.id = 'try-on-panel-wrapper';
    wrapper.style.cssText =
        `border:1px solid ${C.border};border-radius:4px;background:${C.panel};` +
        `backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);` +
        `padding:0 20px;margin:20px auto;width:90%;max-width:1300px;color:${C.text};` +
        `position:relative;overflow:hidden;`;

    if (insertPosition === 'afterend') {
        anchorEl.insertAdjacentElement('afterend', document.createElement('hr'));
        anchorEl.insertAdjacentElement('afterend', wrapper);
    } else {
        anchorEl.insertAdjacentHTML(insertPosition, wrapper.outerHTML + '<hr>');
    }

    document.getElementById('try-on-panel-wrapper').innerHTML = buildPanelInnerHTML(DEFAULT_MODEL_URL);

    const costumeUrls = [];
    document.querySelectorAll(costumeSourceSelector).forEach(icon => {
        const m = window.getComputedStyle(icon).backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
        if (m?.[1]?.includes('/cw3/cats/')) costumeUrls.push(m[1]);
    });

    bindPanelEvents(costumeUrls);
}

(function () {
    const isSettingsCostumes = /\/settings_costumes/.test(location.pathname);

    if (isSettingsCostumes) {
        const tryInsert = () => {
            if (document.getElementById('try-on-panel-wrapper')) return true;
            const col3 = document.querySelector('div[data-v-5fa27571][class*="col-3"]');
            if (!col3) return false;
            const firstDiv =
                col3.querySelector('[class="first"]') ||
                col3.querySelector('[class*="first"]') ||
                document.querySelector('[data-v-59afe5e8][class="first"]') ||
                document.querySelector('[class="first"]');
            if (!firstDiv) return false;
            injectPanel(col3, firstDiv);
            return true;
        };

        if (!tryInsert()) {
            const observer = new MutationObserver(() => { if (tryInsert()) observer.disconnect(); });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    } else {
        const mainDiv = document.getElementById('main');
        if (!mainDiv) return;
        injectPanel(mainDiv, 'beforebegin', '#main button div[style*="background-image: url"]');
    }
})();
