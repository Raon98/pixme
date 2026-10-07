package app.pixme.ai;

import java.util.UUID;

/**
 * Everything a provider needs to produce one character.
 *
 * <p>Two image references, and the split between them is the product rule:
 *
 * <ul>
 *   <li><b>Image A</b> ({@code sourceImage}) — the user's photo. Supplies the
 *       person and the outfit: hairstyle, hair colour, eye and brow shape, lip
 *       shape, facial impression, skin tone, every visible garment with its
 *       colour, pattern and layering, bag, glasses, hat, accessories, shoes.
 *   <li><b>Image B</b> ({@code masterReference}) — the PIXME Master Character
 *       Reference. Supplies the construction: proportions, head-to-body ratio,
 *       character scale, pixel density, how far a face is simplified,
 *       silhouette, pose, rendering language.
 * </ul>
 *
 * <p>The person and the clothes change; the skeleton and the style never do.
 */
public record GenerationRequest(
        UUID generationId,
        UUID userId,
        /** Image A — the original photo, already downscaled by the client. */
        byte[] sourceImage,
        String sourceMimeType,
        /** Image B — may be null if the reference asset is not installed. */
        byte[] masterReference,
        String masterReferenceMimeType,
        /** Geometry measured from Image B; drives the prompt and the normaliser. */
        CharacterSpec spec,
        PixelStyle style,
        /** Null on the first pass; set when re-rendering from a stored analysis. */
        ImageAnalysis analysis,
        String promptVersion,
        /** Stable per (user, day) so retries of the same photo stay coherent. */
        long seed) {

    public boolean hasMasterReference() {
        return masterReference != null && masterReference.length > 0;
    }
}
