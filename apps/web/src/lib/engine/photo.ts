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

// A macrotask yield, not requestAnimationFrame: rAF stalls in background tabs, and a render must keep going.
const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0));

export class PhotoSession {
  private readonly renderer: WebGLRenderer;
  private readonly camera: PhysicalCamera;
  private readonly pathTracer: WebGLPathTracer;
  private readonly bvhWorker = new ParallelMeshBVHWorker();
  private readonly denoise = new FullScreenQuad(new DenoiseMaterial({ blending: NoBlending }));
  private restore: (() => void) | null = null;

  private constructor(private readonly stage: Stage) {
    this.renderer = new WebGLRenderer({
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.setPixelRatio(1);
    this.camera = new PhysicalCamera(26, 1, 1, 100_000);
    this.camera.apertureBlades = 7;

    const pt = new WebGLPathTracer(this.renderer);
    pt.setBVHWorker(this.bvhWorker);
    pt.renderDelay = 0;
    pt.fadeDuration = 0;
    pt.minSamples = 0;
    pt.dynamicLowRes = false;
    pt.rasterizeScene = false;
    pt.bounces = 6;
    pt.transmissiveBounces = 10;
    pt.filterGlossyFactor = 0.5;
    pt.multipleImportanceSampling = true;
    pt.tiles.set(2, 2);
    // Edge-aware smoothing of the remaining sample noise, applied when the result is copied out.
    pt.renderToCanvasCallback = (target, renderer) => {
      const m = this.denoise.material as DenoiseMaterial;
      m.map = target.texture;
      m.sigma = 2.5;
      m.kSigma = 1;
      m.threshold = 0.05;
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      this.denoise.render(renderer);
      renderer.autoClear = autoClear;
    };
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
    this.renderer.setSize(width, height, false);
    this.camera.fov = ctx.fov;
    this.camera.aspect = width / height;
    const target = frameBox(this.camera, ctx.box, shot);
    this.camera.focusDistance = this.camera.position.distanceTo(target);
    // Detail shots read like macro photography; whole-product shots keep the print sharp.
    this.camera.fStop = opts.fStop ?? (shot.detail ? 3.5 : 11);
    this.camera.updateProjectionMatrix();
    this.pathTracer.updateCamera();
    while (this.pathTracer.samples < samples) {
      if (opts.signal?.aborted) throw new DOMException("Render cancelled", "AbortError");
      this.pathTracer.renderSample();
      opts.onProgress?.(Math.min(1, this.pathTracer.samples / samples), "sampling");
      await yieldToBrowser();
    }
    return new Promise<Blob>((resolve, reject) =>
      this.renderer.domElement.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not encode the image."))),
        "image/jpeg",
        0.93,
      ),
    );
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
