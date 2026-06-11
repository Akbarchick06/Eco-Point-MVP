const app = document.querySelector('#app');
const state = {
  token: localStorage.getItem('edu_token') || '',
  user: null,
  page: 'dashboard',
  lang: localStorage.getItem('edu_lang') || 'ru',
  data: {},
  autoRefreshTimer: null
};

const dict = {
  ru: {
    dashboard: 'Главная', tasks: 'Задания', submissions: 'Проверка', leaderboard: 'Рейтинг', rewards: 'Награды', admin: 'Админ', profile: 'Профиль', logout: 'Выйти',
    welcome: 'Добро пожаловать', points: 'Баллы', completed: 'Выполнено', pending: 'На проверке', badges: 'Значки'
  },
  ky: {
    dashboard: 'Башкы бет', tasks: 'Тапшырмалар', submissions: 'Текшерүү', leaderboard: 'Рейтинг', rewards: 'Сыйлыктар', admin: 'Админ', profile: 'Профиль', logout: 'Чыгуу',
    welcome: 'Кош келиңиз', points: 'Упайлар', completed: 'Аткарылды', pending: 'Текшерүүдө', badges: 'Белгилер'
  }
};

function t(key) { return (dict[state.lang] && dict[state.lang][key]) || dict.ru[key] || key; }
function roleName(role) { return { student: 'Ученик/студент', teacher: 'Учитель/организатор', admin: 'Администратор' }[role] || role; }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}
function formatDate(date) {
  if (!date) return '—';
  try { return new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return date; }
}
function initials(name) {
  return String(name || 'U').split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
}
function toast(message, type = '') {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 3600);
}

function clearAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
}

function startAutoRefresh() {
  clearAutoRefresh();
  state.autoRefreshTimer = setInterval(async () => {
    if (!state.token || !state.user) return;
    const safePages = ['dashboard', 'submissions', 'leaderboard', 'profile'];
    if (!safePages.includes(state.page)) return;
    try {
      await loadData();
      renderPage();
    } catch (error) {
      // Если сессия закончилась или сервер недоступен, не мешаем пользователю всплывающими ошибками.
      console.warn('Auto refresh failed:', error.message);
    }
  }, 7000);
}
async function api(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error || 'Ошибка запроса');
  return json;
}
function formValues(form) {
  const fd = new FormData(form);
  return Object.fromEntries(fd.entries());
}
function fileToData(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result });
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

async function init() {
  if (state.token) {
    try {
      const me = await api('/api/auth/me');
      state.user = me.user;
      await loadData();
      renderShell();
      startAutoRefresh();
      return;
    } catch {
      localStorage.removeItem('edu_token');
      state.token = '';
    }
  }
  renderLanding();
}

