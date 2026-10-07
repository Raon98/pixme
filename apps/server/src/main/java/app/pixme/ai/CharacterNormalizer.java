package app.pixme.ai;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import javax.imageio.ImageIO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Conforms a generated character to the Master Character Reference geometry.
 *
 * <p>This is the part that actually makes the rule true. A prompt can
 * <em>ask</em> for consistent scale, centring and foot position; it cannot
 * guarantee them, and image models drift — one render comes back 8% smaller,
 * the next sits 30px off-centre. In a square full of characters that reads
 * immediately as "these are from different apps".
 *
 * <p>So after generation every character is deterministically:
 * <ol>
 *   <li>trimmed to its transparent bounding box,
 *   <li>scaled with <b>nearest-neighbour</b> so its height matches the spec —
 *       anything smoother would destroy the pixel edges that are the whole
 *       point,
 *   <li>clamped if it is unusually wide, so a big silhouette can't dwarf the
 *       crowd,
 *   <li>centred horizontally, with the soles on the spec's baseline.
 * </ol>
 *
 * <p>The art — the person, the outfit, the colours — is never touched. Only the
 * frame it sits in.
 */
@Component
public class CharacterNormalizer {

    private static final Logger log = LoggerFactory.getLogger(CharacterNormalizer.class);

    /** Below this alpha a pixel is treated as empty when finding the bounds. */
    private static final int ALPHA_THRESHOLD = 12;

    private final MasterCharacterReference reference;

    public CharacterNormalizer(MasterCharacterReference reference) {
        this.reference = reference;
    }

    /**
     * @return the normalised PNG, or the input unchanged if it could not be
     *     processed — a normalisation failure must never cost the user a
     *     generation they already paid for
     */
    public byte[] normalize(byte[] pngBytes) {
        CharacterSpec spec = reference.spec();
        try {
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(pngBytes));
            if (source == null) {
                return pngBytes;
            }

            int[] bounds = alphaBounds(source);
            if (bounds == null) {
                log.warn("generated character is fully transparent; leaving it untouched");
                return pngBytes;
            }

            BufferedImage trimmed = source.getSubimage(
                    bounds[0], bounds[1], bounds[2] - bounds[0] + 1, bounds[3] - bounds[1] + 1);

            double scale = (double) spec.characterHeight() / trimmed.getHeight();
            int targetWidth = (int) Math.round(trimmed.getWidth() * scale);

            // A character that is unusually wide (arms out, a big bag) gets
            // scaled down to fit rather than cropped — losing the bag would be
            // worse than being slightly shorter than its neighbours.
            if (targetWidth > spec.maxCharacterWidth()) {
                scale *= (double) spec.maxCharacterWidth() / targetWidth;
                targetWidth = spec.maxCharacterWidth();
            }
            int targetHeight = Math.max(1, (int) Math.round(trimmed.getHeight() * scale));

            BufferedImage canvas = new BufferedImage(
                    spec.canvasSize(), spec.canvasSize(), BufferedImage.TYPE_INT_ARGB);

            int originX = (spec.canvasSize() - targetWidth) / 2;
            int originY = spec.footBaseline() - targetHeight;

            drawNearestNeighbour(trimmed, canvas, originX, originY, targetWidth, targetHeight);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(canvas, "png", out);
            return out.toByteArray();

        } catch (IOException | RuntimeException exception) {
            log.warn("character normalisation failed; using the raw render", exception);
            return pngBytes;
        }
    }

    /** @return {minX, minY, maxX, maxY} of non-transparent pixels, or null */
    private int[] alphaBounds(BufferedImage image) {
        int minX = image.getWidth();
        int minY = image.getHeight();
        int maxX = -1;
        int maxY = -1;

        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                int alpha = (image.getRGB(x, y) >>> 24) & 0xFF;
                if (alpha >= ALPHA_THRESHOLD) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        return maxX < 0 ? null : new int[] {minX, minY, maxX, maxY};
    }

    /**
     * Point-samples the source into the destination rectangle.
     *
     * <p>Deliberately hand-rolled rather than {@code Graphics2D.drawImage} with
     * a rendering hint: the JDK's nearest-neighbour path still blends alpha at
     * the edges on some platforms, which puts a soft halo around a sprite that
     * must have hard pixel edges.
     */
    private void drawNearestNeighbour(
            BufferedImage source,
            BufferedImage destination,
            int originX,
            int originY,
            int width,
            int height) {

        for (int y = 0; y < height; y++) {
            int destinationY = originY + y;
            if (destinationY < 0 || destinationY >= destination.getHeight()) {
                continue;
            }
            int sourceY = Math.min(
                    source.getHeight() - 1, (int) ((long) y * source.getHeight() / height));

            for (int x = 0; x < width; x++) {
                int destinationX = originX + x;
                if (destinationX < 0 || destinationX >= destination.getWidth()) {
                    continue;
                }
                int sourceX = Math.min(
                        source.getWidth() - 1, (int) ((long) x * source.getWidth() / width));
                destination.setRGB(destinationX, destinationY, source.getRGB(sourceX, sourceY));
            }
        }
    }
}
