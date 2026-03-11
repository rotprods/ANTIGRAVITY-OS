# OCULOPS OS — Error Log
> Log every significant failure so the remediation checklist can follow it.

---

## 2026-03-10 | Preview session
- `npx vercel --prod --yes` (and prior `--confirm`) both failed with `FetchError: getaddrinfo ENOTFOUND api.vercel.com` while fetching project/team data; deploy is still blocked until the host resolves.
- Playwright preview console shows repeated Supabase fetch errors: `ai-advisor`, `market-data`, `social-signals`, `messaging-dispatch`, `meta-business-discovery`, `tiktok-business-search`, `manychat-sync`, `banana-generate`, and `websocket` connections failing (remote functions unreachable without the missing secrets).
