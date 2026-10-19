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
export const overlays = { hero: '#061A2BE6', modal: 'rgba(6,26,43,.46)', shadow: '0px 4px 16px rgba(6,26,43,.06)' } as const;
