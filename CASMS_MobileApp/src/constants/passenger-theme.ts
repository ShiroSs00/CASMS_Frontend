import { brand, darkTheme, statusColors } from './ocevie';
export const passengerColors = {
  primary: brand.tealLight, onPrimary: brand.midnight,
  primaryContainer: brand.midnight, onPrimaryContainer: brand.pearl,
  secondary: brand.tealLight, secondaryContainer: darkTheme.selected, onSecondaryContainer: brand.pearl,
  tertiaryContainer: brand.gold, onTertiaryContainer: brand.navy,
  surface: darkTheme.background, surfaceContainerLow: darkTheme.surface,
  surfaceContainer: darkTheme.surface, surfaceContainerHigh: darkTheme.surfaceHover,
  surfaceContainerHighest: darkTheme.selected, onSurface: darkTheme.text,
  onSurfaceVariant: darkTheme.textSecondary, outline: darkTheme.border, outlineVariant: darkTheme.border,
  inverseSurface: brand.pearl, inverseOnSurface: brand.navy, inversePrimary: brand.teal,
  error: statusColors.error.foreground, onError: brand.white,
  errorContainer: statusColors.error.background, onErrorContainer: statusColors.error.foreground,
} as const;
