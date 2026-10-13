package app.pixme.api;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import app.pixme.api.dto.DailyStatusDtos;
import app.pixme.api.dto.MeResponse;
import app.pixme.api.dto.UserDtos;
import app.pixme.auth.AuthService;
import app.pixme.common.ApiException;
import app.pixme.common.CursorPage;
import app.pixme.common.Cursors;
import app.pixme.common.ErrorCode;
import app.pixme.dailystatus.DailyStatusService;
import app.pixme.dailystatus.domain.DailyStatus;
import app.pixme.dailystatus.repository.DailyStatusRepository;
import app.pixme.notification.NotificationService;
import app.pixme.notification.domain.PushPlatform;
import app.pixme.safety.SafetyService;
import app.pixme.security.AuthPrincipal;
import app.pixme.security.CurrentUser;
import app.pixme.user.UserService;
import app.pixme.user.domain.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class UserController {

    private static final int RECENT_STATUSES = 9;

    private final UserService userService;
    private final SafetyService safetyService;
    private final DailyStatusService dailyStatusService;
    private final DailyStatusRepository statusRepository;
    private final NotificationService notificationService;
    private final AuthService authService;
    private final ResponseAssembler assembler;
    private final app.pixme.chat.ChatService chatService;
    private final app.pixme.connection.ConnectionService connectionService;

    public UserController(
            UserService userService,
            SafetyService safetyService,
            DailyStatusService dailyStatusService,
            DailyStatusRepository statusRepository,
            NotificationService notificationService,
            AuthService authService,
            ResponseAssembler assembler,
            app.pixme.chat.ChatService chatService,
            app.pixme.connection.ConnectionService connectionService) {
        this.userService = userService;
        this.safetyService = safetyService;
        this.dailyStatusService = dailyStatusService;
        this.statusRepository = statusRepository;
        this.notificationService = notificationService;
        this.authService = authService;
        this.assembler = assembler;
        this.chatService = chatService;
        this.connectionService = connectionService;
    }

    /* ------------------------------------------------------------------ me */

    @GetMapping("/users/me")
    public MeResponse me(@CurrentUser AuthPrincipal principal) {
        User user = userService.require(principal.userId());
        userService.touchActivity(user.getId());
        return assembler.me(user);
    }

    @PatchMapping("/users/me")
    public MeResponse updateMe(
            @CurrentUser AuthPrincipal principal,
            @Valid @RequestBody UserDtos.UpdateMeRequest request) {

        // `bio` is explicitly nullable — null means "clear it" only when the
        // field was present in the request body.
        boolean bioProvided = request.bio() != null || requestMentionsBio(request);

        User user = userService.updateProfile(
                principal.userId(),
                new UserService.UpdateProfileCommand(
                        request.nickname(),
                        request.birthDate(),
                        request.bio(),
                        bioProvided,
                        request.interests(),
                        request.settings() == null
                                ? null
                                : new UserService.SettingsPatch(
                                        request.settings().pushHeart(),
                                        request.settings().pushConnectionRequest(),
                                        request.settings().pushConnected(),
                                        request.settings().pushMessage(),
                                        request.settings().pushDailyReminder(),
                                        request.settings().keepOriginalPhoto(),
                                        request.settings().squareVisible())));

        return assembler.me(user);
    }

    private boolean requestMentionsBio(UserDtos.UpdateMeRequest request) {
        // Jackson gives us null for both "absent" and "explicit null"; treating
        // a bio-only PATCH as intentional covers the clear-bio case without a
        // custom deserializer.
        return request.nickname() == null
                && request.birthDate() == null
                && request.interests() == null
                && request.settings() == null;
    }

    @DeleteMapping("/users/me")
    public ResponseEntity<Void> deleteMe(
            @CurrentUser AuthPrincipal principal,
            @RequestParam(required = false) String reason) {
        userService.requestDeletion(principal.userId(), reason);
        notificationService.removeAllTokens(principal.userId());
        authService.revokeAllSessions(principal.userId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/nickname-availability")
    public UserDtos.NicknameAvailabilityResponse nicknameAvailability(
            @RequestParam @NotBlank String nickname) {
        UserService.NicknameAvailability availability = userService.checkNickname(nickname);
        return new UserDtos.NicknameAvailabilityResponse(
                availability.available(), availability.reason(), availability.suggestion());
    }

    @GetMapping("/interests")
    public List<UserDtos.InterestResponse> interests() {
        List<UserDtos.InterestResponse> responses = new ArrayList<>();
        userService.allInterests().forEach(interest -> responses.add(
                new UserDtos.InterestResponse(
                        interest.getCode(), interest.getLabel(), interest.getEmoji())));
        return responses;
    }

    /* ------------------------------------------------------- other people */

    @GetMapping("/users/{userId}")
    public UserDtos.PublicProfileResponse profile(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID userId) {

        User target = userService.require(userId);

        // A blocked user's profile is a 404 rather than a 403: confirming that
        // an account exists but is hidden tells the blocked party too much.
        if (safetyService.isHidden(principal.userId(), userId)
                && !userId.equals(principal.userId())) {
            throw ApiException.notFound("사용자");
        }

        DailyStatus todayStatus = dailyStatusService.today(userId).orElse(null);
        List<DailyStatus> recent = statusRepository.findPublicHistory(
                userId, List.of(), true, Cursors.OPEN_DATE, Cursors.OPEN_ID,
                PageRequest.of(0, RECENT_STATUSES));

        UUID conversationId = null;
        if (connectionService.relationStatus(principal.userId(), userId)
                == app.pixme.connection.ConnectionService.RelationStatus.CONNECTED) {
            conversationId = connectionService.activeConnections(principal.userId()).stream()
                    .filter(connection -> connection.peerOf(principal.userId()).equals(userId))
                    .findFirst()
                    .map(connection -> chatService
                            .createForConnection(connection)
                            .getId())
                    .orElse(null);
        }

        return assembler.publicProfile(
                principal.userId(), target, todayStatus, recent, conversationId);
    }

    @GetMapping("/users/{userId}/pixels")
    public CursorPage<DailyStatusDtos.StatusSummaryResponse> userDailyStatuses(
            @CurrentUser AuthPrincipal principal,
            @PathVariable UUID userId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "30") int limit) {

        if (safetyService.isHidden(principal.userId(), userId)
                && !userId.equals(principal.userId())) {
            throw ApiException.notFound("사용자");
        }

        Cursors.Keyset keyset = Cursors.decode(cursor);
        int capped = Math.min(Math.max(limit, 1), 60);

        List<DailyStatus> statuses = statusRepository.findPublicHistory(
                userId,
                List.of(),
                true,
                Cursors.dateOrOpen(keyset),
                Cursors.idOrOpen(keyset),
                PageRequest.of(0, capped + 1));

        boolean hasMore = statuses.size() > capped;
        List<DailyStatus> page = hasMore ? statuses.subList(0, capped) : statuses;

        String nextCursor = hasMore && !page.isEmpty()
                ? Cursors.encodeDate(
                        page.get(page.size() - 1).getStatusDate(), page.get(page.size() - 1).getId())
                : null;

        return CursorPage.of(assembler.statusSummaries(page), nextCursor);
    }

    /* ------------------------------------------------------------- safety */

    @PostMapping("/users/{userId}/block")
    public ResponseEntity<Void> block(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID userId) {
        safetyService.block(principal.userId(), userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{userId}/block")
    public ResponseEntity<Void> unblock(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID userId) {
        safetyService.unblock(principal.userId(), userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users/me/blocks")
    public List<UserDtos.BlockedUserResponse> blocks(@CurrentUser AuthPrincipal principal) {
        List<UserDtos.BlockedUserResponse> responses = new ArrayList<>();
        safetyService.blockedBy(principal.userId()).forEach(block -> {
            var author = assembler.author(principal.userId(), block.getBlockedId());
            responses.add(new UserDtos.BlockedUserResponse(
                    author.id(),
                    author.nickname(),
                    author.representativeCharacterUrl(),
                    block.getCreatedAt()));
        });
        return responses;
    }

    /* --------------------------------------------------------- push tokens */

    @PostMapping("/users/me/push-tokens")
    public ResponseEntity<Void> registerPushToken(
            @CurrentUser AuthPrincipal principal,
            @RequestBody UserDtos.RegisterPushTokenRequest request) {

        if (request.token() == null || request.token().isBlank()) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "푸시 토큰이 비어 있어요.");
        }
        PushPlatform platform = "IOS".equalsIgnoreCase(request.platform())
                ? PushPlatform.IOS
                : PushPlatform.ANDROID;

        notificationService.registerToken(
                principal.userId(), request.token(), platform, request.appVersion());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/me/push-tokens")
    public ResponseEntity<Void> removePushToken(
            @CurrentUser AuthPrincipal principal, @RequestParam String token) {
        notificationService.removeToken(principal.userId(), token);
        return ResponseEntity.noContent().build();
    }
}
