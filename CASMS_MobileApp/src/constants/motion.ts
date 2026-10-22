/** Quiet, short transitions shared by the OceVie passenger experience. */
export const motion = {
  pressIn: 90,
  pressOut: 160,
  content: 180,
  sheetIn: 260,
  sheetOut: 200,
  tab: 160,
  entrance: 240,
  easeOut: [0.2, 0, 0, 1],
  easeIn: [0.4, 0, 1, 1],
} as const;
