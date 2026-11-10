# Evpower mobile charging app

A separate iPhone/Android application built with Expo React Native, a Node 24 API, and an operator dashboard. The website, WordPress theme and digital business cards remain separate projects.

Implemented: customer registration/sign-in/reset/verification/deletion, saved vehicles and pickup addresses, mobile charging requests, operator quotes and dispatch, activity timelines, in-app notifications, verified station discovery, charger-feed freshness, service-credit wallet with verified Chapa payments, support enquiries and public privacy/deletion pages.

The source runs locally and has been tested. **It is not published in the App Store or Google Play.** Apple/Google/Expo accounts and signing, production HTTPS API hosting, SMTP, a Chapa merchant connection, actual station records and a charger-management feed must be connected before release. No real charging equipment or payment credentials were exercised by the tests.

## Review locally

For a browser-only interactive demo without installing development tools, open **https://evpower1.github.io/charge/app-preview/** after the Pages deployment completes. Choose **Try demo account** to explore, **Advance demo booking** to try its timeline, and **Reset preview** to clear local preview data. Accounts, requests and support messages in this demo stay only in that browser. Payments are disabled and all station locations are labelled samples; no real charging team is requested.

The demo uses a separate browser-only data adapter. It never calls the real booking API, uses only the `evpower.browser-demo.v1` storage namespace, and is rejected by production store configuration. `npm run build:browser-demo` exports the dedicated static preview; it is not a production native or backend build. The local launcher below always disables that adapter and uses the actual local Node API instead.

For the quickest browser preview, install [Node.js 24 LTS](https://nodejs.org/), extract the source ZIP, open a terminal in its `evpower-app` folder, and run:

```sh
npm run preview
```

The launcher installs the locked dependencies, builds the browser UI and opens the real app at `http://127.0.0.1:4100/app/`. Keep the terminal open while testing. You can register a test customer, request a charge, browse labelled sample locations and use the operator dashboard at `/operator/`. Your generated operator email/password are in the local `.preview-data/operator-access.json` file. Stop with **Ctrl+C**. The first run needs internet for dependency installation.

This is a local development preview with its own private database. Real payments, email and charger integrations are disabled; requests do not dispatch a real team. It is not a public hosted app. On subsequent runs your local test data is preserved. The `.preview-data` folder is excluded from Git, source ZIPs and the deployment image. Developers can use `npm run preview -- --no-open` to skip opening a browser, or set `EVPOWER_PREVIEW_PORT` if port 4100 is occupied.

To try the whole sandbox journey, create a test customer and submit a request. In the operator dashboard, confirm that test request with a **0 ETB** quote; you can then advance it through dispatch, arrival, charging and completion without enabling payments. This zero-price walkthrough is for the local sandbox only.

For manual setup:

Use Node 24. In two terminals:

```sh
cd evpower-app/api
npm ci
cp .env.example .env
npm start
```

```sh
cd evpower-app/mobile
npm ci
EXPO_PUBLIC_API_URL=http://localhost:4100 npm run export:web
```

Open `http://localhost:4100/app/`. The operator dashboard is `http://localhost:4100/operator/`. The API serves the exported browser preview under `/app/`; the web export is a review version of the native UI, not an App Store installer.

Customer accounts can be created from the app. The server starts with no admin and no production stations. Provision the intended operator with the private-stdin command in [api/README.md](api/README.md). Local demo station fixtures require an explicit non-production `DEMO_MODE=true` and are labelled as samples. Payments are disabled by default even if an unrelated process environment contains a merchant key.

For Expo development, run `npm start` from `mobile/`. On a physical phone, configure `EXPO_PUBLIC_API_URL` with the development computer's reachable LAN address or a trusted HTTPS development endpoint; `localhost` points at the phone itself. For a trusted local network, also set the API's `HOST=0.0.0.0` and allow the development port through that computer's firewall. Keep this development server off the public internet. Android emulators can use `http://10.0.2.2:4100`. Restart Metro after changing the URL. The production build rejects a missing/non-HTTPS public API address.

## How service works

A customer requests mobile charging with a pickup point, connector, energy requirement and optional schedule. The request remains **requested** until an operator checks coverage and sets a quote. The customer pays that quote with verified service credit. The operator can then dispatch and update arrival, charging and completion. Cancellation before charging refunds a paid quote exactly once. Submitting a request does not imply an available vehicle or guarantee an arrival time.

The wallet is Evpower service credit, not a bank account or a transfer service. Its balance comes from an append-only server ledger. Checkout redirects never credit funds by themselves: the API verifies the provider reference, currency, exact amount and success first. Pending payments survive screen changes and can be rechecked. Merchant setup and a successful Chapa sandbox test are release prerequisites.

Stations are configured and verified by staff. Availability comes only from an authenticated charger-management adapter and becomes **unknown** without fresh observations. The feed endpoint is not an OCPP WebSocket server. The app does not implement remote charger start/stop, driver GPS tracking or device push delivery; customer status updates refresh while the app is in use.

## Checks

```sh
cd api && npm test
cd ../mobile && npm test && npm run typecheck
npm run export:web
npm run export:native
```

The API suite covers authorization, refresh reuse/reset, duplicate bookings, validated quotes/transitions, verified ledger credits, concurrent/double payments, atomic refunds, deletion guards, telemetry freshness and durable restarts. Client tests cover simultaneous refresh, logout races and native credential persistence with mocked platform storage.

[tests/browser.py](tests/browser.py) runs the customer and operator journeys against a local test server, with payments disabled and an isolated database. It accepts only a loopback server and a private test-operator credentials JSON supplied from outside the repository. It does not message customers, place real charges or deploy real stations. Chromium screenshots are review artifacts, not physical-device certification.

Native JavaScript exports have been checked for both iOS and Android. Signed APK/AAB/IPA builds and tests on physical phones still require the owner's build/signing accounts and configured services.

The mobile dependency lockfile pins patched `glob` and `minimatch` build tools through npm overrides. Recheck these pins when upgrading Expo. The current combination passes dependency audit, Expo fingerprint generation and both native exports.

## Release and downloads

Follow [docs/STORE-RELEASE.md](docs/STORE-RELEASE.md) for an Android preview APK, iPhone TestFlight build, production AAB/IPA, public URLs and store submission. [CONTRACT.md](CONTRACT.md) documents the API boundary; [api/README.md](api/README.md) covers hosting and operations.

`artifacts/evpower-app-source.zip` contains the source, dependency lockfiles, assets, tests and instructions. It excludes credentials, databases, dependencies and local test data. It is a source package; it cannot be installed as a phone app. Signed install links will come from EAS/TestFlight/Play after the required accounts are linked and builds complete.
