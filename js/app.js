// ====== Màn hình hướng dẫn khi chưa cấu hình Firebase ======
var FirebaseSetupScreen = () => (
  <div className="min-h-screen flex items-center justify-center p-6 text-white"
       style={{ background: 'linear-gradient(135deg, #0a1f4a 0%, #051030 45%, #020817 100%)' }}>
    <div className="max-w-lg bg-slate-900/80 border border-blue-900/60 rounded-2xl p-7 shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-sky-500 rounded-xl flex items-center justify-center">
          <Hand className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold">Ourspace cần cấu hình Firebase</h1>
      </div>
      <p className="text-slate-300 text-sm mb-4">
        Để chat &amp; danh bạ đồng bộ trên mọi thiết bị, hãy tạo một dự án Firebase
        miễn phí rồi dán cấu hình vào file <code className="bg-slate-800 px-1.5 py-0.5 rounded text-sky-300">js/firebase-config.js</code>.
      </p>
      <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside mb-4">
        <li>Mở <a className="text-sky-400 underline" href="https://console.firebase.google.com" target="_blank" rel="noreferrer">console.firebase.google.com</a> → tạo dự án.</li>
        <li>Thêm một <b>Web app</b> (biểu tượng <code className="bg-slate-800 px-1 rounded">&lt;/&gt;</code>) → copy <code className="bg-slate-800 px-1 rounded">firebaseConfig</code>.</li>
        <li>Bật <b>Authentication → Email/Password</b>.</li>
        <li>Tạo <b>Firestore Database</b> (test mode).</li>
        <li>Dán cấu hình vào <code className="bg-slate-800 px-1 rounded text-sky-300">js/firebase-config.js</code> rồi tải lại trang.</li>
      </ol>
      <p className="text-xs text-slate-500">Hướng dẫn chi tiết nằm ngay trong file đó.</p>
    </div>
  </div>
);

// ====== Màn hình chờ ======
var Splash = ({ text = 'Đang tải...' }) => (
  <div className="min-h-screen flex flex-col items-center justify-center text-white gap-3"
       style={{ background: 'linear-gradient(135deg, #0a1f4a 0%, #051030 45%, #020817 100%)' }}>
    <Loader className="w-8 h-8 animate-spin text-sky-400" />
    <span className="text-slate-400 text-sm">{text}</span>
  </div>
);

// ====== Toast nhỏ ======
var Toast = ({ text }) => (
  text ? (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-blue-900/60 text-white text-sm px-4 py-2 rounded-full shadow-2xl">
      {text}
    </div>
  ) : null
);

// ====== Màn hình "Cuộc gọi đến" (chuông + Nghe / Từ chối) ======
var IncomingCallScreen = ({ peerId, name, onAccept, onReject }) => (
  <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center text-white"
       style={{ background: 'linear-gradient(135deg, #0a1f4a 0%, #051030 45%, #020817 100%)' }}>
    <div className="mb-6 animate-pulse">
      <Avatar name={name} color={colorForUid(peerId)} size={120} />
    </div>
    <div className="text-2xl font-bold mb-1">{name}</div>
    <div className="text-slate-400 mb-16">Cuộc gọi video đến…</div>
    <div className="flex items-center gap-16">
      <button onClick={onReject} className="flex flex-col items-center gap-2">
        <span className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg transition">
          <PhoneOff className="w-7 h-7 text-white" />
        </span>
        <span className="text-sm text-red-300">Từ chối</span>
      </button>
      <button onClick={onAccept} className="flex flex-col items-center gap-2">
        <span className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-lg animate-bounce">
          <Phone className="w-7 h-7 text-white" />
        </span>
        <span className="text-sm text-emerald-300">Nghe</span>
      </button>
    </div>
  </div>
);

