package app.pixme.common;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Opaque keyset cursors.
 *
 * <p>Encoding {@code (timestamp, id)} rather than an offset keeps pagination
 * stable while new posts and messages are being created underneath the reader
 * — with OFFSET, a new row shifts every later page and the user sees
 * duplicates. Base64 keeps it opaque so clients can't build their own.
 */
public final class Cursors {

    private Cursors() {}

    public record Keyset(Instant timestamp, UUID id) {}

    /**
     * Sentinels used for the first page.
     *
     * <p>Keyset queries are written as a plain {@code (ts, id) <} comparison
     * with no {@code :param is null} branch, because Postgres cannot infer the
     * type of a bound null and rejects the statement outright with "could not
     * determine data type of parameter". Passing an open upper bound instead
     * keeps one query shape for every page, stays index-friendly, and removes
     * the whole class of problem.
     */
    public static final Instant OPEN_TIMESTAMP = Instant.parse("9999-12-31T23:59:59Z");

    public static final java.time.LocalDate OPEN_DATE = java.time.LocalDate.of(9999, 12, 31);

    /** Largest UUID under Postgres' unsigned byte ordering. */
    public static final UUID OPEN_ID = new UUID(-1L, -1L);

    /** Upper bound for a timestamp cursor: the cursor's value, or wide open. */
    public static Instant timestampOrOpen(Keyset keyset) {
        return keyset == null ? OPEN_TIMESTAMP : keyset.timestamp();
    }

    public static java.time.LocalDate dateOrOpen(Keyset keyset) {
        return keyset == null
                ? OPEN_DATE
                : java.time.LocalDate.ofInstant(keyset.timestamp(), java.time.ZoneOffset.UTC);
    }

    public static UUID idOrOpen(Keyset keyset) {
        return keyset == null ? OPEN_ID : keyset.id();
    }

    public static String encode(Instant timestamp, UUID id) {
        String raw = timestamp.toEpochMilli() + ":" + id;
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    /** Returns null for a blank cursor; throws {@code VALIDATION_FAILED} for a malformed one. */
    public static Keyset decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        try {
            String raw = new String(
                    Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int separator = raw.indexOf(':');
            if (separator <= 0) {
                throw new IllegalArgumentException("missing separator");
            }
            long epochMilli = Long.parseLong(raw.substring(0, separator));
            UUID id = UUID.fromString(raw.substring(separator + 1));
            return new Keyset(Instant.ofEpochMilli(epochMilli), id);
        } catch (RuntimeException exception) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "잘못된 페이지 정보예요.");
        }
    }

    /** Cursor over a plain date + id, used by the per-day history endpoints. */
    public static String encodeDate(java.time.LocalDate date, UUID id) {
        return encode(date.atStartOfDay(java.time.ZoneOffset.UTC).toInstant(), id);
    }
}
