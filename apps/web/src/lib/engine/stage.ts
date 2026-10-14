// The renderer behind every preview and final image: bead meshes + a scene + physically based
// materials, with ambient occlusion so the grooves between layers read like a photograph.

import { type Filament, resolveFilament } from "@exo/shared";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  FrontSide,
  Group,
  HalfFloatType,
  Mesh,
  type MeshPhysicalMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  type Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { frameBox, type Shot } from "./camera";
import type { LoadedPart } from "./loader-types";
import { applyFilament, filamentMaterial } from "./materials";
import type { HdriId } from "./assets";
import { type BuiltScene, buildScene, loadSceneAssets, SCENE_SPECS, type SceneAssets } from "./scenes";

const PART_GAP_MM = 14;
/** Preview resolution cap; final captures set their own size. */
const PREVIEW_MAX_DPR = 1.5;
/** Auto-rotate speed and frame budget for idle previews. */
const ROTATE_DEG_PER_S = 9;
const ROTATE_FRAME_MS = 33;
/** Upper bound for supersampled captures (pixels), to stay inside GPU memory on laptops. */
const MAX_CAPTURE_PIXELS = 18_000_000;

interface PartView {
  group: Group;
  meshes: Map<number, Mesh<BufferGeometry, MeshPhysicalMaterial>>;
}

export interface StageOptions {
  interactive?: boolean;
  autoRotate?: boolean;
}

