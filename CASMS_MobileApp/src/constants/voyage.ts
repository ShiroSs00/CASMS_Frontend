import { Platform } from 'react-native';

/** Native serif keeps Vietnamese text available offline, including in Expo Go. */
export const voyage = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
  ink: '#123042', cream: '#F5F2E9', paper: '#FFFCF5', blue: '#4B8AF1', gold: '#D4A84F',
};
