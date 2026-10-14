import { useEffect, useRef } from "react";
import { Stage, type StageOptions } from "@/lib/engine/stage";

interface ViewerProps extends StageOptions {
  className?: string;
  /** Receives the Stage once WebGL is ready, and null when it is torn down. */
  onStage: (stage: Stage | null) => void;
  label: string;
  /** Pause rendering while scrolled out of view (landing pages). */
  pauseOffscreen?: boolean;
}

export const Viewer = ({ className, onStage, label, interactive, autoRotate, pauseOffscreen }: ViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onStageRef = useRef(onStage);
  useEffect(() => {
    onStageRef.current = onStage;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let stage: Stage;
    try {
      stage = new Stage(canvas, { interactive, autoRotate });
    } catch {
      onStageRef.current(null);
      return;
    }
    onStageRef.current(stage);
    let io: IntersectionObserver | undefined;
    if (pauseOffscreen) {
      io = new IntersectionObserver(([entry]) => stage.setActive(!!entry?.isIntersecting));
      io.observe(canvas);
    }
    return () => {
      io?.disconnect();
      onStageRef.current(null);
      stage.dispose();
    };
  }, [interactive, autoRotate, pauseOffscreen]);

  return <canvas ref={canvasRef} className={className} role="img" aria-label={label} style={{ touchAction: "none" }} />;
};
