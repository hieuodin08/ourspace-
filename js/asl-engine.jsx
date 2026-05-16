// ====== ASL LETTER RECOGNITION ENGINE ======
// Sử dụng TensorFlow.js Graph Model đã được train (26 chữ cái A-Z).
// Input: 21 landmark × 3 toạ độ = 63 float (đã normalize theo wrist).
// Output: softmax 26 class.

var ASL_MODEL_URL = './cam/tfjs_model/model.json';
var ASL_LABELS_URL = './cam/tfjs_model/labels.json';

// === Tham số commit chữ cái ===
// Logic: gom prediction trong WINDOW_MS giây, lấy majority vote.
// Nếu chữ thắng chiếm >= DOMINANCE_RATIO của cửa sổ và confidence TB đủ cao
// thì commit vào câu. Sau khi commit, khoá thêm COMMIT_LOCK_MS để không
// add lặp chữ ngay.
var ASL_WINDOW_MS = 3000;          // 3 giây — user yêu cầu
var ASL_MIN_FRAMES = 25;           // tối thiểu số frame trong cửa sổ (≈ 15fps × 2s)
var ASL_DOMINANCE_RATIO = 0.6;     // chữ thắng phải chiếm ≥ 60% cửa sổ
var ASL_COMMIT_AVG_CONF = 0.7;     // confidence trung bình tối thiểu của chữ thắng
var ASL_FRAME_CONF_MIN = 0.5;      // frame có conf dưới mức này thì không tính
var ASL_COMMIT_LOCK_MS = 300;      // sau commit, im lặng 0.3s rồi mới đếm tiếp

// Singleton để khỏi load model nhiều lần
var _aslModelPromise = null;
var loadASLModel = () => {
  if (_aslModelPromise) return _aslModelPromise;
  _aslModelPromise = (async () => {
    if (!window.tf) throw new Error('TensorFlow.js chưa load');
    const [model, labelsRes] = await Promise.all([
      window.tf.loadGraphModel(ASL_MODEL_URL),
      fetch(ASL_LABELS_URL).then(r => r.json()),
    ]);
    return { model, labels: labelsRes.labels, accuracy: labelsRes.test_accuracy };
  })();
  return _aslModelPromise;
};

// Chuẩn hoá landmark giống code training (translate về wrist + scale max distance)
var normalizeASLLandmarks = (landmarks) => {
  const wrist = landmarks[0];
  const translated = landmarks.map(p => ({
    x: p.x - wrist.x,
    y: p.y - wrist.y,
    z: (p.z || 0) - (wrist.z || 0),
  }));
  let maxDist = 0;
  translated.forEach(p => {
    const d = Math.sqrt(p.x*p.x + p.y*p.y + p.z*p.z);
    if (d > maxDist) maxDist = d;
  });
  if (maxDist === 0) maxDist = 1;
  const out = [];
  translated.forEach(p => {
    out.push(p.x / maxDist);
    out.push(p.y / maxDist);
    out.push(p.z / maxDist);
  });
  return out;
};

