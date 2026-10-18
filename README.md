# Naija Homes

Mobile-first Nigerian property marketplace frontend for Vercel, Clerk authentication, and a Cloudflare Worker API with D1 persistence.

See [SETUP.md](SETUP.md) for deployment, environment variables and current verification limits. Set Vercel Root Directory to `web` and include source files outside the Root Directory. The `api/` folder is deployed separately to Cloudflare Workers.

```sh
npm test
npm run build
```

The build requires `CLERK_PUBLISHABLE_KEY`. Set `CLOUDFLARE_API_URL` after deploying the API; until then the frontend shows an explicit backend setup state. Copy `.env.example` for local use or set those variables in Vercel. Do not commit filled environment files.

Connected implementation: accounts, profiles, shared property listings, owner-only removal, and saved homes. Private messaging (5-second refresh), following and inspection requests with offers, assignment and written reports are connected. Media uploads, payments, provider verification, push notifications and moderation remain future work. Placeholder cover photos and maps are illustrative.

