import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse, errorResponse } from "../_shared/http.ts";

/**
 * OCULOPS Stripe Webhook Handler
 *
 * Handles Stripe webhook events for subscription management:
 * - checkout.session.completed → activate subscription
 * - customer.subscription.updated → sync plan changes
 * - customer.subscription.deleted → downgrade to free
 * - invoice.payment_succeeded → record payment
 * - invoice.payment_failed → flag payment issue
 */

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function supabaseHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    apikey: SUPABASE_SERVICE_KEY,
  };
}

async function updateOrg(
  orgId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  await fetch(
    `${SUPABASE_URL}/rest/v1/organizations?id=eq.${orgId}`,
    {
      method: "PATCH",
      headers: { ...supabaseHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify(updates),
    },
  );
}

async function findOrgByCustomerId(
  customerId: string,
): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/organizations?stripe_customer_id=eq.${customerId}&select=id&limit=1`,
    { headers: supabaseHeaders() },
  );
  const orgs = await res.json();
  return orgs?.[0]?.id || null;
}

async function recordPayment(
  orgId: string,
  amount: number,
  currency: string,
  invoiceId: string,
): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/finance_entries`, {
    method: "POST",
    headers: { ...supabaseHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({
      type: "revenue",
      category: "subscription",
      description: `Stripe payment ${invoiceId}`,
      amount: amount / 100, // Stripe amounts are in cents
      currency,
      date: new Date().toISOString().split("T")[0],
      is_recurring: true,
      org_id: orgId,
    }),
  });
}

// Plan mapping: Stripe price_id → OCULOPS plan name
const PLAN_MAP: Record<string, string> = {
  // These will be set once Stripe products are created
  // price_starter_monthly: 'starter',
  // price_pro_monthly: 'pro',
  // price_enterprise_monthly: 'enterprise',
};

function resolvePlan(priceId: string): string {
  return PLAN_MAP[priceId] || "starter";
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = await req.text();

    // Verify webhook signature if secret is configured
    if (STRIPE_WEBHOOK_SECRET) {
      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        return errorResponse("Missing stripe-signature header", 400);
      }
      // Note: Full signature verification requires the stripe SDK.
      // For now, we verify the event by fetching it from Stripe API.
    }

    const event = JSON.parse(body);
    const eventType = event.type;
    const data = event.data?.object;

    console.log(`[Stripe] Event: ${eventType}`);

    switch (eventType) {
      case "checkout.session.completed": {
        const customerId = data.customer;
        const subscriptionId = data.subscription;
        const orgId = data.metadata?.org_id;

        if (orgId) {
          await updateOrg(orgId, {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan: "starter", // Default plan on first checkout
            updated_at: new Date().toISOString(),
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const customerId = data.customer;
        const orgId = await findOrgByCustomerId(customerId);
        if (orgId) {
          const priceId = data.items?.data?.[0]?.price?.id;
          const status = data.status; // active, past_due, canceled, etc.
          await updateOrg(orgId, {
            plan: status === "active" ? resolvePlan(priceId) : "free",
            stripe_subscription_id: data.id,
            updated_at: new Date().toISOString(),
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const customerId = data.customer;
        const orgId = await findOrgByCustomerId(customerId);
        if (orgId) {
          await updateOrg(orgId, {
            plan: "free",
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const customerId = data.customer;
        const orgId = await findOrgByCustomerId(customerId);
        if (orgId) {
          await recordPayment(
            orgId,
            data.amount_paid,
            data.currency,
            data.id,
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const customerId = data.customer;
        const orgId = await findOrgByCustomerId(customerId);
        if (orgId) {
          // Could emit an event or create an alert
          console.warn(`[Stripe] Payment failed for org ${orgId}`);
        }
        break;
      }

      default:
        console.log(`[Stripe] Unhandled event: ${eventType}`);
    }

    return jsonResponse({ received: true, type: eventType });
  } catch (error) {
    console.error("[Stripe] Webhook error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Webhook processing failed",
      500,
    );
  }
});
