// "Photo" quality: progressive GPU path tracing of the same scene the preview shows. Global
// illumination, physically soft shadows from the HDRI's own lights, glossy reflections and a real
// depth of field. A session builds the BVH once and renders every angle, size and color of a batch.

import { NeutralToneMapping, NoBlending, SRGBColorSpace, WebGLRenderer } from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { ParallelMeshBVHWorker } from "three-mesh-bvh/worker";
import { DenoiseMaterial, PhysicalCamera, WebGLPathTracer } from "three-gpu-pathtracer";
import { frameBox, type Shot } from "./camera";
import type { Stage } from "./stage";

export type PhotoProgress = (fraction: number, phase: "building" | "sampling") => void;

export interface PhotoRenderOptions {
  /** Samples per pixel. 64 is a draft; 256 is clean for most scenes. */
  samples?: number;
  /** Lens aperture; lower is a shallower depth of field. Defaults by shot type. */
  fStop?: number;
  onProgress?: PhotoProgress;
  signal?: AbortSignal;
}

/**
 * Yield to the browser between GPU passes. MessageChannel, not rAF or setTimeout: rAF stops and timers are
 * throttled to 1/s in background tabs, and a batch must keep going while the user does something else.
 */
const channel = new MessageChannel();
const waiting: Array<() => void> = [];
channel.port1.addEventListener("message", () => waiting.shift()?.());
channel.port1.start();
const yieldToBrowser = () =>
  new Promise<void>((r) => {
    waiting.push(r);
    channel.port2.postMessage(null);
  });

/** Max pixels the GPU traces per call. Bigger tiles freeze the page (and can reset the GPU) on large outputs. */
const TILE_PX = 384;
/** Pixels at which the full sample budget still finishes in about a minute on a laptop GPU. */
const FULL_BUDGET_PIXELS = 1_500_000;
const MIN_SAMPLES = 64;
/** Largest image traced directly; bigger outputs are traced at this size and upscaled with high-quality filtering. */
const MAX_TRACED_PIXELS = 2_400_000;

/**
 * Samples for an output size: the full budget up to ~1.5 MP, fewer for big images (each sample costs more
 * and there are more pixels to average noise over when the image is viewed smaller). Denoise covers the rest.
 */
export const samplesFor = (width: number, height: number, max: number) =>
  Math.round(Math.min(max, Math.max(MIN_SAMPLES, (max * FULL_BUDGET_PIXELS) / (width * height))));

export class PhotoSession {
  private readonly renderer: WebGLRenderer;
  private readonly camera: PhysicalCamera;
  private readonly pathTracer: WebGLPathTracer;
  private readonly bvhWorker = new ParallelMeshBVHWorker();
  private readonly denoise = new FullScreenQuad(new DenoiseMaterial({ blending: NoBlending }));
  private restore: (() => void) | null = null;
  private contextLost = false;

