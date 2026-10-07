package app.pixme.common;

import org.springframework.http.HttpStatus;

/**
 * Error vocabulary shared with the mobile client.
 *
 * <p>The {@code code} is the contract — the app switches on it to choose copy
 * and recovery behaviour — so these strings must not change once shipped. The
 * Korean message is a safe default the client can show verbatim.
 */
public enum ErrorCode {

    // auth
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "다시 로그인해주세요."),
    INVALID_PROVIDER_TOKEN(HttpStatus.UNAUTHORIZED, "로그인 정보를 확인할 수 없어요."),
    REFRESH_TOKEN_REUSED(HttpStatus.UNAUTHORIZED, "보안을 위해 다시 로그인해주세요."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없어요."),
    ACCOUNT_SUSPENDED(HttpStatus.FORBIDDEN, "이용이 제한된 계정이에요."),

    // generic
    NOT_FOUND(HttpStatus.NOT_FOUND, "찾을 수 없는 내용이에요."),
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "입력한 내용을 다시 확인해주세요."),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "잠시 후에 다시 시도해주세요."),
    MAINTENANCE(HttpStatus.SERVICE_UNAVAILABLE, "PIXME를 점검하고 있어요."),
    UPDATE_REQUIRED(HttpStatus.UPGRADE_REQUIRED, "새 버전으로 업데이트해주세요."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "잠시 문제가 생겼어요."),

    // profile
    NICKNAME_TAKEN(HttpStatus.CONFLICT, "이미 사용 중인 닉네임이에요."),
    NICKNAME_FORBIDDEN(HttpStatus.BAD_REQUEST, "사용할 수 없는 닉네임이에요."),
    PROFILE_INCOMPLETE(HttpStatus.FORBIDDEN, "프로필을 먼저 완성해주세요."),
    AGE_RESTRICTED(HttpStatus.BAD_REQUEST, "PIXME는 만 14세부터 이용할 수 있어요."),

    // generation / posts
    UPLOAD_NOT_FOUND(HttpStatus.NOT_FOUND, "사진을 다시 올려주세요."),
    UPLOAD_ALREADY_USED(HttpStatus.CONFLICT, "이미 사용한 사진이에요."),
    NO_GENERATION_AVAILABLE(HttpStatus.PAYMENT_REQUIRED, "생성권이 없어요."),
    DAILY_GENERATION_LIMIT(HttpStatus.TOO_MANY_REQUESTS, "오늘은 더 만들 수 없어요."),
    UNSAFE_IMAGE(HttpStatus.UNPROCESSABLE_ENTITY, "이 사진으로는 PIXME를 만들기 어려워요."),
    GENERATION_NOT_COMPLETED(HttpStatus.CONFLICT, "아직 PIXME가 완성되지 않았어요."),
    GENERATION_ALREADY_PUBLISHED(HttpStatus.CONFLICT, "이미 게시된 PIXME예요."),
    ALREADY_PUBLISHED_TODAY(HttpStatus.CONFLICT, "오늘의 PIXME가 이미 있어요."),
    STYLE_NOT_UNLOCKED(HttpStatus.PAYMENT_REQUIRED, "이 스타일은 아직 사용할 수 없어요."),
    ORIGINAL_NOT_AVAILABLE(HttpStatus.NOT_FOUND, "원본 사진이 저장되어 있지 않아요."),

    // social
    CANNOT_REACT_TO_SELF(HttpStatus.BAD_REQUEST, "내 PIXME에는 반응할 수 없어요."),
    BLOCKED_BY_PEER(HttpStatus.FORBIDDEN, "지금은 이 사용자와 연결할 수 없어요."),
    ALREADY_CONNECTED(HttpStatus.CONFLICT, "이미 연결된 사이예요."),
    NOT_CONNECTED(HttpStatus.FORBIDDEN, "서로 연결된 뒤에 대화할 수 있어요."),
    CONVERSATION_INACTIVE(HttpStatus.FORBIDDEN, "더 이상 대화할 수 없어요."),

    // store
    PRODUCT_NOT_FOUND(HttpStatus.NOT_FOUND, "상품을 찾을 수 없어요."),
    RECEIPT_INVALID(HttpStatus.BAD_REQUEST, "결제 정보를 확인할 수 없어요."),
    PURCHASE_ALREADY_GRANTED(HttpStatus.OK, "이미 적용된 결제예요.");

    private final HttpStatus status;
    private final String defaultMessage;

    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus status() {
        return status;
    }

    public String defaultMessage() {
        return defaultMessage;
    }
}
