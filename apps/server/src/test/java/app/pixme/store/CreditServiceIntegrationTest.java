package app.pixme.store;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.store.domain.CreditReason;
import app.pixme.store.domain.SpendKind;
import app.pixme.support.IntegrationTest;
import app.pixme.support.TestFixtures;
import app.pixme.user.domain.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The money path.
 *
 * <p>Free generation is an onboarding grant — first generation, one retry of
 * that first result, one bonus credit — and then everything is paid. These
 * assertions are the ones that must never regress.
 */
@IntegrationTest
class CreditServiceIntegrationTest {

    @Autowired
    private CreditService creditService;

    @Autowired
    private TestFixtures fixtures;

    @Test
    @DisplayName("신규 사용자는 무료 3회를 가진다 — 첫 생성, 첫 재생성, 보너스 1개")
    void newUserGetsThreeFreeChances() {
        User user = fixtures.activeUser("new");
        CreditService.Allowance allowance = creditService.allowance(user.getId());

        assertThat(allowance.firstGenerationAvailable()).isTrue();
        // The retry only exists once there is a first result to retry.
        assertThat(allowance.firstRetryAvailable()).isFalse();
        assertThat(allowance.bonusFreeCredits()).isEqualTo(1);
        assertThat(allowance.creditBalance()).isZero();
        assertThat(allowance.nextGenerationIsFree()).isTrue();
    }

