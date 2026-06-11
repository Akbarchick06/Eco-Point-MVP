const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'school.json');
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const sessions = new Map();

function ensureDirs() {
  for (const dir of [DATA_DIR, UPLOAD_DIR, PUBLIC_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function uid(prefix = '') {
  return `${prefix}${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
}

function now() {
  return new Date().toISOString();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = hashPassword(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

function seedDb() {
  const adminPass = hashPassword('demo123');
  const teacherPass = hashPassword('demo123');
  const studentPass = hashPassword('demo123');
  const student2Pass = hashPassword('demo123');
  const createdAt = now();

  const users = [
    {
      id: 'u_admin',
      name: 'Администратор',
      email: 'admin@school.local',
      passwordHash: adminPass,
      role: 'admin',
      group: 'Администрация',
      school: 'Демо-школа',
      points: 0,
      blocked: false,
      createdAt
    },
    {
      id: 'u_teacher',
      name: 'Айгүл Мугалимова',
      email: 'teacher@school.local',
      passwordHash: teacherPass,
      role: 'teacher',
      group: 'Учителя',
      school: 'Демо-школа',
      points: 0,
      blocked: false,
      createdAt
    },
    {
      id: 'u_student',
      name: 'Бектур Ашимов',
      email: 'student@school.local',
      passwordHash: studentPass,
      role: 'student',
      group: '9-А',
      school: 'Демо-школа',
      points: 75,
      blocked: false,
      createdAt
    },
    {
      id: 'u_student2',
      name: 'Айдана Садыкова',
      email: 'student2@school.local',
      passwordHash: student2Pass,
      role: 'student',
      group: '10-Б',
      school: 'Демо-школа',
      points: 35,
      blocked: false,
      createdAt
    }
  ];

  const categories = [
    { id: 'cat_study', title: 'Учёба', titleKy: 'Окуу', color: '#2563eb', createdAt },
    { id: 'cat_project', title: 'Проекты', titleKy: 'Долбоорлор', color: '#7c3aed', createdAt },
    { id: 'cat_social', title: 'Общественная активность', titleKy: 'Коомдук активдүүлүк', color: '#059669', createdAt },
    { id: 'cat_contest', title: 'Конкурсы', titleKy: 'Сынактар', color: '#ea580c', createdAt }
  ];

  const tasks = [
    {
      id: 'task_1',
      title: 'Сделать мини-проект по экологии',
      description: 'Подготовьте короткую презентацию или постер на тему сохранения природы. Можно загрузить фото, PDF или ссылку на презентацию.',
      categoryId: 'cat_project',
      difficulty: 'medium',
      points: 25,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      requirements: 'Минимум 5 слайдов или 1 постер. Добавьте вывод и личное мнение.',
      status: 'published',
      createdBy: 'u_teacher',
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 'task_2',
      title: 'Принять участие в олимпиаде или конкурсе',
      description: 'Загрузите подтверждение участия: фото сертификата, скрин регистрации или ссылку.',
      categoryId: 'cat_contest',
      difficulty: 'hard',
      points: 50,
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      requirements: 'Подтверждение участия обязательно.',
      status: 'published',
      createdBy: 'u_teacher',
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 'task_3',
      title: 'Помочь однокласснику разобраться с темой',
      description: 'Опишите, кому и в какой теме помогли. Можно приложить фото конспекта или короткий отчёт.',
      categoryId: 'cat_social',
      difficulty: 'easy',
      points: 10,
      deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      requirements: 'Короткий отчёт 5–7 предложений.',
      status: 'published',
      createdBy: 'u_teacher',
      createdAt,
      updatedAt: createdAt
    }
  ];

  const submissions = [
    {
      id: 'sub_1',
      taskId: 'task_3',
      studentId: 'u_student',
      comment: 'Помог однокласснику повторить HTML-теги и структуру страницы.',
      file: null,
      status: 'approved',
      pointsAwarded: 10,
      teacherComment: 'Хорошая активность. Продолжай помогать другим.',
      reviewedBy: 'u_teacher',
      createdAt,
      reviewedAt: createdAt
    }
  ];

  const partners = [
    { id: 'partner_1', name: 'BookHouse', description: 'Скидки на книги и канцтовары', contact: '+996 700 000 001', createdAt },
    { id: 'partner_2', name: 'IT Course Center', description: 'Бонусы на IT-курсы', contact: '+996 700 000 002', createdAt }
  ];

  const rewards = [
    {
      id: 'reward_1',
      title: 'Скидка 10% на канцтовары',
      description: 'Промокод от партнёра BookHouse.',
      partnerId: 'partner_1',
      cost: 50,
      stock: 20,
      type: 'discount',
      active: true,
      createdAt
    },
    {
      id: 'reward_2',
      title: 'Сертификат активного участника',
      description: 'Именной электронный сертификат, который появляется в профиле после получения.',
      partnerId: null,
      cost: 50,
      stock: 1000,
      type: 'certificate',
      active: true,
      createdAt
    },
    {
      id: 'reward_3',
      title: 'Розыгрыш мерча',
      description: 'Участие в розыгрыше фирменного мерча.',
      partnerId: 'partner_2',
      cost: 30,
      stock: 50,
      type: 'lottery',
      active: true,
      createdAt
    }
  ];

  const redemptions = [];
  const pointTransactions = [
    { id: 'pt_seed_1', userId: 'u_student', amount: 65, type: 'bonus', reason: 'Стартовые демо-баллы', createdAt },
    { id: 'pt_seed_2', userId: 'u_student', amount: 10, type: 'task', reason: 'Помощь однокласснику разобраться с темой', submissionId: 'sub_1', createdAt },
    { id: 'pt_seed_3', userId: 'u_student2', amount: 35, type: 'bonus', reason: 'Стартовые демо-баллы', createdAt }
  ];

  const badges = [
    { id: 'badge_first', title: 'Первый шаг', titleKy: 'Биринчи кадам', description: 'Первое выполненное задание', icon: '🌱', minPoints: 0, rule: 'first_approved' },
    { id: 'badge_100', title: 'Активист', titleKy: 'Активист', description: 'Набрал 100 баллов', icon: '⭐', minPoints: 100, rule: 'points' },
    { id: 'badge_250', title: 'Лидер', titleKy: 'Лидер', description: 'Набрал 250 баллов', icon: '🏆', minPoints: 250, rule: 'points' },
    { id: 'badge_helper', title: 'Помощник', titleKy: 'Жардамчы', description: 'Выполнил социальное задание', icon: '🤝', minPoints: 0, rule: 'social_task' }
  ];

  const notifications = [
    { id: uid('n_'), userId: 'u_student', text: 'Добро пожаловать! Выполняй задания и получай баллы.', read: false, createdAt },
    { id: uid('n_'), userId: 'u_teacher', text: 'У вас есть демо-задания. Можно создать новое задание.', read: false, createdAt }
  ];

  const settings = {
    points: {
      easy: 10,
      medium: 25,
      hard: 50,
      contestWin: 100
    },
    appName: 'Edu Motivation Platform'
  };

  return { users, categories, tasks, submissions, partners, rewards, redemptions, pointTransactions, badges, notifications, settings };
}

function loadDb() {
  ensureDirs();
  if (!fs.existsSync(DB_PATH)) {
    const db = seedDb();
    saveDb(db);
    return db;
  }
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const fresh = seedDb();
    for (const key of Object.keys(fresh)) {
      if (!Array.isArray(db[key]) && typeof fresh[key] === 'object' && !Array.isArray(fresh[key])) db[key] = fresh[key];
      if (Array.isArray(fresh[key]) && !Array.isArray(db[key])) db[key] = [];
    }
    migrateDb(db);
    saveDb(db);
    return db;
  } catch (error) {
    const backup = `${DB_PATH}.${Date.now()}.broken`;
    fs.renameSync(DB_PATH, backup);
    const db = seedDb();
    saveDb(db);
    return db;
  }
}

function migrateDb(db) {
  const fresh = seedDb();
  for (const reward of fresh.rewards) {
    const current = db.rewards.find(r => r.id === reward.id);
    if (!current) {
      db.rewards.push(reward);
      continue;
    }
    if (!current.type) current.type = reward.type || 'bonus';
    if (current.id === 'reward_2') {
      current.title = 'Сертификат активного участника';
      current.description = 'Именной электронный сертификат, который появляется в профиле после получения.';
      current.type = 'certificate';
      current.cost = Math.min(Number(current.cost || 50), 50);
      current.stock = Math.max(Number(current.stock || 0), 1000);
      current.active = true;
    }
  }
  for (const redemption of db.redemptions || []) {
    const reward = db.rewards.find(r => r.id === redemption.rewardId);
    const student = db.users.find(u => u.id === redemption.userId);
    if (reward && student && reward.type === 'certificate' && !redemption.certificate) {
      redemption.certificate = buildCertificate(student, reward, redemption.code, redemption.createdAt);
    }
  }
}

function buildCertificate(user, reward, code, createdAt = now()) {
  return {
    title: 'СЕРТИФИКАТ АКТИВНОГО УЧАСТНИКА',
    subtitle: 'за активное участие в образовательных заданиях, проектах и конкурсах',
    participantName: user.name,
    group: user.group || '',
    school: user.school || '',
    rewardTitle: reward.title,
    code,
    issuedAt: createdAt,
    issuer: 'Edu Motivation Platform'
  };
}

function saveDb(db) {
  ensureDirs();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 20 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Слишком большой запрос'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error('Некорректный JSON'));
      }
    });
  });
}

function send(res, status, payload, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
  send(res, status, { ok: false, error: message });
}

function getAuthUser(req, db) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !sessions.has(token)) return null;
  const session = sessions.get(token);
  const user = db.users.find(u => u.id === session.userId);
  if (!user || user.blocked) return null;
  session.lastActive = Date.now();
  return user;
}

function requireAuth(req, res, db) {
  const user = getAuthUser(req, db);
  if (!user) {
    sendError(res, 401, 'Нужно войти в систему');
    return null;
  }
  return user;
}

function requireRole(user, roles, res) {
  if (!user || !roles.includes(user.role)) {
    sendError(res, 403, 'Недостаточно прав');
    return false;
  }
  return true;
}

function cleanText(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim().toLowerCase());
}

function saveDataUrlFile(file) {
  if (!file || !file.dataUrl || !file.name) return null;
  const match = String(file.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Файл должен быть загружен через форму');
  const mime = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error('Файл слишком большой. Максимум 8 МБ');
  const extFromName = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const allowed = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.mp4', '.mov', '.txt']);
  const ext = allowed.has(extFromName) ? extFromName : '.bin';
  const safeName = `${uid('upload_')}${ext}`;
  const filePath = path.join(UPLOAD_DIR, safeName);
  fs.writeFileSync(filePath, buffer);
  return {
    originalName: cleanText(file.name, 180),
    mime,
    size: buffer.length,
    url: `/uploads/${safeName}`
  };
}

function getCategory(db, id) {
  return db.categories.find(c => c.id === id) || null;
}

function getTaskView(db, task) {
  const author = db.users.find(u => u.id === task.createdBy);
  return {
    ...task,
    category: getCategory(db, task.categoryId),
    author: author ? publicUser(author) : null,
    submissionsCount: db.submissions.filter(s => s.taskId === task.id).length
  };
}

function getSubmissionView(db, submission) {
  const task = db.tasks.find(t => t.id === submission.taskId);
  const student = db.users.find(u => u.id === submission.studentId);
  const reviewer = db.users.find(u => u.id === submission.reviewedBy);
  return {
    ...submission,
    task: task ? getTaskView(db, task) : null,
    student: student ? publicUser(student) : null,
    reviewer: reviewer ? publicUser(reviewer) : null
  };
}

function approvedSubmissionsForUser(db, userId) {
  return db.submissions.filter(s => s.studentId === userId && s.status === 'approved');
}

function earnedBadges(db, userId) {
  const user = db.users.find(u => u.id === userId);
  if (!user) return [];
  const approved = approvedSubmissionsForUser(db, userId);
  return db.badges.filter(badge => {
    if (badge.rule === 'points') return user.points >= badge.minPoints;
    if (badge.rule === 'first_approved') return approved.length > 0;
    if (badge.rule === 'social_task') {
      return approved.some(sub => {
        const task = db.tasks.find(t => t.id === sub.taskId);
        return task && task.categoryId === 'cat_social';
      });
    }
    return false;
  });
}

function addNotification(db, userId, text) {
  db.notifications.unshift({ id: uid('n_'), userId, text, read: false, createdAt: now() });
}

function addPoints(db, userId, amount, reason, meta = {}) {
  const user = db.users.find(u => u.id === userId);
  if (!user) return;
  user.points = Number(user.points || 0) + Number(amount || 0);
  db.pointTransactions.unshift({ id: uid('pt_'), userId, amount: Number(amount || 0), reason, type: meta.type || 'manual', createdAt: now(), ...meta });
}

function spendPoints(db, userId, amount, reason, meta = {}) {
  const user = db.users.find(u => u.id === userId);
  if (!user) throw new Error('Пользователь не найден');
  if (user.points < amount) throw new Error('Недостаточно баллов');
  user.points -= amount;
  db.pointTransactions.unshift({ id: uid('pt_'), userId, amount: -Math.abs(amount), reason, type: meta.type || 'reward', createdAt: now(), ...meta });
}

function leaderboard(db) {
  return db.users
    .filter(u => u.role === 'student' && !u.blocked)
    .map(u => ({ ...publicUser(u), badges: earnedBadges(db, u.id), approvedCount: approvedSubmissionsForUser(db, u.id).length }))
    .sort((a, b) => (b.points || 0) - (a.points || 0));
}

function analytics(db) {
  const approved = db.submissions.filter(s => s.status === 'approved');
  const pending = db.submissions.filter(s => s.status === 'pending');
  const rejected = db.submissions.filter(s => s.status === 'rejected');
  const totalPoints = db.users.filter(u => u.role === 'student').reduce((sum, u) => sum + Number(u.points || 0), 0);
  const byCategory = db.categories.map(cat => {
    const tasks = db.tasks.filter(t => t.categoryId === cat.id);
    const submissions = db.submissions.filter(s => tasks.some(t => t.id === s.taskId));
    return { ...cat, tasks: tasks.length, submissions: submissions.length, approved: submissions.filter(s => s.status === 'approved').length };
  });
  return {
    users: db.users.length,
    students: db.users.filter(u => u.role === 'student').length,
    teachers: db.users.filter(u => u.role === 'teacher').length,
    tasks: db.tasks.length,
    publishedTasks: db.tasks.filter(t => t.status === 'published').length,
    submissions: db.submissions.length,
    approved: approved.length,
    pending: pending.length,
    rejected: rejected.length,
    rewards: db.rewards.length,
    redemptions: db.redemptions.length,
    totalPoints,
    byCategory,
    topUsers: leaderboard(db).slice(0, 5)
  };
}

function serveStatic(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  let baseDir = PUBLIC_DIR;
  if (pathname.startsWith('/uploads/')) {
    baseDir = UPLOAD_DIR;
    pathname = pathname.replace('/uploads/', '/');
  }
  let filePath = path.join(baseDir, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(baseDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      if (pathname.startsWith('/api')) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ ok: false, error: 'API не найден' }));
      }
      return fs.createReadStream(indexPath).pipe(res);
    }
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.txt': 'text/plain; charset=utf-8'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function handleApi(req, res, db) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method;
  const pathname = url.pathname;

  if (method === 'POST' && pathname === '/api/auth/login') {
    const body = await getBody(req);
    const email = cleanText(body.email, 180).toLowerCase();
    const password = String(body.password || '');
    const user = db.users.find(u => u.email.toLowerCase() === email);
    if (!user || !verifyPassword(password, user.passwordHash)) return sendError(res, 401, 'Неверный email или пароль');
    if (user.blocked) return sendError(res, 403, 'Ваш аккаунт заблокирован');
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id, createdAt: Date.now(), lastActive: Date.now() });
    addNotification(db, user.id, 'Выполнен вход в аккаунт.');
    saveDb(db);
    return send(res, 200, { ok: true, token, user: publicUser(user) });
  }

  if (method === 'POST' && pathname === '/api/auth/register') {
    const body = await getBody(req);
    const email = cleanText(body.email, 180).toLowerCase();
    const name = cleanText(body.name, 120);
    const password = String(body.password || '');
    if (!name || !validEmail(email) || password.length < 6) return sendError(res, 400, 'Введите имя, корректный email и пароль минимум 6 символов');
    if (db.users.some(u => u.email.toLowerCase() === email)) return sendError(res, 409, 'Такой email уже зарегистрирован');
    const user = {
      id: uid('u_'),
      name,
      email,
      passwordHash: hashPassword(password),
      role: 'student',
      group: cleanText(body.group, 60) || 'Без группы',
      school: cleanText(body.school, 120) || 'Без учреждения',
      points: 0,
      blocked: false,
      createdAt: now()
    };
    db.users.push(user);
    addNotification(db, user.id, 'Добро пожаловать! Теперь можно выполнять задания и получать баллы.');
    saveDb(db);
    return send(res, 201, { ok: true, user: publicUser(user) });
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) sessions.delete(token);
    return send(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/auth/me') {
    const user = requireAuth(req, res, db);
    if (!user) return;
    return send(res, 200, { ok: true, user: publicUser(user), badges: earnedBadges(db, user.id) });
  }

  if (method === 'GET' && pathname === '/api/profile') {
    const user = requireAuth(req, res, db);
    if (!user) return;
    const mine = db.submissions.filter(s => s.studentId === user.id).map(s => getSubmissionView(db, s));
    const transactions = db.pointTransactions.filter(t => t.userId === user.id).slice(0, 20);
    const redemptions = db.redemptions.filter(r => r.userId === user.id).map(r => ({ ...r, reward: db.rewards.find(rew => rew.id === r.rewardId) || null }));
    return send(res, 200, { ok: true, user: publicUser(user), badges: earnedBadges(db, user.id), submissions: mine, transactions, redemptions });
  }

  if (method === 'GET' && pathname === '/api/notifications') {
    const user = requireAuth(req, res, db);
    if (!user) return;
    return send(res, 200, { ok: true, notifications: db.notifications.filter(n => n.userId === user.id).slice(0, 20) });
  }

  if (method === 'POST' && pathname === '/api/notifications/read') {
    const user = requireAuth(req, res, db);
    if (!user) return;
    db.notifications.filter(n => n.userId === user.id).forEach(n => { n.read = true; });
    saveDb(db);
    return send(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/categories') {
    return send(res, 200, { ok: true, categories: db.categories });
  }

  if (method === 'POST' && pathname === '/api/categories') {
    const user = requireAuth(req, res, db);
    if (!user || !requireRole(user, ['teacher', 'admin'], res)) return;
    const body = await getBody(req);
    const title = cleanText(body.title, 80);
    if (!title) return sendError(res, 400, 'Введите название категории');
    const cat = { id: uid('cat_'), title, titleKy: cleanText(body.titleKy, 80), color: cleanText(body.color, 20) || '#2563eb', createdAt: now() };
    db.categories.push(cat);
    saveDb(db);
    return send(res, 201, { ok: true, category: cat });
  }

  if (method === 'GET' && pathname === '/api/tasks') {
    const user = getAuthUser(req, db);
    const categoryId = url.searchParams.get('categoryId');
    const status = url.searchParams.get('status');
    let tasks = db.tasks;
    if (!user || user.role === 'student') tasks = tasks.filter(t => t.status === 'published');
    if (status && user && ['teacher', 'admin'].includes(user.role)) tasks = tasks.filter(t => t.status === status);
    if (categoryId) tasks = tasks.filter(t => t.categoryId === categoryId);
    tasks = tasks.map(t => getTaskView(db, t)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return send(res, 200, { ok: true, tasks });
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (method === 'GET' && taskMatch) {
    const task = db.tasks.find(t => t.id === taskMatch[1]);
    if (!task) return sendError(res, 404, 'Задание не найдено');
    const user = getAuthUser(req, db);
    if (task.status !== 'published' && (!user || !['teacher', 'admin'].includes(user.role))) return sendError(res, 403, 'Задание недоступно');
    return send(res, 200, { ok: true, task: getTaskView(db, task) });
  }

  if (method === 'POST' && pathname === '/api/tasks') {
    const user = requireAuth(req, res, db);
    if (!user || !requireRole(user, ['teacher', 'admin'], res)) return;
    const body = await getBody(req);
    const title = cleanText(body.title, 160);
    const description = cleanText(body.description, 4000);
    const difficulty = ['easy', 'medium', 'hard'].includes(body.difficulty) ? body.difficulty : 'easy';
    const defaultPoints = db.settings.points[difficulty] || 10;
    const points = Math.max(1, Math.min(1000, Number(body.points || defaultPoints)));
    if (!title || !description) return sendError(res, 400, 'Введите название и описание задания');
    const task = {
      id: uid('task_'),
      title,
      description,
      categoryId: body.categoryId && db.categories.some(c => c.id === body.categoryId) ? body.categoryId : 'cat_study',
      difficulty,
      points,
      deadline: cleanText(body.deadline, 20),
      requirements: cleanText(body.requirements, 2500),
      status: ['draft', 'published'].includes(body.status) ? body.status : 'published',
      createdBy: user.id,
      createdAt: now(),
      updatedAt: now()
    };
    db.tasks.push(task);
    if (task.status === 'published') {
      db.users.filter(u => u.role === 'student' && !u.blocked).forEach(u => addNotification(db, u.id, `Новое задание: ${task.title}`));
    }
    saveDb(db);
    return send(res, 201, { ok: true, task: getTaskView(db, task) });
  }

  if ((method === 'PUT' || method === 'PATCH') && taskMatch) {
    const user = requireAuth(req, res, db);
    if (!user || !requireRole(user, ['teacher', 'admin'], res)) return;
    const task = db.tasks.find(t => t.id === taskMatch[1]);
    if (!task) return sendError(res, 404, 'Задание не найдено');
    if (user.role !== 'admin' && task.createdBy !== user.id) return sendError(res, 403, 'Можно менять только свои задания');
    const body = await getBody(req);
    for (const field of ['title', 'description', 'requirements', 'deadline']) {
      if (body[field] !== undefined) task[field] = cleanText(body[field], field === 'description' ? 4000 : 2500);
    }
    if (body.categoryId && db.categories.some(c => c.id === body.categoryId)) task.categoryId = body.categoryId;
    if (body.difficulty && ['easy', 'medium', 'hard'].includes(body.difficulty)) task.difficulty = body.difficulty;
    if (body.points !== undefined) task.points = Math.max(1, Math.min(1000, Number(body.points || task.points)));
    if (body.status && ['draft', 'published', 'archived'].includes(body.status)) task.status = body.status;
    task.updatedAt = now();
    saveDb(db);
    return send(res, 200, { ok: true, task: getTaskView(db, task) });
  }

  const submitMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/submit$/);
  if (method === 'POST' && submitMatch) {
    const user = requireAuth(req, res, db);
    if (!user || !requireRole(user, ['student'], res)) return;
    const task = db.tasks.find(t => t.id === submitMatch[1] && t.status === 'published');
    if (!task) return sendError(res, 404, 'Задание не найдено или недоступно');
    if (db.submissions.some(s => s.taskId === task.id && s.studentId === user.id && s.status === 'pending')) return sendError(res, 409, 'Вы уже отправили это задание на проверку');
    const body = await getBody(req);
    let fileMeta = null;
    try {
      fileMeta = saveDataUrlFile(body.file);
    } catch (error) {
      return sendError(res, 400, error.message);
    }
    const comment = cleanText(body.comment, 4000);
    if (!comment && !fileMeta) return sendError(res, 400, 'Добавьте комментарий или файл');
    const submission = {
      id: uid('sub_'),
      taskId: task.id,
      studentId: user.id,
      comment,
      file: fileMeta,
      status: 'pending',
      pointsAwarded: 0,
      teacherComment: '',
      reviewedBy: null,
      createdAt: now(),
      reviewedAt: null
    };
    db.submissions.unshift(submission);
    const teacher = db.users.find(u => u.id === task.createdBy);
    if (teacher) addNotification(db, teacher.id, `Новая работа на проверку: ${task.title}`);
    saveDb(db);
    return send(res, 201, { ok: true, submission: getSubmissionView(db, submission) });
  }

  if (method === 'GET' && pathname === '/api/submissions') {
    const user = requireAuth(req, res, db);
    if (!user) return;
    let submissions = db.submissions;
    if (user.role === 'student') submissions = submissions.filter(s => s.studentId === user.id);
    // В MVP учитель/организатор видит все отправленные работы,
    // чтобы кабинет проверки сразу обновлялся независимо от того, кто создал задание.
    // Админ также видит все работы.
    const status = url.searchParams.get('status');
    if (status) submissions = submissions.filter(s => s.status === status);
    return send(res, 200, { ok: true, submissions: submissions.map(s => getSubmissionView(db, s)) });
  }

  const reviewMatch = pathname.match(/^\/api\/submissions\/([^/]+)\/review$/);
  if (method === 'PATCH' && reviewMatch) {
    const user = requireAuth(req, res, db);
    if (!user || !requireRole(user, ['teacher', 'admin'], res)) return;
    const submission = db.submissions.find(s => s.id === reviewMatch[1]);
    if (!submission) return sendError(res, 404, 'Работа не найдена');
    const task = db.tasks.find(t => t.id === submission.taskId);
    if (!task) return sendError(res, 404, 'Задание не найдено');
    // В MVP любой учитель/организатор может проверить отправленную работу.
    // Если нужна строгая привязка к автору задания, это правило можно вернуть.
    if (submission.status !== 'pending') return sendError(res, 409, 'Эта работа уже проверена');
    const body = await getBody(req);
    const status = body.status === 'approved' ? 'approved' : body.status === 'rejected' ? 'rejected' : null;
    if (!status) return sendError(res, 400, 'Укажите approved или rejected');
    submission.status = status;
    submission.reviewedBy = user.id;
    submission.reviewedAt = now();
    submission.teacherComment = cleanText(body.teacherComment, 2000);
    if (status === 'approved') {
      const pointsAwarded = Math.max(0, Math.min(1000, Number(body.pointsAwarded || task.points || 0)));
      submission.pointsAwarded = pointsAwarded;
      addPoints(db, submission.studentId, pointsAwarded, `Задание: ${task.title}`, { type: 'task', submissionId: submission.id, taskId: task.id });
      addNotification(db, submission.studentId, `Работа одобрена. Начислено ${pointsAwarded} баллов: ${task.title}`);
    } else {
      submission.pointsAwarded = 0;
      addNotification(db, submission.studentId, `Работа отклонена: ${task.title}`);
    }
    saveDb(db);
    return send(res, 200, { ok: true, submission: getSubmissionView(db, submission) });
  }

  if (method === 'GET' && pathname === '/api/leaderboard') {
    return send(res, 200, { ok: true, leaderboard: leaderboard(db) });
  }

  if (method === 'GET' && pathname === '/api/badges') {
    const user = getAuthUser(req, db);
    return send(res, 200, { ok: true, badges: db.badges, earned: user ? earnedBadges(db, user.id) : [] });
  }

  if (method === 'GET' && pathname === '/api/partners') {
    return send(res, 200, { ok: true, partners: db.partners });
  }

  if (method === 'POST' && pathname === '/api/partners') {
    const user = requireAuth(req, res, db);
    if (!user || !requireRole(user, ['admin'], res)) return;
    const body = await getBody(req);
    const partner = { id: uid('partner_'), name: cleanText(body.name, 120), description: cleanText(body.description, 1000), contact: cleanText(body.contact, 120), createdAt: now() };
    if (!partner.name) return sendError(res, 400, 'Введите название партнёра');
    db.partners.push(partner);
    saveDb(db);
    return send(res, 201, { ok: true, partner });
  }

  if (method === 'GET' && pathname === '/api/rewards') {
    const rewards = db.rewards.map(r => ({ ...r, partner: db.partners.find(p => p.id === r.partnerId) || null }));
    return send(res, 200, { ok: true, rewards });
  }

  if (method === 'POST' && pathname === '/api/rewards') {
    const user = requireAuth(req, res, db);
    if (!user || !requireRole(user, ['admin'], res)) return;
    const body = await getBody(req);
    const reward = {
      id: uid('reward_'),
      title: cleanText(body.title, 160),
      description: cleanText(body.description, 1200),
      partnerId: body.partnerId || null,
      cost: Math.max(1, Math.min(100000, Number(body.cost || 10))),
      stock: Math.max(0, Math.min(100000, Number(body.stock || 1))),
      type: ['discount', 'certificate', 'lottery', 'course', 'gift', 'bonus'].includes(body.type) ? body.type : 'bonus',
      active: body.active !== false,
      createdAt: now()
    };
    if (!reward.title) return sendError(res, 400, 'Введите название награды');
    db.rewards.push(reward);
    saveDb(db);
    return send(res, 201, { ok: true, reward });
  }

  const redeemMatch = pathname.match(/^\/api\/rewards\/([^/]+)\/redeem$/);
  if (method === 'POST' && redeemMatch) {
    const user = requireAuth(req, res, db);
    if (!user || !requireRole(user, ['student'], res)) return;
    const reward = db.rewards.find(r => r.id === redeemMatch[1] && r.active);
    if (!reward) return sendError(res, 404, 'Награда не найдена');
    if (reward.stock <= 0) return sendError(res, 409, 'Награда закончилась');
    try {
      spendPoints(db, user.id, reward.cost, `Обмен на награду: ${reward.title}`, { type: 'reward', rewardId: reward.id });
    } catch (error) {
      return sendError(res, 400, error.message);
    }
    reward.stock -= 1;
    const createdAt = now();
    const redemption = {
      id: uid('red_'),
      userId: user.id,
      rewardId: reward.id,
      code: `EDU-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      status: 'active',
      createdAt
    };
    if (reward.type === 'certificate') {
      redemption.certificate = buildCertificate(user, reward, redemption.code, createdAt);
    }
    db.redemptions.unshift(redemption);
    addNotification(db, user.id, `Вы получили награду: ${reward.title}. Код: ${redemption.code}`);
    saveDb(db);
    return send(res, 201, { ok: true, redemption, reward, user: publicUser(user) });
  }

  if (method === 'GET' && pathname === '/api/admin/analytics') {
    const user = requireAuth(req, res, db);
    if (!user || !requireRole(user, ['admin', 'teacher'], res)) return;
    return send(res, 200, { ok: true, analytics: analytics(db) });
  }

  if (method === 'GET' && pathname === '/api/admin/users') {
    const user = requireAuth(req, res, db);
    if (!user || !requireRole(user, ['admin'], res)) return;
    return send(res, 200, { ok: true, users: db.users.map(publicUser) });
  }

  const userPatchMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (method === 'PATCH' && userPatchMatch) {
    const user = requireAuth(req, res, db);
    if (!user || !requireRole(user, ['admin'], res)) return;
    const target = db.users.find(u => u.id === userPatchMatch[1]);
    if (!target) return sendError(res, 404, 'Пользователь не найден');
    const body = await getBody(req);
    if (typeof body.blocked === 'boolean') target.blocked = body.blocked;
    if (body.role && ['student', 'teacher', 'admin'].includes(body.role)) target.role = body.role;
    if (body.points !== undefined) target.points = Math.max(0, Number(body.points));
    if (body.name !== undefined) target.name = cleanText(body.name, 120);
    if (body.group !== undefined) target.group = cleanText(body.group, 60);
    if (body.school !== undefined) target.school = cleanText(body.school, 120);
    saveDb(db);
    return send(res, 200, { ok: true, user: publicUser(target) });
  }

  if (method === 'GET' && pathname === '/api/settings') {
    const user = requireAuth(req, res, db);
    if (!user || !requireRole(user, ['admin'], res)) return;
    return send(res, 200, { ok: true, settings: db.settings });
  }

  if (method === 'PATCH' && pathname === '/api/settings') {
    const user = requireAuth(req, res, db);
    if (!user || !requireRole(user, ['admin'], res)) return;
    const body = await getBody(req);
    if (body.points) {
      for (const key of ['easy', 'medium', 'hard', 'contestWin']) {
        if (body.points[key] !== undefined) db.settings.points[key] = Math.max(0, Number(body.points[key]));
      }
    }
    saveDb(db);
    return send(res, 200, { ok: true, settings: db.settings });
  }

  return sendError(res, 404, 'API не найден');
}

ensureDirs();
const db = loadDb();

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      return await handleApi(req, res, db);
    }
    return serveStatic(req, res);
  } catch (error) {
    console.error(error);
    return sendError(res, 500, error.message || 'Ошибка сервера');
  }
});

server.listen(PORT, () => {
  console.log(`✅ Edu Motivation Platform запущена`);
  console.log(`🌐 Открой: http://localhost:${PORT}`);
  console.log(`👤 Демо: admin@school.local / teacher@school.local / student@school.local`);
  console.log(`🔑 Пароль: demo123`);
});
