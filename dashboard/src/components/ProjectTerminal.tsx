import type { Manifest } from "@warden/shared";

function buildLines(manifest: Manifest): string[] {
  const lines: string[] = [`$ warden connect ${manifest.project}`];

  for (const service of manifest.services) {
    lines.push(`> service ${service.name} (${service.owner})`);
    lines.push(`    slo  error_rate <= ${service.slo.error_rate_pct}%   p99 <= ${service.slo.p99_latency_ms}ms`);
  }

  lines.push("> signals");
  lines.push(`    metrics  -> ${manifest.signals.metrics.mcp_server}::${manifest.signals.metrics.tool}`);
  lines.push(`    logs     -> ${manifest.signals.logs.mcp_server}::${manifest.signals.logs.tool}`);
  const deploysLine = `    deploys  -> ${manifest.signals.deploys.mcp_server}::${manifest.signals.deploys.tool}`;
  lines.push(
    manifest.signals.deploys.fallback_mcp_server
      ? `${deploysLine}  [fallback: ${manifest.signals.deploys.fallback_mcp_server}::${manifest.signals.deploys.fallback_tool}]`
      : deploysLine,
  );

  lines.push("> actions");
  lines.push(`    safe               ${manifest.actions.safe.join(", ")}`);
  lines.push(`    approval_required  ${manifest.actions.approval_required.join(", ")}`);

  lines.push(`> rollback -> ${manifest.rollback.mcp_server}::${manifest.rollback.tool} (${manifest.rollback.strategy})`);
  lines.push(
    `> verification  ${manifest.verification.metric} < ${manifest.verification.target_below}` +
      `  within ${manifest.verification.window_minutes}m  poll ${manifest.verification.poll_interval_seconds}s`,
  );
  lines.push(`> escalation -> ${manifest.escalation.notify} (${manifest.escalation.human_approver_role})`);

  return lines;
}

export function ProjectTerminal({ manifest }: { manifest: Manifest }) {
  const lines = buildLines(manifest);

  return (
    <div className="wd-terminal">
      <div className="wd-terminal__bar">
        <span className="wd-terminal__dot wd-terminal__dot--r" />
        <span className="wd-terminal__dot wd-terminal__dot--y" />
        <span className="wd-terminal__dot wd-terminal__dot--g" />
        <span className="wd-terminal__bar__title">incident.yaml :: {manifest.project}</span>
        <span className="wd-terminal__status">
          <span className="wd-terminal__status-dot" />
          connected
        </span>
      </div>
      <div className="wd-terminal__body">
        {lines.map((line, i) => (
          <div className="wd-terminal__line" key={i} style={{ animationDelay: `${i * 45}ms` }}>
            {line}
          </div>
        ))}
        <span className="wd-terminal__cursor" />
      </div>
    </div>
  );
}
