import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

/**
 * Icon set.
 *
 * Deliberately hand-rolled rather than pulled from an icon font: PIXME's
 * characters are pixel art, so the chrome uses a consistent 2px-stroke,
 * square-cap geometry on a 24x24 grid that sits next to them without
 * competing. One file keeps that geometry reviewable.
 */
export type IconName =
  | 'today'
  | 'square'
  | 'plus'
  | 'chat'
  | 'user'
  | 'heart'
  | 'heart-filled'
  | 'wave'
  | 'bell'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'close'
  | 'more'
  | 'camera'
  | 'image'
  | 'settings'
  | 'shield'
  | 'lock'
  | 'check'
  | 'trash'
  | 'sparkle'
  | 'flame'
  | 'moon'
  | 'refresh'
  | 'send'
  | 'crown'
  | 'flag'
  | 'block'
  | 'eye'
  | 'eye-off'
  | 'grid'
  | 'calendar'
  | 'store'
  | 'logout'
  | 'info'
  | 'alert';

export interface IconProps {
  name: IconName;
  size?: number;
  /** Defaults to the current text colour. */
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color, strokeWidth = 2 }: IconProps) {
  const { colors } = useTheme();
  const stroke = color ?? colors.text;
  const common = {
    stroke,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderPaths(name, stroke, common)}
    </Svg>
  );
}

type Common = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
  fill: string;
};

