import type { Route } from "./common/http";
import { authController } from "./controllers/auth.controller";
import { contactController } from "./controllers/contact.controller";
import { fileController } from "./controllers/file.controller";
import { healthController } from "./controllers/health.controller";
import { projectController } from "./controllers/project.controller";
import { renderController } from "./controllers/render.controller";
import type { AppServices } from "./layers";

export const routes: ReadonlyArray<Route<AppServices>> = [
  ...healthController,
  ...authController,
  ...projectController,
  ...fileController,
  ...renderController,
  ...contactController,
];
