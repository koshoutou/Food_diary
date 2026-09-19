// 家·肴 - 管理页脚本
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
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sidebar.classList.contains('open')) toggleSidebar(); });

// ===== 主题 =====
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
initTheme();

// ===== 首页排序设置（管理员控制） =====
let sortByTime = true;

async function loadSortSetting() {
    try {
        const res = await fetch(API.settings);
        const data = await res.json();
        if (data.success) { sortByTime = data.sort_by_time; updateSortUI(); }
    } catch (e) {}
}

window.toggleSortSetting = async function() {
    sortByTime = !sortByTime;
    updateSortUI();
    try {
        const res = await fetch(API.settings, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sort_by_time: sortByTime })
        });
        const data = await res.json();
        if (data.success) {
            showMessage(sortByTime ? '首页已切换为时间排序' : '首页已切换为手动排序');
        } else {
            sortByTime = !sortByTime; updateSortUI();
            showMessage(data.error || '设置保存失败', 'error');
        }
    } catch (e) {
        sortByTime = !sortByTime; updateSortUI();
        showMessage('设置保存失败', 'error');
    }
};

function updateSortUI() {
    const toggle = document.getElementById('sortToggle');
    const label = document.getElementById('sortLabel');
    if (toggle) { sortByTime ? toggle.classList.add('active') : toggle.classList.remove('active'); }
    if (label) label.textContent = sortByTime ? '时间排序' : '手动排序';
}

// ===== 全局状态 =====
let isAuthenticated = false;
let uploadedImages = [];
let currentPage = 1;
let currentSearch = '';
const itemsPerPage = 50;
let isSaving = false;
let editingDishId = null;
let dishesCache = [];

// ===== 消息提示 =====
function showMessage(message, type = 'success', container = null) {
    const target = container || document.getElementById('uploadSection') || document.getElementById('authSection');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    msgDiv.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    target.insertBefore(msgDiv, target.firstChild);
    setTimeout(() => msgDiv.remove(), 3000);
}

// ===== 登录状态 =====
async function checkAuth() {
    try {
        const res = await fetch(API.login);
        const data = await res.json();
        if (data.success && data.authenticated) showLoggedIn(data.username);
    } catch (e) {}
}

function showLoggedIn(username) {
    isAuthenticated = true;
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('uploadSection').classList.remove('hidden');
    document.getElementById('manageSection').classList.remove('hidden');
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    const who = document.getElementById('loggedUser');
    if (who && username) who.textContent = username;
    loadSortSetting();
    loadDishes();
}

function showLoggedOut() {
    isAuthenticated = false;
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('uploadSection').classList.add('hidden');
    document.getElementById('manageSection').classList.add('hidden');
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.classList.add('hidden');
}

// ===== 登录（用户名 + 密码） =====
window.doLogin = async function() {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    if (!username) { showMessage('请输入用户名', 'error'); return; }
    if (!password) { showMessage('请输入密码', 'error'); return; }

    const btn = document.querySelector('#authSection .btn');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登录中...';
    try {
        const res = await fetch(API.login, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) { document.getElementById('adminPassword').value = ''; showLoggedIn(data.username); showMessage('登录成功'); }
        else { showMessage(data.error || '用户名或密码错误', 'error'); }
    } catch (error) { showMessage('登录失败: ' + error.message, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-key"></i> 登录'; }
};
document.getElementById('adminPassword')?.addEventListener('keypress', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('adminUsername')?.addEventListener('keypress', e => { if (e.key === 'Enter') doLogin(); });

// ===== 退出登录 =====
window.doLogout = async function() {
    try { await fetch(API.login, { method: 'DELETE' }); } catch (e) {}
    showLoggedOut();
    showMessage('已退出登录');
};

// ===== 上传区域 =====
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const imagePreview = document.getElementById('imagePreview');

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', e => { e.preventDefault(); uploadArea.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', e => handleFiles(e.target.files));

function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = e => { uploadedImages.push({ file, dataUrl: e.target.result, id: Date.now() + Math.random() }); renderImagePreview(); };
        reader.readAsDataURL(file);
    });
}

function renderImagePreview() {
    imagePreview.innerHTML = uploadedImages.map(img => `
        <div class="image-item"><img src="${img.dataUrl}" alt="预览">
        <button class="image-remove" onclick="removeImage(${img.id})"><i class="fas fa-times"></i></button></div>
    `).join('');
}
window.removeImage = function(id) { uploadedImages = uploadedImages.filter(img => img.id !== id); renderImagePreview(); };

