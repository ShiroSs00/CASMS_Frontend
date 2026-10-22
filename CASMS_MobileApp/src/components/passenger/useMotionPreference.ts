import { createContext, createElement, type ReactNode, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

const MotionContext = createContext<boolean | undefined>(undefined);

/** One OS subscription for the application, including changes while open. */
export function MotionPreferenceProvider({ children }: { children: ReactNode }) {
  const initial = useReducedMotion();
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      changed = true;
      if (active) setReduced(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active && !changed) setReduced(value);
    }).catch(() => {});
    return () => { active = false; subscription.remove(); };
  }, []);
  return createElement(MotionContext.Provider, { value: reduced }, children);
}
export function useMotionPreference() {
  const preference = useContext(MotionContext);
  const initial = useReducedMotion();
  return preference ?? initial;
}
