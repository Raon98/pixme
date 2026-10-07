package app.pixme.common;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Wire shape of every error the API returns. Mirrors `ApiErrorBody` in the app. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiErrorResponse(
        String code,
        String message,
        Map<String, String> fieldErrors,
        String traceId) {

    public static ApiErrorResponse of(ErrorCode code, String message, String traceId) {
        return new ApiErrorResponse(code.name(), message, null, traceId);
    }

    public static ApiErrorResponse of(
            ErrorCode code, String message, Map<String, String> fieldErrors, String traceId) {
        return new ApiErrorResponse(
                code.name(), message, fieldErrors.isEmpty() ? null : fieldErrors, traceId);
    }
}
