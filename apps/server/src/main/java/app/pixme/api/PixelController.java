package app.pixme.api;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import app.pixme.ai.PixelStyle;
import app.pixme.api.dto.PixelDtos;
import app.pixme.common.ApiException;
import app.pixme.common.CursorPage;
import app.pixme.common.Cursors;
import app.pixme.common.ErrorCode;
import app.pixme.feed.FeedService;
import app.pixme.pixel.GenerationService;
import app.pixme.pixel.PixelPostService;
import app.pixme.pixel.domain.PixelGeneration;
import app.pixme.pixel.domain.PixelPost;
import app.pixme.security.AuthPrincipal;
import app.pixme.security.CurrentUser;
import app.pixme.store.CreditService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The create flow and PIXME reads.
 *
 * <p>Route order matters here: {@code /pixels/today} and
 * {@code /pixels/today-status} are declared before {@code /pixels/{postId}} so
 * the literal paths are not swallowed by the UUID path variable.
 */
@RestController
@RequestMapping("/api/v1/pixels")
public class PixelController {

    private final GenerationService generationService;
    private final PixelPostService postService;
    private final FeedService feedService;
    private final CreditService creditService;
    private final ResponseAssembler assembler;

    public PixelController(
            GenerationService generationService,
            PixelPostService postService,
            FeedService feedService,
            CreditService creditService,
            ResponseAssembler assembler) {
        this.generationService = generationService;
        this.postService = postService;
        this.feedService = feedService;
        this.creditService = creditService;
        this.assembler = assembler;
    }

    /* ------------------------------------------------------------ uploads */

    @PostMapping("/uploads")
    public PixelDtos.UploadTicketResponse createUpload(
            @CurrentUser AuthPrincipal principal,
            @Valid @RequestBody PixelDtos.CreateUploadRequest request) {

        GenerationService.UploadTicket ticket = generationService.createUpload(
                principal.userId(), request.mimeType(), request.byteSize());

        return new PixelDtos.UploadTicketResponse(
                ticket.uploadId().toString(),
                ticket.uploadUrl(),
                Map.copyOf(ticket.headers()),
                ticket.expiresAt());
    }

    /* --------------------------------------------------------- generation */

    @PostMapping("/generate")
    public PixelDtos.GenerationResponse generate(
            @CurrentUser AuthPrincipal principal,
            @Valid @RequestBody PixelDtos.StartGenerationRequest request) {

        PixelGeneration generation = generationService.start(
                principal.userId(), parseUuid(request.uploadId()), parseStyle(request.style()));
        return assembler.generation(generation);
    }

    @PostMapping("/generate/retry")
    public PixelDtos.GenerationResponse retry(
            @CurrentUser AuthPrincipal principal,
            @Valid @RequestBody PixelDtos.RetryGenerationRequest request) {

        PixelGeneration generation = generationService.retry(
                principal.userId(),
                parseUuid(request.generationId()),
                parseStyle(request.style()));
        return assembler.generation(generation);
    }

    @GetMapping("/generations/{generationId}")
    public PixelDtos.GenerationResponse generation(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID generationId) {
        return assembler.generation(generationService.get(principal.userId(), generationId));
    }

    /* ------------------------------------------------------------ publish */

    @PostMapping("/{generationId}/publish")
    public PixelDtos.PostResponse publish(
            @CurrentUser AuthPrincipal principal,
            @PathVariable UUID generationId,
            @Valid @RequestBody PixelDtos.PublishRequest request) {

        PixelPost post = postService.publish(
                principal.userId(),
                generationId,
                new PixelPostService.PublishCommand(
                        request.caption(),
                        request.mood(),
                        request.tags() == null ? List.of() : request.tags(),
                        request.replaceRepresentative()));

        return assembler.post(principal.userId(), post);
    }

    /* --------------------------------------------------------------- feed */

