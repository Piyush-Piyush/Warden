import { describe, expect, it } from "vitest";
import { listConnectedProjects } from "../server/src/config/manifest.js";

describe("listConnectedProjects", () => {
  it("finds the demo project by scanning for incident.yaml files", () => {
    const projects = listConnectedProjects();
    const slugs = projects.map((m) => m.project);
    expect(slugs).toContain("sample-checkout");
  });
});
