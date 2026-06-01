// ====== HOOK: PeerJS ======
var usePeerConnection = (userName, localStream) => {
  const [status, setStatus] = useState('idle');
  const [myPeerId, setMyPeerId] = useState(null);
  const [error, setError] = useState(null);
  const [peers, setPeers] = useState({});
  const [incomingTick, setIncomingTick] = useState(0); // tăng mỗi khi có cuộc gọi đến
  const [incomingCallPeer, setIncomingCallPeer] = useState(null); // peerId đang gọi đến, chờ Nghe/Từ chối
  const peerRef = useRef(null);
  const peersRef = useRef({});
  const streamRef = useRef(null);
  const userNameRef = useRef(userName);
  const dataHandlersRef = useRef([]);
  const pendingCallsRef = useRef([]); // cuộc gọi đến chưa trả lời (đợi có camera)

  useEffect(() => { streamRef.current = localStream; }, [localStream]);
  useEffect(() => { userNameRef.current = userName; }, [userName]);

  const updatePeer = (id, updates) => {
    peersRef.current[id] = { ...peersRef.current[id], ...updates };
    setPeers({ ...peersRef.current });
  };
  const removePeer = (id) => {
    delete peersRef.current[id];
    setPeers({ ...peersRef.current });
  };

  // Khi 1 trong 2 kênh (media call hoặc data conn) đóng, ta chỉ xoá phần đó.
  // Chỉ remove peer entry khi cả 2 đều đã đóng. Tránh trường hợp tắt cam
  // làm rớt luôn chat.
  const handleCallClose = (id) => {
    const p = peersRef.current[id];
    if (!p) return;
    if (p.dataConn) updatePeer(id, { stream: null, call: null });
    else removePeer(id);
  };
  const handleDataClose = (id) => {
    const p = peersRef.current[id];
    if (!p) return;
    if (p.call) updatePeer(id, { dataConn: null });
    else removePeer(id);
  };

  const setupDataConn = (conn) => {
    conn.on('open', () => {
      updatePeer(conn.peer, { dataConn: conn });
      try { conn.send({ type: 'hello', name: userNameRef.current }); } catch(_){}
    });
    conn.on('data', (data) => {
      if (data.type === 'hello') updatePeer(conn.peer, { name: data.name });
      else if (data.type === 'asl') updatePeer(conn.peer, { asl: data.payload });
      dataHandlersRef.current.forEach(h => h(conn.peer, data));
    });
    conn.on('close', () => handleDataClose(conn.peer));
  };

  // Chẩn đoán: in trạng thái ICE/kết nối WebRTC ra console để biết media có
  // thật sự nối được không (failed = lỗi TURN/mạng, connected = OK).
  const watchIce = (call, label) => {
    const attach = () => {
      const pc = call.peerConnection;
      if (!pc) { setTimeout(attach, 300); return; }
      const log = () => console.log(`[ICE ${label} ${call.peer}] ice=${pc.iceConnectionState} conn=${pc.connectionState}`);
      pc.addEventListener('iceconnectionstatechange', log);
      pc.addEventListener('connectionstatechange', log);
      log();
    };
    try { attach(); } catch(_){}
  };

  useEffect(() => {
    if (!window.Peer) { setError('PeerJS chưa load'); return; }
    setStatus('connecting');
    const myId = `ourspace-${Math.random().toString(36).substring(2, 10)}`;
    // ICE servers: STUN (Google, Cloudflare) để khám phá IP public + TURN public
    // (Open Relay Project) làm fallback khi NAT chặn P2P. Open Relay là TURN
    // mở do Metered tài trợ — credential public, không cần đăng ký/thẻ ngân hàng,
    // dùng được cho demo & dự án nhỏ. Trang chủ: https://www.metered.ca/tools/openrelay/
    const peer = new window.Peer(myId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
          {
            urls: 'turns:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ],
      },
    });

    peer.on('open', (id) => {
      console.log('✅ PeerJS ready. ID:', id);
      setMyPeerId(id); setStatus('connected');
    });
    peer.on('call', (call) => {
      console.log('📞 Incoming call:', call.peer);
      // KHÔNG trả lời ngay — xếp vào hàng đợi và báo cho App hiện màn hình
      // "Cuộc gọi đến" để người nhận chủ động Nghe hoặc Từ chối.
      pendingCallsRef.current.push(call);
      setIncomingCallPeer(call.peer);
      setIncomingTick(t => t + 1);
      // Người gọi huỷ trước khi mình kịp trả lời → gỡ khỏi hàng đợi.
      call.on('close', () => {
        pendingCallsRef.current = pendingCallsRef.current.filter(c => c !== call);
        if (pendingCallsRef.current.length === 0) setIncomingCallPeer(null);
      });
    });
    peer.on('connection', (conn) => {
      console.log('💬 Incoming data conn:', conn.peer);
      setupDataConn(conn);
    });
    peer.on('error', (err) => {
      console.error('Peer error:', err);
      // Lỗi tạm thời (gọi người đang offline, mạng chập chờn) — đừng hạ trạng
      // thái kết nối của chính mình, chỉ log.
      if (err?.type === 'peer-unavailable' || err?.type === 'network') return;
      setError(err.message); setStatus('error');
    });

    peerRef.current = peer;
    return () => {
      Object.values(peersRef.current).forEach(p => { if (p.call) p.call.close(); if (p.dataConn) p.dataConn.close(); });
      peer.destroy();
      peerRef.current = null; peersRef.current = {}; setPeers({});
    };
  }, []);

  const connectTo = useCallback((targetId) => {
    if (!peerRef.current) { console.error('PeerJS chưa sẵn sàng'); return false; }
    if (targetId === myPeerId) return false;
    if (peersRef.current[targetId]) { console.log('⏭️ Đã có kết nối tới', targetId, '— bỏ qua gọi trùng'); return true; }
    console.log('📞 Calling:', targetId);
    const conn = peerRef.current.connect(targetId, { reliable: true });
    const call = peerRef.current.call(targetId, streamRef.current || new MediaStream());
    // Ghi nhận NGAY (trước khi stream/dataConn kịp mở) để chặn việc gọi trùng
    // tới cùng một người — nguyên nhân làm 2 máy "lệch kênh", media không qua.
    peersRef.current[targetId] = { ...peersRef.current[targetId], call, dataConn: conn };
    setupDataConn(conn);
    watchIce(call, 'caller');
    call.on('stream', (rs) => { console.log('🎥 Nhận được hình từ', targetId); updatePeer(targetId, { stream: rs, call }); });
    call.on('close', () => handleCallClose(targetId));
    return true;
  }, [myPeerId]);

  // Trả lời mọi cuộc gọi đang chờ bằng stream hiện có (gọi khi đã bấm Nghe + có camera).
  const answerPending = useCallback((stream) => {
    const calls = pendingCallsRef.current;
    pendingCallsRef.current = [];
    setIncomingCallPeer(null);
    calls.forEach((call) => {
      console.log('✅ Trả lời cuộc gọi từ', call.peer, '— có camera:', !!stream);
      try { call.answer(stream || new MediaStream()); } catch(_){}
      watchIce(call, 'callee');
      call.on('stream', (rs) => { console.log('🎥 Nhận được hình từ', call.peer); updatePeer(call.peer, { stream: rs, call }); });
      call.on('close', () => handleCallClose(call.peer));
    });
  }, []);

  // Từ chối cuộc gọi đến: báo cho người gọi (nếu còn kênh dữ liệu) rồi đóng,
  // không bật camera, ở nguyên màn hình hiện tại.
  const rejectIncoming = useCallback(() => {
    pendingCallsRef.current.forEach((call) => {
      const p = peersRef.current[call.peer];
      try { p?.dataConn?.send({ type: 'call-ended', reason: 'rejected' }); } catch(_){}
      try { call.close(); } catch(_){}
    });
    pendingCallsRef.current = [];
    setIncomingCallPeer(null);
  }, []);

  // Cúp toàn bộ cuộc gọi/kênh dữ liệu hiện tại nhưng GIỮ peer sống để vẫn nhận
  // được cuộc gọi mới (dùng khi rời phòng gọi quay về Home).
  const hangUpAll = useCallback(() => {
    Object.values(peersRef.current).forEach(p => {
      try { p.call?.close(); } catch(_){}
      try { p.dataConn?.close(); } catch(_){}
    });
    peersRef.current = {};
    setPeers({});
  }, []);

  const broadcast = useCallback((data) => {
    Object.values(peersRef.current).forEach(p => {
      if (p.dataConn?.open) { try { p.dataConn.send(data); } catch(_){} }
    });
  }, []);

  const onData = useCallback((handler) => {
    dataHandlersRef.current.push(handler);
    return () => { dataHandlersRef.current = dataHandlersRef.current.filter(h => h !== handler); };
  }, []);

  return { status, myPeerId, error, peers, incomingTick, incomingCallPeer, connectTo, broadcast, onData, hangUpAll, answerPending, rejectIncoming };
};
