# P00 loading geometry

`src/features/launch/material-shapes.ts` adapts geometry and sampling from
[M3E Canvas](https://github.com/lnkiai/m3e-canvas/blob/main/lib/shapes.ts).
Copyright (c) 2026 lnkiai. MIT License: `M3E-Canvas-LICENSE.txt`.

The upstream project attributes its Material Design shape path assets to
Copyright (C) 2024 Google LLC, https://m3.material.io/components/loading-indicator.
Its loading model is based on material-components-android, Copyright (C) 2024
The Android Open Source Project, and the TypeScript adaptation by Alerix,
Copyright 2026 Alerix, under Apache License 2.0 (`Apache-2.0.txt`).

CASMS reuses the outline geometry and sampling. Its animation is implemented
with Reanimated and a cosine easing curve without spring overshoot, preserving
the requested smooth motion. No upstream spring implementation is included.