export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(26, 1, 1, 10000);
  private readonly composer: EffectComposer;
  private readonly gtao: GTAOPass;
  private readonly controls: OrbitControls | null;
  private readonly pmrem: PMREMGenerator;
  private readonly fallbackEnv: Texture;
  private readonly envCache = new Map<HdriId, Texture>();
  private assets: SceneAssets | null = null;
  private loadToken = 0;
  private ready: Promise<void> = Promise.resolve();
  private photoMode = false;
  private readonly model = new Group();
  private readonly clip = new Plane(new Vector3(0, -1, 0), Infinity);
  private parts: PartView[] = [];
  private built: BuiltScene | null = null;
  private sceneId = "white-sweep";
  private shot: Shot = { azimuth: 32, elevation: 18, fill: 0.8 };
  private dirty = true;
  private frame = 0;
  private lastRotate = 0;
  private box: Box3 | null = null;
  private active = true;
  private autoRotate: boolean;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    opts: StageOptions = {},
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    // Khronos PBR Neutral keeps filament hues true instead of shifting them like ACES does.
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    // Lights are fixed in world space, so shadows only change with the model, scene or reveal, not the camera.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.localClippingEnabled = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, PREVIEW_MAX_DPR));

    this.pmrem = new PMREMGenerator(this.renderer);
    // Neutral studio light until the scene's HDRI has downloaded.
    this.fallbackEnv = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.fallbackEnv;
    this.scene.add(this.model);

    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.gtao = new GTAOPass(this.scene, this.camera, 1, 1);
    this.gtao.blendIntensity = 0.9;
    this.composer.addPass(this.gtao);
    this.composer.addPass(new OutputPass());

    this.autoRotate = !!opts.autoRotate;
    this.controls = opts.interactive ? new OrbitControls(this.camera, canvas) : null;
    if (this.controls) {
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.addEventListener("change", () => (this.dirty = true));
    }

    this.ready = this.loadScene();
    this.resizeObserver = new ResizeObserver(() => this.resizeToCanvas());
    this.resizeObserver.observe(canvas);
    this.resizeToCanvas();
    this.loop();
  }

  setActive(active: boolean) {
    this.active = active;
    this.dirty = true;
  }

  setAutoRotate(on: boolean) {
    this.autoRotate = on;
    if (this.controls) this.controls.autoRotate = on;
  }

  /** Replace the model with freshly loaded parts, laid out side by side on the table. */
  setParts(parts: LoadedPart[], colors: string[][]) {
    for (const p of this.parts) {
      for (const m of p.meshes.values()) {
        m.geometry.dispose();
        m.material.dispose();
      }
      this.model.remove(p.group);
    }
    this.parts = [];
    const widths = parts.map((p) => p.bounds.max[0] - p.bounds.min[0]);
    const total = widths.reduce((a, b) => a + b, 0) + PART_GAP_MM * Math.max(0, parts.length - 1);
    let cursor = -total / 2;
    parts.forEach((part, i) => {
      const group = new Group();
      const meshes = new Map<number, Mesh<BufferGeometry, MeshPhysicalMaterial>>();
      for (const lm of part.meshes) {
        const g = new BufferGeometry();
        g.setAttribute("position", new BufferAttribute(lm.positions, 3));
        // Float normals: the path tracer merges every mesh into one geometry and needs matching attribute types.
        const normals = new Float32Array(lm.normals.length);
        for (let n = 0; n < normals.length; n++) normals[n] = lm.normals[n]! / 32767;
        g.setAttribute("normal", new BufferAttribute(normals, 3));
        g.setIndex(new BufferAttribute(lm.indices, 1));
        g.computeBoundingBox();
        g.computeBoundingSphere();
        const filament = resolveFilament(colors[i]?.[lm.tool] ?? colors[i]?.[0] ?? "");
        const mat = filamentMaterial(filament);
        mat.clippingPlanes = [this.clip];
        const mesh = new Mesh(g, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshes.set(lm.tool, mesh);
        group.add(mesh);
      }
      const { min, max } = part.bounds;
      group.position.set(cursor - min[0], -min[1], -(min[2] + max[2]) / 2);
      cursor += widths[i]! + PART_GAP_MM;
      this.model.add(group);
      this.parts.push({ group, meshes });
    });
    this.applyScene();
    this.reframe();
  }

  setColors(colors: string[][]) {
    this.parts.forEach((p, i) => {
      for (const [tool, mesh] of p.meshes) {
        const f: Filament = resolveFilament(colors[i]?.[tool] ?? colors[i]?.[0] ?? "");
        applyFilament(mesh.material, f);
        if (this.photoMode) mesh.material.sheen = 0;
      }
    });
    this.dirty = true;
  }

  setScene(id: string) {
    if (id === this.sceneId && (this.built || this.loadToken > 0)) return this.ready;
    this.sceneId = id;
    this.ready = this.loadScene();
    return this.ready;
  }

  /** Resolves once the current scene's HDRI and surfaces are loaded and built. Await before capturing. */
  whenReady() {
    return this.ready;
  }

  private async loadScene() {
    const token = ++this.loadToken;
    const spec = SCENE_SPECS[this.sceneId] ?? SCENE_SPECS["white-sweep"]!;
    try {
      const assets = await loadSceneAssets(spec);
      if (token !== this.loadToken || this.disposed) return;
      this.assets = assets;
      this.applyScene();
      this.reframe();
    } catch (e) {
      console.error("scene assets failed to load", e);
    }
  }

  private environmentFor(id: HdriId, texture: Texture) {
    let env = this.envCache.get(id);
    if (!env) {
      env = this.pmrem.fromEquirectangular(texture).texture;
      this.envCache.set(id, env);
    }
    return env;
  }

  setShot(shot: Shot) {
    this.shot = shot;
    this.reframe();
  }

  /** Show only the layers below `fraction` of the height (0..1); null shows the whole print. */
  setReveal(fraction: number | null) {
    const box = this.modelBox();
    const on = fraction !== null && fraction < 0.999;
    this.clip.constant = on ? box.min.y + (box.max.y - box.min.y) * Math.max(0, fraction!) : Infinity;
    for (const p of this.parts) for (const m of p.meshes.values()) m.material.side = on ? DoubleSide : FrontSide;
    this.renderer.shadowMap.needsUpdate = true;
    this.dirty = true;
  }

  /** What the path tracer needs to render the scene exactly as previewed. */
  photoContext() {
    const box = this.modelBox();
    return {
      scene: this.scene,
      box,
      fov: this.camera.fov,
      exposure: this.renderer.toneMappingExposure,
      /** Equirect environment (the path tracer samples it directly) and HDRI-only lighting. */
      enterPhotoMode: () => {
        const env = this.scene.environment;
        const lights = this.built?.lights ?? [];
        if (this.assets) this.scene.environment = this.assets.hdri.texture;
        for (const l of lights) l.visible = false;
        this.photoMode = true;
        // Sheen fakes a matte fuzz in raster; path traced it only adds fireflies, and diffuse GI covers it.
        const sheen = new Map<MeshPhysicalMaterial, number>();
        for (const p of this.parts) {
          for (const m of p.meshes.values()) {
            sheen.set(m.material, m.material.sheen);
            m.material.sheen = 0;
          }
        }
        return () => {
          this.scene.environment = env;
          for (const l of lights) l.visible = true;
          for (const [m, v] of sheen) m.sheen = v;
          this.photoMode = false;
          this.dirty = true;
        };
      },
    };
  }

  modelBox() {
    this.box ??= new Box3().setFromObject(this.model);
    return this.box.clone();
  }

  hasModel() {
    return this.parts.length > 0;
  }

  private applyScene() {
    if (!this.assets) return;
    if (this.built) {
      this.scene.remove(this.built.group);
      this.built.dispose();
    }
    this.box = null;
    const raw = new Box3().setFromObject(this.model);
    const size = raw.isEmpty() ? new Vector3(60, 80, 60) : raw.getSize(new Vector3());
    const spec = SCENE_SPECS[this.sceneId] ?? SCENE_SPECS["white-sweep"]!;
    this.built = buildScene(spec, this.assets, Math.max(size.x, size.z), size.y);
    this.scene.add(this.built.group);
    this.scene.environment = this.environmentFor(spec.hdri, this.assets.hdri.texture);
    this.scene.environmentRotation.copy(this.built.rotation);
    this.scene.background = this.built.background;
    this.scene.backgroundBlurriness = this.built.backgroundBlurriness;
    this.scene.backgroundIntensity = this.built.backgroundIntensity;
    this.scene.backgroundRotation.copy(this.built.rotation);
    this.scene.environmentIntensity = this.built.spec.envIntensity;
    this.renderer.toneMappingExposure = this.built.spec.exposure;
    this.model.position.y = this.built.lift;
    this.box = null;
    this.renderer.shadowMap.needsUpdate = true;
    const S = Math.max(size.x, size.y, size.z);
    this.gtao.updateGtaoMaterial({
      radius: S * 0.06,
      distanceExponent: 1.4,
      thickness: S * 0.04,
      scale: 1,
      samples: 16,
    });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    this.dirty = true;
  }

  private reframe() {
    const box = this.modelBox();
    if (box.isEmpty()) box.set(new Vector3(-30, 0, -30), new Vector3(30, 80, 30));
    const target = frameBox(this.camera, box, this.shot);
    if (this.controls) {
      this.controls.target.copy(target);
      this.controls.update();
    }
    this.dirty = true;
  }

  private resizeToCanvas() {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, PREVIEW_MAX_DPR));
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.reframe();
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    if (!this.active) return;
    if (this.autoRotate && !this.controls) {
      const now = performance.now();
      if (now - this.lastRotate < ROTATE_FRAME_MS) return;
      const dt = this.lastRotate ? Math.min(0.1, (now - this.lastRotate) / 1000) : 0;
      this.lastRotate = now;
      this.shot = { ...this.shot, azimuth: (this.shot.azimuth + ROTATE_DEG_PER_S * dt) % 360 };
      frameBox(this.camera, this.modelBox(), this.shot);
      this.dirty = true;
    }
    if (this.controls) {
      this.controls.autoRotate = this.autoRotate;
      this.controls.autoRotateSpeed = 0.6;
      if (this.controls.update()) this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    this.composer.render();
  };

  /**
   * Render one frame at an exact output size into a fresh canvas. Supersamples when GPU memory
   * allows, then downsamples with high-quality filtering.
   */
  renderToCanvas(width: number, height: number, shot: Shot, opts: { supersample?: boolean } = {}): HTMLCanvasElement {
    const ss =
      opts.supersample === false ? 1 : Math.max(1, Math.min(2, Math.sqrt(MAX_CAPTURE_PIXELS / (width * height))));
    const maxDim = this.renderer.capabilities.maxTextureSize;
    const scale = Math.min(ss, maxDim / Math.max(width, height));
    const rw = Math.round(width * scale);
    const rh = Math.round(height * scale);

    const prevSize = this.renderer.getSize(new Vector2());
    const prevRatio = this.renderer.getPixelRatio();
    const prevAspect = this.camera.aspect;
    const prevPos = this.camera.position.clone();
    const prevQuat = this.camera.quaternion.clone();

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(rw, rh, false);
    this.composer.setPixelRatio(1);
    this.composer.setSize(rw, rh);
    this.camera.aspect = width / height;
    frameBox(this.camera, this.modelBox(), shot);
    this.composer.render();

    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.canvas, 0, 0, rw, rh, 0, 0, width, height);

    this.renderer.setPixelRatio(prevRatio);
    this.renderer.setSize(prevSize.x, prevSize.y, false);
    this.composer.setPixelRatio(prevRatio);
    this.composer.setSize(prevSize.x, prevSize.y);
    this.camera.aspect = prevAspect;
    this.camera.position.copy(prevPos);
    this.camera.quaternion.copy(prevQuat);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
    return out;
  }

  /** A final image as a Blob (JPEG by default; PNG keeps the full dynamic range for retouching). */
  async capture(width: number, height: number, shot: Shot, type: "image/jpeg" | "image/png" = "image/jpeg") {
    const canvas = this.renderToCanvas(width, height, shot);
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the image."))), type, 0.93),
    );
  }

  /** Size the drawing buffer for video frames and keep it there until `endFrames`. */
  beginFrames(width: number, height: number) {
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(1);
    this.composer.setSize(width, height);
    this.camera.aspect = width / height;
    this.active = false;
  }

  renderFrame(shot: Shot) {
    frameBox(this.camera, this.modelBox(), shot);
    this.composer.render();
  }

  endFrames() {
    this.active = true;
    this.resizeToCanvas();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    this.built?.dispose();
    for (const p of this.parts) {
      for (const m of p.meshes.values()) {
        m.geometry.dispose();
        m.material.dispose();
      }
    }
    this.fallbackEnv.dispose();
    for (const t of this.envCache.values()) t.dispose();
    this.pmrem.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