function renderPaths(name: IconName, stroke: string, c: Common) {
  switch (name) {
    /* ---------------------------------------------------- tab bar icons */
    case 'today':
      return (
        <>
          <Rect x={4} y={4} width={16} height={16} rx={4} {...c} />
          <Path d="M9 10h.01M15 10h.01" {...c} strokeWidth={2.4} />
          <Path d="M9 15c.9.8 2 1.2 3 1.2s2.1-.4 3-1.2" {...c} />
        </>
      );
    case 'square':
      return (
        <>
          <Circle cx={8} cy={9} r={2.6} {...c} />
          <Circle cx={16} cy={9} r={2.6} {...c} />
          <Path d="M3.5 19c0-2.5 2-4.2 4.5-4.2S12.5 16.5 12.5 19" {...c} />
          <Path d="M11.5 19c0-2.5 2-4.2 4.5-4.2s4.5 1.7 4.5 4.2" {...c} />
        </>
      );
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...c} strokeWidth={2.4} />;
    case 'chat':
      return (
        <>
          <Path
            d="M20 12.5c0 3.9-3.6 7-8 7-.9 0-1.8-.1-2.6-.4L5 20.5l1-3.2A6.6 6.6 0 0 1 4 12.5c0-3.9 3.6-7 8-7s8 3.1 8 7Z"
            {...c}
          />
          <Path d="M9 12h.01M12 12h.01M15 12h.01" {...c} strokeWidth={2.2} />
        </>
      );
    case 'user':
      return (
        <>
          <Circle cx={12} cy={8.5} r={3.6} {...c} />
          <Path d="M4.8 20c0-3.4 3.2-5.6 7.2-5.6s7.2 2.2 7.2 5.6" {...c} />
        </>
      );

    /* ---------------------------------------------------- reactions */
    case 'heart':
      return (
        <Path
          d="M12 20s-7.5-4.4-7.5-9.2A4.3 4.3 0 0 1 12 8.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.6 12 20 12 20Z"
          {...c}
        />
      );
    case 'heart-filled':
      return (
        <Path
          d="M12 20s-7.5-4.4-7.5-9.2A4.3 4.3 0 0 1 12 8.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.6 12 20 12 20Z"
          fill={stroke}
          stroke={stroke}
          strokeWidth={c.strokeWidth}
        />
      );
    case 'wave':
      return (
        <>
          <Path
            d="M8.5 11.5V6.2a1.4 1.4 0 0 1 2.8 0v4.6M11.3 10.8V5.4a1.4 1.4 0 0 1 2.8 0v5.4"
            {...c}
          />
          <Path
            d="M14.1 10.8V7a1.4 1.4 0 0 1 2.8 0v6.3c0 3.6-2.3 6.2-5.4 6.2-3 0-5-2-5-4.8v-3a1.3 1.3 0 0 1 2.6 0"
            {...c}
          />
        </>
      );

    /* ---------------------------------------------------- navigation */
    case 'chevron-right':
      return <Path d="M9.5 5.5 16 12l-6.5 6.5" {...c} />;
    case 'chevron-left':
      return <Path d="M14.5 5.5 8 12l6.5 6.5" {...c} />;
    case 'chevron-down':
      return <Path d="M5.5 9.5 12 16l6.5-6.5" {...c} />;
    case 'close':
      return <Path d="M6 6l12 12M18 6 6 18" {...c} />;
    case 'more':
      return (
        <>
          <Circle cx={5.5} cy={12} r={1.5} fill={stroke} />
          <Circle cx={12} cy={12} r={1.5} fill={stroke} />
          <Circle cx={18.5} cy={12} r={1.5} fill={stroke} />
        </>
      );
    case 'check':
      return <Path d="M5 12.8 9.6 17.4 19 7.6" {...c} strokeWidth={2.4} />;

    /* ---------------------------------------------------- creation */
    case 'camera':
      return (
        <>
          <Path
            d="M4 8.8h2.6l1.3-2.2h8.2l1.3 2.2H20a1 1 0 0 1 1 1v8.2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.8a1 1 0 0 1 1-1Z"
            {...c}
          />
          <Circle cx={12} cy={13.6} r={3.4} {...c} />
        </>
      );
    case 'image':
      return (
        <>
          <Rect x={3.5} y={5} width={17} height={14} rx={2.5} {...c} />
          <Circle cx={9} cy={10} r={1.6} {...c} />
          <Path d="M4.5 17.5 9.8 13l3.3 2.8 2.6-2.3 3.8 3.4" {...c} />
        </>
      );

    /* ---------------------------------------------------- settings/safety */
    case 'settings':
      return (
        <>
          <Circle cx={12} cy={12} r={3} {...c} />
          <Path
            d="M12 3.5v2.2M12 18.3v2.2M4.9 7.8l1.9 1.1M17.2 15.1l1.9 1.1M4.9 16.2l1.9-1.1M17.2 8.9l1.9-1.1"
            {...c}
          />
        </>
      );
    case 'shield':
      return (
        <>
          <Path d="M12 3.6 19 6v6c0 4.2-3 7-7 8.4-4-1.4-7-4.2-7-8.4V6l7-2.4Z" {...c} />
          <Path d="M9.2 12.2 11.3 14.3 15 10.6" {...c} />
        </>
      );
    case 'lock':
      return (
        <>
          <Rect x={5} y={10.5} width={14} height={9.5} rx={2.5} {...c} />
          <Path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" {...c} />
        </>
      );
    case 'flag':
      return (
        <>
          <Path d="M6 20V4" {...c} />
          <Path d="M6 4.8h9.5l-1.3 3.4 1.3 3.4H6" {...c} />
        </>
      );
    case 'block':
      return (
        <>
          <Circle cx={12} cy={12} r={8} {...c} />
          <Path d="M6.6 17.4 17.4 6.6" {...c} />
        </>
      );
    case 'trash':
      return (
        <>
          <Path d="M4.5 7.5h15" {...c} />
          <Path d="M9.5 7.5V5.8A1.3 1.3 0 0 1 10.8 4.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7" {...c} />
          <Path d="M6.4 7.5l.8 11A1.4 1.4 0 0 0 8.6 19.8h6.8a1.4 1.4 0 0 0 1.4-1.3l.8-11" {...c} />
        </>
      );
    case 'eye':
      return (
        <>
          <Path d="M2.8 12S6 6.4 12 6.4 21.2 12 21.2 12 18 17.6 12 17.6 2.8 12 2.8 12Z" {...c} />
          <Circle cx={12} cy={12} r={2.8} {...c} />
        </>
      );
    case 'eye-off':
      return (
        <>
          <Path d="M4 4.5l16 15" {...c} />
          <Path
            d="M9.2 7.1A8.6 8.6 0 0 1 12 6.6c6 0 9.2 5.4 9.2 5.4a15 15 0 0 1-2.6 3.1M6.4 8.6A14.6 14.6 0 0 0 2.8 12s3.2 5.4 9.2 5.4c1 0 1.9-.2 2.7-.4"
            {...c}
          />
        </>
      );

    /* ---------------------------------------------------- misc */
    case 'bell':
      return (
        <>
          <Path d="M6.8 10.2a5.2 5.2 0 0 1 10.4 0v3.4l1.6 2.8H5.2l1.6-2.8v-3.4Z" {...c} />
          <Path d="M10.2 19a1.9 1.9 0 0 0 3.6 0" {...c} />
        </>
      );
    case 'sparkle':
      return (
        <>
          <Path d="M12 4.2l1.5 4 4 1.5-4 1.5L12 15.2l-1.5-4-4-1.5 4-1.5L12 4.2Z" {...c} />
          <Path d="M17.6 15.4l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" {...c} strokeWidth={1.4} />
        </>
      );
    case 'flame':
      return (
        <Path
          d="M12 3.5c3 3.1 5.5 5.3 5.5 9A5.5 5.5 0 0 1 12 20.5 5.5 5.5 0 0 1 6.5 12.5c0-2 1-3.3 2.4-4.6.3 1.3 1 2.1 1.9 2.1 1.1 0 1.5-1 1.5-2.3 0-1.3-.3-2.7-.3-4.2Z"
          {...c}
        />
      );
    case 'moon':
      return (
        <Path
          d="M19.4 14.6A7.8 7.8 0 0 1 9.4 4.6a8 8 0 1 0 10 10Z"
          {...c}
        />
      );
    case 'refresh':
      return (
        <>
          <Path d="M19.4 12a7.4 7.4 0 1 1-2.6-5.6" {...c} />
          <Path d="M19.8 4.8v4h-4" {...c} />
        </>
      );
    case 'send':
      return <Path d="M4.6 11.8 20 5l-6.5 15-2.4-6-6.5-2.2Z" {...c} />;
    case 'crown':
      return (
        <Path
          d="M4 17.5l-1-9 5 3.4L12 5.5l4 6.4 5-3.4-1 9H4Z"
          {...c}
        />
      );
    case 'grid':
      return (
        <>
          <Rect x={4} y={4} width={7} height={7} rx={1.6} {...c} />
          <Rect x={13} y={4} width={7} height={7} rx={1.6} {...c} />
          <Rect x={4} y={13} width={7} height={7} rx={1.6} {...c} />
          <Rect x={13} y={13} width={7} height={7} rx={1.6} {...c} />
        </>
      );
    case 'calendar':
      return (
        <>
          <Rect x={3.8} y={5.5} width={16.4} height={14.5} rx={2.5} {...c} />
          <Path d="M3.8 10h16.4M8.5 3.5v3.4M15.5 3.5v3.4" {...c} />
        </>
      );
    case 'store':
      return (
        <>
          <Path d="M4 9.5h16v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-9Z" {...c} />
          <Path d="M3 9.5 5 4.5h14l2 5" {...c} />
          <Path d="M9.5 13.5h5" {...c} />
        </>
      );
    case 'logout':
      return (
        <>
          <Path d="M14.5 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5h8" {...c} />
          <Path d="M14.5 12h6M17.8 8.8 21 12l-3.2 3.2" {...c} />
        </>
      );
    case 'info':
      return (
        <>
          <Circle cx={12} cy={12} r={8.2} {...c} />
          <Path d="M12 11v5.2M12 7.8h.01" {...c} strokeWidth={2.2} />
        </>
      );
    case 'alert':
      return (
        <>
          <Path d="M12 4.6 21 19.4H3L12 4.6Z" {...c} />
          <Path d="M12 10v4M12 16.6h.01" {...c} strokeWidth={2.2} />
        </>
      );
  }
}
