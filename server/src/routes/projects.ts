import { Router } from "express";
import { listConnectedProjects } from "../config/manifest.js";

export function createProjectsRouter(): Router {
  const router = Router();

  router.get("/api/projects", (_req, res) => {
    res.json({ data: listConnectedProjects() });
  });

  return router;
}
