import { StyleSheet, View } from 'react-native';

import { FRAMES } from './catalog';

export interface DecoFrameProps {
  /** FRAME-slot unlock code; renders nothing for unknown/absent codes. */
  code?: string;
  /** Match the host card's corner radius so the frame hugs it. */
  radius: number;
}

/**
 * A purchased frame, as an overlay.
 *
 * <p>This used to be a single `borderColor` swap, which is invisible as a
 * product — nobody pays for a border changing colour. The retro-dialog
 * treatment (dark outer stroke, light inset line, corner blocks) is the
 * pixel-art vocabulary the whole app trades in, and it reads as "framed"
 * at any size.
 *
 * <p>An overlay rather than border props on the host, so every surface that
 * shows a character (feed card, MY hero, a profile) gets the identical frame
 * from one place.
 */
export function DecoFrame({ code, radius }: DecoFrameProps) {
  const frame = code ? FRAMES[code] : undefined;
  if (!frame) return null;

  /**
   * An L-shaped bracket (two thin bars meeting at the corner), not a filled
   * square. A solid square sitting right on the corner is indistinguishable
   * from an iOS crop tool's selection handle — which is exactly what a
   * "frame someone paid for" must never read as. A bracket is unmistakably
   * decorative: nothing in this app's actual UI draws one.
   */
  const bracketLength = Math.max(10, frame.width * 5);
  const bracketThickness = Math.max(2, frame.width);
  const inset = frame.width > 0 ? frame.width - 1 : 0;

  const corners: { top?: number; bottom?: number; left?: number; right?: number }[] = [
    { top: inset, left: inset },
    { top: inset, right: inset },
    { bottom: inset, left: inset },
    { bottom: inset, right: inset },
  ];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderColor: frame.color,
            borderWidth: frame.width,
            borderRadius: radius,
          },
        ]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            margin: frame.width + 1.5,
            borderColor: frame.inset,
            borderWidth: 1.5,
            borderRadius: Math.max(0, radius - frame.width - 1.5),
            opacity: 0.55,
          },
        ]}
      />
      {corners.map((position, index) => {
        const vertical = position.top !== undefined ? 'top' : 'bottom';
        const horizontal = position.left !== undefined ? 'left' : 'right';
        return (
          <View key={index} style={[styles.bracket, position]}>
            <View
              style={[
                { [horizontal]: 0, [vertical]: 0 } as const,
                styles.bracketSegment,
                {
                  width: bracketLength,
                  height: bracketThickness,
                  backgroundColor: frame.cornerColor,
                },
              ]}
            />
            <View
              style={[
                { [horizontal]: 0, [vertical]: 0 } as const,
                styles.bracketSegment,
                {
                  width: bracketThickness,
                  height: bracketLength,
                  backgroundColor: frame.cornerColor,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bracket: { position: 'absolute', width: 0, height: 0 },
  bracketSegment: { position: 'absolute' },
});
