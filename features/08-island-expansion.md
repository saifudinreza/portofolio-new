# Bigger island

Read `features/README.md` (rules) first. Do `02-grass-realism.md` and `05-river-banks.md` before this one (the grass distance fade and the river ends are needed).

## Goal
Enlarge the playable land so there is new room for the waterfall cove (`09-waterfall-cove.md`) and more exploring. **Everything that exists today keeps its exact coordinates**: zones, roads, pads, the pond, the river, spawns, circuit gates. Only new land is added around the edges. This feature adds the land and makes the whole engine work with it; it does not add the waterfall itself.

## Current state (read these files)
- `WORLD_SIZE = 96` in `src/world/layout.ts` (a square, metres; the island runs from -48 to +48 on x and z). It is used in many places (listed below). `HALF = WORLD_SIZE / 2` is re-declared in several files.
- Everything is centred on (0, 0). The new size is **128** (HALF 64): 16 m of new land on every side.
- The river: `riverControl` in `layout.ts` runs from `[5,-54]` (north, beyond the old edge) to `[54, 9.6]` (east, beyond the edge); both ends currently fall off the island edge as a waterfall (`fallGeometry` in `src/world/River.tsx`).

## Everything that depends on the size (check each one)
| File | What | What to do |
|---|---|---|
| `src/world/layout.ts` | `WORLD_SIZE`, river distance grid `GRID_MIN`, `GRID_N` (derived from `WORLD_SIZE`), `riverControl` end points | Set `WORLD_SIZE = 128`. Extend `riverControl` so both ends again run past the new edge (64): insert `[4.5, -72]` as the new first point (before `[5, -54]`) and append `[72, 10]` as the new last point (after `[54, 9.6]`). Feature 09 will later turn the north end into the waterfall source. Verify `riverDistance` still works near the new edges (the distance grid covers `WORLD_SIZE + 13` cells, derived from the constant). |
| `src/world/Environment.tsx` | `Ground()`: plane `[WORLD_SIZE, WORLD_SIZE]`, side box, invisible-wall colliders (use `HALF`), `meadowShader` uv (divides by `WORLD_SIZE`) | Should adapt through the constant; check the walls are at the new edge and the car cannot leave the island. |
| `src/world/Atmosphere.tsx` | `Cliffs()` rock ring, `Sea`, `Sky`, clouds | The cliff ring follows `HALF`. Make sure the sea plane and the sky dome are still bigger than the island; raise their size if you see an edge. |
| `src/world/Grass.tsx` | scatter over `HALF`, tuft count (`TUFTS_FULL` 28000, `TUFTS_COARSE` 8500) | Area grows by 78%. **Do not scale the count by 1.78** (budget). Keep the count, rely on the distance fade from feature 02, and scatter the tufts with higher density near the middle of the world and near the car. State the numbers in the PR. |
| `src/world/textures.ts` | `meadowMask()` size `WORLD_SIZE * 2` texels and its loops over `isClear` | Cost grows 78% at load. Keep the texel size but build the mask in chunks that yield to the browser (see `01-loading-screen.md`), or lower to 1.5 texels per metre; the olive ground tint must still align with the grass. |
| `src/world/Trees.tsx`, `Details.tsx`, `Scenery.tsx`, `Decor.tsx` | scatters use `HALF`; tree count fixed at 88, bush counts fixed | Raise the counts proportionally for the new land only (not the middle), with the same budgets rule as README; new land should not look empty. |
| `src/ui/DriveHud.tsx`, `src/ui/BigMap.tsx` | minimap and big map (`drawStaticMap`, `drawLiveMap`, click-to-teleport uses `WORLD_SIZE`) | Should scale. Check the markers and the click mapping at the edges. |
| `src/ui/sound.ts` | `createAmbience` surf: `edge = WORLD_SIZE / 2 - max(|x|, |z|)` | Check the surf gets louder near the new edge. |
| `src/world/Rain.tsx`, `Atmosphere.tsx` fog | `FOG_FAR` 115, camera `far` 200 in `Scene.tsx` | The island edge at 64 plus the camera distance must stay inside the far plane; check from the corners. |

Run `grep -rn "WORLD_SIZE\|HALF" src` and make sure no file still assumes 96 or 48 as a number.

## Steps
1. Screenshot before: the minimap, the big map, and a corner of the island.
2. Change the constant, then fix the places in the table, one file per commit.
3. Fill the new land so it is not empty: grass (distance faded), trees, bushes, rocks, flowers through the existing scatter functions (they respect `isClear`). Leave the **north-centre area around `x = 5`, `z < -56`** free of trees and props (clear radius about 14 m), reserved for the waterfall cove: add a `keepClear` entry in `layout.ts` for it.
4. Add one or two **new roads or footpaths** into the new land only if needed to reach it (for example a road from the Projects road `[26,-32]` northwards to `[10,-56]`); update `roadSegments` and check that `circuitGates` still lie on roads (they use `onRoad(i, t)` with road indices: **append new roads at the end of the array; do not reorder**).
5. Check performance with `?stats` on Low, Medium, High at Home and at a far corner (the grass fade must keep draw calls and triangles near today's numbers). Check the loading time did not get noticeably longer (note it in the PR).
6. Check physics: the invisible walls hold the car at the new edge; `respawn` when falling still works.

## Files
`src/world/layout.ts`, `Environment.tsx`, `Atmosphere.tsx`, `Grass.tsx`, `textures.ts`, `Trees.tsx`, `Details.tsx`, `Scenery.tsx`, `Decor.tsx`, `src/ui/DriveHud.tsx`, `src/ui/BigMap.tsx`, `src/ui/sound.ts`.

## How to test
- Drive to all four edges and all four corners: walls hold, no visible island edge artefacts (sea, sky, cliffs complete), no floating objects.
- Teleport buttons and the Big map still go to the right zones; achievements for zones still work; the circuit time trial still works.
- Minimap and Big map show the bigger island correctly.
- `?stats` on all tiers, and compare with the numbers before.
- Rain, fog and night from a corner of the island.

## Acceptance criteria
- [ ] Island is 128 x 128; all old coordinates and gameplay unchanged.
- [ ] No empty-looking new land, and no visible world edge problems.
- [ ] Grass, trees and decor budgets respected (numbers in the PR for Low/Medium/High).
- [ ] Maps, sounds, fog and camera far plane work at the new size.
- [ ] The reserved cove area at the north is kept free for feature 09.
