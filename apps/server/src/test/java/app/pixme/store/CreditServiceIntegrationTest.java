package app.pixme.store;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.store.domain.CreditReason;
import app.pixme.support.IntegrationTest;
import app.pixme.support.TestFixtures;
import app.pixme.user.domain.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The money path. These assertions are the ones that must never regress: a
 * user gets exactly one free generation a day, paid credits are spent only
 * after it, and a failure always gives back what it took — once.
 */
@IntegrationTest
class CreditServiceIntegrationTest {

    @Autowired
    private CreditService creditService;

    @Autowired
    private TestFixtures fixtures;

    @Test
    @DisplayName("하루 첫 생성은 무료이고, 그 다음은 생성권을 쓴다")
    void spendsFreeSlotBeforePaidCredits() {
        User user = fixtures.activeUser("free");
        creditService.grant(user.getId(), 2, CreditReason.PROMOTION, null);

        assertThat(creditService.spendForGeneration(user.getId(), UUID.randomUUID()))
                .isEqualTo(CreditService.SpendKind.FREE_DAILY);

        // The free slot is gone, but the purchased credits are untouched.
        assertThat(creditService.allowance(user.getId()).creditBalance()).isEqualTo(2);

        assertThat(creditService.spendForGeneration(user.getId(), UUID.randomUUID()))
                .isEqualTo(CreditService.SpendKind.PAID_CREDIT);
        assertThat(creditService.allowance(user.getId()).creditBalance()).isEqualTo(1);
    }

    @Test
    @DisplayName("무료도 생성권도 없으면 생성을 거부한다")
    void refusesWhenNothingLeft() {
        User user = fixtures.activeUser("empty");

        creditService.spendForGeneration(user.getId(), UUID.randomUUID());

        assertThatThrownBy(() ->
                        creditService.spendForGeneration(user.getId(), UUID.randomUUID()))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.NO_GENERATION_AVAILABLE);
    }

    @Test
    @DisplayName("실패한 유료 생성은 생성권을 자동으로 돌려준다")
    void refundsPaidGenerationOnFailure() {
        User user = fixtures.activeUser("refund");
        creditService.grant(user.getId(), 1, CreditReason.PURCHASE, null);

        // Burn the free slot first so the next spend is a paid credit.
        creditService.spendForGeneration(user.getId(), UUID.randomUUID());

        UUID generationId = UUID.randomUUID();
        assertThat(creditService.spendForGeneration(user.getId(), generationId))
                .isEqualTo(CreditService.SpendKind.PAID_CREDIT);
        assertThat(creditService.allowance(user.getId()).creditBalance()).isZero();

        assertThat(creditService.refundForGeneration(user.getId(), generationId)).isTrue();
        assertThat(creditService.allowance(user.getId()).creditBalance()).isEqualTo(1);
    }

    @Test
    @DisplayName("같은 생성에 대한 환불은 두 번 일어나지 않는다")
    void refundIsIdempotent() {
        User user = fixtures.activeUser("once");
        creditService.grant(user.getId(), 1, CreditReason.PURCHASE, null);
        creditService.spendForGeneration(user.getId(), UUID.randomUUID());

        UUID generationId = UUID.randomUUID();
        creditService.spendForGeneration(user.getId(), generationId);

        assertThat(creditService.refundForGeneration(user.getId(), generationId)).isTrue();
        // A retried refund — from a reaper and an error handler racing — must
        // not hand out a second credit.
        assertThat(creditService.refundForGeneration(user.getId(), generationId)).isFalse();
        assertThat(creditService.allowance(user.getId()).creditBalance()).isEqualTo(1);
    }

    @Test
    @DisplayName("실패한 무료 생성은 그날의 무료 기회를 돌려준다")
    void restoresFreeSlotOnFailure() {
        User user = fixtures.activeUser("freeback");

        creditService.spendForGeneration(user.getId(), UUID.randomUUID());
        assertThat(creditService.allowance(user.getId()).freeAvailable()).isFalse();

        creditService.restoreFreeGeneration(user.getId());
        assertThat(creditService.allowance(user.getId()).freeAvailable()).isTrue();
    }

    @Test
    @DisplayName("모든 유료 변동은 원장에 남는다")
    void everyPaidMovementIsLedgered() {
        User user = fixtures.activeUser("ledger");
        creditService.grant(user.getId(), 3, CreditReason.PURCHASE, UUID.randomUUID());
        creditService.spendForGeneration(user.getId(), UUID.randomUUID()); // free
        UUID paid = UUID.randomUUID();
        creditService.spendForGeneration(user.getId(), paid);

        var history = creditService.history(user.getId(), 10);

        assertThat(history).hasSize(2);
        assertThat(history)
                .extracting(entry -> entry.getReason())
                .containsExactly(CreditReason.GENERATION, CreditReason.PURCHASE);
        assertThat(history.get(0).getBalanceAfter()).isEqualTo(2);
    }
}
