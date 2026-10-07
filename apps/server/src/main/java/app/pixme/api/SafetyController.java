package app.pixme.api;

import java.util.UUID;

import app.pixme.api.dto.SocialDtos;
import app.pixme.common.ApiException;
import app.pixme.common.ErrorCode;
import app.pixme.safety.SafetyService;
import app.pixme.safety.domain.ReportReason;
import app.pixme.safety.domain.ReportTargetType;
import app.pixme.security.AuthPrincipal;
import app.pixme.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class SafetyController {

    private final SafetyService safetyService;

    public SafetyController(SafetyService safetyService) {
        this.safetyService = safetyService;
    }

    @PostMapping("/reports")
    public ResponseEntity<Void> report(
            @CurrentUser AuthPrincipal principal,
            @Valid @RequestBody SocialDtos.CreateReportRequest request) {

        safetyService.report(
                principal.userId(),
                new SafetyService.ReportCommand(
                        parseTargetType(request.targetType()),
                        parseUuid(request.targetId()),
                        parseReason(request.reason()),
                        request.detail(),
                        request.alsoBlock()));

        return ResponseEntity.accepted().build();
    }

    private ReportTargetType parseTargetType(String value) {
        try {
            return ReportTargetType.valueOf(value.toUpperCase());
        } catch (RuntimeException exception) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "알 수 없는 신고 대상이에요.");
        }
    }

    private ReportReason parseReason(String value) {
        try {
            return ReportReason.valueOf(value.toUpperCase());
        } catch (RuntimeException exception) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "알 수 없는 신고 사유예요.");
        }
    }

    private UUID parseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "잘못된 요청이에요.");
        }
    }
}
