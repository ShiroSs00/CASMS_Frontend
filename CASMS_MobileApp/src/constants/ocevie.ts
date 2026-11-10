/** OceVie Mobile Guidelines v1.0 — shared brand and semantic foundations. */
export const brand = {
  midnight: '#061A2B', navy: '#0B2A4A', teal: '#0E6B7A', gold: '#D4AF37',
  pearl: '#F8F6EC', sand: '#DBC9A7', white: '#FFFFFF', navyHover: '#153E60',
  navySoft: '#DCE8EE', tealDark: '#0B5662', tealLight: '#80C7CB',
  tealSoft: '#DDF1F0', goldDark: '#8E6B23', goldSoft: '#F7EFD9',
} as const;
export const statusColors = {
  success: { foreground: '#167347', background: '#EAF6EF' },
  error: { foreground: '#B42318', background: '#FFF0EF' },
  warning: { foreground: '#995700', background: '#FFF4DD' },
  info: { foreground: '#1458A5', background: '#EAF3FF' },
  neutral: { foreground: '#506777', background: '#EDF3F4' },
} as const;
export const lightTheme = {
  background: brand.pearl, surface: brand.white, surfaceHover: '#EDF3F4',
  text: brand.navy, textSecondary: '#506777', placeholder: '#607282',
  border: '#D5E0E4', divider: '#E7EEF0', link: brand.teal,
  selected: brand.tealSoft, focus: '#B7E3E4',
} as const;
export const darkTheme = {
  background: brand.midnight, surface: '#102E46', surfaceHover: '#153A52',
  text: brand.pearl, textSecondary: '#C3D2D8', placeholder: '#B5C5CF',
  border: '#2A5069', divider: '#24465B', link: brand.tealLight,
  selected: '#174A53', focus: brand.tealLight,
} as const;
export const layout = { gutter: 20, cardRadius: 20, buttonRadius: 14, buttonHeight: 56 } as const;
/** Product UI scale. Brand colors remain the OceVie guideline values above. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32 } as const;
export const typeScale = {
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -.4 },
  section: { fontSize: 18, lineHeight: 26, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 23 },
  caption: { fontSize: 12, lineHeight: 18 },
  amount: { fontSize: 22, lineHeight: 30, fontWeight: '700' as const, fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
} as const;
export const controls = { touch: 48, radius: 14, cardRadius: 18, buttonHeight: 52 } as const;
export const overlays = { hero: '#061A2BE6', modal: 'rgba(6,26,43,.46)', shadow: '0px 4px 16px rgba(6,26,43,.06)' } as const;
