// ============================================================================
//  GALAXY — orbit engine (port từ galaxy.jsx).
//  Khác bản demo: Galaxy nhận `friends` (đã gán tier) qua prop + tên người dùng
//  ở tâm; BloomCard nối nút Nhắn tin / Gọi video ra ngoài qua props.
// ============================================================================
(function () {
  const { useState, useRef, useEffect, useLayoutEffect, useMemo } = React;
  const GD = window.CONTACTS_DATA;
  const GIcon = window.GxIcon;
  const GAvatar = window.ContactsParts.Avatar;

  /* ---------- Starfield background ---------- */
  function Starfield() {
    const ref = useRef();
    useEffect(() => {
      const host = ref.current;
      if (!host || host.dataset.done) return;
      host.dataset.done = '1';
      for (let i = 0; i < 70; i++) {
        const s = document.createElement('span');
        s.className = 'gx-star';
        const sz = Math.random() * 1.8 + 0.5;
        s.style.cssText = `top:${Math.random() * 100}%;left:${Math.random() * 100}%;width:${sz}px;height:${sz}px;animation-delay:${(Math.random() * 4).toFixed(2)}s;opacity:${(Math.random() * 0.6 + 0.25).toFixed(2)}`;
        host.appendChild(s);
      }
    }, []);
    return (
      <div className="gx-bg">
        <div className="gx-grad" />
        <div className="gx-grid" />
        <div className="gx-ray" />
        <div className="gx-orb gx-orb-1" />
        <div className="gx-orb gx-orb-2" />
        <div className="gx-orb gx-orb-3" />
        <div className="gx-stars" ref={ref} />
        <div className="gx-vignette" />
      </div>
    );
  }

  /* ---------- One orbiting star ---------- */
  function StarNode({ f, a, r, dur, rev, square, selected, dim, onSelect }) {
    const given = GD.givenName(f.name);
    const online = f.online;
    const size = f.tier === 1 ? 56 : f.tier === 2 ? 46 : 38;
    return (
      <div className="gx-arm" style={{ '--a': a + 'deg', '--r': r + 'px' }}>
        <div className="gx-upright" style={{ '--a': a + 'deg' }}>
          <div className={'gx-counter' + (rev ? ' rev' : '')} style={{ '--dur': dur + 's' }}>
            <button
              className={'gx-node tier-' + f.tier + (online ? ' on' : '') + (selected ? ' sel' : '') + (dim ? ' dim' : '')}
              onClick={(e) => onSelect(f, e.currentTarget)}>
              <span className="gx-halo" />
              <GAvatar name={f.name} size={size} online={online} square={square} />
              <span className="gx-name">{given}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Legend ---------- */
  function RingGlyph({ level }) {
    const rs = [4, 8, 11.5];
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        {rs.map((r, i) => {
          const active = i + 1 === level;
          return <circle key={i} cx="12" cy="12" r={r}
            stroke={active ? 'var(--accent)' : 'rgba(120,150,200,.35)'}
            strokeWidth={active ? 2 : 1.2} />;
        })}
        <circle cx="12" cy="12" r="2" fill="var(--accent)" />
      </svg>
    );
  }
  function Legend() {
    return (
      <div className="gx-legend">
        {[1, 2, 3].map(lv => (
          <div key={lv} className="lg-row">
            <RingGlyph level={lv} />
            <div className="lg-txt">
              <span className="lg-label">{GD.TIER_META[lv].label}</span>
              <span className="lg-sub">{GD.TIER_META[lv].sub}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  /* ---------- The galaxy ---------- */
  function Galaxy({ friends, scale, square, selectedName, paused, meName, onSelect, onCenterClick }) {
    const tiers = useMemo(() => {
      const by = { 1: [], 2: [], 3: [] };
      (friends || []).forEach(f => { (by[f.tier] || by[3]).push(f); });
      return by;
    }, [friends]);

    const rings = [
      { tier: 1, r: 142, dur: 150, rev: false },
      { tier: 2, r: 250, dur: 200, rev: true },
      { tier: 3, r: 356, dur: 260, rev: false },
    ];

    return (
      <div className={'galaxy' + (paused ? ' gx-paused' : '')} style={{ '--scale': scale }}>
        <div className="gx-rings">
          {rings.map(ring => (
            <div key={ring.tier} className="gx-ring" style={{ '--d': ring.r * 2 + 'px' }} />
          ))}
        </div>

        {rings.map(ring => {
          const list = tiers[ring.tier] || [];
          const offset = ring.tier * 18;
          const step = 360 / (list.length || 1);
          return (
            <div key={ring.tier}
              className={'orbit' + (ring.rev ? ' rev' : '')}
              style={{ '--dur': ring.dur + 's' }}>
              {list.map((f, i) => (
                <StarNode key={f.uid || f.name} f={f}
                  a={offset + i * step} r={ring.r}
                  dur={ring.dur} rev={ring.rev} square={square}
                  selected={selectedName === f.name}
                  dim={selectedName && selectedName !== f.name}
                  onSelect={onSelect} />
              ))}
            </div>
          );
        })}

        {onCenterClick ? (
          <button className="gx-me gx-me-btn" onClick={onCenterClick} title="Chỉnh sửa hồ sơ của bạn">
            <span className="gx-me-aura" />
            <GAvatar name={meName || 'Bạn'} size={92} square={square} />
            <span className="gx-me-label">Bạn</span>
          </button>
        ) : (
          <div className="gx-me">
            <span className="gx-me-aura" />
            <GAvatar name={meName || 'Bạn'} size={92} square={square} />
            <span className="gx-me-label">Bạn</span>
          </div>
        )}
      </div>
    );
  }

  /* ---------- Bloom card (sao nở thành hồ sơ) ---------- */
  function BloomCard({ sel, square, onMessage, onCall, onClose }) {
    const f = sel.f;
    const ref = useRef();
    const [pos, setPos] = useState(null);
    const [shown, setShown] = useState(false);

    useLayoutEffect(() => {
      const card = ref.current;
      if (!card) return;
      const cw = card.offsetWidth, ch = card.offsetHeight;
      const { cx, cy } = sel.rect;
      const vw = window.innerWidth, vh = window.innerHeight;
      let left = Math.min(Math.max(cx - cw / 2, 16), vw - cw - 16);
      let top = cy < vh * 0.52 ? cy + 52 : cy - ch - 52;
      top = Math.min(Math.max(top, 16), vh - ch - 16);
      setPos({ left, top, origin: `${(cx - left).toFixed(0)}px ${(cy - top).toFixed(0)}px` });
    }, [sel]);

    useEffect(() => {
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }, []);

    const meta = GD.TIER_META[f.tier];
    const online = f.online;
    return (
      <>
        <div className="gx-backdrop" onClick={onClose} />
        <div ref={ref} className={'bloom' + (shown ? ' in' : '')}
          style={pos ? { left: pos.left, top: pos.top, transformOrigin: pos.origin } : { visibility: 'hidden' }}>
          <button className="bloom-x" onClick={onClose}><GIcon name="x" size={16} /></button>
          <div className="bloom-head">
            <div className="bloom-av">
              <span className="bloom-halo" />
              <GAvatar name={f.name} size={84} online={online} square={square} ring />
            </div>
            <div className="bloom-id">
              <h3>{f.name}</h3>
              <div className={'bloom-status' + (online ? ' on' : '')}>
                <span className="dot" />{online ? 'Đang hoạt động' : 'Ngoại tuyến'}
              </div>
              {meta && <span className="bloom-tier">{meta.label}</span>}
            </div>
          </div>

          <div className="bloom-actions">
            <button className="ba ba-primary" onClick={() => onMessage && onMessage(f)}>
              <GIcon name="message" size={20} /><span>Nhắn tin</span>
            </button>
            <button className="ba" onClick={() => onCall && onCall(f)}>
              <GIcon name="video" size={20} /><span>Gọi video</span>
            </button>
            <button className="ba" onClick={() => onMessage && onMessage(f)}>
              <GIcon name="contacts" size={20} /><span>Trang cá nhân</span>
            </button>
          </div>

          <div className="bloom-info">
            {f.username && <div className="bi-row"><GIcon name="contacts" size={16} /><span>@{f.username}</span></div>}
            <div className="bi-row"><GIcon name={online ? 'eye' : 'users'} size={16} /><span>{online ? 'Đang hoạt động' : 'Ngoại tuyến'}</span></div>
          </div>
        </div>
      </>
    );
  }

  window.GalaxyParts = { Starfield, Galaxy, BloomCard, Legend };
})();