function renderLanding() {
  clearAutoRefresh();
  const tpl = document.querySelector('#landing-template').content.cloneNode(true);
  app.innerHTML = '';
  app.appendChild(tpl);
  bindLanding();
}
function bindLanding() {
  const modal = document.querySelector('#auth-modal');
  document.querySelectorAll('[data-action="show-login"]').forEach(btn => btn.addEventListener('click', () => showAuth('login')));
  document.querySelectorAll('[data-action="show-register"]').forEach(btn => btn.addEventListener('click', () => showAuth('register')));
  document.querySelectorAll('[data-action="close-auth"]').forEach(btn => btn.addEventListener('click', () => modal.classList.add('hidden')));
  document.querySelectorAll('[data-auth-tab]').forEach(btn => btn.addEventListener('click', () => showAuth(btn.dataset.authTab)));
  document.querySelectorAll('[data-action="demo-login"]').forEach(btn => btn.addEventListener('click', async () => {
    await login(btn.dataset.email, 'demo123');
  }));
  document.querySelector('[data-action="lang"]')?.addEventListener('click', () => {
    state.lang = state.lang === 'ru' ? 'ky' : 'ru';
    localStorage.setItem('edu_lang', state.lang);
    toast(state.lang === 'ru' ? 'Язык: русский' : 'Тил: кыргызча');
  });
  document.querySelector('#login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const data = formValues(e.currentTarget);
    await login(data.email, data.password);
  });
  document.querySelector('#register-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      const data = formValues(form);
      await api('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
      toast('Аккаунт создан. Теперь войдите.', 'success');
      form.reset();
      showAuth('login');
    } catch (err) { toast(err.message, 'error'); }
  });
}
function showAuth(tab) {
  const modal = document.querySelector('#auth-modal');
  modal?.classList.remove('hidden');
  document.querySelectorAll('[data-auth-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.authTab === tab));
  document.querySelector('#login-form')?.classList.toggle('hidden', tab !== 'login');
  document.querySelector('#register-form')?.classList.toggle('hidden', tab !== 'register');
}
async function login(email, password) {
  try {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('edu_token', state.token);
    await loadData();
    renderShell();
    startAutoRefresh();
    toast('Вы вошли в систему', 'success');
  } catch (err) { toast(err.message, 'error'); }
}
async function logout() {
  clearAutoRefresh();
  try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); } catch {}
  localStorage.removeItem('edu_token');
  state.token = '';
  state.user = null;
  renderLanding();
}
async function loadData() {
  const calls = [
    api('/api/profile').catch(() => null),
    api('/api/tasks').catch(() => ({ tasks: [] })),
    api('/api/submissions').catch(() => ({ submissions: [] })),
    api('/api/leaderboard').catch(() => ({ leaderboard: [] })),
    api('/api/rewards').catch(() => ({ rewards: [] })),
    api('/api/categories').catch(() => ({ categories: [] })),
    api('/api/partners').catch(() => ({ partners: [] })),
    api('/api/badges').catch(() => ({ badges: [], earned: [] })),
    api('/api/notifications').catch(() => ({ notifications: [] }))
  ];
  if (['teacher', 'admin'].includes(state.user.role)) calls.push(api('/api/admin/analytics').catch(() => ({ analytics: null })));
  if (state.user.role === 'admin') calls.push(api('/api/admin/users').catch(() => ({ users: [] })));
  const [profile, tasks, submissions, leaderboard, rewards, categories, partners, badges, notifications, analytics, users] = await Promise.all(calls);
  state.data = {
    profile,
    tasks: tasks.tasks || [],
    submissions: submissions.submissions || [],
    leaderboard: leaderboard.leaderboard || [],
    rewards: rewards.rewards || [],
    categories: categories.categories || [],
    partners: partners.partners || [],
    badges: badges.badges || [],
    earned: badges.earned || [],
    notifications: notifications.notifications || [],
    analytics: analytics?.analytics || null,
    users: users?.users || []
  };
  state.user = profile?.user || state.user;
}
async function refresh() {
  await loadData();
  renderPage();
}

