// ============================================================================
//  GALAXY — "sao băng" (port từ comets.jsx).
//  Khác bản demo: nguồn dữ liệu là `suggestions` truyền vào (ở Ourspace = các
//  LỜI MỜI KẾT BẠN đang chờ). "Kết bạn" gọi onAdd(sug) → đồng ý lời mời.
//  "Bỏ qua" chỉ cho sao bay đi, KHÔNG từ chối lời mời (tránh thao tác phá huỷ).
// ============================================================================
(function () {
  const { useState, useRef, useEffect } = React;
  const CD = window.CONTACTS_DATA;
  const CIcon = window.GxIcon;
  const CAvatar = window.ContactsParts.Avatar;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ---------- Một ngôi sao băng ---------- */
  function Comet({ sug, paused, square, onDone, onAdd }) {
    const ref = useRef();
    const animRef = useRef(null);
    const [state, setState] = useState('fly');   // fly | added
    const [focus, setFocus] = useState('none');  // none | hover | pin
    const [ang, setAng] = useState(4);

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const startY = vh * (0.12 + Math.random() * 0.4);
      const endY = startY + (Math.random() * 0.34 - 0.14) * vh;
      const x0 = -180, x1 = vw + 180;
      const dx = x1 - x0, dy = endY - startY;
      setAng(Math.atan2(dy, dx) * 180 / Math.PI);
      const dur = (21 + Math.random() * 9) * 1000;
      const anim = el.animate(
        [{ transform: `translate(${x0}px,${startY}px)` },
         { transform: `translate(${x1}px,${endY}px)` }],
        { duration: dur, easing: 'linear', fill: 'forwards' });
      animRef.current = anim;
      anim.onfinish = () => onDone();
      return () => { try { anim.cancel(); } catch (e) {} };
    }, []);

    useEffect(() => {
      const a = animRef.current;
      if (!a) return;
      if (paused || focus !== 'none' || state !== 'fly') a.pause();
      else a.play();
    }, [paused, focus, state]);

    const add = (e) => {
      e.stopPropagation();
      setState('added');
      onAdd();
      setTimeout(onDone, 1300);
    };
    const skip = (e) => {
      e.stopPropagation();
      const a = animRef.current;
      if (a) { a.playbackRate = 7; a.onfinish = onDone; a.play(); }
      else onDone();
    };

    return (
      <div ref={ref} className={'comet' + (focus !== 'none' ? ' focus' : '') + (state === 'added' ? ' added' : '')}>
        <div className="comet-core" style={{ '--cy': '26px' }}
          onMouseEnter={() => setFocus(f => f === 'pin' ? f : 'hover')}
          onMouseLeave={() => setFocus(f => f === 'pin' ? f : 'none')}
          onClick={() => state === 'fly' && setFocus(f => f === 'pin' ? 'hover' : 'pin')}>
          <span className="comet-tail" style={{ '--ang': ang + 'deg' }} />
          <span className="comet-ring" />
          <div className="comet-av">
            <CAvatar name={sug.name} size={52} square={square} />
            <span className="comet-badge"><CIcon name="sparkle" size={12} stroke={2.2} /></span>
          </div>
          <span className="comet-name">{sug.name}</span>
          {state === 'added' ? (
            <span className="comet-done"><CIcon name="check" size={15} stroke={2.6} />Đã đồng ý</span>
          ) : (
            <div className="comet-meta">
              <span className="comet-mutual">{sug.sub || 'Muốn kết bạn với bạn'}</span>
              <div className="comet-acts">
                <button className="cm-add" onClick={add}>
                  <CIcon name="userPlus" size={14} stroke={2.4} />Kết bạn
                </button>
                <button className="cm-skip" onClick={skip}>Bỏ qua</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- Bộ sinh sao băng ---------- */
  function CometField({ enabled, paused, square, suggestions, onAdd }) {
    const [list, setList] = useState([]);
    const [toast, setToast] = useState('');
    const qRef = useRef([]);
    const idRef = useRef(0);
    const pausedRef = useRef(paused); pausedRef.current = paused;
    const sugRef = useRef(suggestions); sugRef.current = suggestions;

    const nextSug = () => {
      const all = sugRef.current || [];
      if (all.length === 0) return null;
      if (qRef.current.length === 0) qRef.current = shuffle([...all]);
      return qRef.current.shift();
    };

    useEffect(() => {
      if (!enabled) { setList([]); return; }
      let cancelled = false;
      let timer;
      const schedule = (delay) => {
        timer = setTimeout(() => {
          if (cancelled) return;
          if (pausedRef.current || !(sugRef.current || []).length) { schedule(2200); return; }
          setList(cur => {
            if (cur.length >= 2) return cur;
            const s = nextSug();
            if (!s) return cur;
            idRef.current += 1;
            return [...cur, { id: idRef.current, sug: s }];
          });
          schedule(4500 + Math.random() * 5000);
        }, delay);
      };
      schedule(1400);
      return () => { cancelled = true; clearTimeout(timer); };
    }, [enabled]);

    const remove = (id) => setList(cur => cur.filter(c => c.id !== id));
    const addFriend = (sug) => {
      if (onAdd) onAdd(sug);
      setToast('Đã đồng ý kết bạn với ' + CD.givenName(sug.name));
      setTimeout(() => setToast(''), 2400);
    };

    if (!enabled) return null;
    return (
      <>
        {list.map(c => (
          <Comet key={c.id} sug={c.sug} paused={paused} square={square}
            onDone={() => remove(c.id)} onAdd={() => addFriend(c.sug)} />
        ))}
        {toast && <div className="gx-toast">{toast}</div>}
      </>
    );
  }

  window.Comets = { CometField };
})();
