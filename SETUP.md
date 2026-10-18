# Naija Homes: Vercel + Clerk + Cloudflare

This folder is the deployable project. Use this folder as the Vercel Root Directory. The frontend is hosted on Vercel; the API and D1 database are hosted on Cloudflare. Adding environment variables does not provision the Cloudflare resources: complete both sections below.

## 1. Clerk

Create a Clerk app and enable the sign-in methods you want. Copy its **publishable key** and **Frontend API URL** from its dashboard. Use a development instance while testing; configure Clerk's production instance and domain settings before launch. For production, use its production publishable key and matching issuer/JWKS URL together.

## 2. Cloudflare API

In `api/` run:

```sh
npm install
npx wrangler login
npx wrangler d1 create naija-homes
```

Edit `api/wrangler.jsonc`:

- Replace `database_id` with the ID returned by D1 creation.
- Set `CLERK_ISSUER` to Clerk's Frontend API origin, without a trailing slash.
- Set `CLERK_JWKS_URL` to that origin plus `/.well-known/jwks.json`.
- Set `ALLOWED_ORIGINS` to your exact Vercel origin, for example `https://naija-homes.vercel.app`. Comma-separate additional **exact** origins if needed. Do not use `*.vercel.app`: that would trust other projects. Add your custom domain explicitly if using one.

Then:

```sh
npm run db:migrate:remote
npm run deploy
```

Copy the deployed Worker HTTPS origin. The API uses a D1 binding; no database password, Cloudflare API token, R2 key or Clerk secret key is needed in the frontend. Clerk's public JWKS verifies signatures on the Worker. The API checks issuer, expiration, RS256, and the session token's `azp` against `ALLOWED_ORIGINS`.

## 3. Vercel

Upload this project to your Git repository and import it into Vercel. Use framework **Other**, build command `npm run build`, output directory `dist`, and Node.js 22 or newer. `vercel.json` supplies the build/output settings.

In Vercel Settings → Environment Variables, import `.env.example` and replace its two values:

```dotenv
CLERK_PUBLISHABLE_KEY=pk_test_YOUR_COMPLETE_KEY
CLOUDFLARE_API_URL=https://naija-homes-api.YOUR-SUBDOMAIN.workers.dev
```

Set the applicable Production/Preview/Development environments, then deploy or redeploy. The build fails when the Clerk key is missing or malformed. If the API URL is absent, the frontend deploys with a clear backend setup notice; listing and profile actions stay disabled until the API is connected. Only these public values enter `dist/config.js`; do not add secret keys to this public configuration. The root `.env.example` can be copied to `.env` for local builds, but never commit the populated file.

## 4. Local development

Copy `api/.dev.vars.example` to `api/.dev.vars`, fill in the Clerk issuer/JWKS URL, and keep local frontend origins in `ALLOWED_ORIGINS`. In `api/`, run `npm run db:migrate:local`, then `npm run dev`. Set root `.env` to the Clerk development publishable key and `CLOUDFLARE_API_URL=http://localhost:8787`. Run `npm run build` at the root and serve `dist/` on port 3000 using your preferred static server. Use the same hostname in the browser and the origin allowlist.

## 5. Verify your deployment

1. Open `WORKER_URL/health`: it should return `ok: true`.
2. Open Vercel and sign in through Clerk. A real user/profile is created in D1 on first authenticated API request.
3. Open Profile, set your display name, and save it.
4. Tap +, enter property details, review, and publish. The home should appear in My Listings and shared browsing.
5. Open another browser/account, find the property, and save it. Saved homes persist in D1 per user.
6. Sign out: posting, saving and profile changes require sign-in. A different account cannot delete your listing.

New databases start empty. Sample listings and old browser-local posts are **not** automatically uploaded or migrated.

## Implemented and remaining

Connected: Clerk sign-in/sign-out; verified bearer-token API calls; D1-backed profiles, listing creation, public browsing, owner-only deletion, and per-user saved homes; exact CORS allowlist; JSON request-size limit; Vercel build-time environment configuration.

Remaining: photo/video storage and upload processing, live chat, inspection bookings, following, moderation/admin tools, pagination beyond the first 200 listings, abuse/rate limiting and production monitoring review. Cover photos are clearly marked illustrative; media selection is disabled in this live wiring package. Maps are illustrative. These are not represented as live features.

Clerk and Cloudflare account configuration, actual credentials and a deployed cross-service smoke test are still required. Automated API tests use local SQLite via a D1-compatible shim rather than the hosted D1 service.

References: https://clerk.com/docs/js-frontend/getting-started/quickstart · https://clerk.com/docs/guides/sessions/manual-jwt-verification · https://developers.cloudflare.com/d1/ · https://vercel.com/docs/environment-variables

## Validation

Frontend syntax and all three build-configuration tests passed during preparation. Backend tests were added for JWT authorized-party rejection, cross-user deletion, validation, saved-home isolation/cascade, and CORS. Backend dependency installation stalled in the preparation environment, so backend typechecking and tests have not been verified here. Before deploying, run at the project root:

```sh
npm test
cd api
npm install
npm run typecheck
npm test
```

Then perform the account-backed smoke test above. Do not treat the local SQLite shim as confirmation of hosted D1 behavior.

