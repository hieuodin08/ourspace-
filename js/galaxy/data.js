// ============================================================================
//  GALAXY — helpers + ánh xạ bạn bè THẬT (Firebase) sang model "vũ trụ".
//  Bọc trong IIFE để không rò biến ra global (Ourspace dùng chung scope).
//  Khác bản demo: KHÔNG có fixtures; nhận friends thật rồi gán tier.
// ============================================================================
(function () {
  // Bảng màu avatar 2 tông (theo design token AVATAR_COLORS).
  const AVATAR_COLORS = [
    ['#fde68a', '#92400e'], ['#bfdbfe', '#1e40af'], ['#bbf7d0', '#166534'],
    ['#fbcfe8', '#9d174d'], ['#ddd6fe', '#5b21b6'], ['#fed7aa', '#9a3412'],
    ['#a5f3fc', '#155e75'], ['#fecaca', '#991b1b'], ['#d9f99d', '#3f6212'],
    ['#e9d5ff', '#6b21a8'],
  ];
  function colorFor(name) {
    name = name || '?';
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
    return AVATAR_COLORS[(h % AVATAR_COLORS.length + AVATAR_COLORS.length) % AVATAR_COLORS.length];
  }
  function initials(name) {
    const parts = (name || '?').trim().split(/\s+/);
    if (parts.length === 1) return (parts[0] || '?').slice(0, 2).toUpperCase();
    return ((parts[parts.length - 2][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase();
  }
  function removeAccents(str) {
    return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  }
  // Sort theo TỪ CUỐI (tên riêng kiểu danh bạ Việt).
  function sortKey(name) {
    const parts = (name || '').trim().split(/\s+/);
    return removeAccents(parts[parts.length - 1] || '').toLowerCase();
  }
  function givenName(name) { return (name || '').trim().split(/\s+/).pop() || ''; }

  const TIER_META = {
    1: { label: 'Thân thiết', sub: 'Người bạn nói chuyện mỗi ngày' },
    2: { label: 'Hay nhắn', sub: 'Vẫn giữ liên lạc thường xuyên' },
    3: { label: 'Lâu rồi chưa nói', sub: 'Có lẽ đã đến lúc nhắn một câu' },
  };

  // Map 1 friend Firebase ({uid, displayName, avatarColor, username, peerId, pairId})
  // -> node galaxy. `online` suy từ peerId (đang mở app => có peerId).
  function mapFriend(f) {
    const online = !!(f && f.peerId);
    return {
      uid: f.uid,
      name: f.displayName || f.username || 'Người dùng',
      username: f.username || '',
      online,
      status: online ? 'online' : 'offline',
      last: online ? 'Đang hoạt động' : 'Ngoại tuyến',
      raw: f,
    };
  }

  // Gán tier 1/2/3. Dữ liệu thật chưa có "độ thân thiết" → heuristic tạm:
  // người online vào vòng trong, phần còn lại ổn định theo hash(uid).
  function assignTiers(friends) {
    const nodes = (friends || []).map(mapFriend);
    const hash = (s) => { let h = 0; s = s || ''; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 50; };
    const scored = nodes.map(n => ({ n, s: (n.online ? 100 : 0) + hash(n.uid || n.name) }));
    scored.sort((a, b) => b.s - a.s);
    scored.forEach((o, i) => { o.n.tier = i < 5 ? 1 : i < 13 ? 2 : 3; });
    return scored.map(o => o.n);
  }

  window.CONTACTS_DATA = {
    AVATAR_COLORS, colorFor, initials, removeAccents, sortKey, givenName,
    TIER_META, mapFriend, assignTiers,
  };
})();
