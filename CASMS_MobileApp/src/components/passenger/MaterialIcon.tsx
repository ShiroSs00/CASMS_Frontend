import Svg, { Circle, Path } from 'react-native-svg';

import symbols from './material-symbols.json';

export type MaterialIconName = keyof typeof symbols | 'search' | 'person' | 'close' | 'expand_more' | 'expand_less';

/** Official Material Symbols Rounded outlines; see docs/third-party/NOTICE.md. */
export function MaterialIcon({ name, color, size = 24 }: {
  name: MaterialIconName;
  color: string;
  size?: number;
}) {
  if (name === 'search' || name === 'person' || name === 'close' || name === 'expand_more' || name === 'expand_less') {
    return <Svg width={size} height={size} viewBox="0 -960 960 960" pointerEvents="none" aria-hidden={true}>
      {name === 'search' ? <><Circle cx={410} cy={-550} r={230} fill="none" stroke={color} strokeWidth={72} /><Path d="m580-380 220 220" stroke={color} strokeWidth={72} strokeLinecap="round" /></>
        : name === 'person' ? <><Circle cx={480} cy={-650} r={120} fill="none" stroke={color} strokeWidth={64} /><Path d="M240-160v-80c0-160 480-160 480 0v80Z" fill="none" stroke={color} strokeWidth={64} strokeLinejoin="round" /></>
          : <Path d={name === 'close' ? 'm280-680 400 400m0-400L280-280' : name === 'expand_more' ? 'm260-580 220 220 220-220' : 'm260-380 220-220 220 220'} stroke={color} strokeWidth={72} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
    </Svg>;
  }
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" pointerEvents="none"
      aria-hidden={true}>
      <Path d={symbols[name]} fill={color} />
    </Svg>
  );
}
