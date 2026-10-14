import type { RenderView } from "@exo/shared";
import { api } from "../http/api";

export interface RenderMetaInput {
  kind: "image" | "video";
  label: string;
  projectId?: string;
  platform?: string;
  filament?: string;
  scene?: string;
  angle?: string;
  motion?: string;
  width: number;
  height: number;
}

export const renderService = {
  save: (blob: Blob, meta: RenderMetaInput) =>
    api
      .upload<{ render: RenderView }>("POST", "/api/renders", blob, { meta: JSON.stringify(meta) })
      .then((r) => r.render),
  list: (opts: { projectId?: string; before?: number; limit?: number } = {}) =>
    api.get<{ renders: RenderView[] }>("/api/renders", opts).then((r) => r.renders),
  remove: (id: string) => api.delete<{ ok: true }>(`/api/renders/${id}`),
};
