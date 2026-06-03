// ============================================================================
//  GALAXY — dock + overlay (port từ dock.jsx).
//  Khác bản demo: 4 nút (Tìm kiếm / A–Z / Thêm bạn / Lời mời) — bỏ "Cộng đồng"
//  (ngoài phạm vi lõi). Dữ liệu lấy từ props THẬT. "Thêm bạn" do GalaxyView
//  định tuyến sang modal tìm-theo-username sẵn có của Ourspace.
// ============================================================================
(function () {
  const { useState, useMemo, useEffect } = React;
  const KD = window.CONTACTS_DATA;
  const KIcon = window.GxIcon;
  const KAvatar = window.ContactsParts.Avatar;

  /* ---------- Bottom dock ---------- */
  function Dock({ onOpen, current, incomingCount, showMessages }) {
    const items = [];
    if (showMessages) items.push({ id: 'messages', icon: 'message', label: 'Tin nhắn' });
    items.push(
      { id: 'search', icon: 'search', label: 'Tìm kiếm' },
      { id: 'list', icon: 'list', label: 'Danh sách A–Z' },
      { id: 'add', icon: 'userPlus', label: 'Thêm bạn' },
      { id: 'requests', icon: 'bell', label: 'Lời mời', badge: incomingCount },
    );
    return (
      <div className="dock">
        <div className="dock-inner">
          {items.map(it => (
            <button key={it.id}
              className={'dock-btn' + (current === it.id ? ' on' : '')}
              onClick={() => onOpen(it.id)}>
              <span className="dock-tip">{it.label}</span>
              <span className="dock-ic"><KIcon name={it.icon} size={24} /></span>
              {it.badge ? <span className="dock-badge">{it.badge}</span> : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ---------- Generic overlay shell ---------- */
  function Overlay({ title, subtitle, onClose, children }) {
    useEffect(() => {
      const k = e => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', k);
      return () => window.removeEventListener('keydown', k);
    }, [onClose]);
    return (
      <>
        <div className="ov-backdrop" onClick={onClose} />
        <div className="ov-panel">
          <div className="ov-head">
            <div>
              <div className="ov-title">{title}</div>
              {subtitle && <div className="ov-sub">{subtitle}</div>}
            </div>
            <button className="ov-x" onClick={onClose}><KIcon name="x" size={18} /></button>
          </div>
          <div className="ov-body">{children}</div>
        </div>
      </>
    );
  }

  /* ---------- Search / A-Z list overlay ---------- */
  function ListOverlay({ mode, friends, square, onClose, onPick }) {
    const [q, setQ] = useState('');
    const groups = useMemo(() => {
      const norm = KD.removeAccents(q).toLowerCase();
      const list = (friends || []).filter(f => KD.removeAccents(f.name).toLowerCase().includes(norm));
      list.sort((a, b) => KD.sortKey(a.name).localeCompare(KD.sortKey(b.name)));
      const map = {};
      list.forEach(f => { const L = (KD.sortKey(f.name)[0] || '#').toUpperCase(); (map[L] = map[L] || []).push(f); });
      return Object.keys(map).sort().map(L => ({ L, items: map[L] }));
    }, [q, friends]);
    const total = groups.reduce((n, g) => n + g.items.length, 0);

    return (
      <Overlay
        title={mode === 'search' ? 'Tìm kiếm' : 'Tất cả bạn bè'}
        subtitle={`${total} người`}
        onClose={onClose}>
        <div className="ov-search">
          <KIcon name="search" size={18} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Nhập tên bạn bè…" />
          {q && <button onClick={() => setQ('')}><KIcon name="x" size={14} /></button>}
        </div>
        <div className="ov-scroll">
          {total === 0 && <div className="ov-empty">Không tìm thấy ai tên “{q}”.</div>}
          {groups.map(g => (
            <div key={g.L}>
              <div className="ov-letter">{g.L}</div>
              {g.items.map(f => (
                <button key={f.uid || f.name} className="ov-row" onClick={(e) => onPick(f, e.currentTarget)}>
                  <KAvatar name={f.name} size={42} online={f.online} square={square} />
                  <span className="ov-row-main">
                    <span className="ov-name">{f.name}</span>
                    <span className="ov-subtxt">{f.last}</span>
                  </span>
                  <span className="ov-go"><KIcon name="chevron" size={18} /></span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </Overlay>
    );
  }

  /* ---------- Requests overlay ---------- */
  // incoming = [{ pairId, uid, displayName, avatarColor, username }]
  function RequestsOverlay({ incoming, square, onClose, onAccept, onDecline }) {
    const [toast, setToast] = useState('');
    const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 1600); };
    const list = incoming || [];
    return (
      <Overlay title="Lời mời kết bạn" subtitle={`${list.length} lời mời đang chờ`} onClose={onClose}>
        <div className="ov-scroll">
          {list.length === 0 && <div className="ov-empty">Không còn lời mời nào.</div>}
          {list.map(r => (
            <div key={r.pairId} className="rq-card">
              <KAvatar name={r.displayName} size={48} square={square} />
              <div className="rq-main">
                <div className="ov-name">{r.displayName}</div>
                <div className="ov-subtxt">{r.username ? '@' + r.username : 'Muốn kết bạn với bạn'}</div>
                <div className="rq-mutual">Lời mời kết bạn</div>
              </div>
              <div className="rq-actions">
                <button className="rq-no" onClick={() => { onDecline && onDecline(r); flash('Đã từ chối'); }}>Từ chối</button>
                <button className="rq-yes" onClick={() => { onAccept && onAccept(r); flash('Đã thêm vào vũ trụ của bạn ✨'); }}>Đồng ý</button>
              </div>
            </div>
          ))}
        </div>
        {toast && <div className="gx-toast">{toast}</div>}
      </Overlay>
    );
  }

  /* ---------- Messages overlay (danh sách hội thoại) ---------- */
  function MessagesOverlay({ conversations, myUid, square, onClose, onPick }) {
    const list = conversations || [];
    return (
      <Overlay title="Tin nhắn" subtitle={`${list.length} cuộc trò chuyện`} onClose={onClose}>
        <div className="ov-scroll">
          {list.length === 0 && <div className="ov-empty">Chưa có cuộc trò chuyện nào.</div>}
          {list.map(c => (
            <button key={c.id} className="ov-row" onClick={() => onPick(c)}>
              <KAvatar name={c.otherName} size={42} square={square} />
              <span className="ov-row-main">
                <span className="ov-name">{c.otherName}</span>
                <span className="ov-subtxt">{c.lastSender === myUid ? 'Bạn: ' : ''}{c.lastMessage || '…'}</span>
              </span>
              <span className="ov-go"><KIcon name="chevron" size={18} /></span>
            </button>
          ))}
        </div>
      </Overlay>
    );
  }

  window.DockParts = { Dock, ListOverlay, RequestsOverlay, MessagesOverlay };
})();
