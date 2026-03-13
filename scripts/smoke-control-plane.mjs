#!/usr/bin/env node

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const endpoint = `${SUPABASE_URL}/functions/v1/control-plane`;

async function call(action, body = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "apikey": SERVICE_ROLE,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

async function main() {
  const parse = await call("goal_parse", {
    goal_spec: {
      goal_text: "Launch a lead discovery campaign for legal firms in Madrid.",
      goal_type: "lead_discovery",
      goal_risk_level: "medium",
    },
  });

  const metrics = await call("metrics", {
    window_hours: 24,
  });

  console.log(JSON.stringify({
    ok: parse.status < 300 && metrics.status < 300,
    endpoint,
    actions: {
      goal_parse: parse,
      metrics,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
