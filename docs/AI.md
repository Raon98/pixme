# Character generation

The character is the product's core asset. Everything here exists to make two
promises true: **the character wears what the person actually wore**, and
**every PIXME looks like it comes from the same world**.

## Art direction

Shared by every style, so a crowd in the square reads as one place:

- Original pixel art, redrawn from scratch — never a downscaled photo.
- One consistent pixel grid at one scale.
- Slightly oversized head, compact body (≈1 : 2.6). Cute, not childish.
- Clean deliberate edges. At most four shades per garment, flat fills, one
  shadow tone. No gradients, no dithering noise, no blur.
- Modern, slightly Y2K sensibility.
- Readable at 72px (square crowd) and at 300px (feed card).
- **Transparent background**, always. Characters composite onto the feed card
  stage and the square scene, so the asset must never carry its own backdrop.
- Never: photorealism, 3D, anime/manga, smooth vector, exaggerated chibi, any
  recognisable existing character, multiple figures, or a scene.

Purchasable styles (`Y2K_PIXEL`, `BIT_16`, `RETRO_PC`, `ARCADE`, `MINI_PIXEL`,
`SOFT_PIXEL`) vary palette, pixel density and outline weight **on top of** the
same construction rules. They are variations, not different universes.
`PIXME_BASIC` is the house style and is free for everyone.

## Two steps, not one

```
photo ──► moderation ──► analysis (structured JSON) ──► render ──► PNG
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

Two prohibitions in the analysis prompt:

1. **Only report what is visible.** If the frame stops at the waist, emit no
   `BOTTOM` garment. If feet aren't visible, `footwear` is null. Never guess.
2. **Describe clothes, not people.** No age, ethnicity, body shape or
   attractiveness — the product has no use for any of it and should not collect
   it. Only hairstyle, glasses, facial hair and expression.

Layering is explicit: an open jacket over a tee is two garments with different
`layer` values, and the prompt lists them innermost-first. Without that, layered
outfits collapse into one top.

## The framing clause

The single most important part of the generation prompt, because getting it
wrong produces the one error users notice instantly — "I wasn't wearing that."

| Framing | Instruction |
| --- | --- |
| `FULL_BODY` | Draw head to feet; the whole outfit is visible. |
| `UPPER_BODY` | Draw head to just below the hips and fade out. **Do NOT invent** trousers, skirts, legs or shoes. |
| `SELFIE` | Draw a bust — head, shoulders, visible top only. **Do NOT invent** a lower body. |
| `UNKNOWN` | Draw only what was described. Invent no garment. |

The prompt also states an explicit priority order: garment identity and colour
first, then hair, then accessories, then mood — and forbids "improving",
restyling or accessorising the outfit.

`PromptLibraryTest` pins all of this.

## Prompt versioning

`pixme.ai.prompt-version` (currently `PIXME_V1`) is stored on every generation
alongside the provider, model and analysis JSON. Changing the art direction is
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
| `openai` | Moderation → vision analysis → image generation with transparent background. |
| `flux` | Image-to-image (Kontext), which preserves garment shape well; asynchronous, so it polls and surfaces a timeout as a normal failure. Delegates moderation and analysis to the OpenAI provider, since BFL exposes neither. |
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

- One free generation per user per day; extras consume a paid credit.
- A hard per-day cap (`pixme.generation.max-per-day`, default 20) as a backstop
  against a scripted client.
- A 10/hour rate limit on the generation endpoint.
- Analysis reuse on retries avoids paying for the vision pass twice.
- The client downscales to a 1280px long edge and strips EXIF before upload, so
  we never pay to move or analyse a 12MP original.
