// ==UserScript==
// @name         WARDROBE
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Гардероб, позволяющий примерить костюмы перед покупкой во вкладке кролей.
// @author       RESSOR
// @match        http*://*.catwar.net/rabbit*
// @match        http*://*.catwar.su/rabbit*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=catwar.su
// @license      MIT
// @grant        none
// ==/UserScript==

/* global Sortable */

let DEFAULT_MODEL_URL = '';
let layerCounter = 0;
let pendingModelUrl = null;
let pendingCostumeUrl = null;

function updateLayerOrder() {
    const controllerPanel = document.getElementById('try-on-controller-panel');
    if (!controllerPanel) return;
    const layers = controllerPanel.querySelectorAll('.costume-controller');
    let baseZIndex = 1000;
    layers.forEach((controller, i) => {
        const layerId = controller.getAttribute('data-layer-id');
        const costumeImage = document.getElementById(layerId);
        const newZIndex = baseZIndex + (layers.length - i) * 10;
        if (costumeImage) {
            costumeImage.style.zIndex = newZIndex;
        }
    });
}

function removeLayer(layerId) {
    const layerContainer = document.getElementById(layerId);
    if (layerContainer) {
        layerContainer.remove();
    }
    const controller = document.querySelector(`.costume-controller[data-layer-id="${layerId}"]`);
    if (controller) {
        controller.remove();
    }
    updateLayerOrder();
    const controllerPanel = document.getElementById('try-on-controller-panel');
    if (controllerPanel && controllerPanel.children.length === 0) {
        controllerPanel.innerHTML = '<p style="font-style: italic; color: #aaaaaa;">Нажмите на миниатюру для примерки.</p>';
    }
}

function addCostumeLayer(costumeUrl) {
    if (!costumeUrl || costumeUrl.includes('/cw3/composited/')) return;
    layerCounter++;
    const layerId = `costume-layer-${layerCounter}`;
    const container = document.querySelector('#try-on-panel-content .try-on-container');
    const controllerPanel = document.getElementById('try-on-controller-panel');
    if (!container || !controllerPanel) return;
    const starterText = controllerPanel.querySelector('p');
    if (starterText && starterText.textContent.includes('Нажмите на миниатюру')) {
        starterText.remove();
    }
    const newLayer = document.createElement('img');
    newLayer.id = layerId;
    newLayer.src = costumeUrl;
    newLayer.alt = `Костюм ${layerCounter}`;
    newLayer.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 100;`;
    container.appendChild(newLayer);
    const controller = document.createElement('div');
    controller.className = 'costume-controller';
    controller.setAttribute('data-layer-id', layerId);
    controller.style.cssText = `display: flex; align-items: center; justify-content: space-between; border: 1px solid #444444; border-radius: 4px; padding: 5px; margin-bottom: 5px; background-color: #383838; font-size: 10px; cursor: move;`;
    let costumeID;
    const costumeMatch = costumeUrl.match(/costume\/(\d+)\.png/);
    costumeID = costumeMatch ? costumeMatch[1] : `Загруженный`;
    controller.innerHTML = `
        <div style="display: flex; align-items: center; flex-grow: 1;">
            <div style="width: 25px; height: 25px; background-image: url('${costumeUrl}'); background-size: contain; background-repeat: no-repeat; margin-right: 5px; border: 1px solid #666666; border-radius: 3px;"></div>
            <div>
                <span style="font-weight: bold; color: #f0f0f0;">ID: ${costumeID}</span>
            </div>
        </div>
        <div style="margin-left: 10px;">
            <button class="remove-layer-btn" data-layer-id="${layerId}" title="Удалить слой" style="background-color: #a00000; color: white; border: none; padding: 3px 5px; cursor: pointer; line-height: 1; border-radius: 3px;">✖</button>
        </div>
    `;
    controllerPanel.prepend(controller);
    const removeBtn = controller.querySelector('.remove-layer-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            removeLayer(layerId);
        });
    }
    updateLayerOrder();
}

function changePlayerModel(newUrl) {
    const modelImg = document.getElementById('player-model');
    if (modelImg && newUrl) {
        modelImg.src = newUrl;
        const urlInput = document.getElementById('model-url-input');
        const fileNameDisplay = document.getElementById('model-file-name-display');
        if (urlInput) {
            urlInput.value = '';
        }
        pendingModelUrl = null;
        if (fileNameDisplay) {
            fileNameDisplay.textContent = 'Файл не выбран';
        }
        const fileInput = document.getElementById('model-file-input');
        if (fileInput) {
            fileInput.value = '';
        }
    }
}

