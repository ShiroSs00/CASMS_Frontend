import Svg, { Path } from 'react-native-svg';

import symbols from './material-symbols.json';

export type MaterialIconName = keyof typeof symbols;

/** Official Material Symbols Rounded outlines; see docs/third-party/NOTICE.md. */
export function MaterialIcon({ name, color, size = 24 }: {
  name: MaterialIconName;
  color: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" pointerEvents="none"
      aria-hidden={true}>
      <Path d={symbols[name]} fill={color} />
    </Svg>
  );
}
