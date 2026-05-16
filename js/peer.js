// ====== HOOK: PeerJS ======
var usePeerConnection = (userName, localStream) => {
  const [status, setStatus] = useState('idle');
  const [myPeerId, setMyPeerId] = useState(null);
  const [error, setError] = useState(null);
  const [peers, setPeers] = useState({});
  const peerRef = useRef(null);
  const peersRef = useRef({});
  const streamRef = useRef(null);
  const userNameRef = useRef(userName);
  const dataHandlersRef = useRef([]);

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
    // LƯU Ý: openrelay.metered.ca đã ngừng dịch vụ free từ ~2024 → bỏ.
    // Hiện chỉ dùng STUN của Google + Cloudflare. Đủ cho 2 peer cùng mạng
    // hoặc NAT thân thiện (~80% trường hợp). Cho production trên mọi mạng
    // (4G, firewall doanh nghiệp), cần đăng ký TURN riêng:
    //   - Cloudflare Calls (free 1TB/tháng)  https://developers.cloudflare.com/calls/
    //   - Metered TURN free plan             https://www.metered.ca/tools/openrelay/
    //   - Self-host coturn
    const peer = new window.Peer(myId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
      },
    });

    peer.on('open', (id) => {
      console.log('✅ PeerJS ready. ID:', id);
      setMyPeerId(id); setStatus('connected');
    });
    peer.on('call', (call) => {
      console.log('📞 Incoming call:', call.peer);
      call.answer(streamRef.current || new MediaStream());
      call.on('stream', (rs) => {
        console.log('🎥 Got remote stream:', call.peer);
        updatePeer(call.peer, { stream: rs, call });
      });
      call.on('close', () => handleCallClose(call.peer));
    });
    peer.on('connection', (conn) => {
      console.log('💬 Incoming data conn:', conn.peer);
      setupDataConn(conn);
    });
    peer.on('error', (err) => {
      console.error('Peer error:', err);
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

  const broadcast = useCallback((data) => {
    Object.values(peersRef.current).forEach(p => {
      if (p.dataConn?.open) { try { p.dataConn.send(data); } catch(_){} }
    });
  }, []);

  const onData = useCallback((handler) => {
    dataHandlersRef.current.push(handler);
    return () => { dataHandlersRef.current = dataHandlersRef.current.filter(h => h !== handler); };
  }, []);

  return { status, myPeerId, error, peers, connectTo, broadcast, onData };
};
