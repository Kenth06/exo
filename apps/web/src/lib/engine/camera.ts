import type { CameraAngle } from "@exo/shared";
import { type Box3, MathUtils, type PerspectiveCamera, Vector3 } from "three";

export interface Shot {
  azimuth: number;
  elevation: number;
  /** Fraction of the frame the object fills on its tightest axis. */
  fill: number;
  detail?: boolean;
  /** Multiplies the fitted distance (motions use it to push in or pull out). */
  distanceScale?: number;
}

export const shotFor = (angle: CameraAngle): Shot => ({
  azimuth: angle.azimuth,
  elevation: angle.elevation,
  fill: angle.detail ? 1 : 0.8,
  detail: angle.detail,
});

const corners = (box: Box3) => {
  const { min, max } = box;
  const out: Vector3[] = [];
  for (const x of [min.x, max.x])
    for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) out.push(new Vector3(x, y, z));
  return out;
};

/**
 * Place the camera so the whole box is visible with the requested fill, regardless of aspect ratio,
 * and center the object's projection in the frame. Nothing is ever cropped.
 */
export const frameBox = (camera: PerspectiveCamera, box: Box3, shot: Shot) => {
  const az = MathUtils.degToRad(shot.azimuth);
  const el = MathUtils.degToRad(Math.min(shot.elevation, 89));
  const dir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());

  if (shot.detail) {
    // Close-up on the outer wall at mid height, facing the camera.
    const horizontal = new Vector3(dir.x, 0, dir.z).normalize();
    const reach = Math.max(size.x, size.z) / 2;
    const target = center.clone().addScaledVector(horizontal, reach * 0.9);
    target.y = box.min.y + size.y * 0.55;
    const span = Math.max(6, Math.min(size.y, Math.max(size.x, size.z)) * 0.22);
    const dist = (span / 2 / Math.tan(MathUtils.degToRad(camera.fov / 2))) * (shot.distanceScale ?? 1);
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.near = dist / 50;
    camera.far = dist * 400;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    return target;
  }

  const target = center.clone();
  const pts = corners(box);
  let dist = (size.length() / 2 / Math.sin(MathUtils.degToRad(camera.fov / 2))) * 1.1;
  const right = new Vector3();
  const up = new Vector3();
  const ndc = new Vector3();
  for (let iter = 0; iter < 8; iter++) {
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.near = Math.max(0.5, dist / 100);
    camera.far = dist * 200;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      ndc.copy(p).project(camera);
      minX = Math.min(minX, ndc.x);
      maxX = Math.max(maxX, ndc.x);
      minY = Math.min(minY, ndc.y);
      maxY = Math.max(maxY, ndc.y);
    }
    const halfW = (maxX - minX) / 2;
    const halfH = (maxY - minY) / 2;
    // Recenter: shift the target along the camera plane by the projected offset.
    const cx = (maxX + minX) / 2;
    const cy = (maxY + minY) / 2;
    const viewH = 2 * dist * Math.tan(MathUtils.degToRad(camera.fov / 2));
    const viewW = viewH * camera.aspect;
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    target.addScaledVector(right, (cx * viewW) / 2).addScaledVector(up, (cy * viewH) / 2);
    const scale = Math.max(halfW, halfH) / shot.fill;
    dist *= MathUtils.clamp(scale, 0.5, 2);
  }
  dist *= shot.distanceScale ?? 1;
  camera.position.copy(target).addScaledVector(dir, dist);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return target;
};
