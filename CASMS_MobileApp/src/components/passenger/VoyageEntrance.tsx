import { type ReactNode, useLayoutEffect, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { motion } from '@/constants/motion';
import { useMotionPreference } from './useMotionPreference';

/** Opacity/transform only: layout remains measurable when a tab hides mid-entry. */
export function VoyageEntrance({ children, delay = 0, duration = motion.entrance }: { children: ReactNode; delay?: number; duration?: number }) {
  const reduced = useMotionPreference();
  const [progress] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useLayoutEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1, duration: reduced ? 0 : duration,
      delay: reduced ? 0 : Math.max(0, Math.min(delay, 120)),
      easing: Easing.bezier(...motion.easeOut), useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, delay, duration]);
  return <Animated.View style={{ width: '100%', opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 12, 0] }) }] }}>{children}</Animated.View>;
}
