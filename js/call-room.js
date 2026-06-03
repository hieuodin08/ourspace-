// ====== Nền sóng biển ======
var WaveShape = ({ className, fill }) => (
  <svg className={className} viewBox="0 0 1440 200" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path fill={fill} d="M0,80 C180,140 360,20 720,80 C1080,140 1260,20 1440,80 L1440,200 L0,200 Z" />
  </svg>
);
var WaveBackground = () => (
  <div className="os-waves" aria-hidden="true">
    <WaveShape className="os-wave-3" fill="#1e3a8a" />
    <WaveShape className="os-wave-2" fill="#2563eb" />
    <WaveShape className="os-wave-1" fill="#38bdf8" />
  </div>
);

// ====== UI: Main Room ======
// media + peerConn được nâng lên cấp App (xem app.js) và truyền vào qua props,
// để PeerJS luôn lắng nghe cuộc gọi đến kể cả khi đang ở màn hình chat/danh bạ.
// callTarget: peerId cần tự động gọi khi vừa vào phòng (cuộc gọi đi).
var CallRoom = ({ user, media, peerConn, callTarget, onExitCall }) => {
  const stt = useSpeechToText('global', user.id, user.name);
  const tts = useTextToSpeech();
  const visualAlert = useVisualAlerts();
  const localVideoRef = useRef(null);
  const [activePanel, setActivePanel] = useState('chat');
  // Máy tính: mở sẵn khung chat/ký hiệu bên phải. Điện thoại: đóng để xem
  // video toàn màn hình trước (panel là lớp phủ, mở khi cần).
  const [panelOpen, setPanelOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 768);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [aslEnabled, setAslEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [targetPeer, setTargetPeer] = useState('');
  const [remoteMessages, setRemoteMessages] = useState([]);
  // Lift localMessages lên đây để khỏi mất tin khi user đổi panel chat/ASL.
  const [localMessages, setLocalMessages] = useState([]);

  const handTracking = useHandTracking(localVideoRef, aslEnabled && !!media.stream);
  const asl = useASLLetterRecognition(aslEnabled ? handTracking.allLandmarks : [], aslEnabled);

  // Tự bật camera khi vào phòng.
  useEffect(() => { if (!media.stream && !media.isStarting && !media.error) media.startMedia(); }, []);

  // Cuộc gọi ĐI: chỉ gọi tới callTarget sau khi đã có camera để đối phương thấy hình.
  const dialedRef = useRef(false);
  useEffect(() => {
    if (callTarget && !dialedRef.current && peerConn.status === 'connected' && media.stream) {
      dialedRef.current = true;
      peerConn.connectTo(callTarget, media.stream);
    }
  }, [callTarget, peerConn.status, media.stream]);

  // Cuộc gọi ĐẾN: trả lời các cuộc đang chờ khi camera đã sẵn sàng (hoặc khi
  // user từ chối cấp camera thì vẫn trả lời để cuộc gọi không bị treo).
  useEffect(() => {
    if (media.stream) peerConn.answerPending(media.stream);
    else if (media.error) peerConn.answerPending(null);
  }, [media.stream, media.error, peerConn.incomingTick]);

  const sendChatMessage = useCallback((text) => {
    const id = `l_${Date.now()}`;
    const ts = Date.now();
    setLocalMessages(p => [...p, { id, userId: user.id, userName: user.name, text, timestamp: ts }]);
    peerConn.broadcast({ type: 'chat', userName: user.name, text, timestamp: ts });
    return id;
  }, [peerConn.broadcast, user.id, user.name]);

  const recallChatMessage = useCallback((id) => {
    setLocalMessages(p => p.map(m => m.id === id ? { ...m, recalled: true } : m));
  }, []);

  useEffect(() => {
    if (!localVideoRef.current) return;
    // Khi stream = null (user tắt cam), gán null để video không freeze ở frame cuối.
    localVideoRef.current.srcObject = media.stream || null;
  }, [media.stream]);

  useEffect(() => {
    // Chỉ TỰ bật nhận giọng nói trên máy tính. Trên điện thoại, dịch vụ giọng
    // nói của Google hay báo lỗi và làm phiền → để người dùng tự bấm nút "Type".
    const isDesktop = typeof window === 'undefined' ? true : window.innerWidth >= 768;
    if (media.stream && stt.supported && !stt.isListening && isDesktop) {
      const t = setTimeout(() => stt.start(), 1000);
      return () => clearTimeout(t);
    }
  }, [media.stream, stt.supported]);

  const broadcastASLThrottled = useThrottledCallback(peerConn.broadcast, 100);
  // Theo dõi xem lần broadcast cuối có gửi "có tay" không, để khi peer hạ tay
  // ta gửi đúng 1 payload null thay vì spam mỗi frame, và remote video xoá chữ cũ.
  const lastBroadcastHadHandRef = useRef(false);
  useEffect(() => {
    const hasValid = asl.letter && asl.confidence > 0.7 && handTracking.allLandmarks?.length > 0;
    if (hasValid) {
      lastBroadcastHadHandRef.current = true;
      broadcastASLThrottled({
        type: 'asl',
        payload: {
          letter: asl.letter,
          confidence: Math.round(asl.confidence * 100) / 100,
          word: asl.word,
          landmarks: compressLandmarks(handTracking.allLandmarks),
        }
      });
    } else if (lastBroadcastHadHandRef.current) {
      // Vừa chuyển từ "có tay" sang "không có tay" → gửi 1 lần để xoá chữ trên remote.
      lastBroadcastHadHandRef.current = false;
      broadcastASLThrottled({
        type: 'asl',
        payload: { letter: null, confidence: 0, word: '', landmarks: [] },
      });
    }
  }, [asl.letter, asl.confidence, asl.word, handTracking.allLandmarks, broadcastASLThrottled]);

  useEffect(() => {
    return peerConn.onData((peerId, data) => {
      if (data.type === 'chat') {
        setRemoteMessages(p => [...p, { id: `r_${Date.now()}_${Math.random()}`, userId: peerId, userName: data.userName, text: data.text, timestamp: data.timestamp }]);
        visualAlert.alert();
      } else if (data.type === 'call-ended') {
        // Người được gọi đã Từ chối (hoặc cúp máy) → thoát phòng ngay.
        onExitCall();
      }
    });
  }, [peerConn.onData, visualAlert, onExitCall]);

  const copiedTimerRef = useRef(null);
  useEffect(() => () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current); }, []);
  const copyMyId = () => {
    if (peerConn.myPeerId) {
      navigator.clipboard?.writeText(peerConn.myPeerId);
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = () => {
    if (targetPeer.trim()) {
      peerConn.connectTo(targetPeer.trim(), media.stream);
      setTargetPeer('');
      setShowJoinDialog(false);
    }
  };

  const handleSendSignAsMessage = (text) => {
    // Đi qua cùng pipeline với chat thường để có nút thu hồi + tránh duplicate logic.
    sendChatMessage(text);
  };

  // Kết thúc cuộc gọi → quay về Home (App lo việc tắt cam + ngắt peer).
  const handleLeave = () => { stt.stop(); onExitCall(); };
  const remotePeers = Object.entries(peerConn.peers);
  const firstPeer = remotePeers[0];
  const panelMode = activePanel === 'chat' ? 'chat' : 'signs';

  return (
    <div className="min-h-screen text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a1f4a 0%, #051030 45%, #020817 100%)' }}>
      <WaveBackground />
      {visualAlert.flash && <div className="fixed inset-0 bg-blue-400/20 pointer-events-none z-50 animate-pulse" />}

      <div className="relative z-10">

        {/* Dialog gọi */}
        {showJoinDialog && (
          <div className="os-dialog-backdrop fixed inset-0 bg-black/70 backdrop-blur z-50 flex items-center justify-center p-4">
            <div className="os-dialog-card bg-slate-900 border border-blue-900/60 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-blue-950/50">
              <div className="flex items-center gap-4 mb-4">
                <div className="os-dialog-phone shrink-0">
                  <span className="os-call-ring"><Phone className="w-7 h-7" /></span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold leading-tight">Gọi cho người khác</h3>
                  <p className="text-sm text-slate-400 mt-0.5">Nhập <b className="text-sky-300">ID</b> của họ để bắt đầu cuộc gọi</p>
                </div>
              </div>
              <input type="text" value={targetPeer} onChange={(e) => setTargetPeer(e.target.value)}
                placeholder="ourspace-xxxxxxxx"
                className="w-full px-3 py-2 bg-slate-950 border border-blue-900/60 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 font-mono text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()} />
              <div className="flex gap-2">
                <button onClick={() => setShowJoinDialog(false)} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition">Hủy</button>
                <button onClick={handleConnect} disabled={!targetPeer.trim()}
                  className="os-call-btn flex-1 py-2 rounded-lg font-semibold text-white flex items-center justify-center gap-2 relative disabled:opacity-50">
                  <span className="os-call-ring relative z-10"><Phone className="w-4 h-4" /></span>
                  <span className="relative z-10">Gọi</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="px-4 py-3 border-b border-blue-950/80 bg-slate-950/60 backdrop-blur flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-sky-500 rounded-lg flex items-center justify-center">
              <Hand className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">Ourspace</span>
          </div>

          {peerConn.myPeerId && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <span className="text-xs text-emerald-400">🔗 ID:</span>
              <span className="font-mono font-bold text-xs text-emerald-300 truncate max-w-[160px]">{peerConn.myPeerId}</span>
              <button onClick={copyMyId} className="text-emerald-400 hover:text-emerald-200">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 rounded-lg text-xs">
            {peerConn.status === 'connecting' && <><Loader className="w-3 h-3 animate-spin text-amber-400" /><span className="text-amber-400">Đang kết nối...</span></>}
            {peerConn.status === 'connected'  && <><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-emerald-400">Online</span></>}
            {peerConn.status === 'error'      && <><AlertCircle className="w-3 h-3 text-red-400" /><span className="text-red-400">Lỗi</span></>}
          </div>

          <div className="ml-auto flex items-center gap-2 text-sm flex-wrap">
            <button onClick={() => setShowJoinDialog(true)} disabled={peerConn.status !== 'connected'}
              className="os-call-btn relative text-white px-4 py-2 rounded-xl hidden md:flex items-center gap-2 text-sm font-semibold disabled:opacity-50">
              <span className="os-call-ring relative z-10"><Phone className="w-4 h-4" /></span>
              <span className="relative z-10">Gọi người khác</span>
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 rounded-lg">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>{remotePeers.length + 1}</span>
            </div>
          </div>
        </header>

        {/* Khu chính */}
        <div className={`os-call-grid grid grid-cols-1 gap-3 p-3 transition-[grid-template-columns] duration-300 ease-out ${panelOpen ? '' : 'panel-closed'}`}
             style={{
               height: 'calc(100vh - 64px)',
               gridTemplateColumns: panelOpen ? 'minmax(0, 1fr) 380px' : 'minmax(0, 1fr) 0px',
             }}>

          <div className="flex flex-col gap-3 min-h-0">
            {/* Khu video: remote full-bleed + local PIP góc trên-phải */}
            <div className="relative flex-1 min-h-0 rounded-2xl border-2 border-emerald-500/50 overflow-hidden bg-slate-900">

              {/* Chưa bật camera */}
              {!media.stream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                  {media.error ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                      </div>
                      <h3 className="font-bold text-lg mb-2">Không thể bật camera</h3>
                      <p className="text-slate-300 text-sm text-center mb-4 max-w-sm">{media.error}</p>
                      <button onClick={() => media.startMedia()} disabled={media.isStarting}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-semibold flex items-center gap-2">
                        {media.isStarting ? <Loader className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        Thử lại
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 rounded-full bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center mb-4">
                        <Camera className="w-10 h-10 text-blue-400" />
                      </div>
                      <h3 className="font-bold text-lg mb-2">Sẵn sàng?</h3>
                      <p className="text-slate-400 text-sm text-center mb-4">Nhấn để cấp quyền camera + mic</p>
                      <button onClick={() => media.startMedia()} disabled={media.isStarting}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 disabled:opacity-50 rounded-xl font-semibold flex items-center gap-2 shadow-lg">
                        {media.isStarting
                          ? <><Loader className="w-5 h-5 animate-spin" /> Đang khởi động...</>
                          : <><Camera className="w-5 h-5" /> Bật camera</>}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Remote video — luôn hiển thị khi có peer, không cần local stream */}
              {firstPeer && (
                <RemoteVideo peerId={firstPeer[0]} peerData={firstPeer[1]} showLandmarks={showLandmarks} />
              )}

              {/* Màn hình chờ — chỉ khi đã có stream nhưng chưa có ai gọi */}
              {!firstPeer && media.stream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                  <Users className="w-16 h-16 text-slate-600 mb-3" />
                  <p className="text-slate-300 text-center font-semibold mb-2">Chưa có ai khác</p>
                  <p className="text-xs text-slate-500 text-center mb-4 max-w-xs">
                    <b>Cách 1:</b> Share ID của bạn → người khác gọi bạn<br/>
                    <b>Cách 2:</b> Bấm "Gọi người khác" → nhập ID của họ
                  </p>
                  <button onClick={copyMyId} disabled={!peerConn.myPeerId}
                    className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/40 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Đã sao chép!' : 'Sao chép ID'}
                  </button>
                </div>
              )}

              {/* Local PIP — góc trên-phải, HandSkeleton vẽ bên trong PIP */}
              {media.stream && (
                <LocalPip
                  videoRef={localVideoRef}
                  signEnabled={aslEnabled}
                  aslLetter={asl.letter}
                  aslConfidence={asl.confidence}
                  allLandmarks={handTracking.allLandmarks}
                  showLandmarks={showLandmarks}
                  userName={user.name}
                  audioEnabled={media.audioEnabled}
                  videoEnabled={media.videoEnabled}
                />
              )}

              {/* AI loading badge */}
              {media.stream && aslEnabled && handTracking.status === 'loading' && (
                <div className="absolute top-3 left-3 bg-amber-500/90 px-3 py-1.5 rounded-full text-xs flex items-center gap-2 z-10">
                  <Loader className="w-3 h-3 animate-spin" /> Đang tải AI...
                </div>
              )}

              {/* Chỉ báo thêm peer */}
              {remotePeers.length > 1 && (
                <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-xs z-10">
                  +{remotePeers.length - 1} người khác
                </div>
              )}
            </div>

            {/* Thanh điều khiển */}
            <div className="os-ctrl-bar backdrop-blur border border-blue-700/50 rounded-2xl p-3 flex items-center justify-center gap-2 flex-wrap"
                 style={{ background: 'rgba(10, 31, 74, 0.92)' }}>
              <button onClick={media.toggleAudio} disabled={!media.stream}
                className={`os-ctrl-btn p-3 rounded-xl disabled:opacity-30 ${media.audioEnabled ? 'bg-slate-800 hover:bg-slate-700 os-glow-slate' : 'bg-red-500 os-glow-red'}`}>
                {media.audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <button onClick={media.toggleVideo} disabled={!media.stream}
                className={`os-ctrl-btn p-3 rounded-xl disabled:opacity-30 ${media.videoEnabled ? 'bg-slate-800 hover:bg-slate-700 os-glow-slate' : 'bg-red-500 os-glow-red'}`}>
                {media.videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
              <div className="w-px h-8 bg-blue-950 mx-1" />
              <button onClick={stt.isListening ? stt.stop : stt.start} disabled={!stt.supported}
                className={`os-ctrl-btn p-3 rounded-xl os-glow-emerald ${stt.isListening ? 'bg-emerald-500 os-active-pulse-emerald' : 'bg-slate-800 hover:bg-slate-700'} ${!stt.supported ? 'opacity-50' : ''}`}
                title="Speech to text">
                <Type className="w-5 h-5" />
              </button>
              <button onClick={() => setAslEnabled(v => !v)}
                className={`os-ctrl-btn p-3 rounded-xl os-glow-sky ${aslEnabled ? 'bg-sky-500 os-active-pulse' : 'bg-slate-800 hover:bg-slate-700'}`}
                title="Nhận diện chữ cái ASL A-Z">
                <Hand className="w-5 h-5" />
              </button>
              <button onClick={() => setShowLandmarks(v => !v)}
                className={`os-ctrl-btn p-3 rounded-xl os-glow-blue ${showLandmarks ? 'bg-blue-500/30 os-active-pulse' : 'bg-slate-800 hover:bg-slate-700'}`}
                title="Hiện/ẩn khung xương tay">
                <Eye className="w-5 h-5" />
              </button>
              <button onClick={() => setPanelOpen(v => !v)}
                title={panelOpen ? 'Ẩn khung chat / ký hiệu' : 'Hiện khung chat / ký hiệu'}
                className={`os-ctrl-btn p-3 rounded-xl os-glow-blue ${panelOpen ? 'bg-blue-500/30 os-active-pulse' : 'bg-slate-800 hover:bg-slate-700'}`}>
                {panelOpen ? <PanelClose className="w-5 h-5" /> : <PanelOpen className="w-5 h-5" />}
              </button>
              <select value={stt.language} onChange={(e) => stt.setLanguage(e.target.value)}
                className="os-ctrl-btn os-glow-slate px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm border-none cursor-pointer">
                <option value="vi-VN">🇻🇳 Việt</option>
                <option value="en-US">🇺🇸 English</option>
              </select>
              <div className="w-px h-8 bg-blue-950 mx-1" />
              <button onClick={handleLeave}
                className="os-ctrl-btn os-exit-btn os-glow-red px-4 py-3 bg-red-500 hover:bg-red-600 rounded-xl flex items-center gap-2 font-semibold">
                <PhoneOff className="w-5 h-5" />
                <span className="hidden sm:inline">Thoát</span>
              </button>
            </div>
          </div>

          {/* Panel phải (có thể ẩn) */}
          <div
            aria-hidden={!panelOpen}
            className={`os-call-panel flex flex-col gap-2 min-h-0 overflow-hidden transition-all duration-300 ease-out ${panelOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none closed'}`}
          >
            {/* Mode switch */}
            <div className={`os-mode-bar ${panelMode} flex items-center gap-3 p-2 rounded-2xl border backdrop-blur`}>
              <button
                onClick={() => setActivePanel(p => p === 'chat' ? 'asl' : 'chat')}
                className={`os-mode-switch ${panelMode}`}
                aria-label="Chuyển chế độ chat / ký hiệu"
              >
                <div className="os-mode-bg-icons">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <Hand className="w-3.5 h-3.5" />
                </div>
                <div className="os-mode-thumb">
                  {activePanel === 'chat'
                    ? <MessageSquare className="w-4 h-4" />
                    : <Hand className="w-4 h-4" />}
                </div>
              </button>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-medium">Chế độ</span>
                <span className="os-mode-label text-sm font-semibold truncate">
                  {activePanel === 'chat' ? 'Tin nhắn' : 'Ký hiệu AI'}
                </span>
              </div>
              <button onClick={() => setPanelOpen(false)} title="Thu gọn khung"
                className="ml-auto p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition">
                <PanelClose className="w-4 h-4" />
              </button>
            </div>

            {/* Nội dung panel */}
            <div className="flex-1 min-h-0 relative">
              <div key={activePanel} className="os-panel-slide absolute inset-0">
                {activePanel === 'chat' && (
                  <ChatPanel userId={user.id} userName={user.name}
                    onSpeak={(t) => tts.speak(t, stt.language)}
                    onSend={sendChatMessage}
                    onRecall={recallChatMessage}
                    localMessages={localMessages}
                    remoteMessages={remoteMessages} />
                )}
                {activePanel === 'asl' && (
                  <ASLPanel asl={asl}
                    onSpeak={(t) => tts.speak(t, 'en-US')}
                    onSendAsMessage={handleSendSignAsMessage} />
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
