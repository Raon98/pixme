-- The square read as a cool blue panel pasted onto a warm paper app: every
-- scene's sky was a blue-grey (#EAF2FF, #DCE6FF, #DDE3EA) while the surface
-- behind it is #FFFDF8. Time of day is still legible, but each palette now
-- sits in the same warm family as the rest of the product, and saturation is
-- pulled down so the pixel character stays the brightest thing on screen.
UPDATE square_scenes SET sky_color = '#FDF3E4', ground_color = '#F7F1E6'
WHERE code = 'BASIC';

UPDATE square_scenes SET sky_color = '#2A2434', ground_color = '#211C2A'
WHERE code = 'NIGHT';

UPDATE square_scenes SET sky_color = '#F6EEF6', ground_color = '#F8F2E9'
WHERE code = 'DAWN';

UPDATE square_scenes SET sky_color = '#F3F6EC', ground_color = '#FAF3EC'
WHERE code = 'SPRING';

UPDATE square_scenes SET sky_color = '#F1F2F2', ground_color = '#F9F6F0'
WHERE code = 'WINTER';

UPDATE square_scenes SET sky_color = '#EDEBE7', ground_color = '#F4F1EB'
WHERE code = 'RAIN';
