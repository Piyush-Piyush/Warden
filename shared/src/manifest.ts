import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const ManifestV1 = z.object({
  version: z.literal(1),
  project: z.string().min(1),
  services: z
    .array(
      z.object({
        name: z.string().min(1),
        owner: z.string().min(1),
        slo: z.object({
          error_rate_pct: z.number(),
          p99_latency_ms: z.number(),
        }),
      }),
    )
    .min(1),
  signals: z.object({
    metrics: z.object({
      mcp_server: z.string().min(1),
      tool: z.string().min(1),
      default_metric: z.string().min(1),
    }),
    logs: z.object({
      mcp_server: z.string().min(1),
      tool: z.string().min(1),
      query_hint: z.string(),
    }),
    deploys: z.object({
      mcp_server: z.string().min(1),
      repo: z.string().min(1),
      environment: z.string().min(1),
      fallback_mcp_server: z.string().optional(),
    }),
  }),
  bisect: z.object({
    enabled: z.boolean(),
    kit_tool: z.string().min(1),
    candidate_window_minutes: z.number().positive(),
  }),
  actions: z.object({
    safe: z.array(z.string()),
    approval_required: z.array(z.string()),
  }),
  rollback: z.object({
    strategy: z.string().min(1),
    mcp_server: z.string().min(1),
    tool: z.string().min(1),
    runbook: z.string().min(1),
  }),
  verification: z.object({
    metric: z.string().min(1),
    target_below: z.number(),
    window_minutes: z.number().positive(),
    poll_interval_seconds: z.number().positive(),
  }),
  escalation: z.object({
    notify: z.string().min(1),
    human_approver_role: z.string().min(1),
  }),
});

export type Manifest = z.infer<typeof ManifestV1>;

export function parseManifestYaml(yamlText: string): Manifest {
  const raw = parseYaml(yamlText);
  return ManifestV1.parse(raw);
}
