# 02: Thicker, tighter, more realistic grass

**Priority:** HIGH **Branch:** `feature/grass-dense` **Depends on:** 01

> Original request: "rumputnya lebih tebal dan rapat sehingga tidak ada celah tanah yang terlihat, dan lebih realistis".

## Goal

From the normal driving camera, the meadow should look like a continuous lawn. **No bare sand/soil visible between tufts** except on purpose (roads, plazas, pads, beach, river bed). Blades should look more natural: varied height, thickness, lean, colour, and tips.

## Current state (read these)

- `src/world/Grass.tsx`: instanced tufts (`TUFTS_FULL = 28000`, `TUFTS_COARSE = 8500`, `BLADES_PER_TUFT = 5`), density per tier (`GRASS_DENSITY`), height per tier (`GRASS_HEIGHT`), wind shader, car-trail "stamps" (`MAX_STAMPS`), lushness field `meadowField` from `layout.ts`.
- `src/world/Environment.tsx`: the ground shader already tints by `vMeadowUv`; the ground colour is `palette.ground` (sand).
- `src/world/foliageTextures.ts`, `src/world/textures.ts`: procedural textures.

## Why gaps show today

The ground under the grass is light sand (`#EFD7A6`), so any gap between tufts is bright and obvious. Density is also thinned by `meadowField` and per-tier multipliers.

## Tasks

1. **Ground under the grass must be grass-coloured, not sand.** In the ground shader (`Environment.tsx`), blend the ground toward a dark, warm green wherever `meadowField` is high and the point is away from roads/plazas/beach. Gaps then read as shaded turf, not bare soil. Keep sand on roads, plazas, pads, the beach rim and river banks. This is the cheapest and most important change: do it first.
2. **Raise coverage.** Increase tuft count and tuft footprint so they overlap (more tufts, or wider tufts, or both). Target ~1.6x the current visible density on `high`, with `medium` and `low` scaled down but **still covering the ground** (on `low` prefer fewer, wider/taller tufts over thin ones; see how `GRASS_HEIGHT` already trims `low`).
3. **Fix the large-scale layout.** Use a jittered grid (or blue-noise-like scatter) per cell with `rng(seed)` instead of purely random, so tufts are evenly spread without clumps and holes. Keep the near/far split (`TUFTS_FULL` near the camera, `TUFTS_COARSE` far) and make sure the transition between them has no visible band.
4. **More natural blades.**
   - Random height per tuft (roughly 0.6x to 1.4x) and per-blade lean and rotation.
   - Slightly curved blades with tapered tips (2 or 3 segments is enough; keep triangle count per tuft small).
   - Colour: dark root, bright tip, with per-tuft variation between fresh green, deep green and a little dry straw (extend what the colour code at the bottom of `Grass.tsx` already does). Keep within the warm, yellow-leaning greens in `docs/art-direction.md`.
   - Optional small wildflower/clover accents (instanced, a few percent of tufts) in `palette.yellow` / `palette.cream`.
5. **Keep it interactive.** Wind sway and the car-trail flattening (`MAX_STAMPS`) must still work. Grass must not grow on roads, plazas, pads, in the pond, river or on the bridge (reuse the existing exclusion helpers in `Grass.tsx` and `isClear` logic; do not duplicate them).
6. **New land from issue 01 must be covered too** (scatter must use `WORLD_SIZE`).

## Out of scope

River bank vegetation (issue 03), trees, flowers as a separate system.

## Acceptance criteria

- [ ] Screenshot from the default driving camera on `high`: no visible sand patches inside the meadow. Also check from the top-down map camera.
- [ ] Same check on `medium` and `low`: no bare patches (the grass may be simpler).
- [ ] Blades visibly vary in height, lean and colour; the lawn no longer looks like a repeated pattern.
- [ ] Wind and car trails still work; no grass on roads, plazas, pads, water or bridge.
- [ ] Frame time on `high` not more than ~10% worse than before; on `low` not worse. Triangle count of the grass is stated in the PR.
- [ ] Definition of done in `README.md` is satisfied.
