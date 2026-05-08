import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { palette } from '../../theme/tokens';

export interface IconProps {
  size?: number;
  color?: string;
}

const stroke = (color: string) => ({
  stroke: color,
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none' as const,
});

export const ArtemisMark = ({
  size = 28,
  moonColor = palette.forest700,
  arrowColor = palette.gold500,
}: { size?: number; moonColor?: string; arrowColor?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path
      d="M24.4 19.5A9 9 0 0 1 13 7.2a.5.5 0 0 0-.7-.55A10 10 0 1 0 25 20.2a.5.5 0 0 0-.6-.7z"
      fill={moonColor}
    />
    <Path d="M5 27 L27 5" stroke={arrowColor} strokeWidth={1.6} strokeLinecap="round" />
    <Path
      d="M22 5 L27 5 L27 10"
      stroke={arrowColor}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M5 27 L8 24 M5 27 L8 30"
      stroke={arrowColor}
      strokeWidth={1.6}
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
);

export const BowArrow = ({ size = 14, color = palette.gold500 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path d="M2 14 L14 2" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    <Path
      d="M11 2 L14 2 L14 5"
      stroke={color}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M3 13 C 5 10, 6 6, 4 4"
      stroke={color}
      strokeWidth={1.2}
      strokeLinecap="round"
      fill="none"
      opacity={0.6}
    />
  </Svg>
);

export const IconHome = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 11 L12 4 L21 11 V20 a1 1 0 0 1 -1 1 H15 V14 H9 V21 H4 a1 1 0 0 1 -1 -1 z"
      {...stroke(color)}
    />
  </Svg>
);

export const IconMap = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 4 L3 6 V20 L9 18 L15 20 L21 18 V4 L15 6 Z" {...stroke(color)} />
    <Path d="M9 4 V18 M15 6 V20" {...stroke(color)} />
  </Svg>
);

export const IconCircle = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={9} cy={9} r={3.5} {...stroke(color)} />
    <Path d="M3 19c1-3 3.3-4.5 6-4.5" {...stroke(color)} />
    <Circle cx={17} cy={13} r={2.5} {...stroke(color)} />
    <Path d="M13 20c.7-2 2-3 4-3s3.3 1 4 3" {...stroke(color)} />
  </Svg>
);

export const IconCal = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3.5} y={5} width={17} height={15.5} rx={2.5} {...stroke(color)} />
    <Path d="M3.5 10 H20.5 M8 3 V7 M16 3 V7" {...stroke(color)} />
  </Svg>
);

export const IconUser = ({ size = 22, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={8} r={4} {...stroke(color)} />
    <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...stroke(color)} />
  </Svg>
);

export const IconBell = ({ size = 20, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 17 V11 a6 6 0 1 1 12 0 V17 L20 19 H4 z" {...stroke(color)} />
    <Path d="M10 21 a2 2 0 0 0 4 0" {...stroke(color)} />
  </Svg>
);

export const IconLock = ({ size = 14, gold = false }: { size?: number; gold?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Rect x={3} y={7} width={10} height={7.5} rx={2} fill={gold ? palette.gold500 : '#000'} />
    <Path
      d="M5 7 V5 a3 3 0 0 1 6 0 V7"
      stroke={gold ? palette.gold700 : '#000'}
      strokeWidth={1.4}
      fill="none"
    />
  </Svg>
);

export const IconChevron = ({
  dir = 'right',
  size = 16,
  color = '#000',
}: { dir?: 'right' | 'left' | 'down'; size?: number; color?: string }) => {
  const d = dir === 'right' ? 'M6 3 L11 8 L6 13' : dir === 'left' ? 'M10 3 L5 8 L10 13' : 'M3 6 L8 11 L13 6';
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d={d} stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
};

export const IconPhone = ({ size = 16, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6 a2 2 0 0 1 2-2z"
      {...stroke(color)}
    />
  </Svg>
);

export const IconMessage = ({ size = 16, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 5 h16 a1 1 0 0 1 1 1 v11 a1 1 0 0 1 -1 1 H8 l-4 3 V6 a1 1 0 0 1 1 -1 z" {...stroke(color)} />
  </Svg>
);

export const IconPlus = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5 V19 M5 12 H19" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
  </Svg>
);

export const IconShield = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3 L4 6 V12 c0 5 3.5 8 8 9 4.5 -1 8 -4 8 -9 V6 z" {...stroke(color)} />
    <Path d="M9 12 L11.5 14.5 L16 10" {...stroke(color)} />
  </Svg>
);

export const IconWarn = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3 L22 20 H2 z" {...stroke(color)} />
    <Path d="M12 10 V14 M12 17 V17.5" {...stroke(color)} />
  </Svg>
);

export const IconLocate = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 22s7-7 7-12a7 7 0 1 0 -14 0c0 5 7 12 7 12z" {...stroke(color)} />
    <Circle cx={12} cy={10} r={2.5} {...stroke(color)} />
  </Svg>
);

export const IconShare = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={6} cy={12} r={2.5} {...stroke(color)} />
    <Circle cx={18} cy={6} r={2.5} {...stroke(color)} />
    <Circle cx={18} cy={18} r={2.5} {...stroke(color)} />
    <Path d="M8 11 L16 7 M8 13 L16 17" {...stroke(color)} />
  </Svg>
);
