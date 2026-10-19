import { StyleSheet, View } from 'react-native';
import { brand } from '@/constants/ocevie';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** Decorative bay illustration, deliberately not a navigational map. */
export function VoyageArt({ compact = false, scene, cover = false }: { compact?: boolean; scene: 'home' | 'login' | 'services'; cover?: boolean }) {
  // Expo's static and client router trees differ; a scene key keeps SVG references stable.
  const id = `OceVie-bay-${scene}`;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.art, compact && styles.compact, cover && styles.cover]}>
    <Svg width="100%" height="100%" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#E4EBDD" /><Stop offset="1" stopColor="#BCD1D0" /></LinearGradient>
        <LinearGradient id={`${id}sea`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#7FA9AD" /><Stop offset="1" stopColor="#29596A" /></LinearGradient>
        <LinearGradient id={`${id}shade`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={brand.midnight} stopOpacity="0" /><Stop offset={0.35} stopColor={brand.midnight} stopOpacity={0.05} /><Stop offset="1" stopColor={brand.midnight} stopOpacity={0.96} /></LinearGradient>
      </Defs>
      <Rect width="400" height="250" fill={`url(#${id}sky)`} />
      <Circle cx="303" cy="58" r="27" fill={brand.gold} opacity=".8" />
      <Path d="M0 130L30 106L44 109L65 71L82 76L99 120L121 104L144 121L172 97L189 101L210 139L240 121L260 127L286 96L301 98L324 132L356 106L375 111L400 135V200H0Z" fill="#7C9992" />
      <Rect y="144" width="400" height="106" fill={`url(#${id}sea)`} />
      <Path d="M-15 189L7 161L22 155L32 98L49 76L61 83L69 119L81 132L95 189Z" fill="#244D51" />
      <Path d="M248 170L266 145L276 96L289 76L301 82L310 124L327 138L345 169Z" fill="#3F6663" />
      <Path d="M316 202L335 180L342 123L357 107L371 115L380 158L400 175L412 202Z" fill="#193F49" />
      <Path d="M114 193H159L151 201H122Z" fill={brand.pearl} /><Path d="M137 156V190H115Z" fill={brand.pearl} /><Path d="M141 167V190H156Z" fill={brand.gold} />
      <Path d="M37 221H115M171 211H241M261 231H333M107 239H183" stroke={brand.pearl} strokeWidth="1" opacity=".3" />
      {cover && <Rect width="400" height="250" fill={`url(#${id}shade)`} />}
    </Svg>
  </View>;
}
const styles = StyleSheet.create({ art: { height: 210, overflow: 'hidden', borderRadius: 24 }, compact: { height: 136, borderRadius: 20 }, cover: { height: 268 } });
