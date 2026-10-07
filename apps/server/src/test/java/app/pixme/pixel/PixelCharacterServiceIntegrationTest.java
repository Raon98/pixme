package app.pixme.pixel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.common.ServiceClock;
import app.pixme.dailystatus.DailyStatusService;
import app.pixme.dailystatus.domain.DailyStatus;
import app.pixme.pixel.domain.PixelCharacter;
import app.pixme.pixel.domain.PixelGeneration;
import app.pixme.support.IntegrationTest;
import app.pixme.support.TestFixtures;
import app.pixme.user.UserService;
import app.pixme.user.domain.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The bright line the whole paid model rests on: {@link PixelCharacterService#keep}
 * is the only path that grows the Collection and the only thing that was ever
 * paid for; {@link PixelCharacterService#setCurrent} is a free, unlimited
 * switch among what's already owned. Unlike the old one-post-per-day rule,
 * nothing here gates on "today" at all — a user can keep as many characters as
 * generations they've paid for, any day.
 */
@IntegrationTest
class PixelCharacterServiceIntegrationTest {

    @Autowired
    private PixelCharacterService characterService;

    @Autowired
    private DailyStatusService dailyStatusService;

    @Autowired
    private UserService userService;

    @Autowired
    private ServiceClock clock;

    @Autowired
    private TestFixtures fixtures;

    @Test
    @DisplayName("생성 결과를 선택으로 보관하면 Collection과 Current PIXME, 오늘의 상태가 함께 갱신된다")
    void keepAsCurrentPropagatesEverywhere() {
        User user = fixtures.activeUser("keep");
        PixelGeneration generation = fixtures.completedGeneration(user.getId(), clock.today());

        PixelCharacter character =
                characterService.keep(user.getId(), generation.getId(), true, true, null);

        assertThat(characterService.collection(user.getId())).hasSize(1);
        assertThat(characterService.currentCharacterId(user.getId())).isEqualTo(character.getId());
        assertThat(userService.statsOf(user.getId()).getPixelCount()).isEqualTo(1);

        DailyStatus today = dailyStatusService.today(user.getId()).orElseThrow();
        assertThat(today.getPixelCharacterId()).isEqualTo(character.getId());
        assertThat(today.isFreshCharacter()).isTrue();
    }

    @Test
    @DisplayName("보관하지 않고 비교만 해도 되고, 같은 생성을 다시 보관 요청해도 멱등이다")
    void keepIsIdempotentPerGeneration() {
        User user = fixtures.activeUser("idem");
        PixelGeneration generation = fixtures.completedGeneration(user.getId(), clock.today());

        PixelCharacter first = characterService.keep(user.getId(), generation.getId(), false, true, null);
        PixelCharacter second = characterService.keep(user.getId(), generation.getId(), false, true, null);

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(characterService.collection(user.getId())).hasSize(1);
    }

    @Test
    @DisplayName("기존 Collection 캐릭터로 Current를 바꾸는 것은 무료이고 새 캐릭터를 만들지 않는다")
    void setCurrentIsFreeAndCreatesNoCharacter() {
        User user = fixtures.activeUser("switch");
        PixelGeneration firstGen = fixtures.completedGeneration(user.getId(), clock.today());
        PixelGeneration secondGen = fixtures.completedGeneration(user.getId(), clock.today());

        PixelCharacter first = characterService.keep(user.getId(), firstGen.getId(), true, true, null);
        PixelCharacter second = characterService.keep(user.getId(), secondGen.getId(), true, true, null);
        assertThat(characterService.currentCharacterId(user.getId())).isEqualTo(second.getId());

        characterService.setCurrent(user.getId(), first.getId());

        assertThat(characterService.currentCharacterId(user.getId())).isEqualTo(first.getId());
        assertThat(characterService.collection(user.getId())).hasSize(2);
        assertThat(dailyStatusService.today(user.getId()).orElseThrow().getPixelCharacterId())
                .isEqualTo(first.getId());
    }

    @Test
    @DisplayName("오늘 상태 없이 생성만 해도 Current PIXME 변경 시 오늘의 상태가 새로 생긴다")
    void firstKeepCreatesTodayRowEvenWithoutAnExplicitStatus() {
        User user = fixtures.activeUser("firstrow");
        PixelGeneration generation = fixtures.completedGeneration(user.getId(), clock.today());

        assertThat(dailyStatusService.today(user.getId())).isEmpty();

        characterService.keep(user.getId(), generation.getId(), true, true, null);

        assertThat(dailyStatusService.today(user.getId())).isPresent();
    }

    @Test
    @DisplayName("현재 사용 중인 PIXME는 삭제할 수 없다")
    void cannotDeleteCurrentCharacter() {
        User user = fixtures.activeUser("delcur");
        PixelGeneration generation = fixtures.completedGeneration(user.getId(), clock.today());
        PixelCharacter character = characterService.keep(user.getId(), generation.getId(), true, true, null);

        assertThatThrownBy(() -> characterService.delete(user.getId(), character.getId()))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("Current가 아닌 PIXME는 삭제할 수 있고, Collection에서 사라진다")
    void deletesNonCurrentCharacter() {
        User user = fixtures.activeUser("delother");
        PixelGeneration firstGen = fixtures.completedGeneration(user.getId(), clock.today());
        PixelGeneration secondGen = fixtures.completedGeneration(user.getId(), clock.today());

        PixelCharacter first = characterService.keep(user.getId(), firstGen.getId(), true, true, null);
        characterService.keep(user.getId(), secondGen.getId(), true, true, null);

        characterService.delete(user.getId(), first.getId());

        assertThat(characterService.collection(user.getId())).hasSize(1);
    }

    @Test
    @DisplayName("원본 사진을 지워도 캐릭터와 Collection 기록은 남는다")
    void deletingOriginalKeepsCharacter() {
        User user = fixtures.activeUser("orig");
        PixelGeneration generation = fixtures.completedGeneration(user.getId(), clock.today());
        PixelCharacter character = characterService.keep(user.getId(), generation.getId(), true, true, null);
        assertThat(character.hasOriginal()).isTrue();

        characterService.deleteOriginal(user.getId(), character.getId());

        PixelCharacter reloaded = characterService.collection(user.getId()).stream()
                .filter(candidate -> candidate.getId().equals(character.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(reloaded.hasOriginal()).isFalse();
        assertThat(reloaded.getCharacterObjectKey()).isNotNull();

        assertThatThrownBy(() -> characterService.originalUrl(user.getId(), character.getId()))
                .isInstanceOf(ApiException.class)
                .extracting(error -> ((ApiException) error).code())
                .isEqualTo(ErrorCode.ORIGINAL_NOT_AVAILABLE);
    }
}
