import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, jsonResponse, errorResponse, readJson, requireBearerAuth } from "../_shared/http.ts";
import { admin } from "../_shared/supabase.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://oculops.com";
const STRIPE_API = "https://api.stripe.com/v1";

async function stripePost(path: string, params: Record<string, string>) {
  if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

async function stripeGet(path: string) {
  if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");
  const res = await fetch(`${STRIPE_API}${path}`, { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

async function createCheckout(orgId: string, priceId: string, userId: string) {
  const { data: org } = await admin.from("organizations").select("id, name, stripe_customer_id").eq("id", orgId).single();
  if (!org) throw new Error("Organization not found");

  let customerId = org.stripe_customer_id;
  if (!customerId) {
    const { data: { user } } = await admin.auth.admin.getUserById(userId);
    const customer = await stripePost("/customers", { email: user?.email || "", name: org.name || "", "metadata[org_id]": orgId });
    customerId = customer.id;
    await admin.from("organizations").update({ stripe_customer_id: customerId }).eq("id", orgId);
  }

  const session = await stripePost("/checkout/sessions", {
    customer: customerId, mode: "subscription",
    "line_items[0][price]": priceId, "line_items[0][quantity]": "1",
    success_url: `${APP_URL}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/billing?canceled=1`,
    "metadata[org_id]": orgId, "subscription_data[metadata][org_id]": orgId,
  });

  await admin.from("checkout_sessions").insert({ org_id: orgId, stripe_session_id: session.id, price_id: priceId, status: "pending" });
  return { checkout_url: session.url, session_id: session.id };
}

async function getPortal(orgId: string) {
  const { data: org } = await admin.from("organizations").select("stripe_customer_id").eq("id", orgId).single();
  if (!org?.stripe_customer_id) throw new Error("No Stripe customer for this org");
  const session = await stripePost("/billing_portal/sessions", { customer: org.stripe_customer_id, return_url: `${APP_URL}/billing` });
  return { portal_url: session.url };
}

async function getStatus(orgId: string) {
  const { data: org } = await admin.from("organizations").select("plan, plan_status, stripe_customer_id, stripe_subscription_id, trial_ends_at, current_period_end").eq("id", orgId).single();
  return { plan: org?.plan || "free", status: org?.plan_status || "inactive", has_stripe: !!org?.stripe_customer_id, trial_ends_at: org?.trial_ends_at, current_period_end: org?.current_period_end };
}

async function handleWebhook(req: Request) {
  if (!STRIPE_WEBHOOK_SECRET) return errorResponse("Webhook secret not configured", 500);
  const sig = req.headers.get("stripe-signature");
  if (!sig) return errorResponse("Missing stripe-signature", 400);

  const body = await req.text();
  const parts = sig.split(",").reduce((acc: Record<string, string>, part) => { const [k, v] = part.split("="); acc[k] = v; return acc; }, {});
  const payload = `${parts["t"]}.${body}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(STRIPE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("");
  const signatures = Object.entries(parts).filter(([k]) => k === "v1").map(([, v]) => v);
  if (!signatures.includes(expected)) return errorResponse("Invalid webhook signature", 400);

  const event = JSON.parse(body);
  const { error: logErr } = await admin.from("billing_events").insert({ event_type: event.type, stripe_event_id: event.id, payload: event.data?.object || {}, processed: false });
  if (logErr?.code === "23505") return jsonResponse({ received: true, duplicate: true });

  const obj = event.data?.object;
  switch (event.type) {
    case "checkout.session.completed":
      if (obj.metadata?.org_id) await admin.from("checkout_sessions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("stripe_session_id", obj.id);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      if (obj.metadata?.org_id) await admin.from("organizations").update({ stripe_subscription_id: obj.id, stripe_price_id: obj.items?.data?.[0]?.price?.id, plan: obj.items?.data?.[0]?.price?.nickname || "pro", plan_status: obj.status, current_period_end: new Date(obj.current_period_end * 1000).toISOString() }).eq("id", obj.metadata.org_id);
      break;
    case "customer.subscription.deleted":
      if (obj.metadata?.org_id) await admin.from("organizations").update({ plan: "free", plan_status: "canceled", stripe_subscription_id: null }).eq("id", obj.metadata.org_id);
      break;
  }

  await admin.from("billing_events").update({ processed: true }).eq("stripe_event_id", event.id);
  return jsonResponse({ received: true });
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  if (req.headers.get("stripe-signature")) return handleWebhook(req);

  const { userId, error: authError } = await requireBearerAuth(req);
  if (authError) return authError;

  try {
    const body = await readJson<{ action: string; org_id?: string; price_id?: string }>(req);
    switch (body.action) {
      case "create_checkout": {
        if (!body.org_id || !body.price_id) return errorResponse("org_id and price_id required");
        return jsonResponse(await createCheckout(body.org_id, body.price_id, userId!));
      }
      case "get_portal": {
        if (!body.org_id) return errorResponse("org_id required");
        return jsonResponse(await getPortal(body.org_id));
      }
      case "get_status": {
        if (!body.org_id) return errorResponse("org_id required");
        return jsonResponse(await getStatus(body.org_id));
      }
      default: return errorResponse(`Unknown action: ${body.action}`);
    }
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Billing engine error", 500);
  }
});
