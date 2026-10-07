package app.pixme.ai;

import java.util.UUID;

/** Everything a provider needs to produce one character. */
public record GenerationRequest(
        UUID generationId,
        UUID userId,
        /** Original photo bytes, already downscaled by the client. */
        byte[] sourceImage,
        String sourceMimeType,
        PixelStyle style,
        /** Null on the first pass; set when re-rendering from a stored analysis. */
        ImageAnalysis analysis,
        String promptVersion,
        /** Stable per (user, day) so retries of the same photo stay coherent. */
        long seed) {}
