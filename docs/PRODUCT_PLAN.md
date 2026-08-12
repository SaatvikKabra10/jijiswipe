# JijiSwipe Product Plan

Last updated: August 12, 2026
Status: Milestones 1–2 approved; Milestone 3 authentication and hosted security foundation complete

## Product goal

JijiSwipe is an installable, mobile-first digital closet for up to five friends. A user photographs one garment, removes its background on their phone, organizes it privately, swipes owned pieces into a layered outfit, saves the look, and optionally shares a read-only link.

## Core Beta (Gate A)

Target: 27–40 focused development hours and two pilot users.

- Always-dark editorial interface with cobalt-blue identity
- Secure emailed invitations protected by a shared server-side code
- Email/password accounts and private per-user data
- Single garment upload, crop/rotation, and on-device background removal
- Private closet with six categories and optional controlled tags
- Fixed layered outfit renderer and swipeable item selection
- One local outfit draft, saved outfit editing, and private notes
- Revocable public links showing only display name, outfit name, and images
- Installable web-app shell; internet required

Gate A is complete only when a pilot friend can independently join, install the app, add a real garment, manage their closet, build/save/edit an outfit, share and revoke a public link, and return later with data intact.

## Gate B

- Multi-photo local import queue: completed pieces become usable while remaining pieces process sequentially with the app open
- Clothing archive and restore
- Self-service account deletion
- Forgotten-password recovery
- Expanded accessibility, Android, and failure testing
- Privacy-conscious monitoring and backup/restore drill
- Invite the remaining friends after pilot fixes

## Architecture decisions

- Next.js App Router, strict TypeScript, Tailwind CSS, npm, and Node 20.19+
- Local Supabase for development; one hosted Supabase Free project for production
- Private storage bucket and owner-scoped Row Level Security on every private table
- Browser-side image processing; only the approved transparent cutout is uploaded
- One shared outfit renderer across builder, saved views, and public pages
- Vercel Hobby hosting and dedicated Gmail SMTP for account emails
- Public AGPL-3.0 repository due to the selected background-removal dependency
- Project-specific `DESIGN.md`, selective shadcn/ui primitives, Playwright mobile/visual checks, axe accessibility scans, Supabase CLI/type generation/policy tests, and GitHub Actions CI

## Data model

- `profiles`: display name, onboarding state, timestamps
- `clothing_items`: owner, optional label, category, tags, private image metadata, processing state, reserved archive timestamp
- `outfits`: owner, name, private note, timestamps
- `outfit_items`: owner, outfit, clothing item, and fixed slot
- `outfit_shares`: owner, outfit, active/revoked state, timestamps

Fixed slots: base top, mid-layer, outerwear, bottom, one-piece, shoes, accessory 1, accessory 2. An outfit contains 2–8 distinct pieces. A one-piece replaces the top layers and bottom.

## Milestones

1. **Foundation and fake-data visual prototype — approved**
2. **Local image-processing proof using ten varied garments — implemented; awaiting iPhone benchmark**
3. **Accounts, migrations, private storage, and access-policy tests — authentication flow verified; policy tests remain**
4. **Real upload-to-closet vertical slice — verified on iPhone**
5. Real outfit creation, local draft, and saved outfits
6. Secure public sharing
7. Focused tests, deployment, and two-friend pilot

## Milestone 1 review gate

- Closet, Create, and Outfits tabs work using fake local data
- Category filters work
- Tapping an outfit slot changes the swipeable item rail
- Selecting an item immediately updates the fixed outfit preview
- Layout works at iPhone width with no clipping or desktop-sized controls
- Tapping controls never triggers accidental page zoom; fields avoid Safari focus zoom while intentional pinch-to-zoom remains available
- Lint, TypeScript, and production build pass

## Operating constraints

- Normal operating-cost target: $0; no metered AI or image API in Gate A
- Up to five accounts and 250 clothing records per account
- Final cutout: transparent WebP where supported, transparent PNG fallback on Safari, at most 1600 px and 600 KB
- Primary target: iPhone Safari; Android Chrome is secondary
- Monthly manual database/image backup and service-health check

## Decision log

- 2026-08-11: Working name set to JijiSwipe.
- 2026-08-11: Dark editorial/cobalt visual direction selected.
- 2026-08-11: Gate A and Gate B adopted to balance speed and extensibility.
- 2026-08-11: Recommended defaults may be applied automatically unless cost, privacy, or visible behavior changes materially.
- 2026-08-11: Milestone 1 implementation completed; lint, strict TypeScript, and the production build pass.
- 2026-08-11: First desktop review approved the direction; typography and bottom navigation were refined for a cleaner, symmetrical editorial feel. Actual iPhone review remains required.
- 2026-08-11: Milestone 1 visual direction approved; Milestone 2 started.
- 2026-08-11: Local select, HEIC conversion, crop/rotate, background removal, progress, preview, and retry flow implemented; ten-garment iPhone benchmark remains.
- 2026-08-11: Mobile Safari acceptance expanded to cover accidental tap/focus zoom and touch-target behavior.
- 2026-08-12: First iPhone cutout took roughly 30–60 seconds and was usable. Measure cached follow-up processing before optimizing; plan a local bulk queue for Gate B rather than paid server processing in the Core Beta.
- 2026-08-12: Cached iPhone cutout completed in roughly 15 seconds and was usable. On-device processing is viable for Gate A; preload the model when Add Item opens to reduce perceived wait.
- 2026-08-12: Milestones 1–2 saved at Git checkpoint `f1b3f51`; account work moved to `feat/accounts-security`.
- 2026-08-12: Official Supabase client requires Node 22; project runtime raised to Node 22.13+. Profile/private-storage migration and invitation/sign-in/password flows implemented, awaiting a connected Supabase environment.
- 2026-08-12: Engineering-quality bundle approved: custom design specification, selective accessible UI primitives, Playwright/axe, reproducible Supabase workflows, and CI. Avoid generic wholesale restyling and unrestricted production MCP access.
- 2026-08-12: Added `DESIGN.md` and Playwright/axe mobile checks. This macOS receives a frozen incompatible Playwright WebKit build, so automated touch/layout checks use current Chromium while real-iPhone Safari remains a milestone gate.
- 2026-08-12: Mobile interaction and axe checks pass after fixing local hydration origins and accessible text contrast. Added project-scoped Supabase CLI and GitHub Actions quality workflow.
- 2026-08-12: Hosted Supabase migration applied. Gmail SMTP, invite-only join, token-hash confirmation, password creation, and returning-user sign-in were verified end to end.
- 2026-08-12: Real iPhone garment flow verified end to end: local cutout, automatic WebP/PNG sizing, owner-only storage and database save, persistent reload, and contrast-safe closet presentation.
