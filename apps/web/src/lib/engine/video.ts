import { type MotionId, VIDEO_ASPECTS, type VideoAspect } from "@exo/shared";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import type { Shot } from "./camera";
import type { Stage } from "./stage";

const FPS = 30;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export interface MotionFrame {
  shot: Shot;
  reveal: number | null;
}

/** Camera (and reveal) at normalized time t in [0, 1] for each motion. */
export const motionAt = (motion: MotionId, t: number, base: Shot): MotionFrame => {
  const e = ease(t);
  switch (motion) {
    case "orbit":
      return { shot: { ...base, azimuth: base.azimuth + t * 360 }, reveal: null };
    case "sway":
      return { shot: { ...base, azimuth: base.azimuth + Math.sin(t * Math.PI * 2) * 28 }, reveal: null };
    case "push":
      return { shot: { ...base, distanceScale: 1.18 - e * 0.42, azimuth: base.azimuth + e * 12 }, reveal: null };
    case "reveal":
      return {
        shot: { ...base, azimuth: base.azimuth - 20 + e * 40 },
        reveal: Math.min(1, ease(Math.min(1, t / 0.8))),
      };
    case "rise":
      return { shot: { ...base, elevation: 2 + e * 42, azimuth: base.azimuth + e * 25 }, reveal: null };
  }
};

export const videoSupported = () => typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";

/** Render a camera move frame by frame and encode it to H.264 MP4 with WebCodecs. */
export const recordVideo = async (
  stage: Stage,
  opts: { motion: MotionId; duration: number; aspect: VideoAspect; base: Shot; onProgress?: (f: number) => void },
): Promise<Blob> => {
  if (!videoSupported()) throw new Error("This browser can't encode video. Use a recent Chrome, Edge or Safari.");
  const { width, height } = VIDEO_ASPECTS[opts.aspect];
  const config: VideoEncoderConfig = {
    codec: "avc1.640028",
    width,
    height,
    bitrate: 12_000_000,
    framerate: FPS,
    avc: { format: "avc" },
  };
  const support = await VideoEncoder.isConfigSupported(config);
  if (!support.supported) config.codec = "avc1.4d0028";

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height, frameRate: FPS },
    fastStart: "in-memory",
  });
  let failure: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failure = e instanceof Error ? e : new Error(String(e))),
  });
  encoder.configure(config);

  const frames = Math.round(opts.duration * FPS);
  stage.beginFrames(width, height);
  try {
    for (let i = 0; i < frames; i++) {
      if (failure) throw failure;
      const { shot, reveal } = motionAt(opts.motion, i / (frames - 1), opts.base);
      stage.setReveal(reveal);
      stage.renderFrame(shot);
      const frame = new VideoFrame(stage.canvas, {
        timestamp: Math.round((i * 1_000_000) / FPS),
        duration: Math.round(1_000_000 / FPS),
      });
      encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 4));
      opts.onProgress?.((i + 1) / frames);
      // Yield so the page stays responsive.
      if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    await encoder.flush();
    if (failure) throw failure;
  } finally {
    stage.setReveal(null);
    stage.endFrames();
    if (encoder.state !== "closed") encoder.close();
  }
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
};
