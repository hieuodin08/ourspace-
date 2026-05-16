// ====== HOOK: useMedia ======
var useMedia = () => {
  const [stream, setStream] = useState(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const [isStarting, setIsStarting] = useState(false);

  const startMedia = useCallback(async () => {
    setIsStarting(true); setError(null); setErrorType(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Trình duyệt không hỗ trợ. Hãy dùng Chrome/Edge.');
      setErrorType('unsupported'); setIsStarting(false); return null;
    }
    const tries = [
      { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: true },
      { video: { facingMode: 'user' }, audio: true },
      { video: true, audio: true },
      { video: false, audio: true },
      { video: true, audio: false },
    ];
    let lastErr = null;
    for (const c of tries) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(c);
        setStream(s); setIsStarting(false); return s;
      } catch (e) {
        lastErr = e;
        if (e.name === 'NotAllowedError') break;
      }
    }
    let t = 'unknown', m = lastErr?.message || 'Không thể truy cập camera';
    if (lastErr?.name === 'NotAllowedError') { t = 'permission'; m = 'Bạn đã từ chối quyền. Click icon 🔒 cạnh URL để cấp lại.'; }
    else if (lastErr?.name === 'NotFoundError') { t = 'notfound'; m = 'Không tìm thấy camera/mic.'; }
    else if (lastErr?.name === 'NotReadableError') { t = 'inuse'; m = 'Camera đang được dùng. Đóng Zoom/Meet/Teams.'; }
    setError(m); setErrorType(t); setIsStarting(false); return null;
  }, []);

  const stopMedia = useCallback(() => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
  }, [stream]);

  const toggleVideo = useCallback(() => {
    if (stream) { stream.getVideoTracks().forEach(t => t.enabled = !t.enabled); setVideoEnabled(p => !p); }
  }, [stream]);

  const toggleAudio = useCallback(() => {
    if (stream) { stream.getAudioTracks().forEach(t => t.enabled = !t.enabled); setAudioEnabled(p => !p); }
  }, [stream]);

  return { stream, videoEnabled, audioEnabled, error, errorType, isStarting, startMedia, stopMedia, toggleVideo, toggleAudio };
};

// ====== HOOK: STT ======
var useSpeechToText = (roomId, userId, userName) => {
  const [interim, setInterim] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [language, setLanguage] = useState('vi-VN');
  const [supported, setSupported] = useState(true);
  const recRef = useRef(null);
  const listeningRef = useRef(false);
  const db = useDB();

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = language;
    rec.onresult = (e) => {
      let final = '', inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' '; else inter += t;
      }
      if (final && roomId && userId) {
        db.set('transcripts', `${roomId}_${Date.now()}_${userId}`, {
          roomId, userId, userName, text: final.trim(), timestamp: Date.now(), language,
        });
      }
      setInterim(inter);
    };
    rec.onerror = () => {};
    rec.onend = () => { if (listeningRef.current) { try { rec.start(); } catch(_){} } };
    recRef.current = rec;
    return () => { try { rec.stop(); } catch(_){} };
  }, [language, roomId, userId, userName, db]);

  const start = useCallback(() => {
    if (recRef.current && !listeningRef.current) {
      try { recRef.current.start(); listeningRef.current = true; setIsListening(true); } catch(_){}
    }
  }, []);
  const stop = useCallback(() => {
    if (recRef.current) { listeningRef.current = false; setIsListening(false); try { recRef.current.stop(); } catch(_){} }
  }, []);

  return { interim, isListening, language, setLanguage, supported, start, stop };
};

// ====== HOOK: TTS ======
var useTextToSpeech = () => {
  const speak = useCallback((text, lang = 'vi-VN') => {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    window.speechSynthesis.speak(u);
  }, []);
  return { speak };
};

// ====== HOOK: Visual Alert ======
var useVisualAlerts = () => {
  const [flash, setFlash] = useState(false);
  const alert = useCallback(() => {
    setFlash(true);
    if (navigator.vibrate) navigator.vibrate(100);
    setTimeout(() => setFlash(false), 600);
  }, []);
  return { flash, alert };
};

// ====== HOOK: Throttled callback ======
var useThrottledCallback = (fn, intervalMs) => {
  const fnRef = useRef(fn);
  const lastCalledRef = useRef(0);
  const timerRef = useRef(null);
  const lastArgsRef = useRef(null);

  useEffect(() => { fnRef.current = fn; }, [fn]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return useCallback((...args) => {
    const now = Date.now();
    const elapsed = now - lastCalledRef.current;
    lastArgsRef.current = args;
    if (elapsed >= intervalMs) {
      lastCalledRef.current = now;
      fnRef.current(...args);
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    } else if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        lastCalledRef.current = Date.now();
        timerRef.current = null;
        if (lastArgsRef.current) fnRef.current(...lastArgsRef.current);
      }, intervalMs - elapsed);
    }
  }, [intervalMs]);
};

// ====== Helper: nén landmarks để gửi qua DataChannel ======
var compressLandmarks = (allLandmarks) => {
  if (!allLandmarks || allLandmarks.length === 0) return [];
  return allLandmarks.map(hand =>
    hand.map(p => ({
      x: Math.round(p.x * 1000) / 1000,
      y: Math.round(p.y * 1000) / 1000,
      z: Math.round((p.z || 0) * 1000) / 1000,
    }))
  );
};

// ====== HOOK: useHandTracking ======
// Chạy 1 instance MediaPipe Hands duy nhất, đọc frame từ video element và phát
// landmarks ra để cả gesture engine và ASL letter engine cùng dùng (tiết kiệm CPU).
// LƯU Ý: KHÔNG dùng `new window.Camera(...)` vì nó sẽ ghi đè srcObject — conflict
// với stream đã set bởi useMedia. Tự đọc frame qua requestAnimationFrame.
var useHandTracking = (videoRef, enabled) => {
  const [allLandmarks, setAllLandmarks] = useState([]);
  const [status, setStatus] = useState('idle');
  const handsRef = useRef(null);
  const rafRef = useRef(null);
  const stoppedRef = useRef(false);
  const sendingRef = useRef(false);
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (!enabled || !videoRef.current || !window.Hands) {
      setStatus('idle');
      setAllLandmarks([]);
      return;
    }
    setStatus('loading');
    stoppedRef.current = false;

    const hands = new window.Hands({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
    });
    hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.5 });

    hands.onResults((results) => {
      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        setAllLandmarks([]);
        return;
      }
      setAllLandmarks(results.multiHandLandmarks);
    });

    handsRef.current = hands;

    const TARGET_FPS = 15;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;
    let firstFrame = true;

    const loop = async () => {
      if (stoppedRef.current) return;
      const v = videoRef.current;
      const now = performance.now();
      if (v && v.readyState >= 2 && v.videoWidth > 0 && !sendingRef.current
          && (now - lastSentRef.current) >= FRAME_INTERVAL) {
        sendingRef.current = true;
        lastSentRef.current = now;
        try {
          await hands.send({ image: v });
          if (firstFrame) { firstFrame = false; if (!stoppedRef.current) setStatus('ready'); }
        } catch (err) {
          if (!stoppedRef.current) setStatus('error');
        } finally {
          sendingRef.current = false;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      stoppedRef.current = true;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (handsRef.current) { try { handsRef.current.close(); } catch(_){} handsRef.current = null; }
      sendingRef.current = false;
      lastSentRef.current = 0;
    };
  }, [enabled, videoRef]);

  return { allLandmarks, status };
};
