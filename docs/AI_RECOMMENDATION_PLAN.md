# JijiSwipe Recommendation Plan

## Product promise

A user can describe an occasion in ordinary language and receive complete outfits made only from clothing they own. Inspiration may explain the direction, but it must never quietly substitute items from outside the user's closet.

## Recommended approach: hybrid

Use vision-assisted tagging plus structured rules plus language-model ranking.

- Vision-assisted tagging reduces upload work by proposing garment type, colors, material, pattern, season, warmth, formality, and style tags.
- The user can correct every proposed tag; corrected data becomes the source of truth.
- Structured rules remove invalid combinations and enforce occasion, weather, and outfit-slot constraints.
- A language model translates a request such as “outdoor fall birthday dinner” into those constraints, then ranks valid combinations and briefly explains each choice.
- The system sends IDs and structured descriptions to the model, not permanent public image URLs.

This is more dependable than asking a model to invent an outfit from raw images every time, while remaining more flexible than a fixed occasion lookup table.

## Experience

1. User adds a garment and receives editable suggested details.
2. User opens **Suggest** and writes an occasion or selects a shortcut.
3. JijiSwipe extracts occasion, formality, weather needs, season, and optional style direction.
4. The database filters the user's own closet into compatible candidates.
5. A deterministic combination builder creates valid outfits.
6. The model ranks a small candidate set and returns two to four choices with short reasons.
7. The user keeps, skips, edits, saves, or marks a suggestion as worn.
8. Those actions become preference signals for future ranking.

## Data additions

### Clothing items

- primary and secondary color
- material and pattern
- seasons and temperature range
- formality level
- style tags
- waterproof/layering flags where relevant
- tag source and user-confirmed status

### Recommendations and feedback

- original user prompt and parsed constraints
- candidate outfit IDs and selected result
- model/provider version and generation timestamp
- kept, skipped, edited, liked/disliked, and worn events

Keep preference data owner-scoped under Row Level Security, like the existing closet.

## Pinterest and inspiration

### V1

Provide **See inspiration on Pinterest**, opening a clearly labeled Pinterest search based on the occasion and style phrase. Keep the actual JijiSwipe recommendation separate and based only on owned clothes.

### Later experiment

Apply for Pinterest developer access only if an approved API use case fits. The current official API focuses on authenticated account content, publishing, ads, commerce, analytics, and limited trend keywords; it is not a general public Pin-search feed. Pinterest API content also carries storage, attribution, linking, and display restrictions.

Do not scrape Pinterest, proxy its images, or store Pins returned by an API. If Pins are ever displayed through an approved integration, label Pinterest as the source and link every Pin back to Pinterest.

## Delivery phases

1. **Metadata foundation:** schema, editable garment details, controlled tag vocabulary, and backfill existing items. Schema and editing UI implemented; confirm the mobile flow and fill existing items before bulk AI analysis.
2. **Rules engine:** occasion presets and valid outfit generation with no paid AI dependency.
3. **Prompt recommendations:** language model parses free text and ranks rule-generated candidates; strict output validation and per-user limits.
4. **Preference learning:** rerank using keeps, skips, edits, likes, and worn history; no custom training until enough data exists.
5. **Context:** optional weather, then carefully approved trend signals and inspiration links.

## Cost and safety controls

- Analyze each garment once, then reuse confirmed metadata.
- Send compact structured candidate data rather than every full-resolution image on each request.
- Cache identical requests briefly and cap suggestions per user.
- Put all model calls behind a server route with authentication, validation, timeouts, usage logging, per-user quotas, and an application-side monthly cutoff.
- Keep the rules-only recommender available when an AI provider is unavailable or the budget is exhausted.
- Never train on a user's photos or preferences without explicit consent.

## Gate to begin

Phase 1 was approved after owner-side V1 checks passed. Before enabling paid calls, benchmark ten representative garments, record actual token usage, and verify the cutoff and rules-only fallback.
