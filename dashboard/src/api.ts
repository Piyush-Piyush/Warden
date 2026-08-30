import type { Case, CaseEvent, Manifest, PendingApproval } from "@warden/shared";

const SERVER_BASE_URL = import.meta.env.VITE_SERVER_BASE_URL ?? "http://localhost:4100";

export interface CaseDetail extends Case {
  events: CaseEvent[];
  pending_approval: PendingApproval | null;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${SERVER_BASE_URL}${path}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  const body = (await res.json()) as { data: T };
  return body.data;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SERVER_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  const responseBody = (await res.json()) as { data: T };
  return responseBody.data;
}

export function listCases(): Promise<Case[]> {
  return getJson<Case[]>("/api/cases");
}

export function listConnectedProjects(): Promise<Manifest[]> {
  return getJson<Manifest[]>("/api/projects");
}

export function getCase(id: string): Promise<CaseDetail> {
  return getJson<CaseDetail>(`/api/cases/${id}`);
}

export function approveCase(id: string, decidedBy: string): Promise<{ status: string }> {
  return postJson(`/api/cases/${id}/approve`, { decided_by: decidedBy });
}

export function denyCase(id: string, decidedBy: string, reason?: string): Promise<{ status: string }> {
  return postJson(`/api/cases/${id}/deny`, { decided_by: decidedBy, reason });
}
