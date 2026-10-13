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
 *   <li>alpha-binarised — every pixel forced fully transparent or fully
 *       opaque, nothing in between,
 *   <li>trimmed to its (now binary) bounding box,
 *   <li>scaled with <b>nearest-neighbour</b> so its height matches the spec —
 *       anything smoother would destroy the pixel edges that are the whole
 *       point,
 *   <li>clamped if it is unusually wide, so a big silhouette can't dwarf the
 *       crowd,
 *   <li>centred horizontally, with the soles on the spec's baseline.
 * </ol>
 *
 * <p>The binarisation step exists because the prompt alone cannot be trusted
 * to produce a genuinely transparent background: providers have repeatedly
 * painted a soft vignette/glow hugging the character — alpha fading smoothly
 * from ~255 at the silhouette down to 0 far out, never actually hitting zero
 * nearby. That gradient cannot be told apart from real character pixels by
 * alpha value alone at close range, so no amount of prompt wording fixes it
 * completely. Binarising with a single cutoff can't perfectly separate "real
 * edge" from "halo touching the edge" either, but it does two things reliably:
 * it discards the entire outer falloff of any such gradient (which is most of
 * its visible area), and it enforces the product's own "no anti-aliasing, no
 * soft gradients" rule on the character's own silhouette as a side effect.
 *
 * <p>The art — the person, the outfit, the colours — is never touched. Only the
 * frame it sits in.
 */
@Component
public class CharacterNormalizer {

    private static final Logger log = LoggerFactory.getLogger(CharacterNormalizer.class);

    /**
     * Alpha cutoff for binarisation: at or above this, a pixel becomes fully
     * opaque; below it, fully transparent. Deliberately above the midpoint —
     * erring toward discarding a borderline pixel (more likely to be
     * background haze) rather than keeping it (which would re-introduce a
     * soft edge). Tune by comparing real renders if character edges start
     * looking eaten into, or if halos survive past this cutoff.
     */
    private static final int ALPHA_THRESHOLD = 160;

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
            source = binarizeAlpha(source);

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

    /**
     * Forces every pixel fully opaque or fully transparent — no gradient
     * survives, including whatever a provider painted behind the character.
     */
    private BufferedImage binarizeAlpha(BufferedImage source) {
        BufferedImage result = new BufferedImage(
                source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < source.getHeight(); y++) {
            for (int x = 0; x < source.getWidth(); x++) {
                int argb = source.getRGB(x, y);
                int alpha = (argb >>> 24) & 0xFF;
                result.setRGB(x, y, alpha >= ALPHA_THRESHOLD ? (argb | 0xFF000000) : 0);
            }
        }
        return result;
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
