# Validation record

Validated on 10 November 2026 using Node 24 and installed Chromium in the development environment.

- API: seven scenarios passed for authentication, refresh reuse, one-time actions, customer ownership, booking idempotency, payment/ledger concurrency, refunds, deletion guards, telemetry freshness and durable restart.
- Client: four scenarios passed for concurrent refresh, refresh after logout, temporary connectivity failures and serialized native credential storage. Platform storage is mocked in these unit tests.
- TypeScript checks passed. iOS and Android JavaScript/Hermes exports completed. Expo build fingerprint generation passed.
- The customer/operator browser journey passed registration, vehicles, addresses, mobile booking, quote confirmation, station editing, unknown availability, insufficient-credit protection, cancellation, support, login and account deletion. Narrow/mobile and desktop layouts were checked.
- Cold and already-open browser email links prefill verification/reset forms without consuming action tokens automatically. Token fragments are removed from the browser address after capture.
- Production build configuration rejects a missing HTTPS backend URL. Runtime dependency audits reported no known advisories after applying the pinned build-tool patches.
- Source ZIP contents and checksums are verified. Dependencies, caches, databases, real credentials and local customer fixtures are excluded.

All browser/API acceptance work used an isolated local database, disabled real payments and disabled outbound email. No customer was messaged and no physical charger was controlled.

This record does not establish physical-device compatibility, merchant approval, live charger connectivity, production hosting, signed native binaries or store approval. Those release checks require the intended developer accounts, real integrations and devices; follow STORE-RELEASE.md.