// ===== 保存菜品（先上传图片，再创建菜品并关联） =====
window.saveDish = async function() {
    if (isSaving) return;
    const name = document.getElementById('dishName').value.trim();
    const notes = document.getElementById('dishNotes').value.trim();
    if (!name) { showMessage('请输入菜品名称', 'error'); return; }
    if (uploadedImages.length === 0) { showMessage('请至少上传一张图片', 'error'); return; }
    isSaving = true;
    const btn = document.querySelector('#uploadSection .btn-success');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    try {
        const imageUrls = [];
        for (const img of uploadedImages) {
            const formData = new FormData();
            formData.append('file', img.file);
            const res = await fetch(API.upload, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success && data.images) {
                data.images.forEach(i => imageUrls.push({ url: i.image_url, storage_key: i.storage_key }));
            } else {
                showMessage('图片上传失败: ' + (data.error || '未知错误'), 'error');
                return;
            }
        }
        const dishRes = await fetch(API.dishes, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, notes, images: imageUrls })
        });
        const dishData = await dishRes.json();
        if (dishData.success) { showMessage('菜品添加成功'); resetForm(); loadDishes(); }
        else { showMessage(dishData.error || '添加失败', 'error'); }
    } catch (error) { showMessage('保存失败: ' + error.message, 'error'); }
    finally { isSaving = false; btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> 保存菜品'; }
};

function resetForm() { document.getElementById('dishName').value = ''; document.getElementById('dishNotes').value = ''; uploadedImages = []; renderImagePreview(); }

// ===== 编辑菜品 =====
window.editDish = function(dish) {
    editingDishId = dish.id;
    document.getElementById('editDishId').value = dish.id;
    document.getElementById('editDishName').value = dish.name;
    document.getElementById('editDishNotes').value = dish.notes || '';
    document.getElementById('editModal').classList.add('active');
};
window.closeEditModal = function() { document.getElementById('editModal').classList.remove('active'); editingDishId = null; };
window.saveEditDish = async function() {
    if (!editingDishId) return;
    const name = document.getElementById('editDishName').value.trim();
    const notes = document.getElementById('editDishNotes').value.trim();
    if (!name) { showMessage('菜品名称不能为空', 'error', document.getElementById('editModal')); return; }
    const btn = document.querySelector('#editModal .btn-primary');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    try {
        const res = await fetch(API.dishes, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingDishId, name, notes })
        });
        const data = await res.json();
        if (data.success) { showMessage('菜品更新成功'); closeEditModal(); loadDishes(); }
        else { showMessage(data.error || '更新失败', 'error', document.getElementById('editModal')); }
    } catch (error) { showMessage('更新失败: ' + error.message, 'error', document.getElementById('editModal')); }
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> 保存修改'; }
};

// ===== 菜品上移 / 下移（手动排序） =====
window.moveDish = async function(dishId, direction) {
    const idx = dishesCache.findIndex(d => d.id === dishId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= dishesCache.length) return;

    const id1 = dishesCache[idx].id;
    const id2 = dishesCache[targetIdx].id;

    try {
        const res = await fetch(API.sort, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id1, id2 })
        });
        const data = await res.json();
        if (data.success) {
            [dishesCache[idx], dishesCache[targetIdx]] = [dishesCache[targetIdx], dishesCache[idx]];
            renderDishesList(dishesCache);
        } else { showMessage(data.error || '排序失败', 'error'); }
    } catch (e) { showMessage('排序失败', 'error'); }
};

// ===== 图片左移 / 右移 =====
window.moveImage = async function(dishId, imageId, direction) {
    const dish = dishesCache.find(d => d.id === dishId);
    if (!dish) return;
    const imgs = dish.images;
    const idx = imgs.findIndex(i => i.id === imageId);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= imgs.length) return;

    [imgs[idx], imgs[targetIdx]] = [imgs[targetIdx], imgs[idx]];
    renderDishesList(dishesCache);

    try {
        await fetch(API.imageSort, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageIds: imgs.map(i => i.id) })
        });
    } catch (e) {}
};

// ===== 批量追加图片 =====
window.addImagesToDish = function(dishId) {
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true; input.accept = 'image/*';
    input.onchange = async (e) => {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return;
        const dishEl = document.querySelector(`[data-dish-id="${dishId}"]`);
        let msgEl = dishEl.querySelector('.dish-item-msg');
        if (!msgEl) { msgEl = document.createElement('div'); msgEl.className = 'dish-item-msg'; dishEl.appendChild(msgEl); }
        msgEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 正在上传 0/${files.length}...`;
        let successCount = 0, failCount = 0;
        for (let i = 0; i < files.length; i++) {
            const formData = new FormData();
            formData.append('file', files[i]);
            formData.append('dishId', String(dishId));
            try {
                const res = await fetch(API.upload, { method: 'POST', body: formData });
                const data = await res.json();
                if (data.success && data.count > 0) successCount++; else failCount++;
            } catch (err) { failCount++; }
            msgEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 正在上传 ${i + 1}/${files.length}...`;
        }
        msgEl.innerHTML = failCount === 0
            ? `<i class="fas fa-check-circle" style="color:#27ae60"></i> 成功追加 ${successCount} 张图片`
            : `<i class="fas fa-exclamation-circle" style="color:#e74c3c"></i> 成功 ${successCount} 张，失败 ${failCount} 张`;
        setTimeout(() => { msgEl.innerHTML = ''; loadDishes(); }, 1500);
    };
    input.click();
};

