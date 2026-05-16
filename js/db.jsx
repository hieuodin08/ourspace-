// ====== SHARED DB (in-memory + localStorage persistence) ======
var PERSISTED_COLLECTIONS = ['users', 'session'];
var STORAGE_KEY = 'silenttalk_db_v1';

var loadFromStorage = () => {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch(_) { return {}; }
};

var saveToStorage = (data) => {
  try {
    if (typeof localStorage === 'undefined') return;
    const persisted = {};
    PERSISTED_COLLECTIONS.forEach(c => {
      if (data[c]) persisted[c] = Array.from(data[c].entries());
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch(_) {}
};

var createDB = () => {
  const subs = new Map();
  const data = { rooms: new Map(), users: new Map(), transcripts: new Map(), messages: new Map(), session: new Map() };

  const stored = loadFromStorage();
  PERSISTED_COLLECTIONS.forEach(c => {
    if (Array.isArray(stored[c])) data[c] = new Map(stored[c]);
  });

  const notify = (c, id) => {
    (subs.get(`${c}:${id}`) || []).forEach(cb => cb(data[c].get(id)));
    (subs.get(`${c}:*`) || []).forEach(cb => cb(Array.from(data[c].values())));
    if (PERSISTED_COLLECTIONS.includes(c)) saveToStorage(data);
  };
  return {
    set: (c, id, v) => { data[c].set(id, { ...v, id, updatedAt: Date.now() }); notify(c, id); },
    update: (c, id, p) => { const e = data[c].get(id) || {}; data[c].set(id, { ...e, ...p, id }); notify(c, id); },
    get: (c, id) => data[c].get(id),
    getAll: (c) => Array.from(data[c].values()),
    subscribe: (c, id, cb) => {
      const k = `${c}:${id}`;
      const list = subs.get(k) || [];
      list.push(cb); subs.set(k, list);
      return () => subs.set(k, (subs.get(k) || []).filter(x => x !== cb));
    },
    delete: (c, id) => { data[c].delete(id); notify(c, id); },
  };
};
var DB = createDB();
var DBContext = createContext(DB);
var useDB = () => useContext(DBContext);

// ====== AUTH helpers ======
var SALT = 'silenttalk_v1_salt';
var sha256 = async (text) => {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
};
var hashPassword = async (pwd) => sha256(SALT + ':' + pwd);

var findUserByLogin = (db, login) => {
  const key = (login || '').trim().toLowerCase();
  if (!key) return null;
  return db.getAll('users').find(u =>
    (u.username || '').toLowerCase() === key ||
    (u.email || '').toLowerCase() === key
  ) || null;
};

var registerUser = async (db, { username, email, password, displayName }) => {
  const u = (username || '').trim();
  const e = (email || '').trim().toLowerCase();
  const p = password || '';
  if (!u) return { ok: false, error: 'Tên đăng nhập không được để trống' };
  if (u.length < 3) return { ok: false, error: 'Tên đăng nhập tối thiểu 3 ký tự' };
  if (p.length < 4) return { ok: false, error: 'Mật khẩu tối thiểu 4 ký tự' };
  if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: 'Email không hợp lệ' };
  if (findUserByLogin(db, u)) return { ok: false, error: 'Tên đăng nhập đã tồn tại' };
  if (e && findUserByLogin(db, e)) return { ok: false, error: 'Email đã được sử dụng' };

  const id = `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const passwordHash = await hashPassword(p);
  const user = {
    id, username: u, email: e, displayName: (displayName || u).trim(),
    passwordHash, createdAt: Date.now(),
  };
  db.set('users', id, user);
  return { ok: true, user };
};

var loginUser = async (db, { login, password }) => {
  const user = findUserByLogin(db, login);
  if (!user) return { ok: false, error: 'Tài khoản không tồn tại' };
  const hash = await hashPassword(password || '');
  if (hash !== user.passwordHash) return { ok: false, error: 'Mật khẩu không đúng' };
  return { ok: true, user };
};

var saveSession = (db, user) => db.set('session', 'current', { userId: user.id, name: user.displayName || user.username });
var loadSession = (db) => {
  const s = db.get('session', 'current');
  if (!s?.userId) return null;
  const u = db.get('users', s.userId);
  return u ? { id: u.id, name: u.displayName || u.username } : null;
};
var clearSession = (db) => db.delete('session', 'current');
