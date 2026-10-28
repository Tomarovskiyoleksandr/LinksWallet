const $ = selector => document.querySelector(selector);
const state = { user: null, boards: [], links: new Map(), selected: null };
const icon = name => `<img src="/img/about/${name}.svg" alt="">`;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function stored(key, value) { try { if (value === undefined) return localStorage.getItem(key); localStorage.setItem(key, value); } catch {} }
function notice(message = '') { $('#notice').textContent = message; $('#notice').hidden = !message; }
async function api(path, method = 'GET', body) {
    const response = await fetch(path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.message || 'Не удалось выполнить действие'); error.status = response.status; throw error; }
    return data;
}
function selectedBoard() { return state.boards.find(board => board.id === state.selected); }
function empty(title, text, login = false) { return `<div class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${login ? '<a class="primary" href="/login">Войти в аккаунт</a>' : ''}</div>`; }
function selectBoard(id) { state.selected = id; stored('selectedBoard', String(id)); $('#search').value = ''; render(); }
function render() {
    const board = selectedBoard();
    $('#addBoard').disabled = !state.user;
    $('#addLink').disabled = !state.user || !board;
    $('#boardTools').hidden = !board;
    $('#boardsList').replaceChildren();
    for (const item of state.boards) {
        const button = document.createElement('button');
        button.className = `board${item.id === state.selected ? ' active' : ''}`;
        button.setAttribute('aria-pressed', String(item.id === state.selected));
        button.innerHTML = `<span class="folder-color" aria-hidden="true"></span><span class="board-name">${escapeHtml(item.name)}</span><span class="board-count">${(state.links.get(item.id) || []).length}</span>`;
        button.title = item.name; button.onclick = () => selectBoard(item.id); $('#boardsList').append(button);
    }
    if (!state.boards.length) $('#boardsList').innerHTML = '<p class="placeholder">' + (state.user ? 'Создайте первую папку кнопкой «+».' : 'Войдите, чтобы увидеть папки.') + '</p>';
    $('#boardTitle').textContent = board?.name || 'Ваши ссылки'; renderLinks();
}
function safeUrl(raw) { try { const url = new URL(raw); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; } }
function renderLinks() {
    const board = selectedBoard(); const all = state.links.get(state.selected) || [];
    const query = $('#search').value.trim().toLocaleLowerCase('ru');
    const links = all.filter(link => `${link.title} ${link.url}`.toLocaleLowerCase('ru').includes(query));
    $('#linkCount').textContent = board ? (query ? `Найдено: ${links.length} из ${all.length}` : `Ссылок: ${all.length}`) : '';
    const list = $('#linksList'); list.replaceChildren();
    if (!state.user) { list.innerHTML = empty('Важное — под рукой', 'Войдите, чтобы сохранять и организовывать ссылки.', true); return; }
    if (!board) { list.innerHTML = empty('Начните с папки', 'Нажмите «+» рядом с «Мои папки» и добавьте первую ссылку.'); return; }
    if (!links.length) { list.innerHTML = empty(query ? 'Ничего не найдено' : 'В этой папке пока пусто', query ? 'Попробуйте другое название или адрес.' : 'Нажмите «Добавить ссылку», чтобы сохранить что-нибудь полезное.'); return; }
    for (const link of links) {
        const url = safeUrl(link.url); const row = document.createElement('article'); row.className = 'link-row';
        row.innerHTML = `<a class="link-main" ${url ? `href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"` : ''}><span class="favicon">${escapeHtml(link.title.charAt(0).toUpperCase())}</span><span class="link-copy"><span class="link-title">${escapeHtml(link.title)}</span><span class="link-url">${escapeHtml(link.url)}</span></span></a><span class="board-tag">${escapeHtml(board.name)}</span><div class="link-actions"></div>`;
        const actions = row.querySelector('.link-actions');
        if (url) { const open = document.createElement('a'); open.className = 'icon-button'; open.href = url; open.target = '_blank'; open.rel = 'noopener noreferrer'; open.title = `Открыть ${link.title}`; open.setAttribute('aria-label', open.title); open.innerHTML = icon('external-link'); actions.append(open); }
        for (const [name, label, handler] of [['pencil', 'Редактировать ссылку', () => editLink(link)], ['trash-2', 'Удалить ссылку', () => confirmDelete('Удалить ссылку?', `«${link.title}» будет удалена из папки.`, async () => { await api(`/links/${link.id}`, 'DELETE'); await refresh(); })]]) {
            const button = document.createElement('button'); button.className = 'icon-button'; button.title = label; button.setAttribute('aria-label', label); button.innerHTML = icon(name); button.onclick = handler; actions.append(button);
        }
        list.append(row);
    }
}
async function refresh(preferred = state.selected) {
    const { boards } = await api('/boards');
    const links = await Promise.all(boards.map(async board => [board.id, (await api(`/links?boardId=${board.id}`)).links]));
    state.boards = boards; state.links = new Map(links);
    const selected = boards.some(board => board.id === preferred) ? preferred : boards[0]?.id ?? null;
    if (selected !== state.selected) $('#search').value = '';
    state.selected = selected; stored('selectedBoard', String(selected)); render();
}
let submitDialog = null;
function openDialog(title, fields, submit, buttonText = 'Сохранить') {
    $('#dialogTitle').textContent = title; $('#dialogFields').innerHTML = fields; $('#dialogError').textContent = '';
    $('#saveDialog').textContent = buttonText; $('#saveDialog').hidden = !submit; $('#saveDialog').disabled = false;
    $('#cancelDialog').textContent = submit ? 'Отмена' : 'Закрыть'; submitDialog = submit;
    $('#editor').showModal(); ($('#dialogFields input') || $('#closeDialog')).focus();
}
const field = (label, name, value = '', max = 200, type = 'text') => `<label class="field">${label}<input type="${type}" name="${name}" value="${escapeHtml(value)}" maxlength="${max}" ${type === 'password' ? 'autocomplete="current-password"' : ''} required></label>`;
function editBoard() {
    const board = selectedBoard(); if (!board) return;
    openDialog('Переименовать папку', field('Название папки', 'name', board.name, 100), async form => { await api(`/boards/${board.id}`, 'PATCH', { name: form.get('name').trim() }); await refresh(); });
}
function editLink(link = null) {
    if (!selectedBoard()) return;
    const folders = link ? '' : `<label class="field">Папка<select name="boardId">${state.boards.map(board => `<option value="${board.id}" ${board.id === state.selected ? 'selected' : ''}>${escapeHtml(board.name)}</option>`).join('')}</select></label>`;
    openDialog(link ? 'Редактировать ссылку' : 'Добавить ссылку', field('Название', 'title', link?.title || '') + field('Адрес сайта', 'url', link?.url || '', 2048) + folders, async form => {
        let raw = form.get('url').trim(); if (!/^[a-z][a-z\d+.-]*:/i.test(raw)) raw = 'https://' + raw;
        const url = safeUrl(raw); if (!url) throw new Error('Введите корректную ссылку с http:// или https://');
        const body = { title: form.get('title').trim(), url }; if (!link) body.boardId = Number(form.get('boardId'));
        await api(link ? `/links/${link.id}` : '/links', link ? 'PATCH' : 'POST', body);
        await refresh(link ? state.selected : body.boardId);
    }, link ? 'Сохранить' : 'Добавить');
}
function confirmDelete(title, text, action) { openDialog(title, `<p class="dialog-copy">${escapeHtml(text)}</p>`, action, 'Удалить'); }
function profile() {
    if (!state.user) { window.location.href = '/login'; return; }
    location.hash = 'profile';
    showView();
    $('#profileTitle').focus();
}
function renderProfile() {
    if (!state.user) return;
    const { username, email, created_at } = state.user;
    $('#profileName').textContent = $('#accountName').textContent = $('#greeting').textContent = username;
    $('#profileEmail').textContent = $('#accountEmail').textContent = email;
    $('#profileAvatar').textContent = Array.from(username.trim())[0]?.toLocaleUpperCase('ru') || '?';
    const date = created_at ? new Date(created_at) : null;
    $('#accountDate').textContent = date && !Number.isNaN(date.getTime())
        ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
        : 'Не указана';
}
function showView() {
    const isProfile = location.hash === '#profile';
    $('#profileView').hidden = !isProfile;
    $('.workspace-header').hidden = isProfile;
    $('.content-grid').hidden = isProfile;
    for (const [id, active] of [['profileNav', isProfile], ['linksNav', !isProfile]]) {
        $('#' + id).classList.toggle('active', active);
        if (active) $('#' + id).setAttribute('aria-current', 'page');
        else $('#' + id).removeAttribute('aria-current');
    }
    document.title = `${isProfile ? 'Профиль' : 'Мои ссылки'} — LinksWallet`;
    renderProfile();
}
window.addEventListener('hashchange', () => {
    if (location.hash === '#profile' && !state.user) return;
    showView();
});
$('#editName').onclick = () => {
    if (!state.user) return;
    openDialog('Изменить имя', field('Имя пользователя', 'username', state.user.username, 30), async form => {
        const username = form.get('username').trim();
        if (username.length < 3) throw new Error('Имя должно содержать от 3 до 30 символов.');
        state.user = (await api('/me', 'PATCH', { username })).user;
        renderProfile();
    });
    $('#dialogFields input').minLength = 3;
    $('#dialogFields input').autocomplete = 'nickname';
};
$('#editorForm').onsubmit = async event => {
    event.preventDefault(); if (!submitDialog || $('#saveDialog').disabled) return;
    $('#saveDialog').disabled = true; $('#dialogError').textContent = '';
    try { const shouldClose = await submitDialog(new FormData(event.currentTarget)); if (shouldClose !== false) { $('#editor').close(); notice(); } }
    catch (error) { $('#dialogError').textContent = error.message; }
    finally { $('#saveDialog').disabled = false; }
};
$('#closeDialog').onclick = $('#cancelDialog').onclick = () => { if (!$('#saveDialog').disabled) $('#editor').close(); };
$('#editor').addEventListener('cancel', event => { if ($('#saveDialog').disabled) event.preventDefault(); });
$('#search').oninput = renderLinks;
$('#addLink').onclick = () => editLink();
$('#addBoard').onclick = () => openDialog('Новая папка', field('Название папки', 'name', '', 100), async form => { const { board } = await api('/boards', 'POST', { name: form.get('name').trim() }); await refresh(board.id); }, 'Создать');
$('#editBoard').onclick = editBoard;
$('#deleteBoard').onclick = () => { const board = selectedBoard(); if (board) confirmDelete('Удалить папку?', `Папка «${board.name}» и все её ссылки будут удалены.`, async () => { await api(`/boards/${board.id}`, 'DELETE'); await refresh(); }); };
$('#profileNav').onclick = $('#profileButton').onclick = profile;
$('#foldersNav').onclick = () => { location.hash = 'links'; showView(); $('#foldersPanel').scrollIntoView({ block: 'nearest' }); $('#foldersPanel').focus(); };
$('#linksNav').onclick = () => { location.hash = 'links'; showView(); $('#main').scrollIntoView({ block: 'start' }); $('#search').focus(); };
$('#logoutButton').onclick = async () => { try { await api('/logout', 'POST'); window.location.href = '/login'; } catch (error) { notice(error.message); } };
function setTheme(dark) { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; $('#themeToggle span').textContent = dark ? 'Светлая тема' : 'Тёмная тема'; $('#themeToggle').setAttribute('aria-pressed', String(dark)); }
setTheme(stored('theme') === 'dark');
$('#themeToggle').onclick = () => { const dark = document.documentElement.dataset.theme !== 'dark'; setTheme(dark); stored('theme', dark ? 'dark' : 'light'); };
(async () => {
    try {
        state.user = (await api('/me')).user; $('#greeting').textContent = state.user.username;
        $('#logoutButton').hidden = false; $('#loginLink').hidden = true;
        showView();
        await refresh(Number(stored('selectedBoard')));
    } catch (error) { render(); if (error.status === 401 && location.hash === '#profile') window.location.href = '/login'; else if (error.status !== 401) notice('Не удалось загрузить данные. Обновите страницу. ' + error.message); }
})();
