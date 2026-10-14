/** Prefixed ids make logs and URLs self-describing: `prj_3f2a...`. */
export const newId = (prefix: "usr" | "prj" | "fil" | "rnd" | "msg") =>
  `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
