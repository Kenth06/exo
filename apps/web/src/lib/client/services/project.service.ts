import type { ProjectDetail, ProjectFile, ProjectSettings, ProjectSummary } from "@exo/shared";
import { api } from "../http/api";

export const projectService = {
  list: () => api.get<{ projects: ProjectSummary[] }>("/api/projects").then((r) => r.projects),
  create: (name: string) => api.post<{ project: ProjectDetail }>("/api/projects", { name }).then((r) => r.project),
  get: (id: string) => api.get<{ project: ProjectDetail }>(`/api/projects/${id}`).then((r) => r.project),
  update: (id: string, patch: { name?: string; settings?: ProjectSettings }) =>
    api.patch<{ ok: true }>(`/api/projects/${id}`, patch),
  remove: (id: string) => api.delete<{ ok: true }>(`/api/projects/${id}`),
  uploadFile: (id: string, file: File) =>
    api
      .upload<{ file: ProjectFile }>("PUT", `/api/projects/${id}/files`, file, { name: file.name })
      .then((r) => r.file),
  removeFile: (fileId: string) => api.delete<{ ok: true }>(`/api/files/${fileId}`),
  fileBytes: (file: ProjectFile) => api.bytes(file.url),
};
