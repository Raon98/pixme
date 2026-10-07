package app.pixme.ai;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

import javax.imageio.ImageIO;

import app.pixme.config.PixmeProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

/**
 * The official PIXME Master Character Reference — "Image B".
 *
 * <p>Every generation sends two references to the provider: the user's photo,
 * which supplies the person and the outfit, and this image, which supplies the
 * construction. That is what makes a crowd in the square look like one world
 * instead of a collage of whatever each render felt like.
 *
 * <p>Crucially, the geometry is <em>measured</em> from the image rather than
 * hardcoded. Dropping in a new reference re-fixes the spec, and
 * {@link CharacterNormalizer} then conforms every output to it — so "the
 * skeleton is identical" is enforced deterministically, not merely requested in
 * a prompt.
 */
@Component
public class MasterCharacterReference {

    private static final Logger log = LoggerFactory.getLogger(MasterCharacterReference.class);

    /** Per-channel distance at which a pixel still counts as background. */
    private static final int BACKGROUND_TOLERANCE = 20;

    private final byte[] bytes;
    private final String mimeType;
    private final String version;
    private final CharacterSpec spec;
    private final boolean present;

    public MasterCharacterReference(PixmeProperties properties, ResourceLoader resourceLoader) {
        PixmeProperties.Ai.MasterReference config = properties.ai().masterReference();
        this.version = config.version();

        byte[] loaded = null;
        CharacterSpec measured = null;

        Resource resource = resourceLoader.getResource(config.resource());
        if (resource.exists()) {
            try (InputStream input = resource.getInputStream()) {
                loaded = input.readAllBytes();
                measured = measure(loaded);
                log.info(
                        "Master Character Reference '{}' loaded ({} bytes); measured spec: {}",
                        version,
                        loaded.length,
                        measured);
            } catch (IOException | RuntimeException exception) {
                log.error(
                        "Master Character Reference at {} could not be read; "
                                + "falling back to the documented spec",
                        config.resource(),
                        exception);
            }
        }

        this.present = loaded != null;
        this.bytes = loaded;
        this.mimeType = config.mimeType();
        this.spec = measured != null ? measured : CharacterSpec.reference();

        if (!present) {
            String message =
                    "Master Character Reference not found at %s. Characters will be generated "
                            .formatted(config.resource())
                            + "from the prompt alone, which drifts from the house style. "
                            + "Drop the PNG in before shipping.";
            if (config.required()) {
                throw new IllegalStateException(message);
            }
            log.warn(message);
        }
    }

    /** True when the reference image can actually be sent to the provider. */
    public boolean isPresent() {
        return present;
    }

    /** Raw bytes for "Image B", or null when the file is missing. */
    public byte[] bytes() {
        return bytes;
    }

    public String mimeType() {
        return mimeType;
    }

    /** Stored on every generation, so a reference swap is comparable later. */
    public String version() {
        return version;
    }

    public CharacterSpec spec() {
        return spec;
    }

    /* ---------------------------------------------------------- measuring */

    /**
     * Derives the spec from the reference image.
     *
     * <p>The shipped reference is exported on a flat off-white background with
     * a soft ground shadow, so this cannot simply trim alpha. It samples the
     * corners for the background colour, finds the character's bounding box
     * against it, and infers the pixel block size from the shortest repeated
     * horizontal runs.
     */
    static CharacterSpec measure(byte[] imageBytes) throws IOException {
        BufferedImage image = ImageIO.read(new java.io.ByteArrayInputStream(imageBytes));
        if (image == null) {
            throw new IOException("unreadable reference image");
        }

        int width = image.getWidth();
        int height = image.getHeight();
        int background = dominantCornerColor(image);

        int minX = width;
        int minY = height;
        int maxX = -1;
        int maxY = -1;

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                if (isForeground(image.getRGB(x, y), background)) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (maxX < 0 || maxY < 0) {
            throw new IOException("reference image appears to be blank");
        }

        int characterHeight = maxY - minY + 1;
        int characterWidth = maxX - minX + 1;
        int pixelBlock = inferPixelBlock(image, background, minX, maxX, minY, maxY);

        return new CharacterSpec(
                // Normalise output to a power-of-two canvas regardless of how
                // the reference happens to be exported.
                1024,
                (double) characterHeight / height,
                (double) characterWidth / width,
                estimateHeadRatio(image, background, minX, maxX, minY, characterHeight),
                (double) (maxY + 1) / height,
                (double) minY / height,
                pixelBlock,
                Math.max(1, characterHeight / Math.max(1, pixelBlock)));
    }

