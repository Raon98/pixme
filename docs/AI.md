# Character generation

The character is the product's core asset. Everything here exists to make two
promises true: **the character wears what the person actually wore**, and
**every PIXME looks like it comes from the same world**.

## The Master Character Reference

The official character image is the standard. It lives at
`apps/server/src/main/resources/pixme/master-character-v1.png` and does two
jobs:

1. **It is sent to the provider as "Image B" on every generation.** Text alone
   cannot hold a character family together across thousands of renders; a
   picture can.
2. **Its geometry is measured at startup** and becomes `CharacterSpec`. Swapping
   the file re-fixes the spec — the numbers are never invented in code, only
   defaulted when the file is missing.

Every generation records `reference_version`, so changing the reference is as
comparable after the fact as changing the prompt.

## Fixed vs. variable

This is the core rule: **the person and the clothes change, the skeleton never
does.**

| Comes from the user's photo (Image A) | Comes from the reference (Image B) |
| --- | --- |
| hairstyle, hair colour | overall height and width ratio |
| **eye shape, size, brow shape, lip shape, face outline** | head-to-body ratio, "slightly oversized" amount |
| skin tone, expression | face size, torso size, limb thickness |
| every visible garment, its colour and pattern | hand and foot simplification level |
| layering order | silhouette |
| bag, glasses, hat, accessories | pixel size and density |
| shoes | **how far features are simplified** |
| overall mood | standing pose, canvas occupancy, headroom, foot baseline, centring, shading level |

Note where the face sits: its **shape** follows the person — the character
should look like them — while its **rendering** is fixed. Large pixel eyes with
a single highlight, a small mouth, subtle blush: that technique never changes,
but the eyes are *their* eyes.

## Art direction

Measured from the reference and shared by every style:

- Original pixel art, redrawn from scratch — never a downscaled photo.
- One consistent pixel grid at one scale.
- Slightly oversized head: head and hair ≈31% of total height, roughly 3.3
  heads tall. Cute, not chibi, not realistic.
- The character fills ≈93% of the canvas height, centred, soles on the baseline.
- Clean deliberate edges, no anti-aliasing or blur. Limited palette per garment
  with restrained shading for folds, plus a silhouette outline.
- Large expressive eyes with one highlight, soft brows, small mouth, subtle
  blush; nose minimal or omitted.
- Readable at 72px (square crowd) and at 300px (feed card).
- **Transparent background**, always — characters composite onto the feed card
  stage and the square scene. The reference is exported on a flat background
  with a ground shadow and the prompt says explicitly that this is *not* part of
  the standard.
- Never: photorealism, 3D, anime/manga, smooth vector, exaggerated chibi, any
  recognisable existing character, multiple figures, or a scene.

## Enforcement, not just instruction

A prompt can *ask* for consistent scale, centring and foot position. It cannot
guarantee them, and models drift — one render comes back 8% smaller, the next
sits 30px off-centre. In a square full of characters that reads immediately as
"these are from different apps".

So `CharacterNormalizer` runs on every result and deterministically trims to the
alpha bounding box, scales with **nearest-neighbour** to the spec height (clamped
if unusually wide), and places the character centred with its soles on the
baseline. The art is never touched — only the frame it sits in. If
normalisation fails for any reason the raw render is used, because a processing
bug must never cost someone a generation.

Purchasable styles (`Y2K_PIXEL`, `BIT_16`, `RETRO_PC`, `ARCADE`, `MINI_PIXEL`,
`SOFT_PIXEL`) vary palette, pixel density and outline weight **on top of** the
same construction rules. They are variations, not different universes.
`PIXME_BASIC` is the house style and is free for everyone.

## Two steps, not one

```
photo ──► moderation ──► analysis (structured JSON) ──► render (A + B) ──► normalise ──► PNG
```

Analysis is deliberately separate from rendering:

- The outfit becomes **inspectable data**, stored on the generation, so it can
  be diffed across prompt versions on real inputs instead of by vibes.
- "다시 만들어보기" re-renders the stored analysis — same outfit, new render.
  That is what the user is actually asking for, and it is cheaper and more
  consistent than re-reading the photo.
- A structured description lets the prompt be assembled deterministically
  rather than hoping the model preserves clothing on its own.

## The analysis contract

`ImageAnalysis` captures framing, hair, face, garments (with `slot`, `layer`,
`fit`, `color`, `pattern`), accessories, footwear, mood and palette hints.

Every field is nullable **by design**. A selfie legitimately has no bottoms and
no shoes, and absence is the signal the renderer needs.

Three rules in the analysis prompt:

1. **Only report what is visible.** If the frame stops at the waist, emit no
   `BOTTOM` garment. If feet aren't visible, `footwear` is null. If no face is
   visible, `faceVisible` is false and nothing about the face is invented.
   Never guess.
2. **Describe shape precisely enough to be recognisable.** Eye shape and size,
   brow shape, lip shape, face outline, skin tone — what a portrait artist needs.
   "Grey with black wavy horizontal stripes" is useful; "patterned top" is not.