    @GetMapping("/today")
    public CursorPage<PixelDtos.PostResponse> todayFeed(
            @CurrentUser AuthPrincipal principal,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {

        FeedService.FeedPage page = feedService.today(principal.userId(), cursor, limit);
        return CursorPage.of(
                assembler.posts(principal.userId(), page.posts()), page.nextCursor());
    }

    @GetMapping("/today-status")
    public PixelDtos.TodayStatusResponse todayStatus(@CurrentUser AuthPrincipal principal) {
        PixelPost todayPost = postService.findTodayRepresentative(principal.userId()).orElse(null);
        CreditService.Allowance allowance = creditService.allowance(principal.userId());
        String pendingGenerationId = generationService
                .latestUnpublishedCandidate(principal.userId())
                .map(generation -> generation.getId().toString())
                .orElse(null);

        return new PixelDtos.TodayStatusResponse(
                todayPost == null ? null : assembler.post(principal.userId(), todayPost),
                allowance.freeAvailable(),
                allowance.creditBalance(),
                pendingGenerationId);
    }

    /* ------------------------------------------------------------ history */

    @GetMapping("/me")
    public CursorPage<PixelDtos.MyPostResponse> myPixels(
            @CurrentUser AuthPrincipal principal,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "30") int limit) {

        int capped = Math.min(Math.max(limit, 1), 60);
        Cursors.Keyset keyset = Cursors.decode(cursor);

        List<PixelPost> posts = postService.history(
                principal.userId(),
                keyset == null ? null : LocalDate.ofInstant(keyset.timestamp(), ZoneOffset.UTC),
                keyset == null ? null : keyset.id(),
                capped + 1);

        boolean hasMore = posts.size() > capped;
        List<PixelPost> page = hasMore ? posts.subList(0, capped) : posts;

        String nextCursor = hasMore && !page.isEmpty()
                ? Cursors.encodeDate(
                        page.get(page.size() - 1).getPostDate(), page.get(page.size() - 1).getId())
                : null;

        return CursorPage.of(assembler.myPosts(principal.userId(), page), nextCursor);
    }

    @GetMapping("/me/{postId}")
    public PixelDtos.MyPostResponse myPixel(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID postId) {
        return assembler.myPost(
                principal.userId(), postService.getOwned(principal.userId(), postId));
    }

    /* ------------------------------------------------------------- detail */

    @GetMapping("/{postId}")
    public PixelDtos.PostResponse detail(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID postId) {
        return assembler.post(
                principal.userId(), postService.getVisible(principal.userId(), postId));
    }

    /* ----------------------------------------------------------- original */

    /**
     * Issues a short-lived signed URL for the owner's own original photo.
     *
     * <p>Separate endpoint on purpose: no list or detail response ever carries
     * a usable link to an original, so seeing one always requires a deliberate,
     * auditable request.
     */
    @GetMapping("/{postId}/original")
    public PixelDtos.SignedUrlResponse original(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID postId) {
        PixelPostService.SignedUrl signed =
                postService.originalUrl(principal.userId(), postId);
        return new PixelDtos.SignedUrlResponse(signed.url(), signed.expiresAt());
    }

    @DeleteMapping("/{postId}/original")
    public ResponseEntity<Void> deleteOriginal(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID postId) {
        postService.deleteOriginal(principal.userId(), postId);
        return ResponseEntity.noContent().build();
    }

    /* ------------------------------------------------------------- mutate */

    @PostMapping("/{postId}/unpublish")
    public PixelDtos.PostResponse unpublish(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID postId) {
        return assembler.post(
                principal.userId(), postService.unpublish(principal.userId(), postId));
    }

    @DeleteMapping("/{postId}")
    public ResponseEntity<Void> delete(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID postId) {
        postService.delete(principal.userId(), postId);
        return ResponseEntity.noContent().build();
    }

    /* ------------------------------------------------------------ helpers */

    private UUID parseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "잘못된 요청이에요.");
        }
    }

    private PixelStyle parseStyle(String value) {
        if (value == null || value.isBlank()) {
            return PixelStyle.PIXME_BASIC;
        }
        try {
            return PixelStyle.valueOf(value);
        } catch (IllegalArgumentException exception) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "알 수 없는 스타일이에요.");
        }
    }
}
