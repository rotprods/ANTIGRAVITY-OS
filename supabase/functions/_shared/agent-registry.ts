/**
 * OCULOPS — Agent Registry v2
 *
 * Fuente de verdad de todos los agentes del sistema.
 * Define: skills permitidas, policy set, memory scope, escalation path.
 *
 * Usado por: policy-engine.ts, agent-brain-v2.ts
 */

export interface PolicySet {
  can_write_crm: boolean;
  can_send_external: boolean;   // emails, Telegram, WhatsApp
  can_call_agents: string[];    // agent code_names this agent may invoke
  can_delete: boolean;
  max_spend_per_run_usd: number;
  confidence_threshold: number; // 0–1, below this: ask user
  safe_mode: boolean;           // if true, no write operations
}

export interface MemoryScope {
  can_write: string[];          // memory namespaces
  can_read: string[];           // memory namespaces
  ttl_days: Record<string, number>; // namespace → TTL in days (0 = permanent)
}

export interface AgentRegistryEntry {
  code_name: string;
  display_name: string;
  type: "orchestrator" | "domain" | "execution" | "safety";
  hierarchy_level: 0 | 1 | 2 | 3; // 0=director, 1=copilot, 2=domain, 3=worker
  domain: string;
  goal_template: string;
  allowed_skills: string[];
  restricted_skills: string[];
  requires_approval_for: string[]; // skill names that need human approval
  policy_set: PolicySet;
  memory_scope: MemoryScope;
  escalation_path: string;    // agent code_name to escalate to
  retry_limit: number;
  timeout_ms: number;
  max_rounds: number;
  kpis: string[];
}

// ─── Risk levels per skill (0=safe, 4=critical) ──────────────────────────────
export const SKILL_RISK_LEVELS: Record<string, number> = {
  // Level 0 — reads, memory recalls
  fetch_external_data: 0,
  web_search: 0,
  fetch_url: 0,
  crm_query: 0,
  recall_memory: 0,
  metrics_query: 0,
  budget_check: 0,
  policy_check: 0,
  ui_read_state: 0,
  plan_write: 0,

  // Level 1 — low-risk writes, internal only
  store_memory: 1,
  crm_write_task: 1,
  create_signal: 1,
  audit_log_write: 1,
  reasoning_trace_store: 1,
  plan_step_advance: 1,
  workflow_status: 1,

  // Level 2 — moderate writes
  crm_write_contact: 2,
  crm_write_deal: 2,
  create_alert: 2,
  incident_create: 2,
  call_agent: 2,
  workflow_run: 2,
  ui_navigate: 2,
  generate_content: 2,

  // Level 3 — high risk, requires approval
  send_notification: 3,
  approval_request: 3,

  // Level 4 — critical (blocked by default)
  rollback_action: 4,
};

// ─── Agent Registry ───────────────────────────────────────────────────────────

