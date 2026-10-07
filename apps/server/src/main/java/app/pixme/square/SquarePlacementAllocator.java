package app.pixme.square;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import app.pixme.config.PixmeProperties;
import org.springframework.stereotype.Component;

/**
 * Assigns non-overlapping coordinates on the square canvas.
 *
 * <p>Uses Mitchell's best-candidate sampling: for each new character, propose a
 * handful of random points and keep the one furthest from everyone already
 * placed. Pure random placement produces visible clumps and gaps; a strict
 * grid looks like a spreadsheet. Best-candidate gives the organic-but-even
 * spread that reads as "people standing around in a plaza", which is the entire
 * visual point of the square.
 *
 * <p>The vertical band a character lands in also decides its depth, so the
 * crowd gets a sense of front and back rows for free.
 */
@Component
public class SquarePlacementAllocator {

    /** Candidates proposed per placement. Higher = more even, more CPU. */
    private static final int CANDIDATES_PER_POINT = 12;

    /** Keep characters off the very edges so nameplates aren't clipped. */
    private static final double MARGIN_RATIO = 0.08;

    private final PixmeProperties.Square config;

    public SquarePlacementAllocator(PixmeProperties properties) {
        this.config = properties.square();
    }

    public record Point(int x, int y, short depth) {}

    /**
     * @param existing points already taken today (placements must be stable)
     * @param seed deterministic per day, so a replay produces the same layout
     */
    public Point allocate(List<Point> existing, long seed) {
        Random random = new Random(seed);

        int marginX = (int) (config.canvasWidth() * MARGIN_RATIO);
        int marginY = (int) (config.canvasHeight() * MARGIN_RATIO);
        int usableWidth = config.canvasWidth() - marginX * 2;
        int usableHeight = config.canvasHeight() - marginY * 2;

        if (existing.isEmpty()) {
            int x = marginX + random.nextInt(Math.max(1, usableWidth));
            int y = marginY + random.nextInt(Math.max(1, usableHeight));
            return new Point(x, y, depthFor(y));
        }

        int bestX = 0;
        int bestY = 0;
        double bestDistance = -1;

        for (int attempt = 0; attempt < CANDIDATES_PER_POINT; attempt++) {
            int x = marginX + random.nextInt(Math.max(1, usableWidth));
            int y = marginY + random.nextInt(Math.max(1, usableHeight));

            double nearest = Double.MAX_VALUE;
            for (Point point : existing) {
                double dx = point.x() - x;
                double dy = point.y() - y;
                // Vertical distance is weighted more heavily: two characters
                // side by side read fine, but one directly behind another
                // occludes it.
                double distance = Math.sqrt(dx * dx + (dy * dy) * 1.8);
                if (distance < nearest) {
                    nearest = distance;
                }
            }

            if (nearest > bestDistance) {
                bestDistance = nearest;
                bestX = x;
                bestY = y;
            }
        }

        // If the square is genuinely full, fall back to a ring further out
        // rather than stacking someone on top of an existing character.
        if (bestDistance < config.minSeparation()) {
            int ring = existing.size() / 24;
            double angle = (existing.size() % 24) * (Math.PI * 2 / 24);
            bestX = clamp(
                    (int) (config.canvasWidth() / 2.0
                            + Math.cos(angle) * (config.minSeparation() * (2 + ring))),
                    marginX,
                    config.canvasWidth() - marginX);
            bestY = clamp(
                    (int) (config.canvasHeight() / 2.0
                            + Math.sin(angle) * (config.minSeparation() * (2 + ring))),
                    marginY,
                    config.canvasHeight() - marginY);
        }

        return new Point(bestX, bestY, depthFor(bestY));
    }

    /** Characters higher up the canvas are further away. */
    private short depthFor(int y) {
        double ratio = 1.0 - ((double) y / config.canvasHeight());
        return (short) Math.min(4, Math.max(0, Math.round(ratio * 4)));
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    /** Convenience for building the existing-points list from placements. */
    public List<Point> toPoints(List<app.pixme.square.domain.SquarePlacement> placements) {
        List<Point> points = new ArrayList<>(placements.size());
        for (var placement : placements) {
            points.add(new Point(placement.getX(), placement.getY(), placement.getDepth()));
        }
        return points;
    }
}
