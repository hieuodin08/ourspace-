// ====== UI: Lobby (Ourspace login UI) ======
var Lobby = ({ onJoin, onTerms } = {}) => {
  const db = useDB();
  const [mode, setMode] = useState('login');
  const [login, setLogin] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef(null);
  const starsRef = useRef(null);

  useEffect(() => { setError(''); }, [mode]);

  useEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    const setShift = () => {
      let restWidth = 0;
      title.querySelectorAll('.letter:not(.gold)').forEach((l) => {
        restWidth += l.offsetWidth;
      });
      title.style.setProperty('--o-shift', restWidth / 2 + 'px');
      title.classList.add('ready');
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setShift);
    else setTimeout(setShift, 100);
  }, []);

  useEffect(() => {
    const container = starsRef.current;
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 18; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.style.top = Math.random() * 100 + '%';
      star.style.left = Math.random() * 100 + '%';
      star.style.animationDelay = Math.random() * 3 + 's';
      star.style.opacity = (Math.random() * 0.6 + 0.2).toFixed(2);
      const size = Math.random() * 1.5 + 0.5;
      star.style.width = size + 'px';
      star.style.height = size + 'px';
      container.appendChild(star);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Mật khẩu nhập lại không khớp');
          return;
        }
        const res = await registerUser(db, { username, email, password, displayName: username });
        if (!res.ok) { setError(res.error); return; }
        // Firebase tự kích hoạt onAuthStateChanged → App sẽ chuyển màn hình.
        onJoin?.(res.user);
      } else {
        const res = await loginUser(db, { login, password });
        if (!res.ok) { setError(res.error); return; }
        onJoin?.(res.user);
      }
    } catch (err) {
      setError('Có lỗi xảy ra: ' + (err?.message || 'Vui lòng thử lại'));
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setPassword('');
    setConfirmPassword('');
  };

  const TITLE = 'Ourspace';
  const isSignup = mode === 'signup';

  return (
    <div className="ourspace-login">
      <div className="background" />
      <div className="vignette" />
      <div className="light-ray" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="stars" ref={starsRef} />

      <div className="container">
        <div className="header">
          <div className="crown-ornament">
            <span className="orn-line" />
            <span className="orn-diamond" />
            <span className="orn-line" />
          </div>

          <h1 id="title-text" ref={titleRef}>
            {TITLE.split('').map((ch, i) => (
              <span
                key={i}
                className={`letter${i === 0 ? ' gold' : ''}`}
                style={i === 0 ? undefined : { animationDelay: `${1.45 + (i - 1) * 0.15}s` }}
              >
                {ch}
              </span>
            ))}
          </h1>

          <div className="accent-line">
            <span />
            <div className="dot" />
            <span />
          </div>
        </div>

        <div className="login-form-wrapper">
          <form className="login-form" onSubmit={handleSubmit}>
            <div style={{
              display: 'flex', gap: '8px', marginBottom: '24px',
              padding: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px'
            }}>
              <button type="button" onClick={() => switchMode('login')} style={{
                flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none',
                background: !isSignup ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : 'transparent',
                color: !isSignup ? '#fff' : 'rgba(255,255,255,0.6)',
                fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.15em', cursor: 'pointer',
                transition: 'all 0.2s'
              }}>Đăng nhập</button>
              <button type="button" onClick={() => switchMode('signup')} style={{
                flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none',
                background: isSignup ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : 'transparent',
                color: isSignup ? '#fff' : 'rgba(255,255,255,0.6)',
                fontFamily: 'Outfit, sans-serif', fontSize: '0.78rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.15em', cursor: 'pointer',
                transition: 'all 0.2s'
              }}>Đăng ký</button>
            </div>

            {isSignup ? (
              <>
                <div className="form-group">
                  <label htmlFor="username">Tên đăng nhập</label>
                  <input
                    type="text" id="username" name="username"
                    placeholder="Tối thiểu 3 ký tự"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email" id="email" name="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </>
            ) : (
              <div className="form-group">
                <label htmlFor="login">Tên đăng nhập hoặc Email</label>
                <input
                  type="text" id="login" name="login"
                  placeholder="Nhập tên đăng nhập hoặc email"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="password">Mật khẩu</label>
              <input
                type="password" id="password" name="password"
                placeholder={isSignup ? 'Tối thiểu 6 ký tự' : 'Nhập mật khẩu'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                required
              />
            </div>

            {isSignup && (
              <div className="form-group">
                <label htmlFor="confirm-password">Nhập lại mật khẩu</label>
                <input
                  type="password" id="confirm-password" name="confirm-password"
                  placeholder="Nhập lại mật khẩu"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            )}

            {error && (
              <div style={{
                marginBottom: '20px', padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                borderRadius: '8px', color: '#fecaca',
                fontSize: '0.85rem', textAlign: 'center',
                fontFamily: 'Outfit, sans-serif'
              }}>⚠ {error}</div>
            )}

            <button type="submit" className="login-btn" disabled={submitting} style={submitting ? { opacity: 0.6, cursor: 'wait' } : undefined}>
              {submitting ? 'Đang xử lý...' : (isSignup ? 'Tạo tài khoản' : 'Đăng nhập')}
            </button>
          </form>

          <div className="footer-links">
            <a href="#switch" onClick={(e) => { e.preventDefault(); switchMode(isSignup ? 'login' : 'signup'); }}>
              {isSignup ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
            </a>
            <span className="footer-links-divider">•</span>
            <a href="#terms" onClick={(e) => { e.preventDefault(); onTerms?.(); }}>Điều khoản</a>
          </div>
        </div>
      </div>
    </div>
  );
};

// ====== UI: Chat Panel ======
var ChatPanel = ({ userId, userName, onSpeak, onSend, onRecall, localMessages, remoteMessages }) => {
  const [input, setInput] = useState('');
  const [justSentId, setJustSentId] = useState(null);
  const [kick, setKick] = useState(false);
  const endRef = useRef(null);
  const sentTimerRef = useRef(null);
  const kickTimerRef = useRef(null);

  const allMessages = useMemo(
    () => [...localMessages, ...remoteMessages].sort((a, b) => a.timestamp - b.timestamp),
    [localMessages, remoteMessages]
  );

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [allMessages.length]);

  // Clear pending timers khi unmount để tránh setState on unmounted component.
  useEffect(() => () => {
    if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
    if (kickTimerRef.current) clearTimeout(kickTimerRef.current);
  }, []);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const id = onSend(text);
    setJustSentId(id);
    setKick(true);
    setInput('');
    if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
    if (kickTimerRef.current) clearTimeout(kickTimerRef.current);
    sentTimerRef.current = setTimeout(() => setJustSentId(null), 900);
    kickTimerRef.current = setTimeout(() => setKick(false), 500);
  };

  const recall = (id) => onRecall(id);

  return (
    <div className="flex flex-col h-full bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700 overflow-hidden">
      <div className="os-panel-header chat px-4 py-3 flex items-center gap-2 text-white">
        <span className="os-icon-pill w-7 h-7 rounded-lg flex items-center justify-center">
          <MessageSquare className="w-4 h-4" />
        </span>
        <h3 className="font-semibold tracking-wide">Tin nhắn</h3>
        <span className="ml-auto text-[11px] font-medium bg-white/15 border border-white/20 px-2 py-0.5 rounded-full">
          {allMessages.length} tin
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {allMessages.length === 0 && <div className="text-center text-slate-500 text-sm py-8">Chưa có tin nhắn.</div>}
        {allMessages.map(msg => {
          const isMe = msg.userId === userId;
          return (
            <div key={msg.id} className={`group flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="text-xs text-slate-400 mb-0.5 px-1">{msg.userName}</div>
              {msg.recalled ? (
                <div className="os-msg-recalled max-w-[85%] px-3 py-1.5 rounded-2xl border border-dashed border-slate-600 bg-slate-800/40 text-slate-400 italic text-xs flex items-center gap-1.5">
                  <Undo className="w-3 h-3" /> Tin nhắn đã được thu hồi
                </div>
              ) : (
                <div className={`relative max-w-[85%] px-3 py-2 rounded-2xl ${isMe ? 'bg-gradient-to-br from-blue-600 to-sky-500 text-white' : 'bg-slate-700 text-white'} ${msg.id === justSentId ? 'os-msg-sent' : ''}`}>
                  <p className="text-sm break-words">{msg.text}</p>
                  {!isMe && (
                    <button onClick={() => onSpeak(msg.text)} className="os-tts-chip mt-1">
                      <span className="os-tts-bars"><i></i><i></i><i></i><i></i></span>
                      Đọc to
                    </button>
                  )}
                  {isMe && !msg.recalled && (
                    <button onClick={() => recall(msg.id)} title="Thu hồi tin nhắn"
                      className="os-msg-recall-btn absolute -left-9 top-1/2 -translate-y-1/2 bg-slate-900/90 hover:bg-red-600 text-slate-300 hover:text-white px-1.5 py-1 rounded-full border border-slate-700 hover:border-red-500 flex items-center justify-center">
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t border-slate-700">
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Nhập tin nhắn..."
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          <button onClick={send} disabled={!input.trim()}
            className={`os-send-btn px-3 py-2 disabled:opacity-50 text-white rounded-lg ${kick ? 'kick' : ''}`}>
            <span className="os-send-icon inline-flex"><Send className="w-4 h-4" /></span>
          </button>
          <button onClick={() => input.trim() && onSpeak(input)} disabled={!input.trim()}
            className="os-tts-btn px-3 py-2 disabled:opacity-50 disabled:!shadow-none text-white rounded-lg">
            <span className="os-tts-icon"><Volume2 className="w-4 h-4" /></span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ====== UI: ASL Letter Panel (nhận diện chữ cái A-Z từ cam/tfjs_model) ======
var ASLPanel = ({ asl, onSpeak, onSendAsMessage }) => {
  const instantPct = (asl.confidence * 100).toFixed(0);
  const progressPct = (asl.progress * 100).toFixed(0);
  const candidateRatioPct = (asl.candidateRatio * 100).toFixed(0);
  const candidateConfPct = (asl.candidateAvgConf * 100).toFixed(0);
  const dominanceTargetPct = (asl.dominanceTarget * 100).toFixed(0);
  const sec = (asl.progress * (asl.windowMs / 1000)).toFixed(1);
  const totalSec = (asl.windowMs / 1000).toFixed(0);

  // Khi nào "sẵn sàng commit": đủ progress & ratio
  const aboutToCommit = asl.progress >= 0.95 && asl.candidateRatio >= asl.dominanceTarget && asl.candidate;

  return (
    <div className="flex flex-col h-full bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400" />
        <h3 className="text-white font-semibold">Nhận diện chữ cái ASL</h3>
        <span className="ml-auto text-[10px] text-slate-400">
          {asl.status === 'loading' && '⏳ Đang tải model'}
          {asl.status === 'ready' && `✅ ${(asl.accuracy * 100).toFixed(0)}% acc`}
          {asl.status === 'error' && '❌ Lỗi model'}
          {asl.status === 'idle' && '⏸ Tắt'}
        </span>
      </div>

      {/* === Thanh văn bản câu (đang nhập) === */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-700 bg-slate-900/50">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Câu đang nhập</span>
          <span className="text-[10px] text-slate-500">{asl.sentence.length} ký tự</span>
        </div>
        <div className="bg-black/60 border border-slate-700 rounded-lg p-3 min-h-[60px] font-mono text-xl tracking-wider text-white break-all leading-tight">
          {asl.sentence || <span className="text-slate-600">_</span>}
          <span className="inline-block w-0.5 h-5 bg-amber-400 ml-1 align-middle animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          <button onClick={asl.addSpace}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-2 rounded-lg font-medium">
            ⎵ Cách
          </button>
          <button onClick={asl.deleteLastChar}
            className="text-xs bg-rose-500/80 hover:bg-rose-500 text-white px-2 py-2 rounded-lg font-bold flex items-center justify-center gap-1">
            ⌫ Xoá chữ cuối
          </button>
          <button onClick={asl.clearSentence}
            className="text-xs bg-red-600/80 hover:bg-red-600 text-white px-2 py-2 rounded-lg font-medium">
            🗑 Xoá hết
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          <button
            onClick={() => asl.sentence.trim() && onSpeak(asl.sentence.trim())}
            disabled={!asl.sentence.trim()}
            className="px-2 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/40 disabled:opacity-40 text-emerald-200 rounded-lg text-xs flex items-center justify-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5" /> Đọc câu
          </button>
          <button
            onClick={() => asl.sentence.trim() && onSendAsMessage(asl.sentence.trim())}
            disabled={!asl.sentence.trim()}
            className="px-2 py-1.5 bg-purple-500/20 hover:bg-purple-500/40 disabled:opacity-40 text-purple-200 rounded-lg text-xs flex items-center justify-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> Gửi chat
          </button>
        </div>
      </div>

      {/* === Khu vote 3 giây === */}
      <div className="px-3 py-3 border-b border-slate-700 bg-slate-900/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Đang tổng hợp ({sec}s / {totalSec}s)</span>
          {aboutToCommit && <span className="text-[10px] text-emerald-400 font-bold animate-pulse">✓ SẼ GHI</span>}
        </div>

        <div className="flex items-center gap-3">
          {/* Chữ candidate to */}
          <div
            className="font-bold leading-none flex items-center justify-center"
            style={{
              fontSize: 72,
              width: 90, height: 90,
              color: aboutToCommit ? '#4ade80' : (asl.candidate ? '#fbbf24' : 'rgba(255,255,255,0.2)'),
              textShadow: aboutToCommit ? '0 4px 20px rgba(74, 222, 128, 0.6)' : 'none',
              transition: 'color 0.3s',
              background: 'rgba(0,0,0,0.4)', borderRadius: 12,
            }}>
            {asl.candidate || '—'}
          </div>

          <div className="flex-1 space-y-1.5">
            {/* Progress 3 giây */}
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>Thời gian</span><span>{progressPct}%</span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded overflow-hidden">
                <div className="h-full bg-amber-400 transition-all duration-100"
                     style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            {/* Ratio đa số */}
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>Tỉ lệ trùng (cần ≥{dominanceTargetPct}%)</span><span>{candidateRatioPct}%</span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded overflow-hidden">
                <div className={`h-full transition-all duration-100 ${asl.candidateRatio >= asl.dominanceTarget ? 'bg-emerald-400' : 'bg-slate-500'}`}
                     style={{ width: `${candidateRatioPct}%` }} />
              </div>
            </div>
            {/* Confidence TB */}
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>Conf TB</span><span>{candidateConfPct}%</span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded overflow-hidden">
                <div className="h-full bg-blue-400 transition-all duration-100"
                     style={{ width: `${candidateConfPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        <button onClick={asl.resetVote}
          className="w-full mt-2 text-[10px] text-slate-400 hover:text-white py-1">
          ↻ Bỏ qua, đếm lại từ đầu
        </button>
      </div>

      {/* === Frame hiện tại (instant) — thu nhỏ === */}
      <div className="px-3 py-2 border-b border-slate-700 bg-slate-900/20">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Frame hiện tại</span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm" style={{ color: asl.letter ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>
              {asl.letter || '—'}
            </span>
            <span className="text-[10px] text-slate-400">{instantPct}%</span>
          </div>
        </div>
        {asl.top3.length > 0 && (
          <div className="mt-1.5">
            {asl.top3.map((item, i) => {
              const p = (item.prob * 100).toFixed(0);
              return (
                <div key={i} className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold text-white w-3">{item.letter}</span>
                  <div className="flex-1 h-1.5 bg-slate-900 rounded overflow-hidden">
                    <div className="h-full bg-emerald-500/60" style={{ width: `${p}%` }} />
                  </div>
                  <span className="text-[9px] text-slate-400 w-8 text-right">{p}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ====== UI: Local PIP (video nhỏ góc trên-phải) ======
var LocalPip = ({ videoRef, signEnabled, aslLetter, aslConfidence, allLandmarks, showLandmarks, userName, audioEnabled, videoEnabled }) => (
  <div className="absolute top-3 right-3 md:top-4 md:right-4 w-28 sm:w-44 md:w-64 aspect-video rounded-2xl border-2 border-blue-500 ring-4 ring-blue-500/20 shadow-2xl shadow-blue-950/60 overflow-hidden bg-slate-950 z-20">
    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
    {showLandmarks && signEnabled && (
      <HandSkeleton allLandmarks={allLandmarks} mirror={true} />
    )}
    {signEnabled && aslLetter && aslConfidence > 0.7 && (
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-sky-500 px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 max-w-[92%]">
        <Hand className="w-3 h-3" />
        <span className="font-semibold text-[11px] truncate">{aslLetter}</span>
        <span className="text-[9px] bg-white/20 px-1 rounded">{Math.round(aslConfidence * 100)}%</span>
      </div>
    )}
    <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1.5">
      <span className="bg-black/70 backdrop-blur px-2 py-0.5 rounded-full text-[11px] font-medium">{userName} (Bạn)</span>
      <div className="ml-auto flex items-center gap-1">
        {!audioEnabled && <div className="bg-red-500/90 p-1 rounded-full"><MicOff className="w-2.5 h-2.5" /></div>}
        {!videoEnabled && <div className="bg-red-500/90 p-1 rounded-full"><VideoOff className="w-2.5 h-2.5" /></div>}
      </div>
    </div>
  </div>
);

// ====== UI: Remote Video (full-bleed, dùng absolute inset-0) ======
var RemoteVideo = ({ peerId, peerData, showLandmarks }) => {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && peerData.stream) ref.current.srcObject = peerData.stream; }, [peerData.stream]);
  return (
    <div className="absolute inset-0 bg-slate-900 overflow-hidden">
      {peerData.stream ? (
        <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Loader className="w-10 h-10 animate-spin text-blue-400" />
        </div>
      )}
      {showLandmarks && peerData.asl?.landmarks && (
        <HandSkeleton allLandmarks={peerData.asl.landmarks} mirror={false} />
      )}
      {peerData.asl?.letter && peerData.asl.confidence > 0.7 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-sky-500 text-white px-4 py-2 rounded-full shadow-2xl shadow-blue-950/60 flex items-center gap-2 text-sm">
          <Hand className="w-4 h-4" />
          <span className="font-semibold">{peerData.asl.letter}</span>
          {peerData.asl.word && <span className="opacity-80 hidden sm:inline">→ {peerData.asl.word}</span>}
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded ml-1">{Math.round(peerData.asl.confidence * 100)}%</span>
        </div>
      )}
      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-sm flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>{peerData.name || 'Người dùng'}</span>
      </div>
    </div>
  );
};
