package app.pixme.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import javax.imageio.ImageIO;

import org.assertj.core.data.Offset;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The character spec is <em>measured</em> from the reference image rather than
 * hardcoded, so that dropping in a new reference re-fixes the geometry. These
 * tests check the measurement against synthetic images with known proportions.
 */
class MasterCharacterReferenceTest {

    @Test
    @DisplayName("레퍼런스 이미지에서 캐릭터 비율을 측정한다")
    void measuresTheCharacterProportions() throws IOException {
        // 1000x1000 off-white canvas, character from y=50 to y=949 (90% tall),
        // x=400 to x=599 (20% wide).
        BufferedImage image = canvas(1000, 1000, 0xFFF5F2EF);
        fill(image, 400, 50, 200, 900, 0xFF2E2B26);

        CharacterSpec spec = MasterCharacterReference.measure(toPng(image));

        assertThat(spec.characterHeightRatio()).isCloseTo(0.90, Offset.offset(0.01));
        assertThat(spec.characterWidthRatio()).isCloseTo(0.20, Offset.offset(0.01));
        assertThat(spec.footBaselineRatio()).isCloseTo(0.95, Offset.offset(0.01));
        assertThat(spec.headroomRatio()).isCloseTo(0.05, Offset.offset(0.01));
        // Output is always normalised to a square power-of-two canvas,
        // regardless of how the reference happens to be exported.
        assertThat(spec.canvasSize()).isEqualTo(1024);
    }

    @Test
    @DisplayName("배경이 불투명해도 캐릭터를 찾아낸다")
    void findsTheCharacterAgainstAFlatBackground() throws IOException {
        // The shipped reference is exported on a flat background with a soft
        // ground shadow, so alpha-trimming would find nothing.
        BufferedImage image = canvas(400, 400, 0xFFF5F2EF);
        fill(image, 150, 40, 100, 320, 0xFF101010);
        // A shadow close to the background colour must not widen the bounds.
        fill(image, 120, 360, 160, 10, 0xFFEFECE9);

        CharacterSpec spec = MasterCharacterReference.measure(toPng(image));

        assertThat(spec.characterWidthRatio()).isCloseTo(100.0 / 400, Offset.offset(0.02));
    }

    @Test
    @DisplayName("목 위치로 머리 비율을 추정한다")
    void estimatesHeadRatioFromTheNarrowestRow() throws IOException {
        BufferedImage image = canvas(400, 400, 0xFFFFFFFF);
        // Head: wide block at the top.
        fill(image, 150, 40, 100, 90, 0xFF2E2B26);
        // Neck: narrow.
        fill(image, 190, 130, 20, 20, 0xFF2E2B26);
        // Body: wide again.
        fill(image, 140, 150, 120, 200, 0xFF2E2B26);

        CharacterSpec spec = MasterCharacterReference.measure(toPng(image));

        // Neck starts ~90px into a ~310px character.
        assertThat(spec.headRatio()).isCloseTo(0.29, Offset.offset(0.06));
        assertThat(spec.headsTall()).isBetween(2.5, 4.5);
    }

    @Test
    @DisplayName("업스케일된 픽셀 아트의 블록 크기를 추정한다")
    void infersThePixelBlockSize() throws IOException {
        BufferedImage image = canvas(320, 320, 0xFFFFFFFF);
        // 8px blocks in alternating colours — classic upscaled pixel art.
        for (int y = 40; y < 280; y += 8) {
            for (int x = 120; x < 200; x += 8) {
                int color = ((x / 8 + y / 8) % 2 == 0) ? 0xFF2E2B26 : 0xFF8A8A8A;
                fill(image, x, y, 8, 8, color);
            }
        }

        CharacterSpec spec = MasterCharacterReference.measure(toPng(image));

        assertThat(spec.pixelBlock()).isEqualTo(8);
    }

    @Test
    @DisplayName("기본 규격은 머리가 '약간' 큰 비율이다 — 치비도 사실적도 아니다")
    void defaultSpecIsSlightlyOversizedHead() {
        CharacterSpec spec = CharacterSpec.reference();

        // Realistic is ~7.5 heads, chibi is ~2. "Slightly oversized" sits
        // between, and that is the whole house style.
        assertThat(spec.headsTall()).isBetween(3.0, 3.6);
        assertThat(spec.characterHeightRatio()).isBetween(0.85, 0.96);
    }

    /* ------------------------------------------------------------ fixtures */

    private BufferedImage canvas(int width, int height, int background) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        fill(image, 0, 0, width, height, background);
        return image;
    }

    private void fill(BufferedImage image, int x, int y, int width, int height, int color) {
        for (int py = y; py < y + height && py < image.getHeight(); py++) {
            for (int px = x; px < x + width && px < image.getWidth(); px++) {
                image.setRGB(px, py, color);
            }
        }
    }

    private byte[] toPng(BufferedImage image) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }
}
