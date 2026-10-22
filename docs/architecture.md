# ARACHNE Architecture (GitHub Pages + optional gateway)

## Implemented

- Frontend remains a single `index.html` React/Babel UI for GitHub Pages.
- Outfit engine extracted to testable modules in `src/engine/`:
  - `constants.js`: categories, intents, runtime defaults, heuristic weights.
  - `validation.js`: garment/context normalization + structured diagnostics.
  - `rules.js`: category coverage, thermal filtering/relaxation tracking, outfit hard checks.
  - `scoring.js`: deterministic heuristic scoring (formality, thermal, color, preferences, rotation, comfort).
  - `generator.js`: bounded combinational search with intent gating and dual-journey transition logic.
  - `contracts.js`: versioned request/response runtime contracts.
  - `provider.js`: local default provider + optional HTTPS remote adapter + strict revalidation.
- Server scaffold in `server/` separated from public UI files.

## Tested

- Node tests under `test/` validate engine contracts, invalid wardrobe/category cases, deterministic scoring, tweak behavior, dual journey, fallback, cancel, plus gateway auth/CORS/request checks.

## Pending / Not production-ready

- Real Vertex AI call implementation in gateway (currently explicit scaffold-only response).
- Persistent user/session storage.
- Reliable quotas/rate limiting.
- Trustworthy inventory authorization model (server must not trust client inventory claims).
- Hardening for production observability, key management, and abuse controls.
