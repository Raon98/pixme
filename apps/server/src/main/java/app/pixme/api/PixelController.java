package app.pixme.api;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import app.pixme.ai.PixelStyle;
import app.pixme.api.dto.PixelDtos;
import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.pixel.GenerationService;
import app.pixme.pixel.PixelCharacterService;
import app.pixme.pixel.domain.PixelCharacter;
import app.pixme.pixel.domain.PixelGeneration;
import app.pixme.security.AuthPrincipal;
import app.pixme.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The create flow and the PIXME Collection.
 *
 * <p>Deliberately has no feed or "today" reads any more — those live on
 * {@code DailyStatusController}, because appearing on Today/광장 is gated on
 * having a {@code DailyStatus} row, not on anything here. This controller is
 * purely: turn a photo into a candidate, then decide whether to keep it.
 */
@RestController
@RequestMapping("/api/v1/pixels")
public class PixelController {

    private final GenerationService generationService;
    private final PixelCharacterService characterService;
    private final ResponseAssembler assembler;

    public PixelController(
            GenerationService generationService,
            PixelCharacterService characterService,
            ResponseAssembler assembler) {
        this.generationService = generationService;
        this.characterService = characterService;
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
                principal.userId(),
                parseUuid(request.uploadId()),
                parseStyle(request.style()),
                request.clientRequestId());
        return assembler.generation(generation);
    }

    @PostMapping("/generate/retry")
    public PixelDtos.GenerationResponse retry(
            @CurrentUser AuthPrincipal principal,
            @Valid @RequestBody PixelDtos.RetryGenerationRequest request) {

        PixelGeneration generation = generationService.retry(
                principal.userId(),
                parseUuid(request.generationId()),
                parseStyle(request.style()),
                request.clientRequestId());
        return assembler.generation(generation);
    }

    @GetMapping("/generations/{generationId}")
    public PixelDtos.GenerationResponse generation(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID generationId) {
        return assembler.generation(generationService.get(principal.userId(), generationId));
    }

    /**
     * A generation and its retries, so the result screen can let the user pick
     * between the first character and the one the free retry produced.
     */
    @GetMapping("/generations/{generationId}/candidates")
    public List<PixelDtos.GenerationResponse> candidates(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID generationId) {
        return generationService.candidatesFor(principal.userId(), generationId).stream()
                .map(assembler::generation)
                .toList();
    }

    /**
     * Confirms a candidate as an owned character — the one moment a generation
     * becomes part of the Collection. The AI call was already paid for
     * regardless of this call's outcome.
     */
    @PostMapping("/generations/{generationId}/keep")
    public PixelDtos.CharacterResponse keep(
            @CurrentUser AuthPrincipal principal,
            @PathVariable UUID generationId,
            @Valid @RequestBody PixelDtos.KeepGenerationRequest request) {

        PixelCharacter character = characterService.keep(
                principal.userId(), generationId, request.asCurrent(), request.keepOriginal(), request.label());
        return assembler.character(character, characterService.currentCharacterId(principal.userId()));
    }

    /* -------------------------------------------------------- collection */

    @GetMapping("/characters")
    public List<PixelDtos.CharacterResponse> collection(@CurrentUser AuthPrincipal principal) {
        UUID currentId = characterService.currentCharacterId(principal.userId());
        return assembler.characters(characterService.collection(principal.userId()), currentId);
    }

    /** Free — never calls a provider. See {@link PixelCharacterService#setCurrent}. */
    @PostMapping("/characters/{characterId}/set-current")
    public PixelDtos.CharacterResponse setCurrent(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID characterId) {
        characterService.setCurrent(principal.userId(), characterId);
        PixelCharacter character = characterService.collection(principal.userId()).stream()
                .filter(candidate -> candidate.getId().equals(characterId))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("PIXME"));
        return assembler.character(character, characterId);
    }

    @DeleteMapping("/characters/{characterId}")
    public ResponseEntity<Void> deleteCharacter(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID characterId) {
        characterService.delete(principal.userId(), characterId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Issues a short-lived signed URL for the owner's own original photo.
     *
     * <p>Separate endpoint on purpose: no list or detail response ever carries
     * a usable link to an original, so seeing one always requires a deliberate,
     * auditable request.
     */
    @GetMapping("/characters/{characterId}/original")
    public PixelDtos.SignedUrlResponse original(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID characterId) {
        PixelCharacterService.SignedUrl signed =
                characterService.originalUrl(principal.userId(), characterId);
        return new PixelDtos.SignedUrlResponse(signed.url(), signed.expiresAt());
    }

    @DeleteMapping("/characters/{characterId}/original")
    public ResponseEntity<Void> deleteOriginal(
            @CurrentUser AuthPrincipal principal, @PathVariable UUID characterId) {
        characterService.deleteOriginal(principal.userId(), characterId);
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
