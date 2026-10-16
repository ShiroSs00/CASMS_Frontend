import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcon } from '@/components/passenger/MaterialIcon';
import { VoyageArt } from '@/components/passenger/VoyageArt';
import { passengerLightColors as colors } from '@/constants/passenger-light-theme';
import { voyage } from '@/constants/voyage';

export function VoyageHero({ title, subtitle, label, onPress }: { title: string; subtitle: string; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Khám phá hải trình. ${title}. ${subtitle}`} onPress={onPress} style={({ pressed }) => [homeStyles.hero, pressed && { transform: [{ scale: .985 }] }]}>
    <VoyageArt scene="home" cover />
    <View style={homeStyles.heroTop}><Text numberOfLines={2} style={homeStyles.heroTag}>{label}</Text><View style={homeStyles.heroArrow}><MaterialIcon name="arrow_forward" color={colors.onSurface} size={20} /></View></View>
    <View style={homeStyles.heroCopy}>
      <Text numberOfLines={3} style={homeStyles.heroTitle}>{title}</Text>
      <Text numberOfLines={2} style={homeStyles.heroSubtitle}>{subtitle}</Text>
    </View>
  </Pressable>;
}
export const homeStyles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 30, gap: 24, width: '100%', maxWidth: 520, alignSelf: 'center' },
  greeting: { gap: 10 },
  eyebrow: { fontSize: 11, lineHeight: 18, letterSpacing: 1.6, fontWeight: '600', color: colors.onSurfaceVariant },
  title: { fontFamily: voyage.serif, fontSize: 38, lineHeight: 45, letterSpacing: -1.4, color: colors.onSurface },
  hero: { backgroundColor: colors.surfaceContainerLow, borderRadius: 26, overflow: 'hidden' },
  heroTop: { position: 'absolute', left: 16, right: 16, top: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroTag: { flex: 1, backgroundColor: '#123042E6', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, color: colors.onPrimaryContainer, fontSize: 11, lineHeight: 17, letterSpacing: .8 },
  heroArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { position: 'absolute', left: 20, right: 20, bottom: 22, gap: 8 },
  heroTitle: { fontFamily: voyage.serif, fontSize: 33, lineHeight: 39, color: colors.onPrimaryContainer },
  heroSubtitle: { fontSize: 12, lineHeight: 19, color: '#E6EBE9' },
  description: { fontSize: 14, lineHeight: 22, color: colors.onSurfaceVariant },
  next: { backgroundColor: colors.primaryContainer, padding: 22, borderRadius: 26, gap: 14 },
  nextKicker: { fontSize: 11, lineHeight: 18, letterSpacing: 1.4, color: colors.tertiaryContainer, fontWeight: '600' },
  nextTitle: { fontFamily: voyage.serif, fontSize: 26, lineHeight: 33, color: colors.onPrimaryContainer },
  nextSubtitle: { fontSize: 13, lineHeight: 21, color: '#CDD8DC' },
  nextBottom: { borderTopWidth: 1, borderTopColor: '#36505E', paddingTop: 15, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  time: { fontSize: 30, color: colors.onPrimaryContainer, fontVariant: ['tabular-nums'] },
  section: { gap: 14 },
  sectionTitle: { fontFamily: voyage.serif, fontSize: 26, lineHeight: 34, color: colors.onSurface },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickItem: { flexGrow: 1, flexBasis: 145 },
  caption: { fontSize: 11, lineHeight: 18, letterSpacing: .7, color: colors.onSurfaceVariant, textAlign: 'center' },
});