3. **Shapes, not profiling.** No age, ethnicity, nationality, body weight or
   attractiveness. The line is that "almond eyes, straight brows" is a drawing
   instruction while "early-20s, attractive" is a judgement the product has no
   use for.

Layering is explicit: an open jacket over a tee is two garments with different
`layer` values, and the prompt lists them innermost-first. Without that, layered
outfits collapse into one top.

## The framing clause

The single most important part of the generation prompt, because getting it
wrong produces the one error users notice instantly — "I wasn't wearing that."

| Framing | Instruction |
| --- | --- |
| `FULL_BODY` | Draw head to feet; the whole outfit is visible. |
| `UPPER_BODY` | Still a full-body character — but keep the lower half plain and neutral in a colour from the visible palette. **Do NOT invent** a specific garment, pattern or footwear. |
| `SELFIE` | Same: full body, everything below the visible top plain and neutral. **Do NOT invent** specifics. |
| `UNKNOWN` | Draw only the garments described; anything else stays plain. |

Note the resolution for a partial photo is "neutral below", not "crop to a
bust". Every character in the square has to be a full-body sprite of the same
height — a bust would break both the crowd and the normaliser — so the honest
answer is a complete character that visibly declines to make anything up.

The prompt also states an explicit priority order: garment identity and colour
first, then hair, then accessories, then mood — and forbids "improving",
restyling or accessorising the outfit.

`PromptLibraryTest` pins all of this.

## Prompt versioning

`pixme.ai.prompt-version` (currently `PIXME_CHARACTER_V1`) is stored on every
generation alongside the provider, model, reference version and analysis JSON. Changing the art direction is
therefore measurable: re-run stored analyses under a new version and compare,
rather than guessing whether it improved.

## Providers

```java
interface PixelImageProvider {
    String name();
    SafetyVerdict checkSafety(byte[] image, String mimeType);
    ImageAnalysis analyzeImage(byte[] image, String mimeType);
    GeneratedCharacter generateCharacter(GenerationRequest request);
    GeneratedCharacter generateVariant(GenerationRequest request);
}
```

| Provider | Notes |
| --- | --- |
| `openai` | Moderation → vision analysis → `images/edits` with **two image inputs** (photo + reference) and a transparent background. Falls back to text-only generation when the reference is missing. |
| `flux` | Image-to-image (Kontext) with the photo as `input_image` and the reference as `input_image_2`; preserves garment shape well. Asynchronous, so it polls and surfaces a timeout as a normal failure. Delegates moderation and analysis to the OpenAI provider, since BFL exposes neither. |
| `stub` | Draws a character procedurally. Honours the framing rule — a selfie analysis yields a bust, a full-body one yields legs and shoes — because framing is the behaviour most likely to regress. Used by `local` and by the test suite. |

All three are registered; `pixme.ai.provider` selects one. `AiProviderRegistry`
also exposes `byName`, so two providers can be compared on the same input
without a redeploy.

The seam exists because models and pricing change faster than art direction
should. Nothing outside the `ai` package knows which vendor is in use.

## Safety screening

Runs **before** anything is charged, and a rejection refunds anyway. Categories:
sexual, minors, violence, self-harm, personal data, no-person.

When the moderation call itself fails, the verdict is `unavailable` and the
upload proceeds. That is a deliberate trade: the generation prompt is heavily
constrained, the output is a stylised pixel character rather than a photo, and
report/block cover the tail — whereas blocking every upload during a provider
outage would take the product down. The failure is logged.

## Cost control

Generation is the only variable cost in the product, and the only one that
scales with engagement. It is also the thing being sold, which makes the unit
economics a product question rather than an infrastructure one.

The levers, in order of impact:

1. **`pixme.ai.openai.image-quality`** — `low` / `medium` / `high`. Easily a
   multiple-times difference in cost per render. PIXME's output is a
   flat-palette sprite that is normalised and displayed at 72–300px, so the top
   tier is usually paying for detail the product discards. Default is `medium`;
   compare renders at each tier before committing.
2. **Analysis reuse on retries** — a retry re-renders the stored analysis and
   never pays for the vision pass twice.
3. **Client-side downscale** — the app resizes to a 1280px long edge and strips
   EXIF before upload, so we never pay to move or analyse a 12MP original.
4. **Caps** — a hard per-day ceiling (`pixme.generation.max-per-day`) and a
   10/hour rate limit, as a backstop against a scripted client.

To sanity-check a price point: net revenue is the list price minus the store's
cut (30%, or 15% on the small-business programme), and cost is roughly
*(image render + vision analysis) × generations granted*. Moderation is free.
If that product is negative, the plan is subsidising usage.

- Free generation is an onboarding grant only — first generation, one free
  retry of that first result, one bonus credit — then paid. See `PRODUCT.md`.
- A hard per-day cap (`pixme.generation.max-per-day`, default 20) as a backstop
  against a scripted client.
- A 10/hour rate limit on the generation endpoint.
- Analysis reuse on retries avoids paying for the vision pass twice.
- The client downscales to a 1280px long edge and strips EXIF before upload, so
  we never pay to move or analyse a 12MP original.
