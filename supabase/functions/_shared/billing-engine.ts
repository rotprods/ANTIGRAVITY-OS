/**
 * OCULOPS — Billing Engine
 * 
 * Centralized credit management for all AI operations.
 * Called by agent-brain.ts before/after every LLM invocation.
 * 
 * Usage:
 *   import { billing } from "../_shared/billing-engine.ts";
 *   
 *   // Before calling LLM:
 *   const budget = await billing.checkBudget(orgId);
 *   if (!budget.canProceed) throw new Error("No credits");
 *   
 *   // After LLM call:
 *   await billing.recordUsage({ orgId, provider, model, inputTokens, outputTokens, agentCode });
 */

import { admin } from "./supabase.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PricingTier {
  provider: string;
  model: string;
  action_type: string;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  cost_fixed: number;
  platform_margin_pct: number;
}

interface BudgetCheck {
  canProceed: boolean;
  availableCredits: number;
  billingMode: "managed" | "developer";
  customKeyAvailable: boolean;
  reason?: string;
}

interface UsageRecord {
  orgId: string;
  userId?: string;
  agentCode?: string;
  provider: string;
  model: string;
  actionType?: string;
  inputTokens?: number;
  outputTokens?: number;
  usedCustomKey?: boolean;
  metadata?: Record<string, unknown>;
}

// ─── Pricing cache (refreshed every 5 min) ───────────────────────────────────

let pricingCache: PricingTier[] = [];
let pricingCacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getPricing(): Promise<PricingTier[]> {
  if (Date.now() - pricingCacheAt < CACHE_TTL && pricingCache.length > 0) {
    return pricingCache;
  }
  const { data } = await admin
    .from("pricing_tiers")
    .select("provider, model, action_type, cost_per_1k_input, cost_per_1k_output, cost_fixed, platform_margin_pct")
    .eq("is_active", true);
  pricingCache = (data || []) as PricingTier[];
  pricingCacheAt = Date.now();
  return pricingCache;
}

// ─── Cost calculation ─────────────────────────────────────────────────────────

function calculateCost(
  tier: PricingTier,
  inputTokens: number,
  outputTokens: number,
): { credits: number; rawCostUsd: number } {
  if (tier.cost_fixed > 0) {
    // Fixed-cost actions (web search, API call)
    const raw = tier.cost_fixed;
    return { credits: raw, rawCostUsd: raw / (1 + tier.platform_margin_pct / 100) };
  }

  // Token-based pricing
  const inputCost = (inputTokens / 1000) * tier.cost_per_1k_input;
  const outputCost = (outputTokens / 1000) * tier.cost_per_1k_output;
  const total = inputCost + outputCost;

  // Minimum charge of 0.1 credits per call
  const credits = Math.max(0.1, Math.round(total * 100) / 100);
  const rawCostUsd = credits / (1 + tier.platform_margin_pct / 100);

  return { credits, rawCostUsd };
}