    private static boolean isForeground(int argb, int background) {
        int alpha = (argb >>> 24) & 0xFF;
        if (alpha < 16) {
            return false;
        }
        return distance(argb, background) > BACKGROUND_TOLERANCE;
    }

    private static int distance(int first, int second) {
        int dr = Math.abs(((first >> 16) & 0xFF) - ((second >> 16) & 0xFF));
        int dg = Math.abs(((first >> 8) & 0xFF) - ((second >> 8) & 0xFF));
        int db = Math.abs((first & 0xFF) - (second & 0xFF));
        return Math.max(dr, Math.max(dg, db));
    }

    /** The background is whatever colour dominates the four corner patches. */
    private static int dominantCornerColor(BufferedImage image) {
        Map<Integer, Integer> counts = new HashMap<>();
        int patch = Math.max(4, Math.min(image.getWidth(), image.getHeight()) / 32);

        for (int[] origin : new int[][] {
            {0, 0},
            {image.getWidth() - patch, 0},
            {0, image.getHeight() - patch},
            {image.getWidth() - patch, image.getHeight() - patch}
        }) {
            for (int y = origin[1]; y < origin[1] + patch; y++) {
                for (int x = origin[0]; x < origin[0] + patch; x++) {
                    counts.merge(image.getRGB(x, y), 1, Integer::sum);
                }
            }
        }

        return counts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(0xFFFFFFFF);
    }

    /**
     * Infers device-pixels-per-logical-pixel from the shortest colour runs.
     *
     * <p>Pixel art upscaled by N produces runs that are multiples of N, so the
     * smallest commonly-occurring run is a good estimate of N. Taking the
     * minimum outright would be fooled by a single stray antialiased pixel, so
     * this takes the most frequent short run instead.
     */
    private static int inferPixelBlock(
            BufferedImage image, int background, int minX, int maxX, int minY, int maxY) {

        Map<Integer, Integer> runHistogram = new HashMap<>();

        for (int y = minY; y <= maxY; y += Math.max(1, (maxY - minY) / 120)) {
            int runLength = 0;
            int previous = Integer.MIN_VALUE;

            for (int x = minX; x <= maxX; x++) {
                int current = image.getRGB(x, y);
                if (current == previous) {
                    runLength++;
                } else {
                    if (previous != Integer.MIN_VALUE
                            && runLength > 0
                            && isForeground(previous, background)) {
                        runHistogram.merge(runLength, 1, Integer::sum);
                    }
                    previous = current;
                    runLength = 1;
                }
            }
        }

        return runHistogram.entrySet().stream()
                .filter(entry -> entry.getKey() >= 1 && entry.getKey() <= 32)
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(1);
    }

    /**
     * Estimates where the head ends by finding the narrowest row in the upper
     * half of the character — the neck.
     */
    private static double estimateHeadRatio(
            BufferedImage image, int background, int minX, int maxX, int minY, int characterHeight) {

        int searchFrom = minY + (int) (characterHeight * 0.18);
        int searchTo = minY + (int) (characterHeight * 0.45);

        int narrowestRow = -1;
        int narrowestWidth = Integer.MAX_VALUE;

        for (int y = searchFrom; y <= searchTo && y < image.getHeight(); y++) {
            int left = -1;
            int right = -1;
            for (int x = minX; x <= maxX; x++) {
                if (isForeground(image.getRGB(x, y), background)) {
                    if (left < 0) left = x;
                    right = x;
                }
            }
            if (left >= 0) {
                int rowWidth = right - left + 1;
                if (rowWidth < narrowestWidth) {
                    narrowestWidth = rowWidth;
                    narrowestRow = y;
                }
            }
        }

        if (narrowestRow < 0) {
            return CharacterSpec.reference().headRatio();
        }
        return (double) (narrowestRow - minY) / characterHeight;
    }

    /** Test seam. */
    static byte[] toPng(BufferedImage image) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }
}
