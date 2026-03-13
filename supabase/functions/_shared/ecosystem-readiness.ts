import type {
  EcosystemReadinessRecord,
  GovernanceMetricSnapshot,
  JsonRecord,
  ReadinessArtifact,
  ReadinessState,
  RunTraceView,
} from "./control-plane-types.ts";
import { getGovernanceMetrics } from "./governance.ts";
import { compact, safeNumber } from "./http.ts";
import { admin } from "./supabase.ts";

interface BuildReadinessInput {
  orgId?: string | null;
  userId?: string | null;
  windowHours?: number;
}

interface BuildRunTraceInput {
  correlationId: string;
  orgId?: string | null;
  userId?: string | null;
}

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  return new Date().toISOString();
}

async function resolveOrgId(explicitOrgId?: string | null, userId?: string | null) {
  if (compact(explicitOrgId)) return compact(explicitOrgId);
  if (!compact(userId)) return null;

  const { data, error } = await admin
    .from("organization_members")
    .select("org_id")
    .eq("user_id", compact(userId))
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return compact(data?.org_id) || null;
}

function withOrgScope<T>(query: T, orgId: string | null): T {
  const candidate = query as unknown as {
    or?: (arg: string) => unknown;
    is?: (column: string, value: unknown) => unknown;
  };
  if (orgId && typeof candidate.or === "function") {
    return candidate.or(`org_id.eq.${orgId},org_id.is.null`) as T;
  }
  if (!orgId && typeof candidate.is === "function") {
    return candidate.is("org_id", null) as T;
  }
  return query;
}

function normalizeReadinessState(value: unknown): ReadinessState {
  const normalized = compact(value).toLowerCase();
  if (normalized === "planned") return "planned";
  if (normalized === "connected") return "connected";
  if (normalized === "simulated") return "simulated";
  if (normalized === "degraded") return "degraded";
  return "offline";
}

function pickLatestIso(values: Array<string | null | undefined>) {
  const normalized = values
    .map((value) => compact(value))
    .filter(Boolean)
    .map((value) => {
      const epoch = new Date(value).getTime();
      return Number.isFinite(epoch) ? { value, epoch } : null;
    })
    .filter(Boolean) as Array<{ value: string; epoch: number }>;

  if (normalized.length === 0) return null;
  normalized.sort((a, b) => b.epoch - a.epoch);
  return normalized[0].value;
}

function buildRecord(input: {
  moduleKey: string;
  route: string;
  backendSurface: string;
  state: ReadinessState;
  reasonCode: string;
  reasonText: string;
  lastSuccessAt?: string | null;
  correlationId?: string | null;
  smokeCaseId?: string | null;
  remediationAction: string;
}): EcosystemReadinessRecord {
  return {
    module_key: input.moduleKey,
    route: input.route,
    backend_surface: input.backendSurface,
    state: normalizeReadinessState(input.state),
    state_reason_code: compact(input.reasonCode) || "unknown",
    state_reason_text: compact(input.reasonText) || "No reason provided.",
    last_success_at: compact(input.lastSuccessAt) || null,
    last_checked_at: nowIso(),
    correlation_id: compact(input.correlationId) || null,
    smoke_case_id: compact(input.smokeCaseId) || null,
    remediation_action: compact(input.remediationAction) || "Review module diagnostics.",
  };
}

