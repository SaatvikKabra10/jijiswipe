# JijiSwipe Product Plan

Last updated: August 12, 2026
Status: Core product loop complete; two-friend pilot readiness in progress

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
- Forgotten-password recovery — verified end to end in production
- Expanded accessibility, Android, and failure testing
- Privacy-conscious monitoring and backup/restore drill
- Invite the remaining friends after pilot fixes

## Intelligence roadmap

Implementation details and Pinterest constraints are maintained in [AI_RECOMMENDATION_PLAN.md](AI_RECOMMENDATION_PLAN.md).

1. Add useful garment metadata: color, material, season, warmth, formality, and style tags. **Foundation implemented; existing-item confirmation and pilot UX check remain.**
2. Record preference signals without training a model yet: outfit kept/skipped, liked/disliked, edited, and worn.
3. Ship occasion recommendations using structured filters plus a language model that translates prompts such as “casual fall dinner” into closet constraints.
4. Add weather and carefully sourced trend context as optional inputs, never as reasons to recommend clothes the user does not own.
5. Personalize ranking only after each user has enough real feedback; start with a simple scoring model before custom machine learning.

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
- `clothing_items`: owner, label, category, garment type, colors, material, pattern, season, warmth, formality, style/weather tags, metadata provenance/version, private image metadata, and timestamps
- `outfits`: owner, name, private note, timestamps
- `outfit_items`: owner, outfit, clothing item, and fixed slot
- `outfit_shares`: owner, outfit, active/revoked state, timestamps

Fixed slots: base top, mid-layer, outerwear, bottom, one-piece, shoes, accessory 1, accessory 2. An outfit contains 2–8 distinct pieces. A one-piece replaces the top layers and bottom.

## Milestones

1. **Foundation and fake-data visual prototype — approved**
2. **Local image-processing proof using ten varied garments — implemented; awaiting iPhone benchmark**
3. **Accounts, migrations, private storage, and access-policy tests — authentication flow verified; owner-isolation suite added**
4. **Real upload-to-closet vertical slice — verified on iPhone**
5. **Real outfit creation, local draft, saved outfits, templates, and Style Deck — verified on iPhone**
6. **Secure, revocable public sharing — link view verified on iPhone**
7. **Focused tests and deployment — production deployment and core mobile checks complete**
8. Two-friend pilot — owner-side mobile checks passed; awaiting two independent friend sessions

## Milestone 1 review gate

- Closet, Create, and Outfits tabs work using fake local data
- Category filters work
- Tapping an outfit slot changes the swipeable item rail
- Selecting an item immediately updates the fixed outfit preview
- Layout works at iPhone width with no clipping or desktop-sized controls
- Tapping controls never triggers accidental page zoom; fields avoid Safari focus zoom while intentional pinch-to-zoom remains available
- Lint, TypeScript, and production build pass

## Operating constraints

- Core-app operating-cost target: $0; recommendation API budget approved up to $5/month with an app-side cutoff and rules-only fallback
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
- 2026-08-12: Outfit creation direction expanded to two complementary modes: a centered silhouette editor for deliberate control and a gesture-driven style deck for playful discovery. Swipe actions must include visual feedback and visible buttons.
- 2026-08-12: Real outfit saving, one-piece support, template selection, and the local swipeable Style Deck were verified on iPhone. Kept deck combinations return to the precise builder for editing and saving.
- 2026-08-12: Token-hashed public outfit links and unauthenticated read-only outfit pages were verified on iPhone. Private images remain behind short-lived signed URLs; owners can revoke links.
- 2026-08-12: Closet-item editing/deletion, profile photos, profile editing, and reliable sign-out shipped to production.
- 2026-08-12: Added in-app iPhone installation guidance and a standalone-app manifest check for the two-friend pilot.
- 2026-08-12: Removed the duplicate Layered template. Top + bottom retains optional outerwear, shoes, and accessories; Dress / one-piece remains the only alternate structure.
- 2026-08-12: Saved looks can be reopened in the builder, renamed, restyled, and saved back to the existing outfit.
- 2026-08-12: Saved-look editing became a focused mode: creation/deck controls and bottom navigation are hidden until the user saves or cancels, preventing the form from being covered.
- 2026-08-12: Raised the top-and-bottom composition within the outfit canvas so garment cutouts remain centered and bottoms are not clipped at the stage edge.
- 2026-08-12: Added a full-size back control to saved-look editing and confirmed outfit deletion; deleting an outfit also cascades to its private pieces and public share record.
- 2026-08-12: Exposed the existing private outfit-note field in create, edit, and saved-look views.
- 2026-08-12: Fresh-database testing found implicit hosted Data API grants; added explicit least-privilege table grants while retaining owner-scoped RLS.
- 2026-08-12: Password recovery now reuses the exact allow-listed `/auth/confirm` callback; the callback already defaults to the password screen.
- 2026-08-12: Production password recovery was verified from request email through choosing a new password and returning to the closet.
- 2026-08-12: Real-iPhone checks passed for leaving saved-look editing, saving private notes, deleting an outfit, and returning to a stable app state.
- 2026-08-12: Recommendation metadata foundation shipped to Supabase. New and existing garments share versioned, editable fields so rules, vision tagging, and later preference learning use one durable source of truth.
- 2026-08-12: Approved up to $5/month for recommendation API usage. Analyze each garment once, benchmark ten items before bulk tagging, send compact text for outfit ranking, and enforce an application-side cutoff rather than relying only on provider alerts.