// ====== HOOK: ASL Letter Recognition ======
var useASLLetterRecognition = (allLandmarks, enabled) => {
  const [status, setStatus] = useState('idle');     // idle | loading | ready | error
  const [letter, setLetter] = useState('');         // chữ instant của frame hiện tại
  const [confidence, setConfidence] = useState(0);  // confidence instant
  const [top3, setTop3] = useState([]);
  const [accuracy, setAccuracy] = useState(0);

  // === Window vote state ===
  const [candidate, setCandidate] = useState('');   // chữ đang dẫn đầu trong cửa sổ
  const [candidateRatio, setCandidateRatio] = useState(0); // tỉ lệ chiếm của candidate
  const [candidateAvgConf, setCandidateAvgConf] = useState(0);
  const [progress, setProgress] = useState(0);      // 0..1 — bao nhiêu % của 3s đã trôi
  const [sentence, setSentence] = useState('');

  const modelRef = useRef(null);
  const labelsRef = useRef([]);
  const predictingRef = useRef(false);
  const bufferRef = useRef([]); // {letter, prob, ts}
  const sessionStartRef = useRef(0); // ts của frame ĐẦU TIÊN trong session vote hiện tại
  const lockUntilRef = useRef(0);
  const sentenceRef = useRef('');

  // Load model 1 lần khi enabled
  useEffect(() => {
    if (!enabled) { setStatus('idle'); return; }
    let cancelled = false;
    setStatus('loading');
    loadASLModel().then(({ model, labels, accuracy }) => {
      if (cancelled) return;
      modelRef.current = model;
      labelsRef.current = labels;
      setAccuracy(accuracy || 0);
      setStatus('ready');
    }).catch(err => {
      console.error('ASL model load error:', err);
      if (!cancelled) setStatus('error');
    });
    return () => { cancelled = true; };
  }, [enabled]);

  // Tính lại trạng thái cửa sổ (candidate, ratio, progress) sau mỗi prediction
  const recomputeWindow = useCallback(() => {
    const now = Date.now();
    const buf = bufferRef.current;
    if (buf.length === 0 || sessionStartRef.current === 0) {
      setCandidate(''); setCandidateRatio(0); setCandidateAvgConf(0); setProgress(0);
      return null;
    }
    // elapsed tính từ session start (KHÔNG bị reset bởi trim buffer)
    const elapsed = now - sessionStartRef.current;
    const valid = buf.filter(b => b.prob >= ASL_FRAME_CONF_MIN);
    if (valid.length === 0) {
      setCandidate(''); setCandidateRatio(0); setCandidateAvgConf(0);
      setProgress(Math.min(1, elapsed / ASL_WINDOW_MS));
      return null;
    }
    // Đếm và tính trung bình confidence theo từng chữ
    const stats = {}; // letter -> {count, sumConf}
    valid.forEach(b => {
      if (!stats[b.letter]) stats[b.letter] = { count: 0, sumConf: 0 };
      stats[b.letter].count++;
      stats[b.letter].sumConf += b.prob;
    });
    let topLetter = '', topCount = 0, topSum = 0;
    for (const [l, s] of Object.entries(stats)) {
      if (s.count > topCount) { topLetter = l; topCount = s.count; topSum = s.sumConf; }
    }
    const ratio = topCount / buf.length;
    const avgConf = topCount > 0 ? topSum / topCount : 0;
    setCandidate(topLetter);
    setCandidateRatio(ratio);
    setCandidateAvgConf(avgConf);
    setProgress(Math.min(1, elapsed / ASL_WINDOW_MS));
    return { topLetter, ratio, avgConf, elapsed, totalFrames: buf.length };
  }, []);

  // Predict mỗi khi có landmarks mới
  useEffect(() => {
    if (!enabled || status !== 'ready' || !modelRef.current) return;
    const now = Date.now();
    if (!allLandmarks || allLandmarks.length === 0) {
      // Không thấy tay — clear instant nhưng GIỮ buffer để user có thể nhả tay tạm thời
      setLetter(''); setConfidence(0); setTop3([]);
      // Tuy nhiên nếu buffer quá cũ (>WINDOW_MS không có frame mới) thì xoá
      if (bufferRef.current.length > 0 && now - bufferRef.current[bufferRef.current.length - 1].ts > ASL_WINDOW_MS) {
        bufferRef.current = [];
        sessionStartRef.current = 0;
        recomputeWindow();
      }
      return;
    }
    if (predictingRef.current) return;
    predictingRef.current = true;

    (async () => {
      try {
        const normalized = normalizeASLLandmarks(allLandmarks[0]);
        const tensor = window.tf.tensor2d([normalized]);
        const predictions = await modelRef.current.executeAsync(tensor);
        const probs = await predictions.data();
        tensor.dispose();
        predictions.dispose();

        const indexed = Array.from(probs).map((p, i) => ({ letter: labelsRef.current[i], prob: p }));
        indexed.sort((a, b) => b.prob - a.prob);
        const top = indexed[0];

        setLetter(top.letter);
        setConfidence(top.prob);
        setTop3(indexed.slice(0, 3));

        // === Cập nhật buffer cửa sổ ===
        const ts = Date.now();
        // Đánh dấu thời điểm bắt đầu session vote nếu buffer đang trống
        if (bufferRef.current.length === 0 || sessionStartRef.current === 0) {
          sessionStartRef.current = ts;
        }
        bufferRef.current.push({ letter: top.letter, prob: top.prob, ts });
        // Trim buffer: chỉ giữ frame trong WINDOW_MS gần nhất (để ratio chính xác)
        const cutoff = ts - ASL_WINDOW_MS;
        while (bufferRef.current.length > 0 && bufferRef.current[0].ts < cutoff) {
          bufferRef.current.shift();
        }

        const win = recomputeWindow();

        // === Quyết định commit ===
        if (win && ts >= lockUntilRef.current) {
          const { topLetter, ratio, avgConf, elapsed, totalFrames } = win;
          if (
            elapsed >= ASL_WINDOW_MS &&
            totalFrames >= ASL_MIN_FRAMES &&
            ratio >= ASL_DOMINANCE_RATIO &&
            avgConf >= ASL_COMMIT_AVG_CONF &&
            topLetter
          ) {
            sentenceRef.current += topLetter;
            setSentence(sentenceRef.current);
            lockUntilRef.current = ts + ASL_COMMIT_LOCK_MS;
            bufferRef.current = [];
            sessionStartRef.current = 0;
            setCandidate(''); setCandidateRatio(0); setCandidateAvgConf(0); setProgress(0);
          }
        }
      } catch (err) {
        console.error('ASL predict error:', err);
      } finally {
        predictingRef.current = false;
      }
    })();
  }, [allLandmarks, enabled, status, recomputeWindow]);

  // === Sentence controls ===
  const appendChar = useCallback((ch) => {
    sentenceRef.current += ch;
    setSentence(sentenceRef.current);
  }, []);
  const addSpace = useCallback(() => { appendChar(' '); }, [appendChar]);
  const deleteLastChar = useCallback(() => {
    sentenceRef.current = sentenceRef.current.slice(0, -1);
    setSentence(sentenceRef.current);
    // Reset buffer + lock để chữ tiếp theo bắt đầu đếm sạch
    bufferRef.current = [];
    sessionStartRef.current = 0;
    lockUntilRef.current = Date.now() + 300;
    setCandidate(''); setCandidateRatio(0); setCandidateAvgConf(0); setProgress(0);
  }, []);
  const clearSentence = useCallback(() => {
    sentenceRef.current = '';
    setSentence('');
    bufferRef.current = [];
    sessionStartRef.current = 0;
    setCandidate(''); setCandidateRatio(0); setCandidateAvgConf(0); setProgress(0);
  }, []);
  // Cho phép nhận diện lại từ đầu (skip 3s vote hiện tại)
  const resetVote = useCallback(() => {
    bufferRef.current = [];
    sessionStartRef.current = 0;
    lockUntilRef.current = 0;
    setCandidate(''); setCandidateRatio(0); setCandidateAvgConf(0); setProgress(0);
  }, []);

  return {
    status, letter, confidence, top3, accuracy,
    // window vote
    candidate, candidateRatio, candidateAvgConf, progress,
    windowMs: ASL_WINDOW_MS,
    dominanceTarget: ASL_DOMINANCE_RATIO,
    // sentence
    sentence,
    appendChar, addSpace, deleteLastChar, clearSentence, resetVote,
    // legacy aliases
    word: sentence,
    stableCount: 0, stableThreshold: 0,
    confidenceThreshold: ASL_COMMIT_AVG_CONF,
    clearWord: clearSentence,
  };
};
