import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { ApiError } from '@/lib/api';
import { usePos } from './PosLayout';
export { samePosScope } from './pos-contracts';
export function usePosScopeGuard() {
  const { assertReady } = usePos();
  const focused = useRef(true);
  useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; }; }, []));
  return useCallback(() => {
    if (!focused.current) throw new ApiError('Màn thao tác không còn hiện hành.', 409, 'POS_REVERIFY');
    return assertReady();
  }, [assertReady]);
}
