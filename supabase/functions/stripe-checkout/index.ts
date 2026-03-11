import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { handleCors, jsonResponse, errorResponse, readJson } from "../_shared/http.ts";

/**
 * OCULOPS Stripe Checkout
 *
 * Creates Stripe Checkout sessions for subscription upgrades.
 * POST body: { plan: 'starter'|'pro'|'enterprise', org_id: string }
 * Returns: { url: string } — redirect URL to Stripe Checkout
 */

const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") || "";
const APP_URL = Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("APP_URL") || "https://oculops.vercel.app";

// Stripe price IDs — set these after creating products in Stripe Dashboard
const PRICE_IDS: Record<string, string> = {
  starter: Deno.env.get("STRIPE_PRICE_STARTER") || "price_placeholder_starter",
  pro: Deno.env.get("STRIPE_PRICE_PRO") || "price_placeholder_pro",
  enterprise: Deno.env.get("STRIPE_PRICE_ENTERPRISE") || "price_placeholder_enterprise",
};

async function stripeRequest(endpoint: string, body: Record<string, string>): Promise<unknown> {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stripe API error: ${res.status} ${err}`);
  }

  return await res.json();
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  if (!STRIPE_SECRET) {
    return errorResponse("Stripe not configured. Set STRIPE_SECRET_KEY in Supabase secrets.", 500);
  }

  try {
    const { plan, org_id } = await readJson<{ plan: string; org_id: string }>(req);

    if (!plan || !PRICE_IDS[plan]) {
      return errorResponse(`Invalid plan: ${plan}. Valid: ${Object.keys(PRICE_IDS).join(", ")}`, 400);
    }

    if (!org_id) {
      return errorResponse("org_id is required", 400);
    }

    const session = await stripeRequest("/checkout/sessions", {
      "mode": "subscription",
      "payment_method_types[]": "card",
      "line_items[0][price]": PRICE_IDS[plan],
      "line_items[0][quantity]": "1",
      "success_url": `${APP_URL}/billing?session_id={CHECKOUT_SESSION_ID}&status=success`,
      "cancel_url": `${APP_URL}/billing?status=cancelled`,
      "metadata[org_id]": org_id,
      "metadata[plan]": plan,
    }) as { url: string };

    return jsonResponse({ ok: true, url: session.url });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Checkout creation failed",
      500,
    );
  }
});
