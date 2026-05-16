// ====== HandSkeleton renderer (canvas-based, dùng MediaPipe drawing_utils) ======
// Vẽ khung xương tay chi tiết, dày, rõ — giống style của data_collector.html.
// Yêu cầu đã load 2 script:
//   - @mediapipe/drawing_utils  → window.drawConnectors / window.drawLandmarks
//   - @mediapipe/hands          → window.HAND_CONNECTIONS

var HandSkeleton = ({ allLandmarks, mirror = true, width = 640, height = 480 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (allLandmarks && allLandmarks.length > 0
        && window.drawConnectors && window.drawLandmarks && window.HAND_CONNECTIONS) {
      allLandmarks.forEach((landmarks, i) => {
        // Tay 1: xanh lá, tay 2: xanh dương (nếu có 2 tay)
        const connectionColor = i === 0 ? '#00FF00' : '#3b82f6';
        window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {
          color: connectionColor,
          lineWidth: 4,
        });
        window.drawLandmarks(ctx, landmarks, {
          color: '#FF0000',
          fillColor: '#FF0000',
          lineWidth: 1,
          radius: 4,
        });
      });
    }
    ctx.restore();
  }, [allLandmarks]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
    />
  );
};
