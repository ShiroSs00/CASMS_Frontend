import { Image } from 'expo-image';

/** Approved logo kit artwork; preserve the original bird and drum proportions. */
export function OceVieBrand({ variant = 'horizontal', dark = false }: { variant?: 'horizontal' | 'stacked' | 'symbol'; dark?: boolean }) {
  const source = variant === 'horizontal'
    ? dark ? require('../../../assets/ocevie/ocevie-horizontal-dark-no-tagline.png') : require('../../../assets/ocevie/ocevie-horizontal-light-no-tagline.png')
    : variant === 'stacked'
      ? require('../../../assets/ocevie/ocevie-stacked-dark-no-tagline.png')
      : require('../../../assets/ocevie/ocevie-symbol-dark-transparent.png');
  const size = variant === 'horizontal' ? { width: 158, height: 48 }
    : variant === 'stacked' ? { width: 240, height: 210 } : { width: 88, height: 88 };
  return <Image source={source} contentFit="contain" style={size} accessibilityLabel="OceVie Cruises" accessible />;
}