function renderShell() {
  const nav = [
    ['dashboard', '🏠', t('dashboard')],
    ['tasks', '📌', t('tasks')],
    ['leaderboard', '🏆', t('leaderboard')],
    ['rewards', '🎁', t('rewards')],
    ['profile', '👤', t('profile')]
  ];
  if (['teacher', 'admin'].includes(state.user.role)) nav.splice(2, 0, ['submissions', '✅', t('submissions')]);
  if (state.user.role === 'admin') nav.push(['admin', '⚙️', t('admin')]);
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-logo">EDU</div>
          <div><strong>Edu Motivation</strong><span>Motivation platform</span></div>
        </div>
        <div class="profile-mini">
          <div class="avatar">${escapeHtml(initials(state.user.name))}</div>
          <div><p>${escapeHtml(state.user.name)}</p><span>${escapeHtml(roleName(state.user.role))} • ${Number(state.user.points || 0)} балл</span></div>
        </div>
        <nav class="nav">
          ${nav.map(([page, icon, label]) => `<button data-page="${page}" class="${state.page === page ? 'active' : ''}">${icon} ${label}</button>`).join('')}
        </nav>
        <div class="sidebar-bottom">
          <button class="ghost small" data-action="toggle-lang">${state.lang === 'ru' ? 'Кыргызча' : 'Русский'}</button>
          <button class="danger small" data-action="logout">${t('logout')}</button>
        </div>
      </aside>
      <main class="main" id="main"></main>
    </div>`;
  document.querySelectorAll('[data-page]').forEach(btn => btn.addEventListener('click', () => {
    state.page = btn.dataset.page;
    renderShell();
  }));
  document.querySelector('[data-action="logout"]')?.addEventListener('click', logout);
  document.querySelector('[data-action="toggle-lang"]')?.addEventListener('click', () => {
    state.lang = state.lang === 'ru' ? 'ky' : 'ru';
    localStorage.setItem('edu_lang', state.lang);
    renderShell();
  });
  renderPage();
}
function setMain(html) { document.querySelector('#main').innerHTML = html; bindPageActions(); }
function pageHead(title, subtitle, action = '') {
  return `<div class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="actions">${action}</div></div>`;
}
function renderPage() {
  if (state.page === 'dashboard') return renderDashboard();
  if (state.page === 'tasks') return renderTasks();
  if (state.page === 'submissions') return renderSubmissions();
  if (state.page === 'leaderboard') return renderLeaderboard();
  if (state.page === 'rewards') return renderRewards();
  if (state.page === 'profile') return renderProfile();
  if (state.page === 'admin') return renderAdmin();
  renderDashboard();
}

function renderDashboard() {
  const profile = state.data.profile || {};
  const submissions = state.data.submissions || [];
  const approved = submissions.filter(s => s.status === 'approved').length;
  const pending = submissions.filter(s => s.status === 'pending').length;
  const unread = (state.data.notifications || []).filter(n => !n.read).length;
  const analytics = state.data.analytics;
  const topTasks = (state.data.tasks || []).slice(0, 3);
  let html = pageHead(`${t('welcome')}, ${escapeHtml(state.user.name)}!`, 'Здесь собраны задания, баллы, рейтинг, достижения и уведомления.', '<button class="ghost" data-action="manual-refresh">Обновить</button><button class="primary" data-page-jump="tasks">Посмотреть задания</button>');
  html += `<div class="grid grid-4">
    <div class="card stat"><span>${t('points')}</span><strong>${Number(state.user.points || 0)}</strong></div>
    <div class="card stat"><span>${t('completed')}</span><strong>${approved}</strong></div>
    <div class="card stat"><span>${t('pending')}</span><strong>${pending}</strong></div>
    <div class="card stat"><span>${t('badges')}</span><strong>${(profile.badges || []).length}</strong></div>
  </div>`;
  if (unread) html += `<div class="notice">🔔 У вас ${unread} новых уведомлений. <button class="ghost small" data-action="read-notifications">Отметить прочитанными</button></div>`;
  if (analytics) {
    html += `<div class="grid grid-4">
      <div class="card stat"><span>Участники</span><strong>${analytics.students}</strong></div>
      <div class="card stat"><span>Задания</span><strong>${analytics.tasks}</strong></div>
      <div class="card stat"><span>Работы</span><strong>${analytics.submissions}</strong></div>
      <div class="card stat"><span>Всего баллов</span><strong>${analytics.totalPoints}</strong></div>
    </div>`;
  }
  html += `<div class="grid grid-2" style="margin-top:20px">
    <section class="card"><h2>Свежие задания</h2>${topTasks.length ? topTasks.map(taskCard).join('') : empty('Пока нет заданий')}</section>
    <section class="card"><h2>Уведомления</h2>${renderNotifications()}</section>
  </div>`;
  setMain(html);
}
function renderNotifications() {
  const list = state.data.notifications || [];
  if (!list.length) return empty('Пока нет уведомлений');
  return `<div class="stack">${list.slice(0, 7).map(n => `<div class="achievement ${n.read ? 'locked' : ''}"><span>${n.read ? '📭' : '🔔'}</span><div><b>${escapeHtml(n.text)}</b><br><small>${formatDate(n.createdAt)}</small></div></div>`).join('')}</div>`;
}
function empty(text) { return `<div class="empty">${escapeHtml(text)}</div>`; }
function categoryBadge(task) {
  const cat = task.category || state.data.categories.find(c => c.id === task.categoryId);
  return `<span class="badge">${escapeHtml(cat ? (state.lang === 'ky' && cat.titleKy ? cat.titleKy : cat.title) : 'Категория')}</span>`;
}
function difficultyLabel(diff) { return { easy: 'простое', medium: 'среднее', hard: 'сложное' }[diff] || diff; }
function taskCard(task) {
  const already = (state.data.submissions || []).find(s => s.taskId === task.id && s.studentId === state.user.id);
  return `<article class="task-card" style="padding:16px 0;border-bottom:1px solid var(--line)">
    <div class="meta">${categoryBadge(task)}<span class="points">+${Number(task.points || 0)} баллов</span><span>${escapeHtml(difficultyLabel(task.difficulty))}</span><span>до ${formatDate(task.deadline)}</span></div>
    <h3>${escapeHtml(task.title)}</h3>
    <p>${escapeHtml(task.description)}</p>
    ${task.requirements ? `<small><b>Требования:</b> ${escapeHtml(task.requirements)}</small>` : ''}
    <div class="actions">
      ${state.user.role === 'student' ? (already ? `<span class="status ${already.status}">${statusText(already.status)}</span>` : `<button class="primary small" data-action="open-submit" data-task-id="${task.id}">Сдать задание</button>`) : ''}
      ${['teacher','admin'].includes(state.user.role) ? `<span class="badge">${task.submissionsCount || 0} работ</span>` : ''}
    </div>
  </article>`;
}
function statusText(status) { return { pending: 'На проверке', approved: 'Одобрено', rejected: 'Отклонено' }[status] || status; }

function renderTasks() {
  const canCreate = ['teacher', 'admin'].includes(state.user.role);
  let html = pageHead('Список заданий', 'Ученики выполняют задания, учителя проверяют и начисляют баллы.', canCreate ? '<button class="primary" data-action="toggle-create-task">+ Создать задание</button>' : '');
  if (canCreate) html += renderCreateTaskForm(true);
  html += `<section class="card"><h2>Опубликованные задания</h2>${state.data.tasks.length ? state.data.tasks.map(taskCard).join('') : empty('Заданий пока нет')}</section>`;
  setMain(html);
}
function renderCreateTaskForm(hidden = false) {
  const cats = state.data.categories || [];
  return `<section class="card ${hidden ? 'hidden' : ''}" id="create-task-card" style="margin-bottom:20px">
    <h2>Новое задание</h2>
    <form id="create-task-form" class="grid grid-2">
      <label>Название<input name="title" required placeholder="Например: Участие в конкурсе"></label>
      <label>Категория<select name="categoryId">${cats.map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('')}</select></label>
      <label>Сложность<select name="difficulty"><option value="easy">Простое — 10 баллов</option><option value="medium">Среднее — 25 баллов</option><option value="hard">Сложное — 50 баллов</option></select></label>
      <label>Баллы<input name="points" type="number" min="1" value="10"></label>
      <label>Срок выполнения<input name="deadline" type="date"></label>
      <label>Статус<select name="status"><option value="published">Опубликовать</option><option value="draft">Черновик</option></select></label>
      <label style="grid-column:1/-1">Описание<textarea name="description" required placeholder="Что нужно сделать ученику?"></textarea></label>
      <label style="grid-column:1/-1">Требования<textarea name="requirements" placeholder="Файл, фото, отчёт, видео, ссылка..."></textarea></label>
      <div style="grid-column:1/-1"><button class="primary">Опубликовать задание</button></div>
    </form>
  </section>`;
}

function renderSubmissions() {
  const pending = state.data.submissions.filter(s => s.status === 'pending');
  const all = state.data.submissions;
  let html = pageHead('Проверка работ', 'Учитель подтверждает выполнение задания и начисляет баллы.', '<button class="ghost" data-action="manual-refresh">Обновить</button>');
  html += `<section class="card"><h2>Ожидают проверки</h2>${pending.length ? pending.map(submissionCard).join('') : empty('Нет работ на проверку')}</section>`;
  html += `<section class="card" style="margin-top:20px"><h2>История проверок</h2>${all.length ? renderSubmissionsTable(all) : empty('История пустая')}</section>`;
  setMain(html);
}
function submissionCard(s) {
  return `<article class="task-card" style="padding:16px 0;border-bottom:1px solid var(--line)">
    <div class="meta"><span class="status ${s.status}">${statusText(s.status)}</span><span>${formatDate(s.createdAt)}</span><span>${escapeHtml(s.student?.name || '')}</span></div>
    <h3>${escapeHtml(s.task?.title || 'Задание')}</h3>
    <p>${escapeHtml(s.comment)}</p>
    ${s.file ? `<a class="file-link" href="${s.file.url}" target="_blank">📎 ${escapeHtml(s.file.originalName)}</a>` : ''}
    ${s.status === 'pending' ? `<div class="actions"><button class="success small" data-action="approve-submission" data-sub-id="${s.id}" data-points="${s.task?.points || 0}">Одобрить</button><button class="danger small" data-action="reject-submission" data-sub-id="${s.id}">Отклонить</button></div>` : ''}
  </article>`;
}
function renderSubmissionsTable(list) {
  return `<div class="table-wrap"><table><thead><tr><th>Ученик</th><th>Задание</th><th>Статус</th><th>Баллы</th><th>Дата</th></tr></thead><tbody>${list.map(s => `<tr><td>${escapeHtml(s.student?.name || '')}<br><small>${escapeHtml(s.student?.group || '')}</small></td><td>${escapeHtml(s.task?.title || '')}</td><td><span class="status ${s.status}">${statusText(s.status)}</span></td><td>${Number(s.pointsAwarded || 0)}</td><td>${formatDate(s.createdAt)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderLeaderboard() {
  let html = pageHead('Рейтинг участников', 'Чем больше полезных активностей — тем выше место в рейтинге.');
  html += `<section class="card"><div class="table-wrap"><table><thead><tr><th>Место</th><th>Участник</th><th>Класс/группа</th><th>Баллы</th><th>Значки</th></tr></thead><tbody>${state.data.leaderboard.map((u, i) => `<tr><td><b>${i + 1}</b></td><td>${escapeHtml(u.name)}<br><small>${escapeHtml(u.school || '')}</small></td><td>${escapeHtml(u.group || '')}</td><td><span class="points">${Number(u.points || 0)}</span></td><td>${(u.badges || []).map(b => `${escapeHtml(b.icon)} ${escapeHtml(b.title)}`).join('<br>') || '—'}</td></tr>`).join('')}</tbody></table></div></section>`;
  setMain(html);
}
function renderRewards() {
  let html = pageHead('Награды и партнёры', 'Баллы можно обменивать на скидки, сертификаты, розыгрыши и бонусы.');
  html += `<div class="grid grid-3">${state.data.rewards.length ? state.data.rewards.map(rewardCard).join('') : empty('Наград пока нет')}</div>`;
  setMain(html);
}
function rewardTypeLabel(type) {
  return { discount: 'Скидка', certificate: 'Сертификат', lottery: 'Розыгрыш', course: 'Курс', gift: 'Подарок', bonus: 'Бонус' }[type] || 'Награда';
}
function rewardCard(r) {
  const canBuy = state.user.role === 'student' && state.user.points >= r.cost && r.stock > 0;
  const notEnough = state.user.role === 'student' && state.user.points < r.cost;
  return `<article class="card reward ${r.type === 'certificate' ? 'reward-certificate' : ''}">
    <div class="meta"><span class="points">${Number(r.cost)} баллов</span><span>Осталось: ${Number(r.stock)}</span></div>
    <div class="reward-type">${escapeHtml(rewardTypeLabel(r.type))}</div>
    <h3>${escapeHtml(r.title)}</h3>
    <p>${escapeHtml(r.description)}</p>
    <small>Партнёр: ${escapeHtml(r.partner?.name || 'Платформа')}</small>
    ${state.user.role === 'student' ? `<button class="${canBuy ? 'primary' : 'ghost'} small" data-action="redeem" data-reward-id="${r.id}" ${canBuy ? '' : 'disabled'}>${canBuy ? (r.type === 'certificate' ? 'Получить сертификат' : 'Получить награду') : (notEnough ? 'Не хватает баллов' : 'Недоступно')}</button>` : ''}
  </article>`;
}
function renderProfile() {
  const p = state.data.profile || {};
  const allBadges = state.data.badges || [];
  const earnedIds = new Set((p.badges || []).map(b => b.id));
  let html = pageHead('Мой профиль', 'Баллы, достижения, отправленные работы и полученные награды.');
  html += `<div class="grid grid-2">
    <section class="card"><h2>${escapeHtml(state.user.name)}</h2><p>${escapeHtml(roleName(state.user.role))} • ${escapeHtml(state.user.group || '')} • ${escapeHtml(state.user.school || '')}</p><div class="score-circle" style="width:150px;height:150px"><strong>${Number(state.user.points || 0)}</strong><span>баллов</span></div></section>
    <section class="card"><h2>Достижения</h2><div class="badge-grid">${allBadges.map(b => `<div class="achievement ${earnedIds.has(b.id) ? '' : 'locked'}"><span style="font-size:28px">${escapeHtml(b.icon)}</span><div><b>${escapeHtml(state.lang === 'ky' && b.titleKy ? b.titleKy : b.title)}</b><br><small>${escapeHtml(b.description)}</small></div></div>`).join('')}</div></section>
  </div>`;
  html += `<section class="card" style="margin-top:20px"><h2>Мои работы</h2>${p.submissions?.length ? renderSubmissionsTable(p.submissions) : empty('Вы ещё не отправляли задания')}</section>`;
  html += `<section class="card" style="margin-top:20px"><h2>История баллов</h2>${p.transactions?.length ? `<div class="table-wrap"><table><thead><tr><th>Причина</th><th>Баллы</th><th>Дата</th></tr></thead><tbody>${p.transactions.map(tr => `<tr><td>${escapeHtml(tr.reason)}</td><td><span class="points">${tr.amount > 0 ? '+' : ''}${tr.amount}</span></td><td>${formatDate(tr.createdAt)}</td></tr>`).join('')}</tbody></table></div>` : empty('История пустая')}</section>`;
  const certificates = (p.redemptions || []).filter(r => r.certificate || r.reward?.type === 'certificate');
  if (certificates.length) html += `<section class="card" style="margin-top:20px"><div class="section-head"><div><h2>Мои сертификаты</h2><p>Полученные сертификаты отображаются здесь и остаются в профиле.</p></div></div><div class="certificates-list">${certificates.map(renderCertificate).join('')}</div></section>`;
  if (p.redemptions?.length) html += `<section class="card" style="margin-top:20px"><h2>Полученные награды</h2><div class="table-wrap"><table><thead><tr><th>Награда</th><th>Тип</th><th>Код</th><th>Дата</th></tr></thead><tbody>${p.redemptions.map(r => `<tr><td>${escapeHtml(r.reward?.title || '')}</td><td>${escapeHtml(rewardTypeLabel(r.reward?.type))}</td><td><b>${escapeHtml(r.code)}</b></td><td>${formatDate(r.createdAt)}</td></tr>`).join('')}</tbody></table></div></section>`;
  setMain(html);
}

function renderCertificate(redemption) {
  const c = redemption.certificate || {};
  const user = state.data.profile?.user || state.user;
  const issued = formatDate(c.issuedAt || redemption.createdAt);
  return `<div class="certificate-card">
    <div class="certificate-border">
      <div class="certificate-topline">Edu Motivation Platform</div>
      <div class="certificate-title">${escapeHtml(c.title || 'СЕРТИФИКАТ АКТИВНОГО УЧАСТНИКА')}</div>
      <div class="certificate-subtitle">${escapeHtml(c.subtitle || 'за активное участие в заданиях и проектах')}</div>
      <div class="certificate-name">${escapeHtml(c.participantName || user.name)}</div>
      <div class="certificate-text">награждается за активное выполнение заданий, участие в образовательных проектах и вклад в развитие школьной/студенческой активности.</div>
      <div class="certificate-info">
        <span>Группа: ${escapeHtml(c.group || user.group || '—')}</span>
        <span>Дата: ${escapeHtml(issued)}</span>
        <span>№ ${escapeHtml(c.code || redemption.code)}</span>
      </div>
      <div class="certificate-footer">
        <span>${escapeHtml(c.school || user.school || 'Образовательная организация')}</span>
        <span>Подпись: ____________</span>
      </div>
    </div>
  </div>`;
}

function renderAdmin() {
  if (state.user.role !== 'admin') return setMain(pageHead('Нет доступа', 'Этот раздел доступен только администратору.'));
  const a = state.data.analytics || {};
  let html = pageHead('Админ-панель', 'Управление пользователями, партнёрами, наградами и аналитикой.');
  html += `<div class="grid grid-4"><div class="card stat"><span>Пользователи</span><strong>${a.users || 0}</strong></div><div class="card stat"><span>Ученики</span><strong>${a.students || 0}</strong></div><div class="card stat"><span>Задания</span><strong>${a.tasks || 0}</strong></div><div class="card stat"><span>Обмены</span><strong>${a.redemptions || 0}</strong></div></div>`;
  html += `<div class="grid grid-2" style="margin-top:20px">
    <section class="card"><h2>Добавить партнёра</h2><form id="partner-form" class="stack"><label>Название<input name="name" required></label><label>Описание<textarea name="description"></textarea></label><label>Контакт<input name="contact"></label><button class="primary">Сохранить партнёра</button></form></section>
    <section class="card"><h2>Добавить награду</h2><form id="reward-form" class="stack"><label>Название<input name="title" required></label><label>Описание<textarea name="description"></textarea></label><label>Тип награды<select name="type"><option value="bonus">Бонус</option><option value="certificate">Сертификат</option><option value="discount">Скидка</option><option value="lottery">Розыгрыш</option><option value="course">Курс</option><option value="gift">Подарок</option></select></label><label>Партнёр<select name="partnerId"><option value="">Платформа</option>${state.data.partners.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select></label><label>Цена в баллах<input name="cost" type="number" min="1" value="50"></label><label>Количество<input name="stock" type="number" min="0" value="10"></label><button class="primary">Сохранить награду</button></form></section>
  </div>`;
  html += `<section class="card" style="margin-top:20px"><h2>Пользователи</h2><div class="table-wrap"><table><thead><tr><th>ФИО</th><th>Email</th><th>Роль</th><th>Баллы</th><th>Статус</th><th>Действия</th></tr></thead><tbody>${state.data.users.map(u => `<tr><td>${escapeHtml(u.name)}<br><small>${escapeHtml(u.group || '')}</small></td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(roleName(u.role))}</td><td>${Number(u.points || 0)}</td><td>${u.blocked ? '<span class="status rejected">Заблокирован</span>' : '<span class="status approved">Активен</span>'}</td><td><button class="ghost small" data-action="toggle-block" data-user-id="${u.id}" data-blocked="${u.blocked ? 'false' : 'true'}">${u.blocked ? 'Разблокировать' : 'Блокировать'}</button></td></tr>`).join('')}</tbody></table></div></section>`;
  html += `<section class="card" style="margin-top:20px"><h2>Активность по категориям</h2>${a.byCategory ? a.byCategory.map(c => `<div style="margin:12px 0"><b>${escapeHtml(c.title)}</b><div class="kpi-bar"><i style="width:${Math.min(100, c.submissions * 12)}%"></i></div><small>${c.tasks} заданий • ${c.submissions} работ • ${c.approved} одобрено</small></div>`).join('') : empty('Нет данных')}</section>`;
  setMain(html);
}

function openSubmitModal(taskId) {
  const task = state.data.tasks.find(t => t.id === taskId);
  if (!task) return;
  const modal = document.createElement('div');
  modal.className = 'auth-modal';
  modal.innerHTML = `<div class="modal-card"><button class="close" data-action="close-modal">×</button><h2>Сдать задание</h2><p><b>${escapeHtml(task.title)}</b><br><span class="points">+${Number(task.points)} баллов после проверки</span></p><form id="submit-task-form" class="stack"><label>Комментарий / отчёт<textarea name="comment" placeholder="Опишите, что вы сделали"></textarea></label><label>Файл, фото, видео или документ<input name="file" type="file" accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.txt"></label><button class="primary">Отправить на проверку</button></form></div>`;
  document.body.appendChild(modal);
  modal.querySelector('[data-action="close-modal"]').addEventListener('click', () => modal.remove());
  modal.querySelector('#submit-task-form').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Отправка...';
    try {
      const file = form.file.files[0] ? await fileToData(form.file.files[0]) : null;
      await api(`/api/tasks/${taskId}/submit`, { method: 'POST', body: JSON.stringify({ comment: form.comment.value, file }) });
      modal.remove();
      toast('Работа отправлена на проверку', 'success');
      await refresh();
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Отправить на проверку'; }
  });
}
async function reviewSubmission(id, status, defaultPoints = 0) {
  const pointsAwarded = status === 'approved' ? Number(prompt('Сколько баллов начислить?', defaultPoints) || defaultPoints) : 0;
  const teacherComment = prompt(status === 'approved' ? 'Комментарий ученику' : 'Причина отклонения', '') || '';
  try {
    await api(`/api/submissions/${id}/review`, { method: 'PATCH', body: JSON.stringify({ status, pointsAwarded, teacherComment }) });
    toast(status === 'approved' ? 'Работа одобрена' : 'Работа отклонена', 'success');
    await refresh();
  } catch (err) { toast(err.message, 'error'); }
}

function bindPageActions() {
  document.querySelectorAll('[data-action="manual-refresh"]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Обновление...';
    try {
      await refresh();
      toast('Данные обновлены', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }));
  document.querySelectorAll('[data-page-jump]').forEach(btn => btn.addEventListener('click', () => { state.page = btn.dataset.pageJump; renderShell(); }));
  document.querySelector('[data-action="toggle-create-task"]')?.addEventListener('click', () => document.querySelector('#create-task-card')?.classList.toggle('hidden'));
  document.querySelector('#create-task-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await api('/api/tasks', { method: 'POST', body: JSON.stringify(formValues(form)) });
      form.reset();
      toast('Задание создано', 'success');
      await refresh();
    } catch (err) { toast(err.message, 'error'); }
  });
  document.querySelectorAll('[data-action="open-submit"]').forEach(btn => btn.addEventListener('click', () => openSubmitModal(btn.dataset.taskId)));
  document.querySelectorAll('[data-action="approve-submission"]').forEach(btn => btn.addEventListener('click', () => reviewSubmission(btn.dataset.subId, 'approved', btn.dataset.points)));
  document.querySelectorAll('[data-action="reject-submission"]').forEach(btn => btn.addEventListener('click', () => reviewSubmission(btn.dataset.subId, 'rejected', 0)));
  document.querySelectorAll('[data-action="redeem"]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Обменять баллы на эту награду?')) return;
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Получение...';
    try {
      const result = await api(`/api/rewards/${btn.dataset.rewardId}/redeem`, { method: 'POST', body: '{}' });
      const isCertificate = result.reward?.type === 'certificate' || result.redemption?.certificate;
      toast(isCertificate ? 'Сертификат получен и добавлен в профиль.' : 'Награда получена. Код находится в профиле.', 'success');
      if (result.user) state.user = result.user;
      await loadData();
      if (isCertificate) state.page = 'profile';
      renderShell();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = oldText;
      toast(err.message, 'error');
    }
  }));
  document.querySelector('#partner-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget;
    try { await api('/api/partners', { method: 'POST', body: JSON.stringify(formValues(form)) }); form.reset(); toast('Партнёр добавлен', 'success'); await refresh(); }
    catch (err) { toast(err.message, 'error'); }
  });
  document.querySelector('#reward-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget;
    try { await api('/api/rewards', { method: 'POST', body: JSON.stringify(formValues(form)) }); form.reset(); toast('Награда добавлена', 'success'); await refresh(); }
    catch (err) { toast(err.message, 'error'); }
  });
  document.querySelectorAll('[data-action="toggle-block"]').forEach(btn => btn.addEventListener('click', async () => {
    try { await api(`/api/admin/users/${btn.dataset.userId}`, { method: 'PATCH', body: JSON.stringify({ blocked: btn.dataset.blocked === 'true' }) }); toast('Статус пользователя изменён', 'success'); await refresh(); }
    catch (err) { toast(err.message, 'error'); }
  }));
  document.querySelector('[data-action="read-notifications"]')?.addEventListener('click', async () => {
    try { await api('/api/notifications/read', { method: 'POST', body: '{}' }); await refresh(); }
    catch (err) { toast(err.message, 'error'); }
  });
}

init();
