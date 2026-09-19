// 家·肴 - 首页脚本
// 接口地址来自页面注入的 window.API，同一份 JS 可同时适配 PHP 版与 Cloudflare 版

const API = window.API;

// ===== 侧边栏 =====
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const mainContainer = document.getElementById('mainContainer');

function toggleSidebar() {
    sidebar.classList.toggle('open');
    menuToggle.classList.toggle('open');
    sidebarOverlay.classList.toggle('open');
    mainContainer.classList.toggle('sidebar-open');
}
menuToggle.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (sidebar.classList.contains('open')) toggleSidebar(); closeLightbox(); }
});

// ===== 主题（暗色 / 亮色） =====
function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') document.documentElement.setAttribute('data-theme', saved);
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.setAttribute('data-theme', 'dark');
}
window.toggleTheme = function() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
};
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
});
initTheme();

// ===== 全局状态 =====
// 首页不传 sortByTime，由服务端读取管理员的设置决定排序方式
let currentPage = 1;
let currentSearch = '';
const itemsPerPage = 12;

// ===== 获取菜品列表 =====
async function fetchDishes(page = 1, search = '') {
    try {
        const url = `${API.dishes}?page=${page}&limit=${itemsPerPage}&search=${encodeURIComponent(search)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) return data;
        return { data: [], pagination: { page: 1, pages: 1 } };
    } catch (error) {
        return { data: [], pagination: { page: 1, pages: 1 } };
    }
}

// ===== 渲染菜品卡片 =====
function renderDishes(dishes) {
    const container = document.getElementById('dishesContainer');
    if (!dishes || dishes.length === 0) { container.innerHTML = '<div class="no-results">暂无菜品</div>'; return; }

    container.innerHTML = dishes.map(dish => {
        const imgs = dish.images || [];
        const hasImages = imgs.length > 0;
        const hasMultiple = imgs.length > 1;
        const stackImages = imgs.slice(0, 3).map((img, i) => {
            const offset = i * 4;
            const rotate = (i - 1) * 3;
            return `<div class="stack-card" style="transform: translate(${offset}px, ${offset}px) rotate(${rotate}deg); z-index: ${3 - i};">
                <img src="${img.url}" alt="${escapeHtml(dish.name)}" loading="lazy"></div>`;
        }).join('');

        return `
        <div class="dish-card">
            <div class="dish-images" ${hasImages ? `onclick="openLightbox(${JSON.stringify(imgs.map(i => i.url)).replace(/"/g, '&quot;')})"` : ''}>
                ${hasImages ? `
                    <div class="image-stack clickable">
                        ${stackImages}
                        ${hasMultiple ? `<div class="stack-badge"><i class="fas fa-images"></i> ${imgs.length}</div>` : '<div class="stack-badge"><i class="fas fa-search-plus"></i></div>'}
                    </div>
                ` : '<div class="no-image">暂无图片</div>'}
            </div>
            <div class="dish-info">
                <h3 class="dish-name">${escapeHtml(dish.name)}</h3>
                ${dish.notes ? `<p class="dish-notes">${escapeHtml(dish.notes)}</p>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ===== 灯箱 =====
let lightboxImages = [], lightboxIndex = 0;
window.openLightbox = function(images) {
    if (!images || images.length === 0) return;
    lightboxImages = images; lightboxIndex = 0; renderLightbox();
    document.getElementById('lightbox').classList.add('active'); document.body.style.overflow = 'hidden';
};
function closeLightbox() { document.getElementById('lightbox').classList.remove('active'); document.body.style.overflow = ''; }
window.closeLightbox = closeLightbox;
window.lightboxPrev = function() { lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length; renderLightbox(); };
window.lightboxNext = function() { lightboxIndex = (lightboxIndex + 1) % lightboxImages.length; renderLightbox(); };
function renderLightbox() {
    const img = document.getElementById('lightboxImg'), counter = document.getElementById('lightboxCounter');
    if (img) img.src = lightboxImages[lightboxIndex];
    if (counter) counter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
    const thumbs = document.getElementById('lightboxThumbs');
    if (thumbs) thumbs.innerHTML = lightboxImages.map((url, i) =>
        `<div class="lightbox-thumb ${i === lightboxIndex ? 'active' : ''}" onclick="lightboxGoTo(${i})"><img src="${url}" alt=""></div>`
    ).join('');
}
window.lightboxGoTo = function(index) { lightboxIndex = index; renderLightbox(); };
document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox').classList.contains('active')) return;
    if (e.key === 'ArrowLeft') lightboxPrev(); if (e.key === 'ArrowRight') lightboxNext();
});

// ===== 分页 =====
function renderPagination(pagination) {
    const container = document.getElementById('pagination');
    const { page, pages } = pagination;
    if (pages <= 1) { container.innerHTML = ''; return; }
    let html = `<button class="page-btn" ${page === 1 ? 'disabled' : ''} onclick="goToPage(${page - 1})">上一页</button>`;
    for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++)
        html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    html += `<button class="page-btn" ${page === pages ? 'disabled' : ''} onclick="goToPage(${page + 1})">下一页</button>`;
    container.innerHTML = html;
}

window.goToPage = async function(page) {
    currentPage = page;
    const data = await fetchDishes(page, currentSearch);
    renderDishes(data.data); renderPagination(data.pagination);
};
window.searchDishes = async function() {
    currentSearch = document.getElementById('searchInput').value.trim();
    currentPage = 1;
    const data = await fetchDishes(1, currentSearch);
    renderDishes(data.data); renderPagination(data.pagination);
};
document.getElementById('searchInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') searchDishes(); });

async function loadDishes() {
    const data = await fetchDishes(currentPage, currentSearch);
    renderDishes(data.data); renderPagination(data.pagination);
}

function escapeHtml(text) { if (!text) return ''; const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

loadDishes();