async function countEventLogByTypes(input: {
  types: string[];
  sinceIso: string;
  orgId: string | null;
}) {
  if (input.types.length === 0) return 0;

  let query = admin
    .from("event_log")
    .select("id", { count: "exact", head: true })
    .in("event_type", input.types)
    .gte("created_at", input.sinceIso);
  if (input.orgId) query = query.eq("org_id", input.orgId);

  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

async function buildGovernanceMetricSnapshot(input: {
  orgId: string | null;
  userId?: string | null;
  windowHours: number;
  sinceIso: string;
}) {
  const governance = await getGovernanceMetrics({
    orgId: input.orgId,
    userId: input.userId || null,
    windowHours: input.windowHours,
  });

  const [dispatchTotal, blockedFromToolBus, blockedFromGovernanceEvents] = await Promise.all([
    countEventLogByTypes({
      types: ["tool_bus.invocation"],
      sinceIso: input.sinceIso,
      orgId: input.orgId,
    }),
    countEventLogByTypes({
      types: ["tool_bus.blocked", "tool_bus.awaiting_approval"],
      sinceIso: input.sinceIso,
      orgId: input.orgId,
    }),
    countEventLogByTypes({
      types: [
        "goal.governance_blocked",
        "goal.step.governance_blocked",
        "pipeline.governance_blocked",
        "pipeline.step.governance_blocked",
      ],
      sinceIso: input.sinceIso,
      orgId: input.orgId,
    }),
  ]);

  let dispatchRowsQuery = admin
    .from("event_log")
    .select("id, correlation_id, risk_level, metadata, event_type, created_at")
    .in("event_type", ["tool_bus.invocation", "control_plane.tool_dispatch"])
    .gte("created_at", input.sinceIso)
    .order("created_at", { ascending: false })
    .limit(1200);
  if (input.orgId) dispatchRowsQuery = dispatchRowsQuery.eq("org_id", input.orgId);

  const { data: dispatchRows, error: dispatchRowsError } = await dispatchRowsQuery;
  if (dispatchRowsError) throw dispatchRowsError;

  const rows = dispatchRows || [];
  const routedHighRisk = rows.filter((row) => {
    const metadata = asRecord(row.metadata);
    const envelope = asRecord(metadata.envelope_v2);
    const riskLevel = compact(row.risk_level || envelope.risk_level).toLowerCase();
    return riskLevel === "high" || riskLevel === "critical";
  });

  const correlatedInvocations = rows.filter((row) => compact(row.correlation_id)).length;
  const traceCoverage = rows.length > 0 ? Number((correlatedInvocations / rows.length).toFixed(4)) : 0;

  const snapshot: GovernanceMetricSnapshot = {
    org_id: input.orgId,
    window: `last_${input.windowHours}h`,
    dispatch_total: dispatchTotal,
    blocked_total: blockedFromToolBus + blockedFromGovernanceEvents,
    approval_pending_total: safeNumber(asRecord(governance.backlog).pending_approvals, 0),
    high_risk_routed_total: routedHighRisk.length,
    tool_bus_trace_coverage: traceCoverage,
  };

  return {
    snapshot,
    governance,
    latestCorrelationId: compact(rows[0]?.correlation_id) || null,
  };
}

function deriveOverallState(records: EcosystemReadinessRecord[]): "green" | "yellow" | "red" {
  if (records.some((record) => record.state === "offline")) return "red";
  if (records.some((record) => record.state === "degraded")) return "yellow";
  return "green";
}

function buildFailureRows(records: EcosystemReadinessRecord[]) {
  return records
    .filter((record) => record.state === "offline" || record.state === "degraded")
    .map((record) => ({
      module_key: record.module_key,
      state: record.state,
      reason_code: record.state_reason_code,
      reason: record.state_reason_text,
      remediation_action: record.remediation_action,
      smoke_case_id: record.smoke_case_id,
    }));
}

export async function buildEcosystemReadiness(input: BuildReadinessInput): Promise<ReadinessArtifact> {
  const warnings: string[] = [];
  const generatedAt = nowIso();
  const windowHours = Math.max(1, Math.min(168, Number(input.windowHours || 24)));
  const sinceIso = new Date(Date.now() - (windowHours * 60 * 60 * 1000)).toISOString();
  const orgId = await resolveOrgId(input.orgId || null, input.userId || null).catch((error) => {
    warnings.push(error instanceof Error ? error.message : "Unable to resolve org scope.");
    return null;
  });

  const [governanceBundle, channelsBundle, connectorBundle, automationBundle, pipelineBundle, catalogBundle, n8nBundle, agentBundle, simulationBundle, smokeBundle] = await Promise.all([
    buildGovernanceMetricSnapshot({
      orgId,
      userId: input.userId || null,
      windowHours,
      sinceIso,
    }).catch((error) => {
      warnings.push(error instanceof Error ? `governance snapshot failed: ${error.message}` : "governance snapshot failed");
      return {
        snapshot: {
          org_id: orgId,
          window: `last_${windowHours}h`,
          dispatch_total: 0,
          blocked_total: 0,
          approval_pending_total: 0,
          high_risk_routed_total: 0,
          tool_bus_trace_coverage: 0,
        } satisfies GovernanceMetricSnapshot,
        governance: {
          warnings: ["Governance snapshot unavailable"],
          backlog: {},
          counts: {},
          risk: {},
          events: {},
        },
        latestCorrelationId: null,
      };
    }),
    (async () => {
      const scoped = withOrgScope(
        admin
          .from("messaging_channels")
          .select("id, type, provider, status, updated_at, last_error")
          .eq("status", "active"),
        orgId,
      );
      const { data, error } = await scoped;
      if (error) throw error;

      const rows = (data || []) as Array<Record<string, unknown>>;
      const activeReal = rows.filter((row) => compact(row.provider) !== "synthetic_gmail");
      const activeSynthetic = rows.filter((row) => compact(row.provider) === "synthetic_gmail");

      const { data: messageRows, error: messageError } = await admin
        .from("messages")
        .select("id, status, error_message, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(150);
      if (messageError) throw messageError;

      const failed = (messageRows || []).filter((row) => compact(row.status).toLowerCase() === "failed");
      const success = (messageRows || []).filter((row) => {
        const status = compact(row.status).toLowerCase();
        return status === "sent" || status === "delivered" || status === "read";
      });

      const latestCorrelation = success
        .map((row) => asRecord(row.metadata))
        .map((metadata) => compact(metadata.correlation_id || metadata.correlationId))
        .find(Boolean) || null;

      return {
        rows,
        activeRealCount: activeReal.length,
        activeSyntheticCount: activeSynthetic.length,
        failedCount: failed.length,
        lastSuccessAt: compact(success[0]?.created_at) || null,
        lastCorrelationId: latestCorrelation,
      };
    })().catch((error) => {
      warnings.push(error instanceof Error ? `messaging readiness failed: ${error.message}` : "messaging readiness failed");
      return {
        rows: [],
        activeRealCount: 0,
        activeSyntheticCount: 0,
        failedCount: 0,
        lastSuccessAt: null,
        lastCorrelationId: null,
      };
    }),
    (async () => {
      const scoped = withOrgScope(
        admin
          .from("api_connectors")
          .select("id, health_status, is_active, updated_at, last_healthcheck_at, last_synced_at")
          .eq("is_active", true),
        orgId,
      );
      const { data, error } = await scoped;
      if (error) throw error;
      const rows = (data || []) as Array<Record<string, unknown>>;
      const live = rows.filter((row) => compact(row.health_status) === "live");
      const latest = pickLatestIso(rows.map((row) => compact(row.last_healthcheck_at || row.last_synced_at || row.updated_at)));
      return {
        activeCount: rows.length,
        liveCount: live.length,
        lastSuccessAt: latest,
      };
    })().catch((error) => {
      warnings.push(error instanceof Error ? `connector readiness failed: ${error.message}` : "connector readiness failed");
      return { activeCount: 0, liveCount: 0, lastSuccessAt: null };
    }),
    (async () => {
      const scoped = withOrgScope(
        admin
          .from("automation_workflows")
          .select("id, is_active, updated_at, last_run_at, run_count")
          .order("updated_at", { ascending: false })
          .limit(300),
        orgId,
      );
      const { data, error } = await scoped;
      if (error) throw error;
      const rows = (data || []) as Array<Record<string, unknown>>;
      return {
        total: rows.length,
        active: rows.filter((row) => row.is_active === true).length,
        lastSuccessAt: pickLatestIso(rows.map((row) => compact(row.last_run_at || row.updated_at))),
      };
    })().catch((error) => {
      warnings.push(error instanceof Error ? `automation readiness failed: ${error.message}` : "automation readiness failed");
      return { total: 0, active: 0, lastSuccessAt: null };
    }),
    (async () => {
      let query = admin
        .from("pipeline_runs")
        .select("id, status, updated_at, correlation_id")
        .gte("updated_at", sinceIso)
        .order("updated_at", { ascending: false })
        .limit(400);
      if (orgId) query = query.eq("org_id", orgId);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data || []) as Array<Record<string, unknown>>;
      const completed = rows.filter((row) => compact(row.status).toLowerCase() === "completed");
      const failed = rows.filter((row) => compact(row.status).toLowerCase() === "failed");
      return {
        total: rows.length,
        completed: completed.length,
        failed: failed.length,
        lastSuccessAt: compact(completed[0]?.updated_at) || null,
        correlationId: compact(rows[0]?.correlation_id) || null,
      };
    })().catch((error) => {
      warnings.push(error instanceof Error ? `orchestration readiness failed: ${error.message}` : "orchestration readiness failed");
      return { total: 0, completed: 0, failed: 0, lastSuccessAt: null, correlationId: null };
    }),
    (async () => {
      const { data: entries, error: entriesError } = await admin
        .from("api_catalog_entries")
        .select("id, slug, activation_tier, updated_at")
        .eq("is_listed", true)
        .order("updated_at", { ascending: false })
        .limit(1200);
      if (entriesError) throw entriesError;

      const { data: syncRows, error: syncError } = await admin
        .from("api_catalog_sync_runs")
        .select("id, status, finished_at, created_at")
        .order("finished_at", { ascending: false })
        .limit(1);
      if (syncError) throw syncError;

      return {
        entryCount: (entries || []).length,
        latestSync: (syncRows || [])[0] || null,
        lastSuccessAt: compact((syncRows || [])[0]?.finished_at) || pickLatestIso((entries || []).map((row) => compact((row as Record<string, unknown>).updated_at))),
      };
    })().catch((error) => {
      warnings.push(error instanceof Error ? `api catalog readiness failed: ${error.message}` : "api catalog readiness failed");
      return { entryCount: 0, latestSync: null, lastSuccessAt: null };
    }),
    (async () => {
      const { data: entries, error: entriesError } = await admin
        .from("n8n_template_entries")
        .select("id, updated_at")
        .eq("is_listed", true)
        .order("recent_views", { ascending: false })
        .limit(1200);
      if (entriesError) throw entriesError;

      const { data: syncRows, error: syncError } = await admin
        .from("n8n_template_sync_runs")
        .select("id, status, finished_at, created_at")
        .order("finished_at", { ascending: false })
        .limit(1);
      if (syncError) throw syncError;

      const latestSync = (syncRows || [])[0] as Record<string, unknown> | undefined;
      const latestStatus = compact(latestSync?.status).toLowerCase();

      return {
        entryCount: (entries || []).length,
        latestStatus,
        latestSync: latestSync || null,
        lastSuccessAt: compact(latestSync?.finished_at) || pickLatestIso((entries || []).map((row) => compact((row as Record<string, unknown>).updated_at))),
      };
    })().catch((error) => {
      warnings.push(error instanceof Error ? `n8n readiness failed: ${error.message}` : "n8n readiness failed");
      return { entryCount: 0, latestStatus: "", latestSync: null, lastSuccessAt: null };
    }),
    (async () => {
      const scoped = withOrgScope(
        admin
          .from("agent_registry")
          .select("id, status, updated_at, total_runs")
          .order("updated_at", { ascending: false })
          .limit(400),
        orgId,
      );
      const { data, error } = await scoped;
      if (error) throw error;

      const rows = (data || []) as Array<Record<string, unknown>>;
      const active = rows.filter((row) => {
        const status = compact(row.status).toLowerCase();
        return status === "online" || status === "running";
      });
      return {
        total: rows.length,
        active: active.length,
        lastSuccessAt: pickLatestIso(rows.map((row) => compact(row.updated_at))),
      };
    })().catch((error) => {
      warnings.push(error instanceof Error ? `marketplace readiness failed: ${error.message}` : "marketplace readiness failed");
      return { total: 0, active: 0, lastSuccessAt: null };
    }),
    (async () => {
      let query = admin
        .from("simulation_runs")
        .select("id, status, created_at, updated_at")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(300);
      if (orgId) query = query.eq("org_id", orgId);
      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []) as Array<Record<string, unknown>>;
      const passed = rows.filter((row) => {
        const status = compact(row.status).toLowerCase();
        return status === "passed" || status === "completed";
      });
      const failed = rows.filter((row) => {
        const status = compact(row.status).toLowerCase();
        return status === "failed";
      });
      return {
        total: rows.length,
        passed: passed.length,
        failed: failed.length,
        lastSuccessAt: compact(passed[0]?.updated_at || passed[0]?.created_at) || null,
      };
    })().catch((error) => {
      warnings.push(error instanceof Error ? `simulation readiness failed: ${error.message}` : "simulation readiness failed");
      return { total: 0, passed: 0, failed: 0, lastSuccessAt: null };
    }),
    (async () => {
      const [hardBlockEvents, syntheticReplies, governorEscalations] = await Promise.all([
        (async () => {
          let query = admin
            .from("event_log")
            .select("id, event_type, correlation_id, created_at, metadata")
            .in("event_type", ["tool_bus.invocation", "tool_bus.result", "control_plane.tool_dispatch"])
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: false })
            .limit(600);
          if (orgId) query = query.eq("org_id", orgId);
          const { data, error } = await query;
          if (error) throw error;
          return (data || []) as Array<Record<string, unknown>>;
        })(),
        (async () => {
          let query = admin
            .from("outreach_queue")
            .select("id, status, provider_status, replied_at, updated_at, metadata")
            .eq("status", "replied")
            .order("updated_at", { ascending: false })
            .limit(80);
          if (orgId) query = query.eq("org_id", orgId);
          const { data, error } = await query;
          if (error) throw error;
          return (data || []) as Array<Record<string, unknown>>;
        })(),
        (async () => {
          let query = admin
            .from("risk_cases")
            .select("id, created_at, metadata")
            .order("created_at", { ascending: false })
            .limit(100);
          if (orgId) query = query.eq("org_id", orgId);
          const { data, error } = await query;
          if (error) throw error;
          return (data || []) as Array<Record<string, unknown>>;
        })(),
      ]);

      const hardBlockPass = hardBlockEvents.some((row) => {
        const metadata = asRecord(row.metadata);
        const toolName = compact(metadata.tool_code_name).toLowerCase();
        return toolName === "api-proxy" || toolName === "messaging-dispatch";
      });

      const syntheticPass = syntheticReplies.some((row) => {
        const metadata = asRecord(row.metadata);
        return metadata.synthetic_harness === true || asRecord(metadata.last_reply).source === "gmail_inbound";
      });

      const governorPass = governorEscalations.some((row) => {
        const metadata = asRecord(row.metadata);
        return metadata.smoke === true;
      });

      return {
        smokes: [
          {
            smoke_case_id: "hard_block_routing",
            status: hardBlockPass ? "pass" : "fail",
            checked_at: generatedAt,
            evidence_count: hardBlockEvents.length,
          },
          {
            smoke_case_id: "ag2_c6_synthetic",
            status: syntheticPass ? "pass" : "fail",
            checked_at: generatedAt,
            evidence_count: syntheticReplies.length,
          },
          {
            smoke_case_id: "governor_runtime",
            status: governorPass ? "pass" : "fail",
            checked_at: generatedAt,
            evidence_count: governorEscalations.length,
          },
        ],
      };
    })().catch((error) => {
      warnings.push(error instanceof Error ? `smoke evidence read failed: ${error.message}` : "smoke evidence read failed");
      return {
        smokes: [
          { smoke_case_id: "hard_block_routing", status: "fail", checked_at: generatedAt, evidence_count: 0 },
          { smoke_case_id: "ag2_c6_synthetic", status: "fail", checked_at: generatedAt, evidence_count: 0 },
          { smoke_case_id: "governor_runtime", status: "fail", checked_at: generatedAt, evidence_count: 0 },
        ],
      };
    }),
  ]);

  const records: EcosystemReadinessRecord[] = [];

  const governanceWarnings = asArray(asRecord(governanceBundle.governance).warnings)
    .map((entry) => compact(entry))
    .filter(Boolean);
  if (governanceWarnings.length > 0) warnings.push(...governanceWarnings);

  records.push(buildRecord({
    moduleKey: "control_tower",
    route: "/control-tower",
    backendSurface: "control-plane:ecosystem_readiness",
    state: governanceWarnings.length > 0 ? "degraded" : "connected",
    reasonCode: governanceWarnings.length > 0 ? "governance_advisory_mode" : "control_plane_snapshot_ok",
    reasonText: governanceWarnings.length > 0
      ? governanceWarnings[0]
      : "Control-plane readiness snapshot is available.",
    lastSuccessAt: generatedAt,
    correlationId: governanceBundle.latestCorrelationId,
    smokeCaseId: "hard_block_routing",
    remediationAction: "/control-tower?tab=readiness",
  }));

  records.push(buildRecord({
    moduleKey: "governance",
    route: "/control-tower",
    backendSurface: "orchestration-engine:governor_metrics",
    state: governanceWarnings.length > 0 ? "degraded" : "connected",
    reasonCode: governanceWarnings.length > 0 ? "governance_metrics_warning" : "governance_metrics_ok",
    reasonText: governanceWarnings.length > 0
      ? governanceWarnings[0]
      : `Dispatch=${governanceBundle.snapshot.dispatch_total}, blocked=${governanceBundle.snapshot.blocked_total}.`,
    lastSuccessAt: generatedAt,
    correlationId: governanceBundle.latestCorrelationId,
    smokeCaseId: "governor_runtime",
    remediationAction: "/control-tower?tab=governance",
  }));

  records.push(buildRecord({
    moduleKey: "orchestration",
    route: "/automation",
    backendSurface: "orchestration-engine:create_run|execute_run|get_run",
    state: pipelineBundle.total > 0
      ? (pipelineBundle.failed > pipelineBundle.completed ? "degraded" : "connected")
      : "simulated",
    reasonCode: pipelineBundle.total > 0
      ? (pipelineBundle.failed > pipelineBundle.completed ? "pipeline_failure_rate_high" : "pipeline_activity_ok")
      : "pipeline_activity_missing",
    reasonText: pipelineBundle.total > 0
      ? `Runs=${pipelineBundle.total}, completed=${pipelineBundle.completed}, failed=${pipelineBundle.failed}.`
      : "No recent pipeline runs in scope; orchestration is running in simulation/advisory mode.",
    lastSuccessAt: pipelineBundle.lastSuccessAt || generatedAt,
    correlationId: pipelineBundle.correlationId || governanceBundle.latestCorrelationId,
    smokeCaseId: "hard_block_routing",
    remediationAction: "/automation",
  }));

  records.push(buildRecord({
    moduleKey: "messaging",
    route: "/messaging",
    backendSurface: "messaging-dispatch|gmail-inbound|messaging-channel-oauth",
    state: channelsBundle.activeRealCount > 0
      ? (channelsBundle.failedCount > 0 ? "degraded" : "connected")
      : (channelsBundle.activeSyntheticCount > 0 ? "simulated" : "offline"),
    reasonCode: channelsBundle.activeRealCount > 0
      ? (channelsBundle.failedCount > 0 ? "messaging_recent_failures" : "messaging_real_channels_active")
      : (channelsBundle.activeSyntheticCount > 0 ? "messaging_synthetic_only" : "messaging_no_active_channels"),
    reasonText: channelsBundle.activeRealCount > 0
      ? `Active real channels=${channelsBundle.activeRealCount}; recent failed messages=${channelsBundle.failedCount}.`
      : (channelsBundle.activeSyntheticCount > 0
        ? "Synthetic messaging harness is active; provider credentials are intentionally excluded in code-first scope."
        : "No active messaging channels detected."),
    lastSuccessAt: channelsBundle.lastSuccessAt,
    correlationId: channelsBundle.lastCorrelationId,
    smokeCaseId: "ag2_c6_synthetic",
    remediationAction: "/messaging",
  }));

  records.push(buildRecord({
    moduleKey: "connector_proxy",
    route: "/automation",
    backendSurface: "api-proxy|tool-bus",
    state: connectorBundle.liveCount > 0
      ? "connected"
      : (connectorBundle.activeCount > 0 ? "degraded" : "offline"),
    reasonCode: connectorBundle.liveCount > 0
      ? "connectors_live"
      : (connectorBundle.activeCount > 0 ? "connectors_not_live" : "connectors_missing"),
    reasonText: connectorBundle.liveCount > 0
      ? `${connectorBundle.liveCount} live connector(s) available.`
      : (connectorBundle.activeCount > 0
        ? `${connectorBundle.activeCount} active connector(s) pending health/live status.`
        : "No active connectors available."),
    lastSuccessAt: connectorBundle.lastSuccessAt,
    correlationId: governanceBundle.latestCorrelationId,
    smokeCaseId: "hard_block_routing",
    remediationAction: "/automation",
  }));

  records.push(buildRecord({
    moduleKey: "automation",
    route: "/automation",
    backendSurface: "automation-runner|control-plane:tool_dispatch",
    state: automationBundle.total > 0
      ? (governanceBundle.snapshot.blocked_total > governanceBundle.snapshot.dispatch_total ? "degraded" : "connected")
      : "offline",
    reasonCode: automationBundle.total > 0
      ? (governanceBundle.snapshot.blocked_total > governanceBundle.snapshot.dispatch_total
        ? "automation_high_blocked_ratio"
        : "automation_workflows_available")
      : "automation_workflows_missing",
    reasonText: automationBundle.total > 0
      ? `Workflows=${automationBundle.total}, active=${automationBundle.active}, dispatch_total=${governanceBundle.snapshot.dispatch_total}, blocked_total=${governanceBundle.snapshot.blocked_total}.`
      : "No automation workflows configured.",
    lastSuccessAt: automationBundle.lastSuccessAt,
    correlationId: governanceBundle.latestCorrelationId,
    smokeCaseId: "hard_block_routing",
    remediationAction: "/automation",
  }));

  records.push(buildRecord({
    moduleKey: "api_catalog",
    route: "/intelligence",
    backendSurface: "api_catalog_entries|api_connectors",
    state: catalogBundle.entryCount > 0
      ? (connectorBundle.liveCount > 0 ? "connected" : "simulated")
      : "offline",
    reasonCode: catalogBundle.entryCount > 0
      ? (connectorBundle.liveCount > 0 ? "api_catalog_live_connectors" : "api_catalog_seed_or_uninstalled")
      : "api_catalog_entries_missing",
    reasonText: catalogBundle.entryCount > 0
      ? `Catalog entries=${catalogBundle.entryCount}; live connectors=${connectorBundle.liveCount}.`
      : "No listed API catalog entries found.",
    lastSuccessAt: catalogBundle.lastSuccessAt,
    correlationId: governanceBundle.latestCorrelationId,
    smokeCaseId: "hard_block_routing",
    remediationAction: "/intelligence",
  }));

  const n8nStatus = n8nBundle.latestStatus;
  const n8nSyncFailed = n8nStatus === "failed" || n8nStatus === "error";
  records.push(buildRecord({
    moduleKey: "n8n_catalog",
    route: "/automation",
    backendSurface: "n8n_template_entries|n8n_template_sync_runs",
    state: n8nBundle.entryCount > 0
      ? (n8nSyncFailed ? "degraded" : "connected")
      : "simulated",
    reasonCode: n8nBundle.entryCount > 0
      ? (n8nSyncFailed ? "n8n_sync_failed" : "n8n_catalog_synced")
      : "n8n_db_empty_seed_fallback",
    reasonText: n8nBundle.entryCount > 0
      ? `Template entries=${n8nBundle.entryCount}${n8nStatus ? `; latest sync status=${n8nStatus}` : ""}.`
      : "No n8n templates in DB; frontend seed fallback is expected in code-first mode.",
    lastSuccessAt: n8nBundle.lastSuccessAt,
    correlationId: governanceBundle.latestCorrelationId,
    smokeCaseId: "hard_block_routing",
    remediationAction: "npm run sync:n8n-templates",
  }));

  records.push(buildRecord({
    moduleKey: "marketplace",
    route: "/marketplace",
    backendSurface: "agent_registry|api_catalog_entries|n8n_template_entries",
    state: agentBundle.active > 0
      ? "connected"
      : (agentBundle.total > 0 ? "simulated" : "offline"),
    reasonCode: agentBundle.active > 0
      ? "marketplace_agents_active"
      : (agentBundle.total > 0 ? "marketplace_agents_inactive" : "marketplace_agents_missing"),
    reasonText: agentBundle.active > 0
      ? `Active agents=${agentBundle.active} of total=${agentBundle.total}.`
      : (agentBundle.total > 0
        ? `Agents detected (${agentBundle.total}) but none active.`
        : "No marketplace agents found."),
    lastSuccessAt: agentBundle.lastSuccessAt,
    correlationId: governanceBundle.latestCorrelationId,
    smokeCaseId: "hard_block_routing",
    remediationAction: "/marketplace",
  }));

  records.push(buildRecord({
    moduleKey: "simulation",
    route: "/simulation",
    backendSurface: "simulation-engine|simulation_runs",
    state: simulationBundle.total > 0
      ? (simulationBundle.failed > simulationBundle.passed ? "degraded" : "connected")
      : "simulated",
    reasonCode: simulationBundle.total > 0
      ? (simulationBundle.failed > simulationBundle.passed ? "simulation_failures_high" : "simulation_runs_available")
      : "simulation_no_recent_runs",
    reasonText: simulationBundle.total > 0
      ? `Simulation runs=${simulationBundle.total}, passed=${simulationBundle.passed}, failed=${simulationBundle.failed}.`
      : "No recent simulation runs; simulation layer ready but idle.",
    lastSuccessAt: simulationBundle.lastSuccessAt,
    correlationId: governanceBundle.latestCorrelationId,
    smokeCaseId: "ag2_c6_synthetic",
    remediationAction: "/simulation",
  }));

  if (warnings.length > 0) {
    records.push(buildRecord({
      moduleKey: "readiness_observability",
      route: "/control-tower",
      backendSurface: "control-plane:ecosystem_readiness",
      state: "degraded",
      reasonCode: "readiness_partial_warnings",
      reasonText: warnings[0],
      lastSuccessAt: generatedAt,
      correlationId: governanceBundle.latestCorrelationId,
      smokeCaseId: null,
      remediationAction: "/control-tower?tab=readiness",
    }));
  }

  return {
    generated_at: generatedAt,
    version: "1.0.0",
    overall_state: deriveOverallState(records),
    records,
    smokes: smokeBundle.smokes,
    failures: buildFailureRows(records),
    governance_metrics: governanceBundle.snapshot,
  };
}

