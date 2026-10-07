package app.pixme.common;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.ConstraintViolationException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;

/**
 * Converts every failure into the same JSON envelope.
 *
 * <p>Two deliberate choices: unexpected exceptions never leak their message to
 * the client (only a trace id, which is also logged), and client-fault
 * responses are logged at a level that doesn't drown real incidents.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApi(ApiException exception) {
        String traceId = newTraceId();
        ErrorCode code = exception.code();

        if (code.status().is5xxServerError()) {
            log.error("[{}] {} — {}", traceId, code, exception.getMessage(), exception);
        } else {
            log.debug("[{}] {} — {}", traceId, code, exception.getMessage());
        }

        return ResponseEntity.status(code.status())
                .body(ApiErrorResponse.of(code, exception.getMessage(), exception.fieldErrors(), traceId));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        Map<String, String> fieldErrors = new HashMap<>();
        exception.getBindingResult()
                .getFieldErrors()
                .forEach(error -> fieldErrors.putIfAbsent(
                        error.getField(),
                        error.getDefaultMessage() == null
                                ? ErrorCode.VALIDATION_FAILED.defaultMessage()
                                : error.getDefaultMessage()));

        return ResponseEntity.status(ErrorCode.VALIDATION_FAILED.status())
                .body(ApiErrorResponse.of(
                        ErrorCode.VALIDATION_FAILED,
                        ErrorCode.VALIDATION_FAILED.defaultMessage(),
                        fieldErrors,
                        newTraceId()));
    }

    @ExceptionHandler({
        ConstraintViolationException.class,
        HttpMessageNotReadableException.class,
        MissingServletRequestParameterException.class,
        MethodArgumentTypeMismatchException.class
    })
    public ResponseEntity<ApiErrorResponse> handleBadRequest(Exception exception) {
        String traceId = newTraceId();
        log.debug("[{}] bad request: {}", traceId, exception.getMessage());
        return ResponseEntity.status(ErrorCode.VALIDATION_FAILED.status())
                .body(ApiErrorResponse.of(
                        ErrorCode.VALIDATION_FAILED,
                        ErrorCode.VALIDATION_FAILED.defaultMessage(),
                        traceId));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(AccessDeniedException exception) {
        return ResponseEntity.status(ErrorCode.FORBIDDEN.status())
                .body(ApiErrorResponse.of(
                        ErrorCode.FORBIDDEN, ErrorCode.FORBIDDEN.defaultMessage(), newTraceId()));
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNoHandler(NoHandlerFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiErrorResponse.of(
                        ErrorCode.NOT_FOUND, ErrorCode.NOT_FOUND.defaultMessage(), newTraceId()));
    }

    /**
     * A unique-constraint violation that reaches here means two concurrent
     * requests raced (e.g. both publishing today's representative post). The
     * database rejected one; the client should retry or re-read.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleIntegrity(DataIntegrityViolationException exception) {
        String traceId = newTraceId();
        log.warn("[{}] data integrity violation", traceId, exception);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiErrorResponse.of(
                        ErrorCode.VALIDATION_FAILED,
                        "같은 요청이 이미 처리됐어요. 잠시 후 다시 확인해주세요.",
                        traceId));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception exception) {
        String traceId = newTraceId();
        log.error("[{}] unhandled exception", traceId, exception);
        return ResponseEntity.status(ErrorCode.INTERNAL_ERROR.status())
                .body(ApiErrorResponse.of(
                        ErrorCode.INTERNAL_ERROR,
                        ErrorCode.INTERNAL_ERROR.defaultMessage(),
                        traceId));
    }

    private static String newTraceId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
