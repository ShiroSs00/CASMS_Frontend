import { useEffect } from 'react';
import { AppState } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { passengerColors } from '@/constants/passenger-theme';

import { indicatorPath, LOOP_STEPS, SHAPE_DURATION_MS } from './indicator-motion';
import { getShapes } from './material-shapes';

const AnimatedPath = Animated.createAnimatedComponent(Path);
// Sample once on the JS thread. Only interpolation runs on the animation thread.
const shapes = getShapes();

/** M3E-style morphing for Expo Go on iOS/web; Android uses its native component. */
export function LaunchIndicator() {
  const phase = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    function updateAnimation(state: string) {
      cancelAnimation(phase);
      phase.value = 0;
      if (state === 'active' && !reduceMotion) {
        phase.value = withRepeat(
          withTiming(LOOP_STEPS, {
            duration: LOOP_STEPS * SHAPE_DURATION_MS,
            easing: Easing.linear,
          }),
          -1,
          false,
        );
      }
    }

    updateAnimation(AppState.currentState);
    const subscription = AppState.addEventListener('change', updateAnimation);
    return () => {
      subscription.remove();
      cancelAnimation(phase);
    };
  }, [phase, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    d: indicatorPath(shapes, phase.value),
  }));

  return (
    <Svg width={48} height={48} viewBox="0 0 48 48" pointerEvents="none">
      <AnimatedPath
        d={indicatorPath(shapes, 0)}
        animatedProps={animatedProps}
        fill={passengerColors.primary}
      />
    </Svg>
  );
}