// ====== Ứng dụng chính sau khi đăng nhập ======
// Nâng media + PeerJS lên đây để vừa nhận cuộc gọi đến (kể cả khi đang xem chat)
// vừa gọi đi từ danh bạ. Điều hướng giữa Home và phòng gọi.
var MainApp = ({ profile, setProfile, onLogout }) => {
  const media = useMedia();
  const peerConn = usePeerConnection(profile.displayName, media.stream);
  const [view, setView] = useState('home');     // 'home' | 'call'
  const [callTarget, setCallTarget] = useState(null);
  const [toast, setToast] = useState('');
  const hadPeersRef = useRef(false);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((t) => {
    setToast(t);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 2600);
  }, []);
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // Đăng ký peerId online để người khác gọi được; xoá khi đóng tab.
  useEffect(() => {
    if (peerConn.myPeerId) fbSetPeerId(profile.uid, peerConn.myPeerId);
  }, [peerConn.myPeerId, profile.uid]);
  useEffect(() => {
    const clear = () => fbSetPeerId(profile.uid, null);
    window.addEventListener('beforeunload', clear);
    return () => window.removeEventListener('beforeunload', clear);
  }, [profile.uid]);

  const exitCall = useCallback(() => {
    peerConn.hangUpAll();
    media.stopMedia();
    setCallTarget(null);
    hadPeersRef.current = false;
    setView('home');
  }, [peerConn.hangUpAll, media.stopMedia]);

  // Có cuộc gọi đến → KHÔNG tự vào phòng nữa. App hiện màn hình "Cuộc gọi đến"
  // (IncomingCallScreen) để người nhận chủ động bấm Nghe hoặc Từ chối.
  const acceptIncomingCall = useCallback(() => {
    // Gọi getUserMedia NGAY trong sự kiện chạm "Nghe" để trình duyệt di động
    // chịu mở camera (nhiều trình duyệt chặn nếu không gắn với cử chỉ người dùng).
    if (!media.stream && !media.isStarting) media.startMedia();
    setView('call');
  }, [media.stream, media.isStarting, media.startMedia]);
  const rejectIncomingCall = useCallback(() => { peerConn.rejectIncoming(); }, [peerConn.rejectIncoming]);
  const incomingName = peerConn.incomingCallPeer
    ? (peerConn.peers[peerConn.incomingCallPeer]?.name || 'Người dùng')
    : '';

  // Theo dõi kết nối: đối phương cúp máy (peers về rỗng sau khi đã có) → về Home.
  const peerCount = Object.keys(peerConn.peers).length;
  useEffect(() => {
    if (peerCount > 0) {
      hadPeersRef.current = true;
    } else if (peerCount === 0 && hadPeersRef.current && view === 'call') {
      hadPeersRef.current = false;
      showToast('Cuộc gọi đã kết thúc');
      exitCall();
    }
  }, [peerCount, view, exitCall, showToast]);

  // Gọi video cho 1 liên hệ: lấy peerId mới nhất từ Firestore.
  const startCall = useCallback(async (contact) => {
    if (peerConn.status !== 'connected') { showToast('Đang kết nối, thử lại sau giây lát'); return; }
    let target = contact;
    try { target = (await fbGetProfile(contact.uid)) || contact; } catch (_) {}
    if (!target.peerId) { showToast(`${contact.displayName} hiện không online`); return; }
    if (target.peerId === peerConn.myPeerId) { showToast('Không thể tự gọi chính mình'); return; }
    setCallTarget(target.peerId);
    setView('call');
  }, [peerConn.status, peerConn.myPeerId, showToast]);

  const saveProfile = useCallback(async (patch) => {
    await fbUpdateProfile(profile.uid, patch);
    setProfile(p => ({ ...p, ...patch }));
  }, [profile.uid, setProfile]);

  const callUser = { id: profile.uid, name: profile.displayName };

  return (
    <div className="h-screen w-screen overflow-hidden text-white"
         style={{ background: 'linear-gradient(135deg, #0a1f4a 0%, #051030 45%, #020817 100%)' }}>
      {/* Home luôn được mount để giữ subscription Firebase; chỉ ẩn khi đang gọi. */}
      <div className={view === 'call' ? 'hidden' : 'h-full'}>
        <Home
          profile={profile}
          onSaveProfile={saveProfile}
          onLogout={onLogout}
          onStartCall={startCall}
          myPeerId={peerConn.myPeerId}
          peerStatus={peerConn.status}
        />
      </div>

      {view === 'call' && (
        <CallRoom
          user={callUser}
          media={media}
          peerConn={peerConn}
          callTarget={callTarget}
          onExitCall={exitCall}
        />
      )}

      {peerConn.incomingCallPeer && view !== 'call' && (
        <IncomingCallScreen
          peerId={peerConn.incomingCallPeer}
          name={incomingName}
          onAccept={acceptIncomingCall}
          onReject={rejectIncomingCall}
        />
      )}

      <Toast text={toast} />
    </div>
  );
};

// ====== ROOT ======
var App = () => {
  const [profile, setProfile] = useState(undefined); // undefined = đang tải, null = chưa đăng nhập

  useEffect(() => {
    if (!fbConfigured()) { setProfile(null); return; }
    const unsub = fbOnAuth(setProfile);
    return () => unsub && unsub();
  }, []);

  const handleLogout = useCallback(async () => {
    if (profile?.uid) fbSetPeerId(profile.uid, null);
    await fbLogout();
  }, [profile]);

  if (!fbConfigured()) return <FirebaseSetupScreen />;
  if (profile === undefined) return <Splash text="Đang khởi động Ourspace..." />;

  return (
    <DBContext.Provider value={DB}>
      {!profile
        ? <Lobby onJoin={() => {}} />
        : <MainApp key={profile.uid} profile={profile} setProfile={setProfile} onLogout={handleLogout} />}
    </DBContext.Provider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
