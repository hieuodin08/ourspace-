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

// LƯU Ý: Xác thực (đăng ký/đăng nhập), danh bạ và tin nhắn nay do Firebase
// đảm nhiệm — xem js/firebase.js. DB ở trên chỉ còn dùng cho dữ liệu cục bộ
// (vd: transcripts của Speech-to-Text trong phòng gọi).
