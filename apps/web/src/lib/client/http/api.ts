import { type ApiErrorBody, CSRF_HEADER, type ErrorCode } from "@exo/shared";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ErrorCode | "ERR_NETWORK",
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | undefined>;

const url = (path: string, query?: Query) => {
  if (!query) return path;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined) q.set(k, String(v));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
};

const request = async <T>(
  method: string,
  path: string,
  init: { query?: Query; json?: unknown; body?: BodyInit; contentType?: string } = {},
) => {
  const headers = new Headers();
  if (method !== "GET") headers.set(CSRF_HEADER, "1");
  let body: BodyInit | undefined = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  } else if (init.contentType) headers.set("content-type", init.contentType);

  let res: Response;
  try {
    res = await fetch(url(path, init.query), { method, headers, body, credentials: "same-origin" });
  } catch {
    throw new ApiError("Can't reach Exo. Check your connection.", 0, "ERR_NETWORK");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(data?.error ?? `Request failed (${res.status}).`, res.status, data?.code ?? "ERR_INTERNAL");
  }
  return (await res.json()) as T;
};

/** The only module that talks HTTP to the API. */
export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, json?: unknown) => request<T>("POST", path, { json: json ?? {} }),
  patch: <T>(path: string, json: unknown) => request<T>("PATCH", path, { json }),
  delete: <T>(path: string) => request<T>("DELETE", path),
  /** Raw upload (file as body). */
  upload: <T>(method: "PUT" | "POST", path: string, body: Blob, query?: Query) =>
    request<T>(method, path, { body, query, contentType: body.type || "application/octet-stream" }),
  /** Binary download of an API resource. */
  bytes: async (path: string) => {
    const res = await fetch(path, { credentials: "same-origin" });
    if (!res.ok) throw new ApiError(`Download failed (${res.status}).`, res.status, "ERR_INTERNAL");
    return res.arrayBuffer();
  },
};
