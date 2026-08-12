# JijiSwipe

JijiSwipe is a mobile-first digital closet for building outfits from clothing you already own. The current beta includes the mobile interaction prototype, on-device background removal, invite-only accounts, and a private Supabase foundation.

Read the living [product plan](docs/PRODUCT_PLAN.md) for decisions and milestones, and [design system](docs/DESIGN.md) for the UI contract.

## Getting Started

Use Node 22.13 or newer. Copy `.env.example` to `.env.local`, provide the project-specific values, then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Before opening a pull request, run:

```bash
npm run check
npm run test:e2e
npm run db:lint
```

Environment secrets belong only in `.env.local` and deployment-provider settings; never commit them.
