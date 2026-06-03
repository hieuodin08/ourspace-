// ============================================================================
//  GALAXY VIEW — vỏ ghép vào Ourspace (thay GalaxyApp của bản demo).
//  KHÔNG tự mount root, KHÔNG có thanh top riêng (Ourspace đã có header).
//  Nhận dữ liệu THẬT + handler qua props, tự quản sel/overlay/scale/hint.
//
//  Props:
//    profile      : hồ sơ người đăng nhập (để hiện avatar ở tâm)
//    friends      : mảng bạn bè THẬT (Firebase) — sẽ tự gán tier
//    incoming     : mảng lời mời đến (cho overlay Lời mời + sao băng)
//    onOpenChat(rawFriend)   : mở cửa sổ chat
//    onStartCall(rawFriend)  : gọi video
//    onAccept(rawReq)        : đồng ý lời mời
//    onDecline(rawReq)       : từ chối lời mời
//    onAddFriend()           : mở modal "Thêm bạn" (tìm theo username)
// ============================================================================
(function () {
  const { useState, useEffect, useRef } = React;
  const AD = window.CONTACTS_DATA;
  const GP = window.GalaxyParts;
  const KP = window.DockParts;
  const CF = window.Comets;

  function GalaxyView({ profile, friends, incoming, conversations, onOpenChat, onStartCall, onAccept, onDecline, onAddFriend, onEditProfile, showMessages }) {
    const square = false;
    const [sel, setSel] = useState(null);       // { f, rect:{cx,cy} }
    const [overlay, setOverlay] = useState(null);
    const [scale, setScale] = useState(1);
    const [hintGone, setHintGone] = useState(false);
    const stageRef = useRef(null);

    const nodes = AD.assignTiers(friends || []);
    const onlineCount = nodes.filter(n => n.online).length;
    const incomingList = incoming || [];
    const suggestions = incomingList.map(r => ({
      name: r.displayName || 'Người dùng',
      sub: r.username ? '@' + r.username : 'Muốn kết bạn với bạn',
      raw: r,
    }));

    // fit galaxy theo KÍCH THƯỚC KHUNG (không phải cả màn hình) vì đang nhúng trong tab.
    useEffect(() => {
      const fit = () => {
        const el = stageRef.current;
        if (!el) return;
        const size = 860;
        const availW = el.clientWidth - 24;
        const availH = el.clientHeight - 96; // chừa chỗ cho dock
        setScale(Math.max(0.32, Math.min(availW / size, availH / size, 1.08)));
      };
      fit();
      const t = setTimeout(fit, 60);
      window.addEventListener('resize', fit);
      return () => { clearTimeout(t); window.removeEventListener('resize', fit); };
    }, []);

    // Esc đóng hồ sơ / overlay
    useEffect(() => {
      const k = e => { if (e.key === 'Escape') { setSel(null); setOverlay(null); } };
      window.addEventListener('keydown', k);
      return () => window.removeEventListener('keydown', k);
    }, []);

    const selectStar = (f, el) => {
      const r = el.getBoundingClientRect();
      setSel({ f, rect: { cx: r.left + r.width / 2, cy: r.top + r.height / 2 } });
      setHintGone(true);
    };
    const pickFromList = (f) => {
      setOverlay(null);
      setSel({ f, rect: { cx: window.innerWidth / 2, cy: window.innerHeight / 2 } });
      setHintGone(true);
    };
    const openDock = (id) => {
      if (id === 'add') { if (onAddFriend) onAddFriend(); return; }
      setOverlay(o => o === id ? null : id);
    };
    const paused = !!sel || !!overlay;

    return (
      <div className="gx-root">
        <GP.Starfield />

        <div className="gx-presence gx-presence-float">
          <span className="gx-pdot" />{onlineCount} bạn đang online
        </div>

        <main className="gx-stage" ref={stageRef}>
          <GP.Legend />
          <GP.Galaxy friends={nodes} scale={scale} square={square}
            meName={profile && profile.displayName}
            selectedName={sel && sel.f.name} paused={paused} onSelect={selectStar}
            onCenterClick={onEditProfile} />
          {!hintGone && nodes.length > 0 && (
            <div className="gx-hint">Chạm vào một vì sao để mở hồ sơ</div>
          )}
          {nodes.length === 0 && (
            <div className="gx-hint">Chưa có bạn bè — bấm “Thêm bạn” ở thanh dưới để mời.</div>
          )}
        </main>

        <CF.CometField enabled={true} paused={paused} square={square}
          suggestions={suggestions}
          onAdd={(sug) => { if (onAccept) onAccept(sug.raw); }} />

        {sel && (
          <GP.BloomCard sel={sel} square={square}
            onMessage={(f) => { setSel(null); if (onOpenChat) onOpenChat(f.raw); }}
            onCall={(f) => { setSel(null); if (onStartCall) onStartCall(f.raw); }}
            onClose={() => setSel(null)} />
        )}

        <KP.Dock current={overlay} incomingCount={incomingList.length}
          showMessages={showMessages} onOpen={openDock} />

        {overlay === 'messages' && (
          <KP.MessagesOverlay conversations={conversations || []} myUid={profile && profile.uid} square={square}
            onClose={() => setOverlay(null)}
            onPick={(c) => { setOverlay(null); if (onOpenChat) onOpenChat({ uid: c.otherUid, displayName: c.otherName, avatarColor: c.otherColor, username: '' }); }} />
        )}
        {(overlay === 'search' || overlay === 'list') && (
          <KP.ListOverlay mode={overlay} friends={nodes} square={square}
            onClose={() => setOverlay(null)} onPick={pickFromList} />
        )}
        {overlay === 'requests' && (
          <KP.RequestsOverlay incoming={incomingList} square={square}
            onClose={() => setOverlay(null)} onAccept={onAccept} onDecline={onDecline} />
        )}
      </div>
    );
  }

  window.GalaxyView = GalaxyView;
})();
