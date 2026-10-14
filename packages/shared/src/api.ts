// HTTP contracts shared by apps/api and apps/web.

export type ErrorCode =
  | "ERR_BAD_REQUEST"
  | "ERR_UNAUTHORIZED"
  | "ERR_FORBIDDEN"
  | "ERR_NOT_FOUND"
  | "ERR_CONFLICT"
  | "ERR_PAYLOAD_TOO_LARGE"
  | "ERR_UPSTREAM"
  | "ERR_INTERNAL";

export interface ApiErrorBody {
  error: string;
  code: ErrorCode;
}

export interface PublicUser {
  id: string;
  email: string;
  createdAt: number;
}

export interface ProjectFile {
  id: string;
  filename: string;
  size: number;
  position: number;
  url: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  files: ProjectFile[];
}

export interface ProjectDetail extends ProjectSummary {
  settings: unknown;
}

export type RenderKind = "image" | "video";
export interface RenderItemRequest {
  label: string;
  platform?: string;
  filament?: string;
  scene?: string;
  angle?: string;
  width: number;
  height: number;
}

export interface RenderView {
  id: string;
  kind: RenderKind;
  label: string;
  projectId: string | null;
  meta: RenderItemRequest;
  url: string;
  createdAt: number;
}

/** The custom header every mutating request must carry (CSRF guard). */
export const CSRF_HEADER = "x-exo";
