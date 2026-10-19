import { Platform } from 'react-native';
import { brand } from './ocevie';
export const voyage = {
  // Guideline-approved system fallback supports Vietnamese offline.
  heading: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' }),
  ink: brand.navy, cream: brand.pearl, paper: brand.white, blue: brand.teal, gold: brand.gold,
};
