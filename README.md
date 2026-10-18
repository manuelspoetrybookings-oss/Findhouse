# Naija Homes

Mobile-first Nigerian property marketplace frontend for Vercel, Clerk authentication, and a Cloudflare Worker API with D1 persistence.

See [SETUP.md](SETUP.md) for deployment, environment variables and current verification limits. The root is the Vercel project; `api/` is deployed separately to Cloudflare Workers.

```sh
npm test
npm run build
```

The build requires `CLERK_PUBLISHABLE_KEY` and `CLOUDFLARE_API_URL`. Copy `.env.example` for local use or set those variables in Vercel. Do not commit filled environment files.

Connected implementation: accounts, profiles, shared property listings, owner-only removal, and saved homes. Media uploads, live messaging, inspection services and moderation remain future work. Placeholder cover photos and maps are illustrative.
