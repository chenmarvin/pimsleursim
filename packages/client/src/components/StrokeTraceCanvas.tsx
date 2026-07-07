import { useEffect, useRef, type PointerEvent } from "react";
import { useUiLanguage } from "../i18n/useUiLanguage.js";

const SIZE = 240;

interface Props {
  character: string;
}

// Freehand tracing over a faint character guide — there's no stroke-order
// path dataset wired in, so this doesn't validate individual strokes; it's
// guided handwriting practice, not stroke-order grading.
export function StrokeTraceCanvas({ character }: Props) {
  const { t } = useUiLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  function drawGuide(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = "#ccc";
    ctx.strokeRect(0, 0, SIZE, SIZE);
    ctx.font = `${SIZE * 0.7}px sans-serif`;
    ctx.fillStyle = "#bbb";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(character, SIZE / 2, SIZE / 2 + SIZE * 0.05);
  }

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawGuide(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character]);

  function getPos(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#222";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function handleClear() {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawGuide(ctx);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        style={{ touchAction: "none", cursor: "crosshair" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div>
        <button type="button" onClick={handleClear}>
          {t("writingClear")}
        </button>
      </div>
    </div>
  );
}
