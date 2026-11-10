# Evpower native app and API contract

Independent project; never change the published website, WordPress or digital cards. Native iOS/Android app uses Expo and a separately deployed Node 24 API with persistent SQLite storage (single API instance). Public release needs store accounts/signing, HTTPS API hosting, Chapa merchant credentials and verified charger data/feed. No live station availability or payments are invented.

## Transport

Base URL configured through `EXPO_PUBLIC_API_URL`, with `/v1` on every route below. JSON, camelCase. Errors: `{error:{code,message,fields?}}`. Lists: `{items:[...]}`. Bearer access token; refresh token rotated on use. Access token 15 minutes, refresh 30 days. Never expose credentials or fund balances from the client. Money is integer Ethiopian birr minor units (100 = ETB 1).

## Types and endpoints

`User`: `{id,name,email,phone,role:'customer'|'admin',emailVerified,createdAt}`.

- `GET /v1/config`: `{name:'Evpower',currency:'ETB',serviceCities:['Addis Ababa','Adama'],paymentsEnabled,telemetryConfigured,isDemo,contact:{phone:'+251911049916',tollFree:'8890',email:'info@evpower.et',whatsapp:'+251911049916'}}`.
- `POST /v1/auth/register`: `{name,email,phone,password}` → `{accessToken,refreshToken,user}`.
- `POST /v1/auth/login`: `{email,password}` → same session shape.
- `POST /v1/auth/refresh`: `{refreshToken}` → rotated session shape.
- `POST /v1/auth/logout`: `{refreshToken}`; revoke refresh family.
- `POST /v1/auth/password-reset`: `{email}` → generic message; no token exposed in HTTP response.
- `POST /v1/auth/password-reset/complete`: `{token,password}`.
- `POST /v1/auth/verify-email`: `{token}`; `POST /v1/auth/resend-verification` requires auth.
- `GET /v1/me` → User; `PATCH /v1/me` `{name,phone}` → User.
- `DELETE /v1/me` `{password}` → delete/anonymize account and revoke sessions; reject nonzero service credit or in-progress service with useful support instructions.

`Vehicle`: `{id,make,model,plate,connector,batteryKwh}`; connector one of `CCS2`, `Type2`, `GB/T`, `CHAdeMO`. `GET /v1/vehicles`, `POST /v1/vehicles`, `PATCH /v1/vehicles/:id`, `DELETE /v1/vehicles/:id`. Customer ownership enforced.

`Address`: `{id,label,address,latitude,longitude}`. Coordinates nullable together. `GET /v1/addresses`, `POST /v1/addresses`, `DELETE /v1/addresses/:id`.

`Station`: `{id,name,city,address,latitude,longitude,verified,isDemo,connectors,availableCount,totalCount,availabilityUpdatedAt}`. Connector: `{id,type,powerKw,status,lastSeenAt}`. Status `available|charging|faulted|offline|unknown`; stale (>120 seconds) and absent telemetry always `unknown`. `GET /v1/stations` public, lists verified configured locations only (demo data clearly marked). No production seed stations.

`Booking`: `{id,reference,status,city,address,latitude,longitude,connector,requestedKwh,scheduledAt,notes,vehicleId,quoteMinor,paymentStatus,dispatchName,dispatchPhone,createdAt,updatedAt,events}`. Nulls allowed for optional data. Status `requested|confirmed|en_route|arrived|charging|completed|cancelled`. Payment `unpaid|paid|refunded`. Event `{status,message,at}`. Quote initially null, set by operator; no fabricated price or ETA.

- `GET /v1/bookings`; `GET /v1/bookings/:id` → Booking.
- `POST /v1/bookings` `{city,address,latitude?,longitude?,connector,requestedKwh,scheduledAt?,notes?,vehicleId?}`; `Idempotency-Key` required, generated UUID. Returns Booking. Validate service city, future schedule, ownership and sane energy/coordinates.
- `POST /v1/bookings/:id/cancel` allowed before charging; refund paid service credit atomically.
- `POST /v1/bookings/:id/pay` debits quoted total atomically once from customer's service credit. Idempotent; insufficient funds fails with no debit. Operator dispatch requires paid quote (or explicit zero quote).

`GET /v1/wallet`: `{balanceMinor,currency:'ETB',paymentsEnabled,transactions:[{id,kind,amountMinor,balanceAfterMinor,reference,createdAt}],pendingTopups:[{id,reference,status,checkoutUrl,createdAt}]}`. Pending payments can be recovered after leaving the wallet or relaunching. Ledger is append-only; credit only after provider verification; no peer transfers or fake credits.

- `POST /v1/wallet/topups` `{amountMinor}` → `{id,reference,checkoutUrl,status}`; Chapa-hosted checkout. Disabled when merchant configuration unavailable.
- `POST /v1/wallet/topups/:id/verify` → `{status}`; verify reference, exact ETB amount and currency with Chapa before idempotent credit.
- `POST /v1/payments/chapa/webhook` verifies signature then fetches provider transaction before credit. Return URL never credits funds itself.

`Notification`: `{id,title,message,readAt,createdAt}`. `GET /v1/notifications`, `POST /v1/notifications/:id/read`. In-app notifications for booking/payment changes. Poll while foreground; do not claim device push without configured delivery.

`POST /v1/support` `{subject,message}` → `{id,status:'open'}`. Contact support uses company number/email; no outbound messages sent by build/test.

## Operations and charger connection

Admin bearer session requires real admin role (provisioned by CLI, never signup body).

- `GET /v1/admin/overview` → `{customers,activeBookings,totalBookings,stations,bookings:[Booking],tickets:[{id,name,email,subject,message,status,createdAt}]}`.
- `GET /v1/admin/bookings` → `{items:[Booking]}`.
- `GET /v1/admin/stations` → `{items:[Station]}`, including unverified drafts for operators.
- `PATCH /v1/admin/bookings/:id` `{status?,quoteMinor?,dispatchName?,dispatchPhone?,note?}` → Booking; enforce transitions and payment before dispatch/charging. Append events, notify customer.
- `POST /v1/admin/stations` `{name,city,address,latitude,longitude,verified,connectors:[{id,type,powerKw}]}` → Station. `PATCH /v1/admin/stations/:id` same partial fields.
- `POST /v1/integrations/charger-status`: separate `Authorization: Bearer TELEMETRY_INGEST_KEY`; `{eventId,stationId,connectorId,status,observedAt}`. Real provider/gateway adapter only. Reject invalid/unknown mapping, replay and future timestamps; never regress newer status. No OCPP protocol implementation implied.

API serves operator static files at `/operator/`, privacy/support/account-deletion pages as public release URLs. Health endpoint `/health`. No public admin password, access token or environment secret in bundles, logs, ZIPs or repository. Tests use temporary DBs and injected Chapa/mailer adapters, never real charges. Native credentials in SecureStore; web preview uses memory only. Empty states must work with no configured stations, no quotes and disabled payments.
