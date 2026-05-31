// ====== HOOK: PeerJS ======
var usePeerConnection = (userName, localStream) => {
  const [status, setStatus] = useState('idle');
  const [myPeerId, setMyPeerId] = useState(null);
  const [error, setError] = useState(null);
  const [peers, setPeers] = useState({});
  const [incomingTick, setIncomingTick] = useState(0); // tăng mỗi khi có cuộc gọi đến
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

  useEffect(() => {
    if (!window.Peer) { setError('PeerJS chưa load'); return; }
    setStatus('connecting');
    const myId = `ourspace-${Math.random().toString(36).substring(2, 10)}`;
    // TURN: Metered.ca free tier (50GB/tháng). Bao gồm STUN + TURN trên port
    // 80/443 (UDP và TCP) để xuyên qua NAT khắt khe (CGNAT, 4G, firewall).
    // Quota dùng hết sẽ tự ngắt; xem usage tại https://dashboard.metered.ca
    const peer = new window.Peer(myId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.relay.metered.ca:80' },
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: 'turn:global.relay.metered.ca:80',
            username: '913cdb003505fa2ab459dba7',
            credential: 'qosAoeJ/BWc8NmWx',
          },
          {
            urls: 'turn:global.relay.metered.ca:80?transport=tcp',
            username: '913cdb003505fa2ab459dba7',
            credential: 'qosAoeJ/BWc8NmWx',
          },
          {
            urls: 'turn:global.relay.metered.ca:443',
            username: '913cdb003505fa2ab459dba7',
            credential: 'qosAoeJ/BWc8NmWx',
          },
          {
            urls: 'turns:global.relay.metered.ca:443?transport=tcp',
            username: '913cdb003505fa2ab459dba7',
            credential: 'qosAoeJ/BWc8NmWx',
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
      // KHÔNG trả lời ngay — xếp vào hàng đợi để App bật camera trước rồi mới
      // answer (tránh trả lời với stream rỗng làm đối phương không thấy hình).
      pendingCallsRef.current.push(call);
      setIncomingTick(t => t + 1);
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
    if (peersRef.current[targetId]) return true;
    console.log('📞 Calling:', targetId);
    const conn = peerRef.current.connect(targetId, { reliable: true });
    setupDataConn(conn);
    const call = peerRef.current.call(targetId, streamRef.current || new MediaStream());
    call.on('stream', (rs) => updatePeer(targetId, { stream: rs, call }));
    call.on('close', () => handleCallClose(targetId));
    return true;
  }, [myPeerId]);

  // Trả lời mọi cuộc gọi đang chờ bằng stream hiện có (gọi khi camera đã sẵn sàng).
  const answerPending = useCallback((stream) => {
    const calls = pendingCallsRef.current;
    pendingCallsRef.current = [];
    calls.forEach((call) => {
      try { call.answer(stream || new MediaStream()); } catch(_){}
      call.on('stream', (rs) => updatePeer(call.peer, { stream: rs, call }));
      call.on('close', () => handleCallClose(call.peer));
    });
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

  return { status, myPeerId, error, peers, incomingTick, connectTo, broadcast, onData, hangUpAll, answerPending };
};
