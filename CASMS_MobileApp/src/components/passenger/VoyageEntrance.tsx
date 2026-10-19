import { type ReactNode } from 'react';
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';

export function VoyageEntrance({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduced = useReducedMotion();
  return <Animated.View entering={reduced ? undefined : FadeInDown.duration(280).delay(delay).easing(Easing.bezier(.2, 0, 0, 1))}>{children}</Animated.View>;
}
