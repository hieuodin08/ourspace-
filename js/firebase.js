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
  if (!e) return { ok: false, error: 'Email không được để trống' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: 'Email không hợp lệ' };

  try {
    // Username phải là duy nhất
    const nameRef = fbStore.collection('usernames').doc(uLower);
    const nameSnap = await nameRef.get();
    if (nameSnap.exists) return { ok: false, error: 'Tên đăng nhập đã tồn tại' };

    // Email là bắt buộc → dùng trực tiếp làm email đăng nhập Firebase.
    // Firebase Auth tự đảm bảo mỗi email chỉ tạo được 1 tài khoản
    // (ném auth/email-already-in-use nếu trùng) → chặn 1 Gmail tạo nhiều acc.
    const authEmail = e;
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
    if (code === 'auth/email-already-in-use') return { ok: false, error: 'Email này đã được dùng cho một tài khoản khác' };
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

// ---- Kết bạn (friendships) — mô hình lời mời 2 chiều kiểu Zalo ----
// 1 document /friendships/{pairId} cho mỗi cặp người dùng (pairId ổn định cho
// cả 2 phía). status: 'pending' (đang chờ duyệt) | 'accepted' (đã là bạn).
// requestedBy = uid người GỬI lời mời → người kia mới có quyền duyệt/từ chối.
// Dùng memberMap để query 1 lần rồi tách phía client (khỏi cần composite index),
// giống cách conversations đang làm.

// Lấy trạng thái quan hệ giữa 2 người (null nếu chưa có).
var fbGetFriendship = async (a, b) => {
  const snap = await fbStore.collection('friendships').doc(convIdOf(a, b)).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
};

// Gửi lời mời kết bạn. me/target là hồ sơ đầy đủ {uid, displayName, avatarColor, username}.
var fbSendFriendRequest = async (me, target) => {
  if (!me || !target) return { ok: false, error: 'Thiếu thông tin người dùng' };
  if (me.uid === target.uid) return { ok: false, error: 'Không thể tự kết bạn với chính mình' };
  const pairId = convIdOf(me.uid, target.uid);
  const ref = fbStore.collection('friendships').doc(pairId);
  const snap = await ref.get();
  if (snap.exists) {
    const d = snap.data();
    if (d.status === 'accepted') return { ok: false, error: 'Hai bạn đã là bạn bè' };
    if (d.requestedBy === me.uid) return { ok: false, error: 'Bạn đã gửi lời mời, đang chờ duyệt' };
    // Người kia đã gửi lời mời cho mình trước đó → coi như mình đồng ý luôn.
    await ref.update({ status: 'accepted', updatedAt: Date.now() });
    return { ok: true, autoAccepted: true };
  }
  await ref.set({
    members: [me.uid, target.uid],
    memberMap: { [me.uid]: true, [target.uid]: true },
    memberInfo: {
      [me.uid]: { name: me.displayName, color: me.avatarColor, username: me.username || '' },
      [target.uid]: { name: target.displayName, color: target.avatarColor, username: target.username || '' },
    },
    status: 'pending',
    requestedBy: me.uid,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return { ok: true };
};

var fbAcceptFriendRequest = async (pairId) => {
  await fbStore.collection('friendships').doc(pairId).update({ status: 'accepted', updatedAt: Date.now() });
};
// Từ chối lời mời / huỷ lời mời đã gửi / huỷ kết bạn → đều xoá document.
var fbDeleteFriendship = async (pairId) => {
  await fbStore.collection('friendships').doc(pairId).delete();
};

// Lắng nghe mọi quan hệ của tôi, tách sẵn thành { friends, incoming, outgoing }.
//   friends   : đã là bạn (kèm hồ sơ mới nhất để có peerId mà gọi)
//   incoming  : lời mời người khác gửi đến → tôi duyệt/từ chối
//   outgoing  : lời mời tôi đã gửi đi → đang chờ
var fbSubscribeFriendships = (myUid, cb) => {
  return fbStore.collection('friendships')
    .where('memberMap.' + myUid, '==', true)
    .onSnapshot(async (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const accepted = docs.filter(d => d.status === 'accepted');
      const pending = docs.filter(d => d.status === 'pending');

      const friends = (await Promise.all(accepted.map(async (d) => {
        const otherUid = (d.members || []).find(u => u !== myUid);
        if (!otherUid) return null;
        const p = await fbGetProfile(otherUid).catch(() => null);
        const info = (d.memberInfo && d.memberInfo[otherUid]) || {};
        if (p) return { ...p, pairId: d.id };
        return { uid: otherUid, displayName: info.name || 'Người dùng',
                 avatarColor: info.color || colorForUid(otherUid), username: info.username || '', pairId: d.id };
      }))).filter(Boolean);

      const incoming = pending.filter(d => d.requestedBy !== myUid).map(d => {
        const fromUid = d.requestedBy;
        const info = (d.memberInfo && d.memberInfo[fromUid]) || {};
        return { pairId: d.id, uid: fromUid, displayName: info.name || 'Người dùng',
                 avatarColor: info.color || colorForUid(fromUid), username: info.username || '' };
      });

      const outgoing = pending.filter(d => d.requestedBy === myUid).map(d => {
        const toUid = (d.members || []).find(u => u !== myUid);
        const info = (d.memberInfo && d.memberInfo[toUid]) || {};
        return { pairId: d.id, uid: toUid, displayName: info.name || 'Người dùng',
                 avatarColor: info.color || colorForUid(toUid), username: info.username || '' };
      });

      cb({ friends, incoming, outgoing });
    }, (err) => { console.error('friendships:', err); cb({ friends: [], incoming: [], outgoing: [] }); });
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