// ===== 删除单张图片 =====
window.deleteImage = async function(imageId) {
    if (!confirm('确定要删除这张图片吗？')) return;
    try {
        const res = await fetch(API.images, {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: imageId })
        });
        const data = await res.json();
        if (data.success) { showMessage('图片删除成功'); loadDishes(); }
        else { showMessage(data.error || '删除失败', 'error'); }
    } catch (error) { showMessage('删除失败: ' + error.message, 'error'); }
};

// ===== 加载菜品列表（管理页固定按手动排序） =====
async function loadDishes() {
    try {
        const url = `${API.dishes}?page=1&limit=${itemsPerPage}&search=${encodeURIComponent(currentSearch)}&sortByTime=0`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) { dishesCache = data.data; renderDishesList(dishesCache); }
    } catch (error) { console.error('加载菜品失败:', error); }
}

function renderDishesList(dishes) {
    const container = document.getElementById('dishesList');
    if (!dishes || dishes.length === 0) { container.innerHTML = '<div class="no-results">暂无菜品</div>'; return; }

    container.innerHTML = dishes.map((dish, idx) => `
        <div class="dish-item" data-dish-id="${dish.id}">
            <div class="dish-item-header">
                <div class="dish-item-left">
                    <span class="dish-item-name">${escapeHtml(dish.name)}</span>
                    <div class="sort-controls">
                        <button class="sort-btn" onclick="moveDish(${dish.id}, 'up')" ${idx === 0 ? 'disabled' : ''} title="上移">
                            <i class="fas fa-arrow-up"></i>
                        </button>
                        <button class="sort-btn" onclick="moveDish(${dish.id}, 'down')" ${idx === dishes.length - 1 ? 'disabled' : ''} title="下移">
                            <i class="fas fa-arrow-down"></i>
                        </button>
                    </div>
                </div>
                <div class="dish-item-actions">
                    <button class="btn btn-small btn-primary" onclick='editDish(${JSON.stringify(dish).replace(/'/g, "&#39;")})'>
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="btn btn-small btn-success" onclick="addImagesToDish(${dish.id})">
                        <i class="fas fa-plus"></i> 追加
                    </button>
                    <button class="btn btn-small btn-danger" onclick="deleteDish(${dish.id})">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            </div>
            ${dish.notes ? `<p class="dish-item-notes">${escapeHtml(dish.notes)}</p>` : ''}
            ${dish.images && dish.images.length > 0 ? `
                <div class="dish-item-images">
                    ${dish.images.map((img, imgIdx) => `
                        <div class="dish-item-image">
                            <img src="${img.url}" alt="${escapeHtml(dish.name)}" loading="lazy">
                            <div class="image-sort-controls">
                                <button class="img-sort-btn" onclick="moveImage(${dish.id}, ${img.id}, 'left')" ${imgIdx === 0 ? 'disabled' : ''} title="左移">
                                    <i class="fas fa-chevron-left"></i>
                                </button>
                                <button class="img-sort-btn img-delete-btn" onclick="deleteImage(${img.id})" title="删除">
                                    <i class="fas fa-times"></i>
                                </button>
                                <button class="img-sort-btn" onclick="moveImage(${dish.id}, ${img.id}, 'right')" ${imgIdx === dish.images.length - 1 ? 'disabled' : ''} title="右移">
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
}

window.goToPage = async function(page) { currentPage = page; await loadDishes(); };
window.searchDishes = async function() { currentSearch = document.getElementById('searchInput').value.trim(); currentPage = 1; await loadDishes(); };
document.getElementById('searchInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') searchDishes(); });

window.deleteDish = async function(id) {
    if (!confirm('确定要删除这个菜品及其所有图片吗？')) return;
    try {
        const res = await fetch(API.dishes, {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if (data.success) { showMessage('删除成功'); loadDishes(); }
        else { showMessage(data.error || '删除失败', 'error'); }
    } catch (error) { showMessage('删除失败: ' + error.message, 'error'); }
};

function escapeHtml(text) { if (!text) return ''; const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

// ===== 初始化 =====
checkAuth();
