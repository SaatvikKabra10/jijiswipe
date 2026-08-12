# JijiSwipe Design System

Status: Core Beta baseline
Visual direction: dark editorial fashion with a cobalt identity

## Principles

1. **Clothing is the content.** Images dominate; interface chrome stays restrained.
2. **Editorial, not corporate.** Strong type hierarchy, deliberate negative space, minimal card nesting, and concise labels.
3. **One obvious action.** Each screen has one cobalt primary action; secondary actions remain quiet.
4. **Designed for a thumb.** Important controls sit within comfortable reach and never depend on hover.
5. **Consistent over clever.** Reuse tokens, primitives, and the shared outfit renderer before inventing new patterns.

Depop is a product-quality reference for image-first density, confident typography, and simple navigation—not a screen or brand to copy. JijiSwipe keeps its own near-black surfaces, cobalt identity, layered outfit builder, wording, and iconography.

## Foundation

- Canvas: `#09090b`
- Raised surface: `#151518`
- Strong border: `#29292e`
- Primary text: `#f5f5f2`
- Secondary text: `#8c8c91`
- Brand/action cobalt: `#2864f0`; small cobalt text uses the lighter accessible token `#6791ff`
- Error and success colors appear only for status feedback.
- Typography: system sans (`-apple-system`, BlinkMacSystemFont, Helvetica Neue, Helvetica, Arial).
- Display headings use tight tracking and 750–900 weight.
- Body copy uses normal tracking, short line lengths, and at least 16px for editable fields.

## Spacing and shape

- Base spacing unit: 4px.
- Common gaps: 8, 12, 16, 20, 24, and 32px.
- Phone page padding: 18–20px.
- Interactive targets: minimum 44×44px, with 48–54px preferred for primary actions.
- Small controls: 10–13px radius; panels/cards: 16–22px radius.
- Avoid stacking rounded containers inside rounded containers unless hierarchy requires it.

## Components

- Bottom navigation always uses three equal columns and matching square icon containers.
- Primary buttons are full-width or compact pills, cobalt, high-contrast, and verb-led.
- Sheets and dialogs use accessible primitives, focus trapping, Escape/close behavior, and mobile-safe scrolling.
- Forms use visible labels, 16px inputs, inline errors, disabled/loading states, and no placeholder-only labeling.
- Clothing cards prioritize the cutout; metadata is secondary and never visually louder than the item.
- Outfit layouts reuse one renderer across creation, saved outfits, and public sharing.

## Motion and touch

- Motion explains state changes; it is never decorative noise.
- Honor `prefers-reduced-motion`.
- Use `touch-action: manipulation` on taps while preserving intentional pinch zoom.
- Horizontal item rails use native momentum scrolling and scroll snap.
- Never trigger accidental Safari focus or double-tap zoom.

## Required states

Every feature accounts for loading, empty, success, validation error, service failure, offline/slow connection, disabled, and destructive confirmation states where applicable.

## Visual acceptance loop

For material UI changes:

1. Capture phone-width screenshots before and after.
2. Compare hierarchy, spacing, typography, overflow, touch targets, and all required states.
3. Run Playwright mobile checks and axe scans.
4. Test interaction on a real iPhone before approving a milestone.
5. Record intentional changes in `PRODUCT_PLAN.md`.