    @Test
    @DisplayName("첫 생성 → 무료 Retry → 보너스 무료 → 그 다음부터 유료")
    void spendsFreeChancesInOrderThenRequiresPayment() {
        User user = fixtures.activeUser("order");

        // 1. the first PIXME
        assertThat(creditService.spendForGeneration(user.getId(), UUID.randomUUID()))
                .isEqualTo(SpendKind.FREE_FIRST);

        // The free retry only becomes available after the first generation.
        assertThat(creditService.allowance(user.getId()).firstRetryAvailable()).isTrue();

        // 2. the free retry of that first result
        assertThat(creditService.spendForFirstRetry(user.getId(), UUID.randomUUID()))
                .isEqualTo(SpendKind.FREE_FIRST_RETRY);

        // 3. the bonus credit, days later with a different outfit
        assertThat(creditService.spendForGeneration(user.getId(), UUID.randomUUID()))
                .isEqualTo(SpendKind.FREE_BONUS);

        // 4. and now it costs money
        assertThatThrownBy(() ->
                        creditService.spendForGeneration(user.getId(), UUID.randomUUID()))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.NO_GENERATION_AVAILABLE);
    }

    @Test
    @DisplayName("무료 Retry를 안 쓰고 넘어가도 일반 생성은 보너스를 먼저 쓴다")
    void normalGenerationNeverConsumesTheFirstRetry() {
        User user = fixtures.activeUser("skip");

        creditService.spendForGeneration(user.getId(), UUID.randomUUID()); // FREE_FIRST
        // A later "make another PIXME" must not quietly eat the retry — it is
        // scoped to the first result screen.
        assertThat(creditService.spendForGeneration(user.getId(), UUID.randomUUID()))
                .isEqualTo(SpendKind.FREE_BONUS);

        assertThat(creditService.allowance(user.getId()).firstRetryAvailable()).isTrue();
    }

    @Test
    @DisplayName("무료 Retry를 다 쓴 뒤의 재시도는 일반 순서를 따른다")
    void retryFallsThroughOnceUsed() {
        User user = fixtures.activeUser("fall");

        creditService.spendForGeneration(user.getId(), UUID.randomUUID()); // FREE_FIRST
        creditService.spendForFirstRetry(user.getId(), UUID.randomUUID()); // FREE_FIRST_RETRY

        assertThat(creditService.spendForFirstRetry(user.getId(), UUID.randomUUID()))
                .isEqualTo(SpendKind.FREE_BONUS);
    }

    @Test
    @DisplayName("유료 생성권은 무료를 모두 쓴 뒤에 소비된다")
    void paidCreditsComeLast() {
        User user = fixtures.activeUser("paid");
        creditService.grant(user.getId(), 2, CreditReason.PURCHASE, null);

        assertThat(creditService.spendForGeneration(user.getId(), UUID.randomUUID()))
                .isEqualTo(SpendKind.FREE_FIRST);
        // Buying credits must not forfeit the remaining free chances.
        assertThat(creditService.allowance(user.getId()).creditBalance()).isEqualTo(2);

        assertThat(creditService.spendForGeneration(user.getId(), UUID.randomUUID()))
                .isEqualTo(SpendKind.FREE_BONUS);
        assertThat(creditService.spendForGeneration(user.getId(), UUID.randomUUID()))
                .isEqualTo(SpendKind.PAID_CREDIT);
        assertThat(creditService.allowance(user.getId()).creditBalance()).isEqualTo(1);
    }

    @Test
    @DisplayName("실패하면 쓴 것과 '같은 종류'를 돌려준다")
    void refundReturnsTheSameCurrency() {
        User user = fixtures.activeUser("back");

        UUID first = UUID.randomUUID();
        creditService.spendForGeneration(user.getId(), first); // FREE_FIRST
        assertThat(creditService.allowance(user.getId()).firstGenerationAvailable()).isFalse();

        assertThat(creditService.refund(user.getId(), first, SpendKind.FREE_FIRST)).isTrue();

        CreditService.Allowance restored = creditService.allowance(user.getId());
        assertThat(restored.firstGenerationAvailable()).isTrue();
        // And the retry is correctly unavailable again — there is no first
        // result to retry.
        assertThat(restored.firstRetryAvailable()).isFalse();
        assertThat(restored.bonusFreeCredits()).isEqualTo(1);
    }

    @Test
    @DisplayName("무료 Retry 실패는 Retry만 돌려준다")
    void refundRestoresTheFreeRetryOnly() {
        User user = fixtures.activeUser("retry");

        creditService.spendForGeneration(user.getId(), UUID.randomUUID());
        UUID retryGeneration = UUID.randomUUID();
        creditService.spendForFirstRetry(user.getId(), retryGeneration);
        assertThat(creditService.allowance(user.getId()).firstRetryAvailable()).isFalse();

        creditService.refund(user.getId(), retryGeneration, SpendKind.FREE_FIRST_RETRY);

        CreditService.Allowance allowance = creditService.allowance(user.getId());
        assertThat(allowance.firstRetryAvailable()).isTrue();
        assertThat(allowance.bonusFreeCredits()).isEqualTo(1);
        assertThat(allowance.creditBalance()).isZero();
    }

    @Test
    @DisplayName("유료 생성권 환불은 두 번 일어나지 않는다")
    void paidRefundIsIdempotent() {
        User user = fixtures.activeUser("once");
        creditService.grant(user.getId(), 1, CreditReason.PURCHASE, null);
        creditService.spendForGeneration(user.getId(), UUID.randomUUID()); // FREE_FIRST
        creditService.spendForGeneration(user.getId(), UUID.randomUUID()); // FREE_BONUS

        UUID paid = UUID.randomUUID();
        assertThat(creditService.spendForGeneration(user.getId(), paid))
                .isEqualTo(SpendKind.PAID_CREDIT);

        assertThat(creditService.refund(user.getId(), paid, SpendKind.PAID_CREDIT)).isTrue();
        // A reaper and an error handler racing must not hand out two credits.
        assertThat(creditService.refund(user.getId(), paid, SpendKind.PAID_CREDIT)).isFalse();
        assertThat(creditService.allowance(user.getId()).creditBalance()).isEqualTo(1);
    }

    @Test
    @DisplayName("유료 변동만 원장에 남는다")
    void onlyPaidMovementsAreLedgered() {
        User user = fixtures.activeUser("ledger");
        creditService.grant(user.getId(), 3, CreditReason.PURCHASE, UUID.randomUUID());

        creditService.spendForGeneration(user.getId(), UUID.randomUUID()); // FREE_FIRST
        creditService.spendForGeneration(user.getId(), UUID.randomUUID()); // FREE_BONUS
        creditService.spendForGeneration(user.getId(), UUID.randomUUID()); // PAID_CREDIT

        var history = creditService.history(user.getId(), 10);

        // The two free spends are not ledger movements; mixing them in would
        // make `balance_after` meaningless.
        assertThat(history).hasSize(2);
        assertThat(history)
                .extracting(entry -> entry.getReason())
                .containsExactly(CreditReason.GENERATION, CreditReason.PURCHASE);
        assertThat(history.get(0).getBalanceAfter()).isEqualTo(2);
    }
}
