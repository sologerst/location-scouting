# Miami-Dade County Property Owner Lookup

Enter a Miami-Dade street address or 13-digit folio number → get the **owner of
record** from the county, then a **way to reach them**. Built for property /
location outreach.

Two data tiers, reflected in the UI:

- **Verified (teal)** — Miami-Dade County Property Appraiser. Owner name +
  mailing address are public record. Live, authoritative, zero config.
- **Enriched (amber)** — third-party skip-trace (phone/email). Probabilistic,
  confidence-scored, compliance-gated. Pluggable provider.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + Tailwind v4
- Vercel (hosting), Supabase (optional cache + search history)
- TypeScript throughout

## How it works

```
search (address | folio)
   └─ GET /api/owner   → Miami-Dade PA proxy (GetAddress / GetPropertySearchByFolio)
         └─ on match → POST /api/contact → skip-trace provider (gated)
```

The owner card and contact panel render independently — the verified owner
appears immediately while contacts resolve in their own panel.

- `src/lib/miami-dade.ts` — live county client (address + folio lookup)
- `src/lib/skiptrace.ts` — provider-agnostic contact enrichment (apify | mock)
- `src/lib/supabase.ts` — optional cache + history (no-op without env)
- `src/app/api/owner` · `src/app/api/contact` — the two routes
- `src/components/*` — search UI, owner card, contact panel

## Local development

```bash
npm install
cp .env.example .env.local   # owner lookup works with no keys
npm run dev                  # http://localhost:3000
```

Owner lookup is live out of the box. Contact enrichment defaults to `mock`
(sample data) until a real provider + compliance terms are settled.

## Environment

See `.env.example`. Owner lookup needs **nothing**. Optional:

| Var | Purpose |
|-----|---------|
| `SKIPTRACE_PROVIDER` | `apify` \| `mock` \| unset (→ "not configured") |
| `APIFY_TOKEN` | required when provider = apify |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | enable cache + history |

## Compliance

**Read [COMPLIANCE.md](./COMPLIANCE.md) before enabling enrichment or outreach.**
Owner data is public record; phone/email enrichment + outreach implicate FCRA,
TCPA/DNC, DPPA, and vendor ToS. The enrichment provider ships disabled by design.

## Status

- ✅ Front end — search, owner card, contact panel, parallel states, errors
- ✅ Backend — live owner lookup (address + folio); contact route with adapter
- ⏳ Data side (open) — pick + contract a skip-trace vendor; verify Miami-Dade
  match rates; build the DNC scrub; resolve LLC → human for entity owners