async function findTier(provider: string, model: string, actionType = "chat"): Promise<PricingTier | null> {
  const tiers = await getPricing();
  // Exact match first
  let tier = tiers.find(t => t.provider === provider && t.model === model && t.action_type === actionType);
  // Fallback: match provider + action type (for unknown models)
  if (!tier) tier = tiers.find(t => t.provider === provider && t.action_type === actionType);
  return tier || null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const billing = {

  /**
   * Check if org can proceed with an AI action.
   * Returns billing mode & whether custom key is available.
   */
  async checkBudget(orgId: string, provider?: string): Promise<BudgetCheck> {
    // Get credit balance
    const { data: balance } = await admin
      .from("credit_balances")
      .select("available_credits, billing_mode")
      .eq("org_id", orgId)
      .single();

    if (!balance) {
      // Auto-create for orgs that existed before the billing system
      await admin.rpc("add_credits", { p_org_id: orgId, p_amount: 100, p_is_purchase: false });
      return { canProceed: true, availableCredits: 100, billingMode: "managed", customKeyAvailable: false };
    }

    // Check for developer mode custom key
    let customKeyAvailable = false;
    if (balance.billing_mode === "developer" && provider) {
      const { data: key } = await admin
        .from("custom_api_keys")
        .select("id")
        .eq("org_id", orgId)
        .eq("provider", provider)
        .eq("is_active", true)
        .single();
      customKeyAvailable = !!key;
    }

    // In developer mode with a valid key, always allow
    if (customKeyAvailable) {
      return {
        canProceed: true,
        availableCredits: balance.available_credits,
        billingMode: balance.billing_mode,
        customKeyAvailable: true,
      };
    }

    // Managed mode: need credits
    if (balance.available_credits <= 0) {
      return {
        canProceed: false,
        availableCredits: 0,
        billingMode: balance.billing_mode,
        customKeyAvailable: false,
        reason: "No credits remaining. Add credits to continue.",
      };
    }

    return {
      canProceed: true,
      availableCredits: balance.available_credits,
      billingMode: balance.billing_mode,
      customKeyAvailable: false,
    };
  },

  /**
   * Record usage after a successful AI call. Deducts credits unless custom key was used.
   */
  async recordUsage(record: UsageRecord): Promise<{ creditsCharged: number; newBalance: number }> {
    const {
      orgId, userId, agentCode,
      provider, model, actionType = "chat",
      inputTokens = 0, outputTokens = 0,
      usedCustomKey = false, metadata = {},
    } = record;

    // Calculate cost
    const tier = await findTier(provider, model, actionType);
    let creditsCharged = 0;
    let rawCostUsd = 0;

    if (tier && !usedCustomKey) {
      const cost = calculateCost(tier, inputTokens, outputTokens);
      creditsCharged = cost.credits;
      rawCostUsd = cost.rawCostUsd;
    } else if (usedCustomKey) {
      // Developer mode: symbolic 0.1 credit fee for orchestration
      creditsCharged = 0.1;
    }

    // Log usage
    await admin.from("usage_logs").insert({
      org_id: orgId,
      user_id: userId || null,
      agent_code: agentCode || null,
      provider,
      model,
      action_type: actionType,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      credits_charged: creditsCharged,
      raw_api_cost_usd: rawCostUsd,
      used_custom_key: usedCustomKey,
      metadata,
    });

    // Deduct credits
    let newBalance = 0;
    if (creditsCharged > 0) {
      try {
        const { data } = await admin.rpc("deduct_credits", {
          p_org_id: orgId,
          p_amount: creditsCharged,
        });
        newBalance = data as number;
      } catch {
        // If deduction fails (insufficient), log but don't block (already executed)
        console.warn(`[billing] Failed to deduct ${creditsCharged} credits for org ${orgId}`);
      }
    }

    return { creditsCharged, newBalance };
  },

  /**
   * Get the custom API key for a provider (decrypted).
   * Returns null if not found or inactive.
   */
  async getCustomKey(orgId: string, provider: string): Promise<string | null> {
    const { data } = await admin
      .from("custom_api_keys")
      .select("encrypted_key")
      .eq("org_id", orgId)
      .eq("provider", provider)
      .eq("is_active", true)
      .single();

    // In Phase 1, keys are stored as-is (Supabase Vault handles encryption at rest)
    // In Phase 2, add AES-256-GCM decryption layer
    return data?.encrypted_key || null;
  },

  /**
   * Get usage summary for dashboard.
   */
  async getUsageSummary(orgId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: logs } = await admin
      .from("usage_logs")
      .select("agent_code, provider, model, credits_charged, total_tokens, created_at")
      .eq("org_id", orgId)
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (!logs?.length) return { totalCredits: 0, totalTokens: 0, byAgent: {}, byModel: {}, logs: [] };

    const totalCredits = logs.reduce((sum: number, l: Record<string, number>) => sum + (l.credits_charged || 0), 0);
    const totalTokens = logs.reduce((sum: number, l: Record<string, number>) => sum + (l.total_tokens || 0), 0);

    const byAgent: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    for (const l of logs) {
      byAgent[l.agent_code || "unknown"] = (byAgent[l.agent_code || "unknown"] || 0) + (l.credits_charged || 0);
      byModel[l.model] = (byModel[l.model] || 0) + (l.credits_charged || 0);
    }

    return { totalCredits, totalTokens, byAgent, byModel, logs: logs.slice(0, 100) };
  },
};