function handleFileSelect(event, type) {
    const file = event.target.files[0];
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const fileNameDisplayId = type === 'model' ? 'model-file-name-display' : 'costume-file-name-display';
            const fileNameDisplay = document.getElementById(fileNameDisplayId);
            if (type === 'model') {
                pendingModelUrl = e.target.result;
            } else {
                pendingCostumeUrl = e.target.result;
            }
            if (fileNameDisplay) {
                fileNameDisplay.textContent = `Файл выбран: ${file.name}`;
            }
        };
        reader.readAsDataURL(file);
    }
}

function handleModelLoad() {
    const urlInput = document.getElementById('model-url-input');
    if (pendingModelUrl) {
        changePlayerModel(pendingModelUrl);
        pendingModelUrl = null;
    } else if (urlInput && urlInput.value) {
        changePlayerModel(urlInput.value);
    }
}

function handleCostumeLoad() {
    const urlInput = document.getElementById('costume-url-input');
    if (pendingCostumeUrl) {
        addCostumeLayer(pendingCostumeUrl);
        pendingCostumeUrl = null;
        const fileInput = document.getElementById('costume-file-input');
        const fileNameDisplay = document.getElementById('costume-file-name-display');
        if (fileInput) {
            fileInput.value = '';
        }
        if (fileNameDisplay) {
            fileNameDisplay.textContent = 'Файл не выбран';
        }
    } else if (urlInput && urlInput.value) {
        addCostumeLayer(urlInput.value);
        urlInput.value = '';
    }
}

function toggleLoader(id) {
    const content = document.getElementById(id + '-content');
    const toggleBtn = document.getElementById(id + '-toggle-btn');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggleBtn.textContent = '▼';
    } else {
        content.style.display = 'none';
        toggleBtn.textContent = '▶';
    }
}

function toggleMainPanel() {
    const mainContent = document.getElementById('try-on-panel-content');
    const toggleBtn = document.getElementById('main-panel-toggle-btn');
    const panel = document.getElementById('try-on-panel-wrapper');
    if (mainContent.style.display === 'none') {
        mainContent.style.display = 'flex';
        toggleBtn.textContent = '▼';
        panel.style.padding = '0 15px 15px 15px';
    } else {
        mainContent.style.display = 'none';
        toggleBtn.textContent = '▶';
        panel.style.padding = '0 15px 0 15px';
    }
}

