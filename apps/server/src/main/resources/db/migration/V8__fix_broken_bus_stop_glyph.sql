-- ===========================================================================
-- V8 — 🚏 (BUS_STOP) renders as a broken/missing glyph on iOS in practice,
-- showing as a thin vertical sliver instead of the emoji. Every scene that
-- seeded it (V2) is swapped to PLANT (🪴), which renders reliably, at the
-- same coordinates — purely a glyph swap, not a layout change.
-- ===========================================================================

UPDATE square_scenes
SET props_json = replace(props_json, '"code":"BUS_STOP"', '"code":"PLANT"'),
    version = version + 1
WHERE props_json LIKE '%BUS_STOP%';
