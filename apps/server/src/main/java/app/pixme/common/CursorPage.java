package app.pixme.common;

import java.util.List;

/** Cursor-paginated response envelope. Mirrors `Page<T>` in the app. */
public record CursorPage<T>(List<T> items, String nextCursor, boolean hasMore) {

    public static <T> CursorPage<T> of(List<T> items, String nextCursor) {
        return new CursorPage<>(items, nextCursor, nextCursor != null);
    }

    public static <T> CursorPage<T> last(List<T> items) {
        return new CursorPage<>(items, null, false);
    }

    public static <T> CursorPage<T> empty() {
        return new CursorPage<>(List.of(), null, false);
    }
}
