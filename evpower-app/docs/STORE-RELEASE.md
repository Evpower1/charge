# Evpower · iPhone and Android release

This project contains an Expo React Native app, a separate API and an operator dashboard. It does not create Apple, Google or Expo accounts, sign a native binary, publish a listing or connect physical chargers by itself. A JavaScript export, source ZIP or web preview is **not** an installable `.ipa`, `.apk` or `.aab`.

The user confirmed that developer accounts and a charger management connection are not set up yet. Complete the connections below before calling the service live.

## Launch connections

| Connection | Required action |
| --- | --- |
| Apple | Enrol in the [Apple Developer Program](https://developer.apple.com/programs/) under the intended owner. Create the App Store Connect app, complete identity/business verification and arrange signing and agreements. |
| Google | Create the [Google Play developer account](https://play.google.com/console/signup), complete verification, create the app and satisfy the testing steps required for that account. |
| Expo/EAS | Create an Expo account, link an EAS project and configure the build environment. Keep signing credentials in the provider's credential system. |
| API hosting | Deploy the Node 24 API behind HTTPS with durable private storage. The SQLite deployment supports a **single API instance** with a persistent volume; an ephemeral build directory or GitHub Pages cannot host it. |
| Operations | Provision an admin through the API CLI. Confirm actual service cities, pickup coverage, quote rules, dispatch procedures and cancellation/refund handling. |
| Payments | Complete Chapa merchant setup. Test hosted checkout and server verification with test credentials, then configure the approved production credentials and webhook secret on the API server. |
| Email | Configure the API mail provider so password-reset and email-verification messages can be delivered. Confirm the sender and support inbox are monitored. |
| Stations | Add verified station coordinates, connector IDs, connector types and power ratings through the operator dashboard. No production station inventory is assumed. |
| Charger status | Connect a trusted charger management system or gateway to the telemetry endpoint. Until a current feed exists, status stays **unknown**. |
| Public pages | Publish and review the privacy, support and account-deletion pages on the API domain. They must open without an account. |

No store fee, review time or approval is promised. Use the requirements shown in the current Apple and Google consoles when enrolling and submitting.

## 1. Prepare and verify the backend

Read `api/README.md` and `.env.example` for the exact environment names and deployment commands. The API and operator files need to be included together in the deployment.

From `evpower-app/api`:

```sh
npm ci
npm test
```

Configure the production public URL, database path, allowed browser origins, email transport, payment secrets and telemetry ingestion secret on the server. Run the documented admin CLI; never place an admin password in the mobile app, source archive or store review notes.

Before release, verify:

- `/health` responds over HTTPS and survives a service restart.
- `/operator/` requires a real admin sign-in for protected data and actions.
- Registration, email verification, sign-in, token refresh, password reset and account deletion work against the deployed API.
- Two customers cannot read or change each other's bookings, vehicles, addresses, credit or notifications.
- A request is shown as requested until an operator confirms a quote. Dispatch and charging follow the permitted payment and status rules.
- Duplicate requests, payment callbacks or payment checks do not create duplicate bookings or credit.
- A failed or unverified payment does not credit the wallet. The exact reference, ETB currency and amount are verified server-side.
- Backups are private and recoverable. Storage remains present across deployments. Finalize the company's retention and deletion process before publishing the privacy notice.

The app uses Evpower service credit for charging bookings. It does not implement peer transfers, cash withdrawals or a general-purpose bank wallet. Explain any payment-review or staging arrangements to the store reviewer; do not create hidden production bypasses or let review requests dispatch a real service unintentionally.

### Operator onboarding

1. Create the intended staff admin with the documented `npm run admin` CLI. Sign in at the deployed API's `/operator/` page. Use individual authorized accounts; do not distribute one password inside the app.
2. Add real station names, addresses, coordinates and connector specifications. Check those details on site before marking a station verified. Verification lists a location; it does not manufacture live connector status.
3. Use a customer test account to submit a request. From Operations, check its pickup details, set the actual service quote and confirm it. Check that the customer sees the same reference and quote.
4. After the booking is paid, enter the dispatch contact and move through the permitted service states. Confirm that the customer's Activity and in-app notifications reflect those changes. Do not mark a job completed until it is completed operationally.
5. Review support requests, pending payment questions and deletion requests with the team. Document who handles refunds, identity checks, retained records and service interruptions before accepting public bookings.

## 2. Connect station status

`POST /v1/integrations/charger-status` accepts authenticated status events from a trusted server-side adapter. See `CONTRACT.md` and the API README for its body and authentication.

This endpoint is **not an OCPP server**. Do not enter its HTTP address into a charger's OCPP configuration. A charger management system or OCPP gateway must translate its own verified station/connector events into the API format. The integration credential stays on that trusted system, never in the mobile bundle.

Test available, charging, faulted and offline states using actual mapped station and connector IDs. Stop the feed and confirm that freshness expires to unknown. This release does not implement remote charger start/stop, live vehicle battery state, driver GPS tracking or device push delivery. In-app booking and payment updates are delivered through foreground refresh; do not advertise those other features as included.

## 3. Link Expo and configure the app

From `evpower-app/mobile`:

```sh
npm ci
npx eas-cli@latest login
npx eas-cli@latest init
```

Link the intended Evpower project. The dynamic `app.config.ts` reads `EAS_PROJECT_ID`; set it to the project ID supplied by Expo. It also reads `EXPO_PUBLIC_API_URL`. That value is a public backend URL, **not a secret**. Never use an `EXPO_PUBLIC_` variable for a Chapa key, database credential or admin password.

Use your real HTTPS API URL in the EAS preview and production environments. For example, replace both placeholders below with your own values:

```sh
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://YOUR-API-HOST --visibility plaintext
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_URL --value https://YOUR-API-HOST --visibility plaintext
```

Set `EAS_PROJECT_ID` for the commands/configuration as needed. Do not publish with `localhost`, an emulator IP, a temporary development tunnel or a sample domain. The production config rejects a missing or non-HTTPS API URL.

The proposed identifiers are `et.evpower.app` for both platforms. Confirm that the intended accounts can register these identifiers before the first store build; after release, changing them creates a different app. Confirm the display name, logo rights, version and signing owner. `eas.json` uses remote version management and production auto-increment.

Run the local checks and exports:

```sh
npm run typecheck
npm run export:web
npm run export:native
```

These exports verify bundling; they do not produce signed store binaries or prove that native permissions and checkout behave correctly on real devices.

## 4. Build installable test versions

An Android internal preview can be distributed as an APK:

```sh
npx eas-cli@latest build --platform android --profile preview
```

The EAS build page provides the finished APK when the build succeeds. A tester must allow installation from that source. Do not label a ZIP, HTML file or JavaScript export as an APK.

For iPhone testing through TestFlight, create a production iOS build and upload it to the intended App Store Connect app:

```sh
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production
```

Complete the signing and app-selection prompts using the owner's Apple account or its authorized App Store Connect access. Submission uploads the binary; it does not automatically make it public. Add TestFlight testers and complete any required beta review. A normal iPhone cannot install an unsigned IPA downloaded from this chat.

For Google Play, create the Android production App Bundle:

```sh
npx eas-cli@latest build --platform android --profile production
```

Upload the resulting `.aab` to a Play testing track, or configure authorized Play submission and use `eas submit`. Complete the testing and release requirements shown for the developer account before applying for production access.

## 5. Test on physical devices

Use at least one current iPhone and Android phone, including a narrow screen and a tablet if tablet support remains enabled.

- Register a new customer, verify email, sign out/in, restart the app, reset the password and confirm old sessions are revoked where expected.
- Deny location permission and complete a manual-address request. Then grant foreground location and confirm the correct pickup coordinates. Background location is not requested.
- Create a vehicle and address, submit one request, restart, and confirm its reference and status persist.
- Quote and confirm from Operations, pay once, dispatch, update arrival/charging/completion and inspect customer history and notifications.
- Test cancellation before charging and confirm a paid booking is credited back once. Test insufficient credit without a partial debit.
- Exercise Chapa return, pending payment, provider error, cancellation and repeated verification. Confirm the app never assumes the checkout screen alone means payment succeeded.
- Turn off connectivity during requests and payment checks. Show a useful error and prevent repeated taps from creating duplicates.
- Confirm live station data is from the equipment feed, and becomes unknown after stale data. No sample location may be mistaken for an operating production station.
- Test large text, screen-reader labels, keyboard focus, readable contrast and permission explanations.
- Delete an eligible test account from Account. Test that deletion with unresolved credit or an active service directs the customer to support. Verify the external email deletion request is handled by the team.

## 6. Public URLs and listing material

After deployment, use these **real, publicly reachable API-host URLs** in the store consoles:

| Purpose | Path |
| --- | --- |
| Privacy policy | `https://YOUR-API-HOST/privacy` |
| Support | `https://YOUR-API-HOST/support` |
| Web account-deletion instructions | `https://YOUR-API-HOST/account-deletion` |

`YOUR-API-HOST` is a placeholder, not a published link. The API serves files from `docs/public/` and the shared `/release-pages.css` stylesheet. Check every route in an incognito browser on a mobile network. The company must review the wording, data retention, provider list and support process before making these pages its live policy.

Suggested listing copy, to verify against launch coverage:

**Name:** Evpower

**Subtitle / short description:** EV charging, wherever you are.

**Description:**

> Keep your electric journey moving with Evpower. Request mobile EV charging, manage your charging requests and find configured Evpower charging stations from one account.
>
> • Request a charge with your address, connector and energy needs.
> • Follow operator confirmation, quotes and service updates.
> • Find verified station locations and view current connector status when a live feed is available.
> • Manage vehicles, pickup addresses and charging history.
> • Use Evpower service credit for bookings, with hosted Chapa checkout when enabled.
> • Contact the Evpower team for assistance.
>
> Service coverage, dispatch and charger availability depend on the location and current operations. A submitted request requires confirmation. Location access is optional; you can enter an address manually.

Suggested categories: Apple **Navigation** or **Travel**; Google Play **Maps & Navigation**, subject to the consoles' current choices and actual launch focus. Suggested keywords: `EV,charging,Ethiopia,Evpower,mobile charging,charge station,electric vehicle`.

Capture store screenshots from the finished native build using non-personal test data. Show Home, booking, station status with truthful data labels, Activity and Account/service credit. Match required device sizes in the current consoles. Do not use mock screenshots to imply unavailable chargers or an already approved payment connection.

## 7. Privacy and review declarations

Prepare the current App Store privacy labels, Play Data safety answers, age/content rating, support contact, app-access instructions and export-compliance answers from the **deployed build and every included SDK**. The table below is a starting inventory, not a completed declaration:

| Data / capability | This implementation |
| --- | --- |
| Account identity and contact | Name, email, phone; linked to the account for account/service functions. |
| Vehicle / address / booking content | Saved vehicle and pickup details, booking notes, quotes and service history. |
| Location | Optional foreground coordinates for a selected pickup/nearby lookup; booking coordinates are submitted with a request. No background location permission. |
| Payments | Amount, ETB currency, provider reference and service-credit ledger; checkout is handled by Chapa. No card/PIN fields in the app. Review Chapa's current collection and sharing separately. |
| Support and security | Support messages, account/session records and operational records needed by the deployed service. Review hosting/email logging and retention. |
| Credentials on device | Native refresh credential in SecureStore; web-preview session is memory-only. |
| Advertising / tracking / analytics | No advertising or analytics SDK is intentionally included by this project. Recheck dependencies and release settings before answering store questions. |

Charging is a physical service and this project uses provider-hosted payments rather than App Store/Play in-app purchases. Confirm the current payment rules and how service credit may be presented before submission. Do not assert approval or exemption in the listing without that review.

Provide a dedicated customer review account and clear steps for the reviewer to see bookings, stations, account management and deletion. Keep operator/admin credentials private. Explain any launch constraints truthfully; do not rely on unavailable external hardware or undocumented bypasses to make review succeed.

## Release record

For each store submission, retain the source commit, API version, successful test results, EAS build IDs, version/build numbers, signing owner, deployed public URLs and the exact store declarations. Publish only after the account owner has reviewed the working build and completed the store's release steps. Neither a successful EAS build nor an uploaded binary guarantees store acceptance.