export async function buildRunTraceView(input: BuildRunTraceInput): Promise<RunTraceView> {
  const correlationId = compact(input.correlationId);
  if (!correlationId) {
    throw new Error("correlation_id is required for run_trace.");
  }

  const orgId = await resolveOrgId(input.orgId || null, input.userId || null).catch(() => null);

  let eventQuery = admin
    .from("event_log")
    .select("id, event_type, status, source_agent, created_at, payload, metadata, correlation_id, pipeline_run_id, step_run_id, result")
    .eq("correlation_id", correlationId)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (orgId) eventQuery = eventQuery.eq("org_id", orgId);
  const { data: eventRows, error: eventError } = await eventQuery;
  if (eventError) throw eventError;

  let runQuery = admin
    .from("pipeline_runs")
    .select("id, status, correlation_id, pipeline_template_id, created_at, updated_at, pipeline_templates(name, code_name)")
    .eq("correlation_id", correlationId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (orgId) runQuery = runQuery.eq("org_id", orgId);
  const { data: runRows, error: runError } = await runQuery;
  if (runError) throw runError;

  const runs = (runRows || []) as Array<Record<string, unknown>>;
  const runIds = runs.map((row) => compact(row.id)).filter(Boolean);

  let stepRows: Array<Record<string, unknown>> = [];
  if (runIds.length > 0) {
    let stepQuery = admin
      .from("pipeline_step_runs")
      .select("id, pipeline_run_id, step_key, status, error, started_at, finished_at, updated_at, input, output")
      .in("pipeline_run_id", runIds)
      .order("started_at", { ascending: true })
      .limit(1200);
    if (orgId) stepQuery = stepQuery.eq("org_id", orgId);
    const { data, error } = await stepQuery;
    if (error) throw error;
    stepRows = (data || []) as Array<Record<string, unknown>>;
  }

  const events = (eventRows || []) as Array<Record<string, unknown>>;
  const governanceDecisions = events.filter((event) => {
    const eventType = compact(event.event_type).toLowerCase();
    return eventType.includes("governance")
      || eventType === "tool_bus.blocked"
      || eventType === "tool_bus.awaiting_approval";
  }).map((event) => {
    const payload = asRecord(event.payload);
    const metadata = asRecord(event.metadata);
    return {
      id: compact(event.id),
      event_type: compact(event.event_type),
      status: compact(event.status || event.result) || "unknown",
      created_at: compact(event.created_at),
      source_agent: compact(event.source_agent) || null,
      reason: compact(payload.error || payload.reason || metadata.reason) || null,
      correlation_id: compact(event.correlation_id) || correlationId,
    };
  });

  const toolBusEvents = events.filter((event) => compact(event.event_type).startsWith("tool_bus.")).map((event) => {
    const payload = asRecord(event.payload);
    const metadata = asRecord(event.metadata);
    return {
      id: compact(event.id),
      event_type: compact(event.event_type),
      status: compact(event.status || event.result) || "unknown",
      created_at: compact(event.created_at),
      source_agent: compact(event.source_agent) || null,
      tool_code_name: compact(metadata.tool_code_name),
      summary: compact(payload.summary || payload.error || payload.status),
      correlation_id: compact(event.correlation_id) || correlationId,
    };
  });

  const primaryRun = runs[0] || null;
  const template = asRecord(primaryRun?.pipeline_templates);
  const workflowId = compact(template.code_name || template.name || primaryRun?.pipeline_template_id) || null;
  const finalStatus = compact(primaryRun?.status)
    || compact(toolBusEvents[toolBusEvents.length - 1]?.status)
    || "unknown";

  return {
    correlation_id: correlationId,
    run_id: compact(primaryRun?.id) || null,
    workflow_id: workflowId,
    steps: stepRows.map((row) => ({
      id: compact(row.id),
      pipeline_run_id: compact(row.pipeline_run_id),
      step_key: compact(row.step_key),
      status: compact(row.status) || "unknown",
      error: compact(row.error) || null,
      started_at: compact(row.started_at) || null,
      finished_at: compact(row.finished_at) || null,
      updated_at: compact(row.updated_at) || null,
      input: asRecord(row.input),
      output: asRecord(row.output),
    })),
    governance_decisions: governanceDecisions,
    tool_bus_events: toolBusEvents,
    final_status: finalStatus,
  };
}
