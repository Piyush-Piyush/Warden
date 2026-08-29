import { z } from "zod";

export const restartServiceInputShape = {
  project: z.string(),
  service: z.string(),
  environment: z.string(),
};

const restartServiceInput = z.object(restartServiceInputShape);
export type RestartServiceInput = z.infer<typeof restartServiceInput>;

export interface RestartServiceOutput {
  status: "ok";
  restarted_at: string;
}

// Destructive — approval-gated, same as rollback_deploy. Not part of the
// sample-checkout incident's actual resolution path (that's a rollback), but
// exists because incident.yaml's actions.approval_required lists it as a
// generally available remediation for other kinds of incidents.
export function restartServiceHandler(_input: RestartServiceInput): RestartServiceOutput {
  return { status: "ok", restarted_at: new Date().toISOString() };
}
