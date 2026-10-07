package app.pixme.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * The normaliser is what actually makes "every PIXME shares one skeleton" true.
 *
 * <p>A prompt can ask for consistent scale, centring and foot position; models
 * drift anyway. These tests pin the guarantee: whatever comes back, the stored
 * character is the same size, centred, and standing on the same line as
 * everyone else in the square.
 */
class CharacterNormalizerTest {

    private final CharacterSpec spec = CharacterSpec.reference();
    private final CharacterNormalizer normalizer = normalizerFor(spec);

    private CharacterNormalizer normalizerFor(CharacterSpec spec) {
        MasterCharacterReference reference = Mockito.mock(MasterCharacterReference.class);
        Mockito.when(reference.spec()).thenReturn(spec);
        return new CharacterNormalizer(reference);
    }

    @Test
    @DisplayName("크기가 제각각이어도 같은 캔버스·같은 키로 맞춰진다")
    void conformsEveryRenderToTheSameHeight() throws IOException {
        // Two "renders" of wildly different sizes, as providers actually drift.
        // Both are within the width budget, so height alone decides the scale.
        byte[] small = normalizer.normalize(sprite(512, 512, 40, 60, 100, 300));
        byte[] large = normalizer.normalize(sprite(2048, 2048, 10, 20, 600, 1800));

        BufferedImage first = read(small);
        BufferedImage second = read(large);

        assertThat(first.getWidth()).isEqualTo(spec.canvasSize());
        assertThat(second.getWidth()).isEqualTo(spec.canvasSize());

        int firstHeight = heightOf(first);
        int secondHeight = heightOf(second);

        // Both end up at the reference height, within a pixel of rounding.
        assertThat(firstHeight).isCloseTo(spec.characterHeight(), org.assertj.core.data.Offset.offset(2));
        assertThat(secondHeight).isCloseTo(spec.characterHeight(), org.assertj.core.data.Offset.offset(2));
    }

    @Test
    @DisplayName("발이 같은 바닥선에 서고, 가로로 가운데 정렬된다")
    void putsFeetOnTheBaselineAndCentresHorizontally() throws IOException {
        // A sprite sitting far off to one side and floating near the top.
        BufferedImage result = read(normalizer.normalize(sprite(900, 900, 20, 10, 150, 400)));

        int[] bounds = bounds(result);
        int bottom = bounds[3];
        int centre = (bounds[0] + bounds[2]) / 2;

        assertThat(bottom).isCloseTo(spec.footBaseline() - 1, org.assertj.core.data.Offset.offset(2));
        assertThat(centre)
                .isCloseTo(spec.canvasSize() / 2, org.assertj.core.data.Offset.offset(2));
    }

    @Test
    @DisplayName("비정상적으로 넓은 캐릭터는 폭 상한에 맞춰 줄인다")
    void clampsUnusuallyWideCharacters() throws IOException {
        // Arms out, a big bag: scaling by height alone would dwarf the crowd.
        BufferedImage result = read(normalizer.normalize(sprite(1000, 1000, 10, 10, 900, 300)));

        int[] bounds = bounds(result);
        int width = bounds[2] - bounds[0] + 1;

        assertThat(width).isLessThanOrEqualTo(spec.maxCharacterWidth() + 2);
        // Still standing on the baseline, not cropped.
        assertThat(bounds[3])
                .isCloseTo(spec.footBaseline() - 1, org.assertj.core.data.Offset.offset(2));
    }

    @Test
    @DisplayName("픽셀 경계가 흐려지지 않는다")
    void keepsPixelEdgesHard() throws IOException {
        BufferedImage result = read(normalizer.normalize(sprite(256, 256, 50, 50, 100, 150)));

        // Nearest-neighbour only: every pixel is either fully transparent or
        // fully opaque. Any intermediate alpha means something blended and the
        // sprite has a soft halo.
        for (int y = 0; y < result.getHeight(); y += 3) {
            for (int x = 0; x < result.getWidth(); x += 3) {
                int alpha = (result.getRGB(x, y) >>> 24) & 0xFF;
                assertThat(alpha).isIn(0, 255);
            }
        }
    }

    @Test
    @DisplayName("처리할 수 없는 입력은 원본을 그대로 돌려준다")
    void returnsTheInputWhenItCannotBeProcessed() {
        byte[] garbage = {1, 2, 3, 4};
        // A normalisation failure must never cost a generation the user paid for.
        assertThat(normalizer.normalize(garbage)).isEqualTo(garbage);
    }

    @Test
    @DisplayName("완전히 투명한 결과는 손대지 않는다")
    void leavesAFullyTransparentRenderAlone() throws IOException {
        byte[] blank = toPng(new BufferedImage(64, 64, BufferedImage.TYPE_INT_ARGB));
        assertThat(normalizer.normalize(blank)).isEqualTo(blank);
    }

    /* ------------------------------------------------------------ fixtures */

    /** A transparent canvas with one opaque rectangle standing in for a sprite. */
    private byte[] sprite(int canvas, int canvasHeight, int x, int y, int width, int height)
            throws IOException {
        BufferedImage image = new BufferedImage(canvas, canvasHeight, BufferedImage.TYPE_INT_ARGB);
        for (int py = y; py < y + height && py < canvasHeight; py++) {
            for (int px = x; px < x + width && px < canvas; px++) {
                image.setRGB(px, py, 0xFF2E2B26);
            }
        }
        return toPng(image);
    }

    private byte[] toPng(BufferedImage image) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    private BufferedImage read(byte[] bytes) throws IOException {
        return ImageIO.read(new ByteArrayInputStream(bytes));
    }

    private int heightOf(BufferedImage image) {
        int[] bounds = bounds(image);
        return bounds[3] - bounds[1] + 1;
    }

    /** {minX, minY, maxX, maxY} of opaque pixels. */
    private int[] bounds(BufferedImage image) {
        int minX = image.getWidth();
        int minY = image.getHeight();
        int maxX = -1;
        int maxY = -1;
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                if (((image.getRGB(x, y) >>> 24) & 0xFF) > 12) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        return new int[] {minX, minY, maxX, maxY};
    }
}
