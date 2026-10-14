import type { Filament } from "@exo/shared";
import { Color, MeshPhysicalMaterial } from "three";

/** Physically based look per filament finish. Values tuned against photos of real prints. */
export const filamentMaterial = (f: Filament): MeshPhysicalMaterial => {
  const color = new Color(f.hex);
  const m = new MeshPhysicalMaterial({ color });
  applyFilament(m, f);
  return m;
};

export const applyFilament = (m: MeshPhysicalMaterial, f: Filament) => {
  m.color.set(f.hex);
  m.metalness = 0;
  m.roughness = 0.5;
  m.clearcoat = 0;
  m.clearcoatRoughness = 0.3;
  m.sheen = 0;
  m.transmission = 0;
  m.thickness = 0;
  m.ior = 1.5;
  m.specularIntensity = 0.5;
  const tint = new Color(f.hex).lerp(new Color("#ffffff"), 0.5);
  switch (f.finish) {
    case "matte":
      m.roughness = 0.82;
      m.sheen = 0.35;
      m.sheenRoughness = 0.85;
      m.sheenColor.copy(tint);
      m.specularIntensity = 0.35;
      break;
    case "basic":
      m.roughness = 0.42;
      m.clearcoat = 0.15;
      m.clearcoatRoughness = 0.45;
      break;
    case "silk":
      m.roughness = 0.24;
      m.metalness = 0.55;
      m.sheen = 1;
      m.sheenRoughness = 0.35;
      m.sheenColor.copy(tint);
      m.clearcoat = 0.4;
      m.clearcoatRoughness = 0.2;
      break;
    case "glossy":
      m.roughness = 0.2;
      m.clearcoat = 0.6;
      m.clearcoatRoughness = 0.12;
      m.specularIntensity = 0.7;
      break;
    case "translucent":
      m.roughness = 0.16;
      m.transmission = 0.65;
      m.thickness = 1.6;
      m.attenuationColor.set(f.hex);
      m.attenuationDistance = 2.5;
      m.clearcoat = 0.5;
      m.clearcoatRoughness = 0.1;
      break;
    case "carbon":
      m.roughness = 0.68;
      m.sheen = 0.25;
      m.sheenRoughness = 0.6;
      m.sheenColor.set("#8a8a8a");
      m.specularIntensity = 0.3;
      break;
  }
  m.needsUpdate = true;
};
