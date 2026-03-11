#!/usr/bin/env python3
"""
OCULOPS Bridge — Agent-OS ↔ OCULOPS Integration

Bridges the local Agent-OS vault (414 agents) with OCULOPS cloud runtime.
Syncs agent manifest, maps vault agents to business roles, and enables
CLI-triggered agent actions that feed into OCULOPS event bus.

Usage:
    python scripts/oculops-bridge.py sync-manifest   # Copy manifest to public/data/
    python scripts/oculops-bridge.py map-roles        # Print role → agent mapping
    python scripts/oculops-bridge.py activate <role>  # Activate agents for OCULOPS role
    python scripts/oculops-bridge.py status           # Show bridge status
    python scripts/oculops-bridge.py emit <type> [payload_json]  # Emit event to OCULOPS
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

HOME = Path.home()
PROJECT_ROOT = Path(__file__).resolve().parent.parent
MANIFEST_SRC = HOME / "agent-os" / "registry" / "manifest.json"
MANIFEST_DST = PROJECT_ROOT / "public" / "data" / "agent-manifest.json"
AGENT_RUNTIME = HOME / "agent-os" / "router" / "agent_runtime.py"

# OCULOPS business role → vault capability mapping
ROLE_CAPABILITY_MAP = {
    "atlas":      ["research", "data-engineering", "web-scraping"],
    "hunter":     ["data-engineering", "web-scraping", "api-design"],
    "oracle":     ["data-engineering", "ml-ai", "data"],
    "forge":      ["content", "documentation", "copywriting"],
    "sentinel":   ["security", "research", "code-review"],
    "scribe":     ["documentation", "content", "reporting"],
    "strategist": ["orchestration", "research", "product"],
    "cortex":     ["orchestration", "ml-ai"],
}


def load_manifest() -> dict:
    if not MANIFEST_SRC.exists():
        print(f"ERROR: Manifest not found at {MANIFEST_SRC}")
        sys.exit(1)
    return json.loads(MANIFEST_SRC.read_text(encoding="utf-8"))


def sync_manifest():
    """Copy Agent-OS manifest to OCULOPS public/data/ for web access."""
    MANIFEST_DST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(MANIFEST_SRC, MANIFEST_DST)
    manifest = load_manifest()
    total = manifest.get("total_agents", len(manifest.get("agents", [])))
    canonical = manifest.get("canonical_count", total)
    namespaces = len(manifest.get("namespaces", []))
    print(f"Synced manifest: {total} agents ({canonical} canonical), {namespaces} namespaces")
    print(f"  src: {MANIFEST_SRC}")
    print(f"  dst: {MANIFEST_DST}")


def map_roles():
    """Print which vault agents map to each OCULOPS business role."""
    manifest = load_manifest()
    agents = [a for a in manifest.get("agents", []) if not a.get("is_alias")]

    for role, caps in ROLE_CAPABILITY_MAP.items():
        matched = []
        for agent in agents:
            agent_caps = agent.get("capabilities", [])
            overlap = [c for c in agent_caps if c in caps]
            if overlap:
                matched.append((agent["name"], agent["namespace"], overlap))

        print(f"\n{'=' * 60}")
        print(f"  {role.upper()} — capabilities: {', '.join(caps)}")
        print(f"  {len(matched)} compatible agents")
        print(f"{'=' * 60}")
        for name, ns, overlap in sorted(matched, key=lambda x: -len(x[2]))[:10]:
            print(f"  [{ns}] {name} — {', '.join(overlap)}")
        if len(matched) > 10:
            print(f"  ... and {len(matched) - 10} more")


def activate_for_role(role: str):
    """Activate vault agents that match an OCULOPS business role."""
    if role not in ROLE_CAPABILITY_MAP:
        print(f"ERROR: Unknown role '{role}'. Valid: {', '.join(ROLE_CAPABILITY_MAP.keys())}")
        sys.exit(1)

    caps = ROLE_CAPABILITY_MAP[role]
    manifest = load_manifest()
    agents = [a for a in manifest.get("agents", []) if not a.get("is_alias")]

    # Score agents by capability overlap
    scored = []
    for agent in agents:
        agent_caps = agent.get("capabilities", [])
        score = len([c for c in agent_caps if c in caps])
        if score > 0:
            scored.append((agent["name"], score, agent.get("context_cost", 0)))

    # Sort by score desc, then context cost asc — pick top 4 (slot limit)
    scored.sort(key=lambda x: (-x[1], x[2]))
    to_activate = [s[0] for s in scored[:4]]

    if not to_activate:
        print(f"No vault agents match role '{role}'")
        return

    print(f"Activating {len(to_activate)} agents for {role.upper()}:")
    for name in to_activate:
        print(f"  - {name}")

    # Call agent_runtime.py activate
    if AGENT_RUNTIME.exists():
        import subprocess
        result = subprocess.run(
            [sys.executable, str(AGENT_RUNTIME), "activate", *to_activate, "--task-id", f"oculops-{role}"],
            capture_output=True, text=True
        )
        print(result.stdout.strip())
        if result.returncode != 0:
            print(f"ERROR: {result.stderr.strip()}")
    else:
        print(f"WARNING: agent_runtime.py not found at {AGENT_RUNTIME}")


def bridge_status():
    """Show bridge status: manifest sync, active agents, runtime state."""
    # Manifest sync status
    src_exists = MANIFEST_SRC.exists()
    dst_exists = MANIFEST_DST.exists()
    in_sync = False
    if src_exists and dst_exists:
        src_mtime = MANIFEST_SRC.stat().st_mtime
        dst_mtime = MANIFEST_DST.stat().st_mtime
        in_sync = dst_mtime >= src_mtime

    print("OCULOPS BRIDGE STATUS")
    print("=" * 50)
    print(f"  Agent-OS manifest: {'FOUND' if src_exists else 'MISSING'}")
    print(f"  Web manifest:      {'FOUND' if dst_exists else 'MISSING'}")
    print(f"  Sync status:       {'UP TO DATE' if in_sync else 'STALE' if dst_exists else 'NOT SYNCED'}")

    if src_exists:
        manifest = load_manifest()
        print(f"  Total agents:      {manifest.get('total_agents', '?')}")
        print(f"  Canonical:         {manifest.get('canonical_count', '?')}")
        print(f"  Namespaces:        {len(manifest.get('namespaces', []))}")

    # Runtime status
    if AGENT_RUNTIME.exists():
        import subprocess
        result = subprocess.run(
            [sys.executable, str(AGENT_RUNTIME), "status"],
            capture_output=True, text=True
        )
        print(f"\nAGENT-OS RUNTIME:")
        print(result.stdout.strip())
    else:
        print(f"\n  Agent runtime: NOT FOUND ({AGENT_RUNTIME})")

    # OCULOPS env
    env_file = PROJECT_ROOT / ".env"
    if env_file.exists():
        env_text = env_file.read_text()
        has_supabase = "VITE_SUPABASE_URL=" in env_text
        has_n8n = "N8N_API_URL=" in env_text
        print(f"\nOCULOPS ENV:")
        print(f"  Supabase:  {'CONFIGURED' if has_supabase else 'MISSING'}")
        print(f"  n8n:       {'CONFIGURED' if has_n8n else 'MISSING'}")


def emit_event(event_type: str, payload_json: str | None):
    """Emit an event to OCULOPS event bus via Supabase edge function."""
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        print("ERROR: .env not found")
        sys.exit(1)

    env = {}
    for line in env_file.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()

    supabase_url = env.get("VITE_SUPABASE_URL") or env.get("SUPABASE_URL")
    anon_key = env.get("VITE_SUPABASE_ANON_KEY") or env.get("SUPABASE_ANON_KEY")

    if not supabase_url or not anon_key:
        print("ERROR: SUPABASE_URL or ANON_KEY not found in .env")
        sys.exit(1)

    payload = json.loads(payload_json) if payload_json else {}

    import urllib.request
    url = f"{supabase_url}/functions/v1/event-dispatcher"
    data = json.dumps({"event_type": event_type, "payload": payload}).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {anon_key}",
            "apikey": anon_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            print(f"Event dispatched: {event_type}")
            print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"ERROR dispatching event: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="OCULOPS Bridge — Agent-OS integration")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("sync-manifest", help="Copy Agent-OS manifest to public/data/")
    sub.add_parser("map-roles", help="Show vault agent → business role mapping")
    sub.add_parser("status", help="Show bridge status")

    act = sub.add_parser("activate", help="Activate vault agents for an OCULOPS role")
    act.add_argument("role", choices=list(ROLE_CAPABILITY_MAP.keys()))

    emit = sub.add_parser("emit", help="Emit event to OCULOPS event bus")
    emit.add_argument("event_type")
    emit.add_argument("payload", nargs="?", default=None)

    args = parser.parse_args()

    if args.command == "sync-manifest":
        sync_manifest()
    elif args.command == "map-roles":
        map_roles()
    elif args.command == "activate":
        activate_for_role(args.role)
    elif args.command == "status":
        bridge_status()
    elif args.command == "emit":
        emit_event(args.event_type, args.payload)


if __name__ == "__main__":
    main()
