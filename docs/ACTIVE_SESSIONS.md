# ACTIVE SESSIONS — Multi-Instance Coordination
> OCULOPS | Updated on write by each Claude Code instance
> PURPOSE: Prevent file conflicts, duplicate work, and silent overwrites across simultaneous sessions.

---

## HOW TO USE THIS FILE

**On session start:** Add your entry under ACTIVE SESSIONS with the files you plan to touch.
**On session end / task complete:** Move your entry to COMPLETED and note what you did.
**Before editing any file:** Check LOCKED FILES. If it's listed, wait or coordinate.
**Rule:** Never edit a file another session has locked without clearing it first.

---

## ACTIVE SESSIONS

### SESSION A — Creative Factory (this file's author)
- **Started:** 2026-03-11
- **Branch:** main @ `b7422ed`
- **Focus:** Creative Factory — pipeline complete
- **Status:** IDLE (waiting for next task)
- **Files recently touched:**
  - `src/hooks/useCreativeAssets.js` ✅ done
  - `src/hooks/useCreativeBriefs.js` ✅ done
  - `src/hooks/useGenerativeMedia.js` ✅ done
  - `src/components/modules/CreativeStudio.jsx` ✅ done
  - `src/components/modules/CreativeStudio.css` ✅ done
  - `supabase/functions/agent-forge/index.ts` ✅ done
- **Do NOT touch (session A owns):** nothing currently locked

---

### SESSION B
- **Started:** —
- **Branch:** —
- **Focus:** —
- **Status:** unknown
- **Files locked:** —
- **Last update:** —

---

### SESSION C
- **Started:** —
- **Branch:** —
- **Focus:** —
- **Status:** unknown
- **Files locked:** —
- **Last update:** —

---

## LOCKED FILES
> Files currently being edited. Do not touch until lock is cleared.

| File | Locked by | Since | Reason |
|------|-----------|-------|--------|
| _(none)_ | — | — | — |

---

## COMPLETED THIS SESSION (2026-03-11)

| What | Files | Commit |
|------|-------|--------|
| Creative Factory — response key fix + video element | `useGenerativeMedia.js`, `CreativeStudio.jsx` | pre-commit |
| Creative Factory — DB persistence chain | `useCreativeAssets.js` | `b7422ed` |
| Creative Factory — DB briefs + auto-seed | `useCreativeBriefs.js` | `b7422ed` |
| Creative Factory — FORGE copy generation | `useGenerativeMedia.js`, `agent-forge/index.ts` | `b7422ed` |
| Creative Factory — FORGE UI button + AssetPreview + brief→deploy | `CreativeStudio.jsx`, `CreativeStudio.css` | `b7422ed` |
| Doctor fix — gitnexus re-indexed | — | — |

---

## SYSTEM STATE (last known good)

| Layer | Status | Detail |
|-------|--------|--------|
| Git branch | main | HEAD `b7422ed` |
| Vercel | LIVE | `antigravity-os-theta.vercel.app` |
| Supabase | LIVE | yxzdafptqtcvpsbqkmkm |
| Edge functions | ACTIVE | banana-generate, veo-generate, agent-forge redeployed |
| DB migrations | UP TO DATE | `db push` confirmed no pending |
| Build | ✅ clean | `built in 2.24s` |

---

## KNOWN SAFE ZONES (low conflict risk)
- `supabase/migrations/` — each session uses unique timestamp prefix, no conflict possible
- `supabase/functions/agent-*/` — each agent is isolated folder
- `src/components/modules/` — modules are isolated, low conflict unless same module
- `src/hooks/` — hooks are isolated files

## HIGH CONFLICT RISK (coordinate before touching)
- `src/App.jsx` — routing, lazy imports, shared layout logic
- `src/styles/tokens.css` — design system source of truth
- `src/styles/global.css` — shared component classes
- `src/lib/supabase.js` — shared client + CRUD helpers
- `CLAUDE.md` — project brain, merge carefully
- `package.json` — dep changes need coordination
