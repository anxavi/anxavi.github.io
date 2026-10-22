# Google Cloud Gateway Scaffold Guide

## Local run

```bash
cp server/.env.example server/.env
npm run gateway
```

## Required configuration

- `CORS_ALLOWLIST` must be explicit origins (no wildcard).
- JWT validation is fail-closed (`JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_HS256_SECRET`).
- Cloud target fields are mandatory (`GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_REGION`, `VERTEX_MODEL`).

If config is missing, the gateway returns explicit error responses.

## Security boundaries

- No secrets in frontend or repository env files.
- Gateway does not trust client inventory as authorization proof.
- Until persistent identity-aware authorization, quotas/rate-limiting and trusted inventory ownership are implemented, this is **not production-ready**.
