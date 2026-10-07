package app.pixme.square.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A dressed version of the square: palette plus prop layout.
 *
 * <p>Scenes are rows, not code, with hour and month ranges and a priority. That
 * is what lets the square become "밤의 광장" after 7pm or "겨울 광장" in
 * December without a deploy, and what makes seasonal/event scenes a content
 * change rather than an engineering project.
 */
@Entity
@Table(name = "square_scenes")
@Getter
@NoArgsConstructor
public class SquareScene {

    @Id
    @Column(name = "code", nullable = false, length = 32)
    private String code;

    @Column(name = "name", nullable = false, length = 48)
    private String name;

    /** Bumped when props change, so clients can cache a scene by (code, version). */
    @Column(name = "version", nullable = false)
    private int version = 1;

    @Column(name = "sky_color", nullable = false, length = 16)
    private String skyColor;

    @Column(name = "ground_color", nullable = false, length = 16)
    private String groundColor;

    @Column(name = "accent_color", nullable = false, length = 16)
    private String accentColor;

    /** JSON array of {code,x,y,scale,zIndex}. */
    @Column(name = "props_json", nullable = false)
    private String propsJson;

    @Column(name = "from_hour", nullable = false)
    private short fromHour;

    @Column(name = "to_hour", nullable = false)
    private short toHour = 24;

    @Column(name = "from_month", nullable = false)
    private short fromMonth = 1;

    @Column(name = "to_month", nullable = false)
    private short toMonth = 12;

    @Column(name = "priority", nullable = false)
    private int priority;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    /**
     * Whether this scene applies now.
     *
     * <p>Month ranges may wrap the year end (12→2 for winter), so the
     * comparison is not a simple between.
     */
    public boolean matches(int hour, int month) {
        boolean hourMatches = hour >= fromHour && hour < toHour;
        boolean monthMatches = fromMonth <= toMonth
                ? month >= fromMonth && month <= toMonth
                : month >= fromMonth || month <= toMonth;
        return active && hourMatches && monthMatches;
    }
}