(function() {
    const inputStyle = `width: 90%; padding: 5px; margin-bottom: 5px; margin-top: 5px; border: 1px solid #555555; background-color: #1e1e1e; color: #f0f0f0; border-radius: 3px; font-size: 10px;`;
    const nameDisplayStyle = `font-size: 10px; color: #aaaaaa; margin: 0 0 5px 0; height: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
    const loaderContainerStyle = `margin-top: 5px; padding: 5px 5px 5px 7px; background-color: #333333; border-radius: 4px; width: 180px; order: 4; margin-bottom: 10px;`;
    const loaderHeaderStyle = `display: flex; justify-content: space-between; align-items: center; cursor: pointer;`;
    const buttonStyle = `width: 100%; padding: 5px; color: white; border: none; border-radius: 3px; cursor: pointer;`;

    function loadSortableJS(callback) {
        if (typeof Sortable !== 'undefined') {
            callback();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js';
        script.onload = callback;
        document.head.appendChild(script);
    }

    function initSortable() {
        const controllerPanel = document.getElementById('try-on-controller-panel');
        if (!controllerPanel) return;

        new Sortable(controllerPanel, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: updateLayerOrder,
        });

        const style = document.createElement('style');
        style.textContent = `.sortable-ghost { opacity: 0.5; background-color: #555555; border-radius: 4px; }`;
        document.head.appendChild(style);
    }

    function installTryOnPanel() {
        const existingPanel = document.getElementById('try-on-panel');
        if (existingPanel) {
            existingPanel.parentNode.removeChild(existingPanel.previousElementSibling);
            existingPanel.parentNode.removeChild(existingPanel.nextElementSibling);
            existingPanel.remove();
        }
        layerCounter = 0;
        const mainDiv = document.getElementById('main');
        if (!mainDiv) return;
        let initialModelElement = document.querySelector('div[style*="/cw3/composited/"]');
        if (initialModelElement) {
            const style = window.getComputedStyle(initialModelElement);
            const urlMatch = style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
            if (urlMatch && urlMatch[1]) {
                DEFAULT_MODEL_URL = urlMatch[1];
            }
        }

        const modelLoaderHTML = `
            <div id="model-loader-container" style="${loaderContainerStyle.replace('margin-top: 5px', 'margin-top: 20px').replace('order: 4', 'order: 3')}">
                <div id="model-loader-header" style="${loaderHeaderStyle}">
                    <h4 style="font-size: 14px; margin: 0; color: #cccccc;">Заменить модель</h4>
                    <button id="model-loader-toggle-btn" style="background: none; border: none; color: #cccccc; font-size: 14px; cursor: pointer; padding: 0 5px; line-height: 1;">▶</button>
                </div>
                <div id="model-loader-content" style="display: none;">
                    <input type="text" id="model-url-input" placeholder="URL изображения" style="${inputStyle}">
                    <div id="model-file-name-display" style="${nameDisplayStyle}">Файл не выбран</div>
                    <input type="file" id="model-file-input" style="display: none;" accept="image/png, image/jpeg">
                    <button id="model-select-file-btn" style="${buttonStyle} background-color: #555555; margin-bottom: 5px;">Выбрать файл</button>
                    <button id="model-confirm-load-btn" style="${buttonStyle} background-color: #646464; font-weight: bold; margin-bottom: 8px;">ОК</button>
                    <button id="restore-model-btn" style="${buttonStyle} background-color: #646464;">Вернуть модель</button>
                </div>
            </div>
        `;

        const costumeLoaderHTML = `
            <div id="costume-loader-container" style="${loaderContainerStyle}">
                <div id="costume-loader-header" style="${loaderHeaderStyle}">
                    <h4 style="font-size: 14px; margin: 0; color: #cccccc;">Загрузить костюм</h4>
                    <button id="costume-loader-toggle-btn" style="background: none; border: none; color: #cccccc; font-size: 14px; cursor: pointer; padding: 0 5px; line-height: 1;">▶</button>
                </div>
                <div id="costume-loader-content" style="display: none;">
                    <input type="text" id="costume-url-input" placeholder="URL изображения" style="${inputStyle}">
                    <div id="costume-file-name-display" style="${nameDisplayStyle}">Файл не выбран</div>
                    <input type="file" id="costume-file-input" style="display: none;" accept="image/png, image/jpeg">
                    <button id="costume-select-file-btn" style="${buttonStyle} background-color: #555555; margin-bottom: 5px;">Выбрать файл</button>
                    <button id="costume-confirm-load-btn" style="${buttonStyle} background-color: #646464; font-weight: bold; margin-bottom: 8px;">Добавить костюм</button>
                </div>
            </div>
        `;

        const panelWrapperHTML = `
            <div id="try-on-panel-wrapper" style="
                border: 1px solid #444444;
                border-radius: 8px;
                background-color: #262626;
                padding: 0 15px 0 15px;
                margin: 20px auto;
                width: 90%;
                max-width: 1000px;
                color: #f0f0f0;
            ">

                <div id="main-panel-header" style="
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    padding: 10px 0;
                    margin-bottom: 0;
                ">
                    <button id="main-panel-toggle-btn" style="
                        background: none;
                        border: none;
                        color: #cccccc;
                        font-size: 18px;
                        cursor: pointer;
                        padding: 0 5px;
                        line-height: 1;
                        margin-right: 10px;
                    ">▶</button>
                    <h2 style="font-size: 18px; margin: 0; color: #cccccc;">ПРИМЕРКА КОСТЮМОВ</h2>
                </div>
                <div id="try-on-panel-content" style="
                    display: none;
                    justify-content: space-around;
                    align-items: flex-start;
                    padding-top: 15px;
                    padding-bottom: 15px;
                ">

                    <div id="control-column" style="
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        flex-shrink: 0;
                        margin-right: 30px;
                        text-align: center;
                    ">
                        <h3 style="font-size: 16px; margin: 0; padding: 0; margin-bottom: 25px; color: #cccccc; order: 1;">ПАРАМЕТРЫ ПРИМЕРКИ</h3>
                        <div class="try-on-container" style="position: relative; width: 100px; height: 100px; margin: 5px auto 10px auto; transform: scale(1.5); order: 2;">
                            <img id="player-model"
                                src="${DEFAULT_MODEL_URL}"
                                alt="Модель игрока"
                                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1;"
                            >
                        </div>
                        ${modelLoaderHTML}
                        ${costumeLoaderHTML}
                        <h4 style="font-size: 14px; margin-bottom: 5px; color: #cccccc; order: 5;">Слои костюмов</h4>
                        <div id="try-on-controller-panel" style="
                            width: 180px;
                            max-height: 400px;
                            overflow-y: auto;
                            margin: 2px auto 0 auto;
                            padding: 5px;
                            background-color: #1e1e1e;
                            border: 1px solid #333333;
                            border-radius: 4px;
                            order: 6;
                        ">
                            <p style="font-style: italic; color: #aaaaaa;">Нажмите на миниатюру для примерки.</p>
                        </div>
                    </div>
                    <div style="flex-grow: 1;">
                        <h3 style="font-size: 16px; margin: 0 0 10px 0; color: #cccccc;">КОСТЮМЫ</h3>
                        <div id="try-on-thumbnails" style="
                            display: flex;
                            flex-wrap: wrap;
                            gap: 5px;
                            border: 1px solid #333333;
                            padding: 10px;
                            background: #1e1e1e;
                            border-radius: 4px;
                        ">
                            </div>
                    </div>
                </div>
            </div>
            <hr>
        `;
        mainDiv.insertAdjacentHTML('beforebegin', panelWrapperHTML);

        document.getElementById('main-panel-header')?.addEventListener('click', toggleMainPanel);
        document.getElementById('model-loader-header')?.addEventListener('click', () => toggleLoader('model-loader'));
        document.getElementById('costume-loader-header')?.addEventListener('click', () => toggleLoader('costume-loader'));
        document.getElementById('model-confirm-load-btn')?.addEventListener('click', handleModelLoad);
        document.getElementById('costume-confirm-load-btn')?.addEventListener('click', handleCostumeLoad);
        document.getElementById('restore-model-btn')?.addEventListener('click', () => changePlayerModel(DEFAULT_MODEL_URL));

        const modelFileInput = document.getElementById('model-file-input');
        document.getElementById('model-select-file-btn')?.addEventListener('click', () => {
            if (modelFileInput) {
                modelFileInput.click();
            }
        });
        modelFileInput?.addEventListener('change', (e) => handleFileSelect(e, 'model'));

        const costumeFileInput = document.getElementById('costume-file-input');
        document.getElementById('costume-select-file-btn')?.addEventListener('click', () => {
            if (costumeFileInput) {
                costumeFileInput.click();
            }
        });
        costumeFileInput?.addEventListener('change', (e) => handleFileSelect(e, 'costume'));

        const thumbnailsPanel = document.getElementById('try-on-thumbnails');
        document.querySelectorAll('#main button div[style*="background-image: url"]').forEach(icon => {
            const style = window.getComputedStyle(icon);
            let imageUrl = style.backgroundImage;
            const urlMatch = imageUrl.match(/url\(['"]?(.*?)['"]?\)/);

            if (urlMatch && urlMatch[1] && urlMatch[1].includes('/cw3/cats/')) {
                const costumeUrl = urlMatch[1];
                const thumbnail = document.createElement('div');
                thumbnail.style.cssText = `width: 53px; height: 53px; background-image: url('${costumeUrl}'); background-size: contain; background-repeat: no-repeat; cursor: pointer; border: 1px solid #444444; border-radius: 3px;`;

                const thumbnailClick = () => addCostumeLayer(costumeUrl);
                const mouseEnter = () => { thumbnail.style.borderColor = '#4a90e2'; thumbnail.style.backgroundColor = '#383838'; };
                const mouseLeave = () => { thumbnail.style.borderColor = '#444444'; thumbnail.style.backgroundColor = 'transparent'; };

                thumbnail.addEventListener('click', thumbnailClick);
                thumbnail.addEventListener('mouseenter', mouseEnter);
                thumbnail.addEventListener('mouseleave', mouseLeave);

                thumbnailsPanel.appendChild(thumbnail);
            }
        });

        loadSortableJS(initSortable);
    }

    installTryOnPanel();
})();