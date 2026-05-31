// ============================================================================
//  FIREBASE LAYER  — Auth + Firestore (đồng bộ mọi thiết bị)
//  Dùng SDK "compat" (gắn global `firebase`) để chạy được với <script> + Babel
//  standalone, không cần bundler.
// ============================================================================

// ---- Khởi tạo ----
var FB_CONFIG = (typeof window !== 'undefined' && window.OURSPACE_FIREBASE_CONFIG) || {};
var FB_CONFIGURED =
  !!FB_CONFIG.apiKey &&
  !FB_CONFIG.apiKey.startsWith('DAN_') &&
  !!FB_CONFIG.projectId &&
  FB_CONFIG.projectId !== 'your-project';

var fbAuth = null;
var fbStore = null;

if (FB_CONFIGURED && typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(FB_CONFIG);
    fbAuth = firebase.auth();
    fbStore = firebase.firestore();
    // Giữ phiên đăng nhập sau khi tải lại trang.
    fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
  } catch (e) {
    console.error('Khởi tạo Firebase lỗi:', e);
  }
}

var fbConfigured = () => FB_CONFIGURED && !!fbAuth && !!fbStore;

// ---- Tiện ích ----
var AVATAR_COLORS = [
  '#2563eb', '#0ea5e9', '#06b6d4', '#10b981', '#8b5cf6',
  '#ec4899', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1',
];
var colorForUid = (uid) => {
  let h = 0;
  for (let i = 0; i < (uid || '').length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};
var initialsOf = (name) => {
  const parts = (name || '?').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// id hội thoại 1-1: ghép 2 uid đã sort → ổn định cho cả 2 phía
var convIdOf = (a, b) => [a, b].sort().join('__');
var tsToMillis = (t) => (t && typeof t.toMillis === 'function') ? t.toMillis() : (typeof t === 'number' ? t : 0);

// ---- Hồ sơ người dùng ----
var fbGetProfile = async (uid) => {
  if (!uid) return null;
  const snap = await fbStore.collection('users').doc(uid).get();
  return snap.exists ? snap.data() : null;
};

// ---- Đăng ký ----
var registerUser = async (_db, { username, email, password, displayName }) => {
  if (!fbConfigured()) return { ok: false, error: 'Firebase chưa được cấu hình' };
  const u = (username || '').trim();
  const uLower = u.toLowerCase();
  const e = (email || '').trim().toLowerCase();
  const p = password || '';
  if (!u) return { ok: false, error: 'Tên đăng nhập không được để trống' };
  if (u.length < 3) return { ok: false, error: 'Tên đăng nhập tối thiểu 3 ký tự' };
  if (!/^[a-z0-9_.]+$/i.test(u)) return { ok: false, error: 'Tên đăng nhập chỉ gồm chữ, số, dấu _ hoặc .' };
  if (p.length < 6) return { ok: false, error: 'Mật khẩu tối thiểu 6 ký tự' };
  if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: 'Email không hợp lệ' };

  try {
    // Username phải là duy nhất
    const nameRef = fbStore.collection('usernames').doc(uLower);
    const nameSnap = await nameRef.get();
    if (nameSnap.exists) return { ok: false, error: 'Tên đăng nhập đã tồn tại' };

    // Firebase Auth cần email — nếu user không nhập thì tạo email nội bộ.
    const authEmail = e || `${uLower}@ourspace.app`;
    const cred = await fbAuth.createUserWithEmailAndPassword(authEmail, p);
    const uid = cred.user.uid;

    const profile = {
      uid,
      username: u,
      usernameLower: uLower,
      email: e,
      authEmail,
      displayName: (displayName || u).trim(),
      about: 'Xin chào, tôi đang dùng Ourspace!',
      avatarColor: colorForUid(uid),
      peerId: null,
      peerUpdatedAt: 0,
      createdAt: Date.now(),
    };
    await fbStore.collection('users').doc(uid).set(profile);
    await nameRef.set({ uid, authEmail });
    return { ok: true, user: profile };
  } catch (err) {
    const code = err?.code || '';
    if (code === 'auth/email-already-in-use') return { ok: false, error: 'Email/tên đăng nhập đã được dùng' };
    if (code === 'auth/weak-password') return { ok: false, error: 'Mật khẩu quá yếu (tối thiểu 6 ký tự)' };
    if (code === 'auth/invalid-email') return { ok: false, error: 'Email không hợp lệ' };
    return { ok: false, error: err?.message || 'Đăng ký thất bại' };
  }
};

// ---- Đăng nhập (bằng username hoặc email) ----
var loginUser = async (_db, { login, password }) => {
  if (!fbConfigured()) return { ok: false, error: 'Firebase chưa được cấu hình' };
  const key = (login || '').trim();
  if (!key) return { ok: false, error: 'Nhập tên đăng nhập hoặc email' };
  try {
    let authEmail = key;
    if (!key.includes('@')) {
      // login bằng username → tra cứu email nội bộ
      const snap = await fbStore.collection('usernames').doc(key.toLowerCase()).get();
      if (!snap.exists) return { ok: false, error: 'Tài khoản không tồn tại' };
      authEmail = snap.data().authEmail;
    }
    const cred = await fbAuth.signInWithEmailAndPassword(authEmail, password || '');
    const profile = await fbGetProfile(cred.user.uid);
    return { ok: true, user: profile || { uid: cred.user.uid, displayName: key } };
  } catch (err) {
    const code = err?.code || '';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return { ok: false, error: 'Mật khẩu không đúng' };
    if (code === 'auth/user-not-found') return { ok: false, error: 'Tài khoản không tồn tại' };
    if (code === 'auth/too-many-requests') return { ok: false, error: 'Thử lại quá nhiều lần, đợi chút rồi thử lại' };
    return { ok: false, error: err?.message || 'Đăng nhập thất bại' };
  }
};

var fbLogout = async () => { try { await fbAuth.signOut(); } catch (_) {} };

// onAuthStateChanged + nạp hồ sơ. cb(profile|null). Trả về hàm huỷ đăng ký.
var fbOnAuth = (cb) => {
  if (!fbConfigured()) { cb(null); return () => {}; }
  return fbAuth.onAuthStateChanged(async (user) => {
    if (!user) { cb(null); return; }
    let profile = await fbGetProfile(user.uid);
    if (!profile) { // doc có thể chưa kịp ghi ngay sau khi đăng ký
      await new Promise(r => setTimeout(r, 600));
      profile = await fbGetProfile(user.uid);
    }
    cb(profile || { uid: user.uid, displayName: user.email });
  });
};

// ---- Cập nhật hồ sơ ----
var fbUpdateProfile = async (uid, patch) => {
  await fbStore.collection('users').doc(uid).update(patch);
};

// ---- PeerId online (để gọi video) ----
var fbSetPeerId = async (uid, peerId) => {
  try { await fbStore.collection('users').doc(uid).update({ peerId, peerUpdatedAt: Date.now() }); } catch (_) {}
};

// ---- Tìm người dùng theo username ----
var fbFindByUsername = async (username) => {
  const q = (username || '').trim().toLowerCase();
  if (!q) return null;
  const snap = await fbStore.collection('users').where('usernameLower', '==', q).limit(1).get();
  return snap.empty ? null : snap.docs[0].data();
};

// ---- Danh bạ ----
var fbAddContact = async (myUid, contactUid) => {
  if (myUid === contactUid) return { ok: false, error: 'Không thể tự thêm chính mình' };
  await fbStore.collection('users').doc(myUid).collection('contacts').doc(contactUid)
    .set({ contactUid, addedAt: Date.now() });
  return { ok: true };
};
var fbRemoveContact = async (myUid, contactUid) => {
  await fbStore.collection('users').doc(myUid).collection('contacts').doc(contactUid).delete();
};

// Lắng nghe danh bạ realtime; cb nhận mảng hồ sơ đầy đủ. Trả về hàm huỷ.
var fbSubscribeContacts = (myUid, cb) => {
  return fbStore.collection('users').doc(myUid).collection('contacts')
    .onSnapshot(async (snap) => {
      const uids = snap.docs.map(d => d.data().contactUid);
      const profiles = await Promise.all(uids.map(u => fbGetProfile(u).catch(() => null)));
      cb(profiles.filter(Boolean));
    }, (err) => { console.error('contacts:', err); cb([]); });
};

// ---- Hội thoại ----
// Lắng nghe danh sách hội thoại của tôi (sort client để khỏi cần composite index).
var fbSubscribeConversations = (myUid, cb) => {
  return fbStore.collection('conversations')
    .where('memberMap.' + myUid, '==', true)
    .onSnapshot((snap) => {
      const list = snap.docs.map(d => {
        const c = d.data();
        const otherUid = (c.members || []).find(u => u !== myUid) || myUid;
        const info = (c.memberInfo && c.memberInfo[otherUid]) || {};
        return {
          id: d.id,
          otherUid,
          otherName: info.name || 'Người dùng',
          otherColor: info.color || colorForUid(otherUid),
          lastMessage: c.lastMessage || '',
          lastSender: c.lastSender || '',
          lastTime: tsToMillis(c.lastTime),
        };
      }).sort((a, b) => b.lastTime - a.lastTime);
      cb(list);
    }, (err) => { console.error('conversations:', err); cb([]); });
};

// Lắng nghe tin nhắn trong 1 hội thoại (sort theo time tăng dần).
var fbSubscribeMessages = (convId, cb) => {
  return fbStore.collection('conversations').doc(convId).collection('messages')
    .orderBy('time', 'asc')
    .onSnapshot((snap) => {
      cb(snap.docs.map(d => {
        const m = d.data();
        return {
          id: d.id,
          senderId: m.senderId,
          senderName: m.senderName,
          text: m.text,
          recalled: !!m.recalled,
          timestamp: tsToMillis(m.time) || m.localTime || 0,
        };
      }));
    }, (err) => { console.error('messages:', err); cb([]); });
};

// Gửi tin nhắn. members = [{uid,name,color}, ...] (gồm cả người gửi).
var fbSendMessage = async (convId, members, { senderId, senderName, text }) => {
  const memberMap = {};
  const memberInfo = {};
  members.forEach(m => { memberMap[m.uid] = true; memberInfo[m.uid] = { name: m.name, color: m.color }; });
  const convRef = fbStore.collection('conversations').doc(convId);
  const now = firebase.firestore.FieldValue.serverTimestamp();
  await convRef.set({
    members: members.map(m => m.uid),
    memberMap, memberInfo,
    lastMessage: text, lastSender: senderId, lastTime: now,
  }, { merge: true });
  await convRef.collection('messages').add({
    senderId, senderName, text, recalled: false, time: now, localTime: Date.now(),
  });
};

var fbRecallMessage = async (convId, msgId) => {
  await fbStore.collection('conversations').doc(convId).collection('messages').doc(msgId)
    .update({ recalled: true });
};
