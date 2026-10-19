import { brand, darkTheme, lightTheme, statusColors } from './ocevie';
/** Existing passenger roles backed by OceVie semantic tokens. */
export const passengerLightColors = {
  primary: brand.navy, onPrimary: brand.white,
  primaryContainer: brand.navy, onPrimaryContainer: brand.pearl,
  secondary: brand.teal, secondaryContainer: brand.tealSoft, onSecondaryContainer: brand.tealDark,
  tertiaryContainer: brand.gold, onTertiaryContainer: brand.navy,
  surface: lightTheme.background, surfaceContainerLow: lightTheme.surface, surfaceContainer: lightTheme.surface,
  surfaceContainerHigh: lightTheme.surfaceHover, surfaceContainerHighest: brand.navySoft,
  onSurface: lightTheme.text, onSurfaceVariant: lightTheme.textSecondary,
  outline: lightTheme.border, outlineVariant: lightTheme.border,
  inverseSurface: brand.midnight, inverseOnSurface: brand.pearl, inversePrimary: brand.tealLight,
  error: statusColors.error.foreground, onError: brand.white,
  errorContainer: statusColors.error.background, onErrorContainer: statusColors.error.foreground,
  focus: lightTheme.focus, placeholder: lightTheme.placeholder, divider: lightTheme.divider,
  onDarkSecondary: darkTheme.textSecondary, darkBorder: darkTheme.border,
} as const;
