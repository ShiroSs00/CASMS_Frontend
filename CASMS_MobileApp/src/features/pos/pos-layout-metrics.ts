import { contentLayout } from '../../constants/ocevie';

/** Large text and narrow split windows retain a single reading/action column. */
export function posColumns(width: number, fontScale: number) {
  if (!Number.isFinite(width) || !Number.isFinite(fontScale) || fontScale <= 0) return 1;
  return width / Math.max(1, fontScale) >= contentLayout.split ? 2 : 1;
}
