import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/entities/index.ts",
  out: "./drizzle/migrations",
});