export const AGENT_REGISTRY: Record<string, AgentRegistryEntry> = {

  nexus: {
    code_name: "nexus",
    display_name: "NEXUS Director",
    type: "orchestrator",
    hierarchy_level: 0,
    domain: "orchestration",
    goal_template: "Decompose complex goals into a multi-agent plan and coordinate execution",
    allowed_skills: [
      "plan_write", "plan_step_advance", "call_agent", "recall_memory",
      "store_memory", "audit_log_write", "reasoning_trace_store", "metrics_query",
    ],
    restricted_skills: [
      "crm_write_contact", "crm_write_deal", "send_notification",
      "crm_write_task", "create_alert", "rollback_action",
    ],
    requires_approval_for: [],
    policy_set: {
      can_write_crm: false,
      can_send_external: false,
      can_call_agents: ["atlas", "hunter", "oracle", "sentinel", "forge", "herald", "outreach", "cortex"],
      can_delete: false,
      max_spend_per_run_usd: 0.50,
      confidence_threshold: 0.70,
      safe_mode: false,
    },
    memory_scope: {
      can_write: ["plans", "episodic"],
      can_read: ["plans", "episodic", "procedural", "knowledge", "company"],
      ttl_days: { plans: 7, episodic: 90 },
    },
    escalation_path: "copilot",
    retry_limit: 1,
    timeout_ms: 60000,
    max_rounds: 3,
    kpis: ["plan_success_rate", "delegation_accuracy", "consolidation_quality"],
  },

  sentinel: {
    code_name: "sentinel",
    display_name: "SENTINEL Watchdog",
    type: "domain",
    hierarchy_level: 2,
    domain: "risk",
    goal_template: "Monitor system health and pipeline anomalies. Take corrective action where allowed.",
    allowed_skills: [
      "recall_memory", "crm_query", "metrics_query", "create_alert",
      "create_signal", "crm_write_task", "store_memory", "audit_log_write",
      "reasoning_trace_store", "incident_create", "web_search", "budget_check",
    ],
    restricted_skills: [
      "crm_write_contact", "crm_write_deal", "fetch_url", "rollback_action",
    ],
    requires_approval_for: ["send_notification"],
    policy_set: {
      can_write_crm: false,
      can_send_external: false,
      can_call_agents: [],
      can_delete: false,
      max_spend_per_run_usd: 0.15,
      confidence_threshold: 0.60,
      safe_mode: false,
    },
    memory_scope: {
      can_write: ["episodic", "knowledge"],
      can_read: ["episodic", "knowledge", "company", "market"],
      ttl_days: { episodic: 30, knowledge: 180 },
    },
    escalation_path: "nexus",
    retry_limit: 2,
    timeout_ms: 30000,
    max_rounds: 5,
    kpis: ["anomalies_detected", "false_positive_rate", "resolution_time_ms", "alerts_created"],
  },

  oracle: {
    code_name: "oracle",
    display_name: "ORACLE Intelligence",
    type: "domain",
    hierarchy_level: 2,
    domain: "market_intelligence",
    goal_template: "Analyze market conditions, competition, and generate actionable intelligence",
    allowed_skills: [
      "web_search", "fetch_external_data", "fetch_url", "store_memory",
      "recall_memory", "create_signal", "create_alert", "generate_content",
      "audit_log_write", "reasoning_trace_store", "crm_query", "metrics_query",
    ],
    restricted_skills: [
      "crm_write_contact", "crm_write_deal", "send_notification",
      "rollback_action",
    ],
    requires_approval_for: [],
    policy_set: {
      can_write_crm: false,
      can_send_external: false,
      can_call_agents: [],
      can_delete: false,
      max_spend_per_run_usd: 0.20,
      confidence_threshold: 0.65,
      safe_mode: false,
    },
    memory_scope: {
      can_write: ["knowledge", "market", "episodic"],
      can_read: ["knowledge", "market", "episodic", "company"],
      ttl_days: { knowledge: 180, market: 7, episodic: 90 },
    },
    escalation_path: "nexus",
    retry_limit: 2,
    timeout_ms: 45000,
    max_rounds: 6,
    kpis: ["signals_generated", "intel_accuracy", "sources_consulted", "market_coverage"],
  },

  herald: {
    code_name: "herald",
    display_name: "HERALD Briefing",
    type: "domain",
    hierarchy_level: 2,
    domain: "communications",
    goal_template: "Build and distribute the daily intelligence briefing to the team",
    allowed_skills: [
      "recall_memory", "crm_query", "fetch_external_data", "web_search",
      "generate_content", "audit_log_write", "reasoning_trace_store",
    ],
    restricted_skills: [
      "crm_write_contact", "crm_write_deal", "create_alert",
      "crm_write_task", "rollback_action",
    ],
    requires_approval_for: ["send_notification"],
    policy_set: {
      can_write_crm: false,
      can_send_external: true,  // Telegram briefing is its core function
      can_call_agents: [],
      can_delete: false,
      max_spend_per_run_usd: 0.15,
      confidence_threshold: 0.70,
      safe_mode: false,
    },
    memory_scope: {
      can_write: ["episodic"],
      can_read: ["knowledge", "market", "episodic", "company", "user"],
      ttl_days: { episodic: 30 },
    },
    escalation_path: "nexus",
    retry_limit: 1,
    timeout_ms: 30000,
    max_rounds: 4,
    kpis: ["briefings_sent", "delivery_time_ms", "sources_used", "content_quality"],
  },

  forge: {
    code_name: "forge",
    display_name: "FORGE Content",
    type: "domain",
    hierarchy_level: 2,
    domain: "content_ops",
    goal_template: "Generate high-quality content (emails, proposals, posts) with company context",
    allowed_skills: [
      "generate_content", "recall_memory", "web_search", "fetch_url",
      "store_memory", "audit_log_write", "reasoning_trace_store", "crm_query",
    ],
    restricted_skills: [
      "crm_write_contact", "crm_write_deal", "create_alert",
      "rollback_action",
    ],
    requires_approval_for: ["send_notification"],
    policy_set: {
      can_write_crm: false,
      can_send_external: false,
      can_call_agents: [],
      can_delete: false,
      max_spend_per_run_usd: 0.30,
      confidence_threshold: 0.70,
      safe_mode: false,
    },
    memory_scope: {
      can_write: ["procedural", "episodic"],
      can_read: ["procedural", "episodic", "company", "user", "knowledge"],
      ttl_days: { procedural: 0, episodic: 90 }, // 0 = permanent
    },
    escalation_path: "nexus",
    retry_limit: 2,
    timeout_ms: 45000,
    max_rounds: 5,
    kpis: ["content_pieces_generated", "approval_rate", "quality_score", "avg_tokens_used"],
  },

  atlas: {
    code_name: "atlas",
    display_name: "ATLAS Prospector",
    type: "domain",
    hierarchy_level: 2,
    domain: "prospecting",
    goal_template: "Find and qualify new business leads in target zones/sectors",
    allowed_skills: [
      "web_search", "fetch_external_data", "fetch_url", "crm_write_contact",
      "crm_write_task", "store_memory", "recall_memory", "create_signal",
      "audit_log_write", "reasoning_trace_store", "crm_query", "metrics_query",
    ],
    restricted_skills: [
      "crm_write_deal", "send_notification", "create_alert", "rollback_action",
    ],
    requires_approval_for: [],
    policy_set: {
      can_write_crm: true,
      can_send_external: false,
      can_call_agents: ["hunter"],
      can_delete: false,
      max_spend_per_run_usd: 0.25,
      confidence_threshold: 0.65,
      safe_mode: false,
    },
    memory_scope: {
      can_write: ["episodic", "knowledge"],
      can_read: ["episodic", "knowledge", "company", "procedural"],
      ttl_days: { episodic: 60, knowledge: 90 },
    },
    escalation_path: "nexus",
    retry_limit: 2,
    timeout_ms: 45000,
    max_rounds: 6,
    kpis: ["leads_found", "contacts_created", "qualification_accuracy", "zone_coverage"],
  },

  hunter: {
    code_name: "hunter",
    display_name: "HUNTER Qualifier",
    type: "domain",
    hierarchy_level: 2,
    domain: "lead_qualification",
    goal_template: "Research and qualify leads. Score them. Update CRM with findings.",
    allowed_skills: [
      "web_search", "fetch_url", "crm_query", "crm_write_deal",
      "crm_write_contact", "crm_write_task", "store_memory", "recall_memory",
      "audit_log_write", "reasoning_trace_store", "fetch_external_data",
    ],
    restricted_skills: [
      "send_notification", "create_alert", "rollback_action",
    ],
    requires_approval_for: [],
    policy_set: {
      can_write_crm: true,
      can_send_external: false,
      can_call_agents: ["forge", "outreach"],
      can_delete: false,
      max_spend_per_run_usd: 0.20,
      confidence_threshold: 0.70,
      safe_mode: false,
    },
    memory_scope: {
      can_write: ["episodic", "knowledge"],
      can_read: ["episodic", "knowledge", "company", "procedural"],
      ttl_days: { episodic: 60, knowledge: 90 },
    },
    escalation_path: "nexus",
    retry_limit: 2,
    timeout_ms: 45000,
    max_rounds: 6,
    kpis: ["leads_qualified", "score_accuracy", "deals_created", "pipeline_value_added"],
  },

  outreach: {
    code_name: "outreach",
    display_name: "OUTREACH Communications",
    type: "domain",
    hierarchy_level: 2,
    domain: "communications",
    goal_template: "Orchestrate personalized outreach sequences. Never send without approval.",
    allowed_skills: [
      "recall_memory", "crm_query", "generate_content", "audit_log_write",
      "reasoning_trace_store", "crm_write_task", "store_memory",
    ],
    restricted_skills: [
      "crm_write_contact", "crm_write_deal", "rollback_action", "create_alert",
    ],
    requires_approval_for: ["send_notification"],
    policy_set: {
      can_write_crm: false,
      can_send_external: false,   // only after approval
      can_call_agents: ["forge"],
      can_delete: false,
      max_spend_per_run_usd: 0.20,
      confidence_threshold: 0.80,
      safe_mode: false,
    },
    memory_scope: {
      can_write: ["episodic", "procedural"],
      can_read: ["episodic", "procedural", "user", "company", "knowledge"],
      ttl_days: { episodic: 90, procedural: 0 },
    },
    escalation_path: "nexus",
    retry_limit: 1,
    timeout_ms: 30000,
    max_rounds: 4,
    kpis: ["messages_drafted", "approval_rate", "response_rate", "conversion_rate"],
  },

  cortex: {
    code_name: "cortex",
    display_name: "CORTEX Orchestrator",
    type: "orchestrator",
    hierarchy_level: 1,
    domain: "orchestration",
    goal_template: "Orchestrate multi-agent pipelines for complex business workflows",
    allowed_skills: [
      "call_agent", "recall_memory", "store_memory", "crm_query",
      "audit_log_write", "reasoning_trace_store", "metrics_query", "plan_write",
    ],
    restricted_skills: [
      "crm_write_contact", "crm_write_deal", "send_notification", "rollback_action",
    ],
    requires_approval_for: [],
    policy_set: {
      can_write_crm: false,
      can_send_external: false,
      can_call_agents: ["atlas", "hunter", "oracle", "sentinel", "forge", "herald", "outreach"],
      can_delete: false,
      max_spend_per_run_usd: 0.50,
      confidence_threshold: 0.65,
      safe_mode: false,
    },
    memory_scope: {
      can_write: ["episodic", "procedural"],
      can_read: ["*"],
      ttl_days: { episodic: 30, procedural: 0 },
    },
    escalation_path: "nexus",
    retry_limit: 1,
    timeout_ms: 90000,
    max_rounds: 4,
    kpis: ["orchestrations_completed", "agent_coordination_success", "pipeline_throughput"],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getAgentEntry(codeName: string): AgentRegistryEntry | null {
  return AGENT_REGISTRY[codeName] ?? null;
}

export function isSkillAllowed(codeName: string, skill: string): boolean {
  const entry = AGENT_REGISTRY[codeName];
  if (!entry) return false;
  if (entry.restricted_skills.includes(skill)) return false;
  return entry.allowed_skills.includes(skill);
}

export function requiresApproval(codeName: string, skill: string): boolean {
  const entry = AGENT_REGISTRY[codeName];
  if (!entry) return true; // unknown agents require approval for everything
  return entry.requires_approval_for.includes(skill);
}

export function getSkillRiskLevel(skill: string): number {
  return SKILL_RISK_LEVELS[skill] ?? 1;
}
