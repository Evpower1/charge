# Evpower Operations

The API serves this dashboard at `/operator/`. It uses the API on the same origin and has no build step or external JavaScript dependency.

Provision an administrator through the API's administrator CLI, then sign in with that account. Customer registration cannot grant operator access. No sample password is included.

The dashboard manages mobile charging requests, quotes, dispatch details and service status. Customers must pay a confirmed quote before dispatch unless the quote is explicitly zero. Published station information must be verified; charger availability comes from the protected telemetry integration and becomes unknown when reports are stale.

Operator sessions and rotating refresh tokens remain in page memory. Reloading or closing the page requires signing in again. Do not enter payment credentials or charger integration keys in this dashboard; configure them on the API server.

The location editor uses `GET /v1/admin/stations` to include unverified drafts. The API must serve `index.html`, `styles.css`, `app.js` and `assets/logo.png` under `/operator/`, with the existing security headers. All values received from the API are rendered as text; no untrusted HTML is inserted.
