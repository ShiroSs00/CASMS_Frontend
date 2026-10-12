import { type Point, SHAPE_COUNT } from './material-shapes';

export const SHAPE_DURATION_MS = 650;
// 18 seven-shape cycles: both the shape and rotation meet at the repeat boundary.
export const LOOP_STEPS = SHAPE_COUNT * 18;

/** Interpolate corresponding outline points and rotate without spring overshoot. */
export function indicatorPath(shapes: Point[][], phase: number): string {
  'worklet';
  const step = Math.floor(phase);
  const fraction = phase - step;
  const eased = (1 - Math.cos(Math.PI * fraction)) / 2;
  const from = shapes[step % shapes.length];
  const to = shapes[(step + 1) % shapes.length];
  // M3E Canvas combines 50° continuous and 90° morph-driven rotation per shape.
  const angle = ((step * 140 + fraction * 50 + eased * 90) * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const scale = (48 * 0.79) / 2;
  let path = '';

  for (let i = 0; i < from.length; i++) {
    const x = from[i][0] + (to[i][0] - from[i][0]) * eased;
    const y = from[i][1] + (to[i][1] - from[i][1]) * eased;
    const rotatedX = 24 + scale * (x * cosine - y * sine);
    const rotatedY = 24 + scale * (x * sine + y * cosine);
    path += `${i === 0 ? 'M' : 'L'}${rotatedX.toFixed(3)} ${rotatedY.toFixed(3)}`;
  }

  return `${path}Z`;
}
