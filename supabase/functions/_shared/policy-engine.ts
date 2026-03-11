/**
 * OCULOPS — Policy Engine
 *
 * Verifica si un agente tiene permiso para ejecutar una skill,
 * dado su registro y el nivel de riesgo de la acción.
 *
 * Usage:
 *   import { checkPolicy } from "../_shared/policy-engine.ts";
 *   const { allowed, risk_level, reason } = await checkPolicy("sentinel", "create_alert", { ... });
 */

import { admin } from "./supabase.ts";
import {
  AGENT_REGISTRY,
  SKILL_RISK_LEVELS,
  isSkillAllowed,
  requiresApproval,
  getSkillRiskLevel,
} from "./agent-registry.ts";

export interface PolicyResult {
  allowed: boolean;
  risk_level: number;
  reason: string;
  requires_approval: boolean;
}

// ─── Main policy check ────────────────────────────────────────────────────────

export async function checkPolicy(
  agent: string,
  skill: string,
  _payload: Record<string, unknown> = {},
): Promise<PolicyResult> {

  const entry = AGENT_REGISTRY[agent];

  // Unknown agent
  if (!entry) {
    return {
      allowed: false,
      risk_level: 4,
      reason: `Agent '${agent}' not found in registry`,
      requires_approval: false,
    };
  }

  // Safe mode: no write operations
  if (entry.policy_set.safe_mode && getSkillRiskLevel(skill) >= 1) {
    return {
      allowed: false,
      risk_level: getSkillRiskLevel(skill),
      reason: `Agent '${agent}' is in safe_mode — writes are disabled`,
      requires_approval: false,
    };
  }

  // Explicitly restricted
  if (entry.restricted_skills.includes(skill)) {
    await writeAuditLog(agent, "policy_blocked", skill, 4, `Skill explicitly restricted for ${agent}`);
    return {
      allowed: false,
      risk_level: 4,
      reason: `Skill '${skill}' is explicitly restricted for agent '${agent}'`,
      requires_approval: false,
    };
  }

  // Not in allowed list
  if (!entry.allowed_skills.includes(skill)) {
    await writeAuditLog(agent, "policy_blocked", skill, 3, `Skill not in allowed list for ${agent}`);
    return {
      allowed: false,
      risk_level: getSkillRiskLevel(skill),
      reason: `Skill '${skill}' is not in allowed_skills for agent '${agent}'`,
      requires_approval: false,
    };
  }

  const riskLevel = getSkillRiskLevel(skill);
  const needsApproval = requiresApproval(agent, skill);

  // Critical skills (level 4) are always blocked
  if (riskLevel >= 4) {
    await writeAuditLog(agent, "policy_blocked", skill, 4, `Risk level 4 skill blocked`);
    return {
      allowed: false,
      risk_level: 4,
      reason: `Skill '${skill}' has risk level 4 — cannot be executed autonomously`,
      requires_approval: true,
    };
  }

  // High-risk skills not in approval list
  if (riskLevel >= 3 && !needsApproval) {
    return {
      allowed: false,
      risk_level: riskLevel,
      reason: `Skill '${skill}' has risk level ${riskLevel} but is not in requires_approval_for for agent '${agent}'`,
      requires_approval: false,
    };
  }

  // Check DB override (admin can toggle safe_mode per agent at runtime)
  const { data: dbEntry } = await admin
    .from("agent_registry")
    .select("safe_mode")
    .eq("code_name", agent)
    .maybeSingle();

  if (dbEntry?.safe_mode && riskLevel >= 1) {
    return {
      allowed: false,
      risk_level: riskLevel,
      reason: `Agent '${agent}' is in safe_mode (DB) — writes are disabled`,
      requires_approval: false,
    };
  }

  return {
    allowed: true,
    risk_level: riskLevel,
    reason: "OK",
    requires_approval: needsApproval,
  };
}

// ─── Anti-loop check ─────────────────────────────────────────────────────────
// Returns true if a loop is detected (same skill called > maxRepeats times)

export function detectLoop(
  skillHistory: Record<string, number>,
  skill: string,
  maxRepeats = 3,
): boolean {
  const count = (skillHistory[skill] || 0) + 1;
  skillHistory[skill] = count;
  return count > maxRepeats;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function writeAuditLog(
  agent: string,
  eventType: string,
  skill: string,
  riskLevel: number,
  reason: string,
): Promise<void> {
  await admin.from("audit_logs").insert({
    agent,
    event_type: eventType,
    skill,
    payload: { reason },
    risk_level: riskLevel,
  }).catch(() => {}); // never throw from audit logging
}
