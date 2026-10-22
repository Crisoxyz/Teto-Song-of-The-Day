setTimeout(() => {
    document.querySelectorAll('.card-wrapper').forEach(card => {
        card.classList.remove('initial-entrance');
        card.classList.add('loaded');
    });
    const btnContainer = document.getElementById('buttons-container');
    if (btnContainer) {
        btnContainer.classList.add('loaded');
    }
}, 900);

const MAX_SCALE = 6;
const MIN_SCALE = 0.5;
const DESKTOP_MARGIN = 16;
const MOBILE_MARGIN = 8;
const mobileQuery = window.matchMedia('(max-width: 820px)');

let currentScale = MAX_SCALE;
let currentDpr = window.devicePixelRatio || 1;
let toolsUnits = 0;
const registry = new Map();

function loadImage(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

function renderCanvas(canvas, img) {
    const cap = parseFloat(canvas.getAttribute('data-scale')) || 1;
    const scale = Math.min(cap, currentScale);
    canvas.width = Math.round(img.width * scale * currentDpr);
    canvas.height = Math.round(img.height * scale * currentDpr);
    canvas.style.width = canvas.width / currentDpr + 'px';
    canvas.style.height = canvas.height / currentDpr + 'px';

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}

function drawEntry(canvas, entry) {
    const img = entry.alt && entry.toggled ? entry.alt : entry.primary;
    renderCanvas(canvas, img);
}

function cssNumber(name) {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

function naturalHeight(selector) {
    let max = 0;
    document.querySelectorAll(selector).forEach(canvas => {
        const entry = registry.get(canvas);
        if (entry) max = Math.max(max, entry.primary.height);
    });
    return max;
}

function layoutUnits() {
    const parts = [
        naturalHeight('.card-1 > canvas'),
        naturalHeight('#card-2 > canvas'),
        naturalHeight('#card-3 > canvas'),
        naturalHeight('#buttons-container canvas')
    ];
    if (parts.some(h => !h)) return null;
    const gaps = cssNumber('--gap-title') + cssNumber('--gap-player') + cssNumber('--gap-song');
    const tools = naturalHeight('.drawing-tools canvas') + cssNumber('--tool-lift');
    return { stack: parts.reduce((a, b) => a + b, 0) + gaps, tools };
}

function computeScale() {
    let widest = 0;
    registry.forEach((entry, canvas) => {
        if (!canvas.isConnected) return;
        if (canvas.closest('.right-sidebar')) return;
        widest = Math.max(widest, entry.primary.width);
    });
    if (!widest) return { scale: currentScale, tools: toolsUnits };

    const mobile = mobileQuery.matches;
    const margin = mobile ? MOBILE_MARGIN : DESKTOP_MARGIN;
    let fit = (window.innerWidth - margin * 2) / widest;
    let tools = 0;

    if (mobile) {
        const units = layoutUnits();
        if (units) {
            tools = units.tools;
            const padTop = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
            fit = Math.min(fit, (window.innerHeight - padTop) / (units.stack + units.tools));
        }
    }

    const dpr = window.devicePixelRatio || 1;
    const snapped = Math.floor(Math.min(fit, MAX_SCALE) * dpr) / dpr;
    return { scale: Math.max(MIN_SCALE, snapped), tools };
}

function applyScale() {
    const next = computeScale();
    const dpr = window.devicePixelRatio || 1;
    const changed = next.scale !== currentScale || dpr !== currentDpr;
    currentScale = next.scale;
    currentDpr = dpr;
    toolsUnits = next.tools;

    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--px', currentScale + 'px');
    rootStyle.setProperty('--tools-units', toolsUnits);

    if (changed) {
        registry.forEach((entry, canvas) => drawEntry(canvas, entry));
    }
}

function releaseCanvases(root) {
    root.querySelectorAll('canvas').forEach(canvas => {
        const entry = registry.get(canvas);
        if (entry) {
            clearInterval(entry.timer);
            registry.delete(canvas);
        }
    });
}

async function initPixelCardCanvas(canvas) {
    const imgSrc = canvas.getAttribute('data-src');
    const altSrc = canvas.getAttribute('data-alt-src');
    const animated = altSrc && canvas.classList.contains('animated-sprite');

    const [primary, alt] = await Promise.all([
        loadImage(imgSrc),
        animated ? loadImage(altSrc) : Promise.resolve(null)
    ]);
    if (!primary || !canvas.isConnected) return;

    const entry = { primary, alt, toggled: false, timer: null };
    registry.set(canvas, entry);
    drawEntry(canvas, entry);
    applyScale();

    if (entry.alt) {
        entry.timer = setInterval(() => {
            entry.toggled = !entry.toggled;
            drawEntry(canvas, entry);
        }, 200);
    }
}

document.querySelectorAll('.pixel-card').forEach(canvas => {
    initPixelCardCanvas(canvas);
});

window.addEventListener('resize', applyScale);

function getDayIndex() {
    const now = new Date();
    const utcToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const utcEpoch = Date.UTC(2024, 0, 1);
    const diff = utcToday - utcEpoch;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function seededRandom(seed) {
    return () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function getCycleOrder(length, cycle) {
    const rand = seededRandom(cycle + 1);
    const order = Array.from({ length }, (_, i) => i);
    for (let i = length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}

function getSongForDay(songs, dayIndex) {
    const n = songs.length;
    const cycle = Math.floor(dayIndex / n);
    const pos = dayIndex % n;
    const order = getCycleOrder(n, cycle);

    if (cycle > 0 && n > 1) {
        const prevLast = getCycleOrder(n, cycle - 1)[n - 1];
        if (order[0] === prevLast) {
            [order[0], order[1]] = [order[1], order[0]];
        }
    }
    return songs[order[pos]];
}

async function renderSongOfTheDay() {
    const titleElement = document.getElementById('song-title');
    const playerElement = document.getElementById('youtube-player');

    try {
        const response = await fetch('songs4.json');
        const songs = await response.json();
        if (!songs || songs.length === 0) return;

        const song = getSongForDay(songs, getDayIndex());

        if (titleElement) titleElement.innerText = song.title;
        if (playerElement) playerElement.src = `https://www.youtube.com/embed/${song.youtube_id}`;
    } catch (error) {
        console.error('Unable to load songs4.json:', error);
        if (titleElement) titleElement.innerText = "Error: songs4.json not found.";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderSongOfTheDay();

    let currentDayIndex = getDayIndex();
    setInterval(() => {
        const newDayIndex = getDayIndex();
        if (newDayIndex !== currentDayIndex) {
            currentDayIndex = newDayIndex;
            renderSongOfTheDay();
        }
    }, 60 * 1000);
});

const btnSettings = document.getElementById('btn-settings');
const card2 = document.getElementById('card-2');
const card3 = document.getElementById('card-3');
let cardState = 0;

btnSettings.addEventListener('click', () => {
    if (card2.classList.contains('slide-out-right') || card2.classList.contains('slide-in-left')) return;

    if (cardState === 0) {
        card2.classList.add('slide-out-right');
        card3.classList.add('slide-out-right');

        setTimeout(() => {
            card2.classList.remove('slide-out-right');
            card3.classList.remove('slide-out-right');
            card3.classList.add('hidden-space');

            const cardInnerContent = document.getElementById('card-2-content');
            releaseCanvases(cardInnerContent);
            cardInnerContent.innerHTML = `
                <div class="changelog-container">
                    <div class="changelog-banner-wrapper">
                        <canvas class="pixel-card animated-sprite" 
                            data-src=" ChatAssets/Changelog1.png" 
                            data-alt-src=" ChatAssets/Changelog2.png" 
                            data-scale="6">
                        </canvas>
                    </div>
                    <div class="changelog-list-content" id="changelog-list">
                        <div class="changelog-status">Loading...</div>
                    </div>
                </div>
            `;

            const bannerCanvas = cardInnerContent.querySelector('.pixel-card');
            if (bannerCanvas) {
                initPixelCardCanvas(bannerCanvas);
            }

            fetch('changelog.json')
                .then(response => response.json())
                .then(data => {
                    const changelogContainer = document.getElementById('changelog-list');
                    let htmlContent = '';
                    data.forEach(item => {
                        htmlContent += `
                            <div class="changelog-item">
                                <div class="changelog-version">${item.version} - ${item.date}</div>
                                <div>${item.description}</div>
                            </div>
                        `;
                    });
                    changelogContainer.innerHTML = htmlContent;
                })
                .catch(error => {
                    const changelogContainer = document.getElementById('changelog-list');
                    changelogContainer.innerHTML = '<div class="changelog-status error">Unable to load changelogs.</div>';
                });

            cardState = 1;
            card2.classList.add('slide-in-left');

            setTimeout(() => {
                card2.classList.remove('slide-in-left');
            }, 400);

        }, 400);

    } else {
        card2.classList.add('slide-out-right');

        setTimeout(() => {
            card2.classList.remove('slide-out-right');
            card3.classList.remove('hidden-space');

            const cardInnerContent = document.getElementById('card-2-content');
            releaseCanvases(cardInnerContent);
            cardInnerContent.innerHTML = `
                <div class="youtube-embed-container">
                    <iframe id="youtube-player" src=""
                        title="YouTube video player" frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
                </div>
                <div class="sub-embed-text">
                    Fan-made, non-commercial project. All songs and embedded videos are the property of their respective composers, producers, and labels. “Kasane Teto / 重音テト” is a character originally associated with the UTAU community and the TWINDRILL team.
                </div>
            `;

            cardState = 0;
            renderSongOfTheDay();

            card2.classList.add('slide-in-left');
            card3.classList.add('slide-in-left');

            setTimeout(() => {
                card2.classList.remove('slide-in-left');
                card3.classList.remove('slide-in-left');
            }, 400);

        }, 400);
    }
});

const drawCanvas = document.getElementById('drawing-canvas');
const drawCtx = drawCanvas.getContext('2d');

function resizeDrawCanvas() {
    const rect = drawCanvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (width === drawCanvas.width && height === drawCanvas.height) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = drawCanvas.width;
    tempCanvas.height = drawCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(drawCanvas, 0, 0);

    drawCanvas.width = width;
    drawCanvas.height = height;
    drawCtx.imageSmoothingEnabled = false;

    drawCtx.drawImage(tempCanvas, 0, 0);
}

function canvasPoint(e) {
    const rect = drawCanvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (drawCanvas.width / rect.width),
        y: (e.clientY - rect.top) * (drawCanvas.height / rect.height)
    };
}
window.addEventListener('resize', resizeDrawCanvas);
resizeDrawCanvas();

let isDrawing = false;
let activeTool = null;

const drawingToolsContainer = document.getElementById('drawing-tools');
const btnDrawing = document.getElementById('btn-drawing');
const toolBtns = document.querySelectorAll('.tool-btn');

btnDrawing.addEventListener('click', (e) => {
    if (drawingToolsContainer.classList.contains('visible')) {
        drawingToolsContainer.classList.remove('visible');
        drawingToolsContainer.classList.add('hidden-exit');
        deselectTools();

        setTimeout(() => {
            drawingToolsContainer.classList.remove('hidden-exit');
            drawingToolsContainer.style.display = 'none';
        }, 350);
    } else {
        drawingToolsContainer.style.display = 'flex';
        drawingToolsContainer.classList.remove('hidden-exit');
        drawingToolsContainer.classList.add('visible');
    }
});

toolBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const selectedTool = btn.getAttribute('data-tool');

        if (activeTool === selectedTool) {
            deselectTools();
        } else {
            toolBtns.forEach(b => b.classList.remove('tool-selected'));
            btn.classList.add('tool-selected');
            activeTool = selectedTool;
            document.body.classList.add('drawing-mode-active');
        }
    });
});

