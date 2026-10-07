package app.pixme.api.dto;

import java.time.Instant;
import java.util.List;

/**
 * What a generation costs this user right now.
 *
 * <p>Free generation is an onboarding grant, not a daily allowance, so the
 * client needs the three free entitlements separately to show the right copy:
 * "첫 PIXME는 무료예요", "한 번 더 무료로 만들어보기", "무료 생성권 1개가 남아 있어요".
 */
public record EntitlementsResponse(
        boolean plusActive,
        Instant plusExpiresAt,
        boolean firstGenerationAvailable,
        boolean firstRetryAvailable,
        int bonusFreeCredits,
        int creditBalance,
        /** Convenience: starting a new PIXME right now costs nothing. */
        boolean nextGenerationIsFree,
        List<String> unlockedStyles,
        List<String> unlockedDecorations) {}