  private constructor(private readonly stage: Stage) {
    this.renderer = new WebGLRenderer({
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.setPixelRatio(1);
    // If the GPU resets mid-render the canvas is blank; fail loudly instead of saving a black image.
    this.renderer.domElement.addEventListener("webglcontextlost", () => (this.contextLost = true));
    this.camera = new PhysicalCamera(26, 1, 1, 100_000);
    this.camera.apertureBlades = 7;

    const pt = new WebGLPathTracer(this.renderer);
    pt.setBVHWorker(this.bvhWorker);
    pt.renderDelay = 0;
    pt.fadeDuration = 0;
    pt.minSamples = 0;
    pt.dynamicLowRes = false;
    pt.rasterizeScene = false;
    pt.bounces = 5;
    pt.transmissiveBounces = 8;
    pt.filterGlossyFactor = 0.5;
    pt.multipleImportanceSampling = true;
    // Accumulate off-screen; the denoised copy to the canvas happens once, after the last sample.
    pt.renderToCanvas = false;
    this.pathTracer = pt;
  }

  /** Build the BVH for the stage's current model and scene. */
  static async create(stage: Stage, onProgress?: PhotoProgress) {
    const session = new PhotoSession(stage);
    await session.rebuild(onProgress);
    return session;
  }

  /** Call after the scene (backdrop) changed. Colors only need `updateMaterials`. */
  async rebuild(onProgress?: PhotoProgress) {
    await this.stage.whenReady();
    this.restore?.();
    const ctx = this.stage.photoContext();
    this.restore = ctx.enterPhotoMode();
    this.renderer.toneMappingExposure = ctx.exposure;
    onProgress?.(0, "building");
    await this.pathTracer.setSceneAsync(ctx.scene, this.camera, {
      onProgress: (f: number) => onProgress?.(f, "building"),
    });
  }

  updateMaterials() {
    this.pathTracer.updateMaterials();
  }

  async render(width: number, height: number, shot: Shot, opts: PhotoRenderOptions = {}): Promise<Blob> {
    const samples = opts.samples ?? 256;
    const ctx = this.stage.photoContext();
    const scale = Math.min(1, Math.sqrt(MAX_TRACED_PIXELS / (width * height)));
    const tw = Math.round(width * scale);
    const th = Math.round(height * scale);
    this.renderer.setSize(tw, th, false);
    this.pathTracer.tiles.set(Math.ceil(tw / TILE_PX), Math.ceil(th / TILE_PX));
    this.camera.fov = ctx.fov;
    this.camera.aspect = width / height;
    const target = frameBox(this.camera, ctx.box, shot);
    this.camera.focusDistance = this.camera.position.distanceTo(target);
    // Detail shots read like macro photography; whole-product shots keep the print sharp.
    this.camera.fStop = opts.fStop ?? (shot.detail ? 3.5 : 11);
    this.camera.updateProjectionMatrix();
    this.pathTracer.updateCamera();
    const budget = samplesFor(tw, th, samples);
    while (this.pathTracer.samples < budget) {
      if (opts.signal?.aborted) throw new DOMException("Render cancelled", "AbortError");
      if (this.contextLost) throw new Error("The GPU reset during the render. Try a smaller size or Fast quality.");
      this.pathTracer.renderSample();
      opts.onProgress?.(Math.min(1, this.pathTracer.samples / budget), "sampling");
      await this.gpuIdle();
    }
    this.present();
    if (this.contextLost) throw new Error("The GPU reset during the render. Try a smaller size or Fast quality.");
    let out: HTMLCanvasElement = this.renderer.domElement;
    if (tw !== width || th !== height) {
      out = document.createElement("canvas");
      out.width = width;
      out.height = height;
      const c2d = out.getContext("2d")!;
      c2d.imageSmoothingEnabled = true;
      c2d.imageSmoothingQuality = "high";
      c2d.drawImage(this.renderer.domElement, 0, 0, width, height);
    }
    return new Promise<Blob>((resolve, reject) =>
      out.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the image."))), "image/jpeg", 0.93),
    );
  }

  /**
   * Wait for the GPU to finish the tile just submitted. Without this the command queue grows faster than
   * the GPU drains it and the whole tab freezes, even though JavaScript yields between tiles.
   */
  private async gpuIdle() {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) return yieldToBrowser();
    gl.flush();
    try {
      for (;;) {
        const status = gl.clientWaitSync(sync, 0, 0);
        if (status !== gl.TIMEOUT_EXPIRED) return;
        await yieldToBrowser();
      }
    } finally {
      gl.deleteSync(sync);
    }
  }

  /** Edge-aware smoothing of the remaining sample noise while copying the result to the canvas. */
  private present() {
    const m = this.denoise.material as DenoiseMaterial;
    m.map = this.pathTracer.target.texture;
    m.sigma = 2.5;
    m.kSigma = 1;
    m.threshold = 0.05;
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.denoise.render(this.renderer);
  }

  dispose() {
    this.restore?.();
    this.restore = null;
    this.pathTracer.dispose();
    this.bvhWorker.dispose();
    this.denoise.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

/** One-off render (builds and disposes a session). Batches should reuse a PhotoSession. */
export const renderPhoto = async (
  stage: Stage,
  width: number,
  height: number,
  shot: Shot,
  opts: PhotoRenderOptions = {},
) => {
  const session = await PhotoSession.create(stage, opts.onProgress);
  try {
    return await session.render(width, height, shot, opts);
  } finally {
    session.dispose();
  }
};