function deselectTools() {
    toolBtns.forEach(b => b.classList.remove('tool-selected'));
    activeTool = null;
    document.body.classList.remove('drawing-mode-active');
}

function isHittingUI(e) {
    const target = document.elementFromPoint(e.clientX, e.clientY);
    return target && (target.closest('#btn-drawing') || target.closest('#btn-settings') || target.closest('.drawing-tools'));
}

window.addEventListener('pointerdown', (e) => {
    if (!activeTool) return;
    if (isHittingUI(e)) return;

    isDrawing = true;
    const point = canvasPoint(e);
    drawCtx.beginPath();
    drawCtx.moveTo(point.x, point.y);
});

window.addEventListener('pointermove', (e) => {
    if (!isDrawing || !activeTool) return;
    e.preventDefault();

    if (activeTool === 'pen') {
        drawCtx.globalCompositeOperation = 'source-over';
        drawCtx.strokeStyle = '#000000';
        drawCtx.lineWidth = 4;
        drawCtx.lineCap = 'square';
    } else if (activeTool === 'eraser') {
        drawCtx.globalCompositeOperation = 'destination-out';
        drawCtx.lineWidth = 20;
        drawCtx.lineCap = 'square';
    }

    const point = canvasPoint(e);
    drawCtx.lineTo(point.x, point.y);
    drawCtx.stroke();
});

function endStroke() {
    if (isDrawing) {
        isDrawing = false;
        drawCtx.closePath();
    }
}

window.addEventListener('pointerup', endStroke);
window.addEventListener('pointercancel', endStroke);