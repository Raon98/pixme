package app.pixme.ai;

/**
 * A finished character: a transparent-background PNG plus the provenance we
 * need to compare prompt versions and debug regressions later.
 */
public record GeneratedCharacter(
        byte[] image,
        String mimeType,
        String provider,
        String model,
        String promptVersion,
        ImageAnalysis analysis) {}
