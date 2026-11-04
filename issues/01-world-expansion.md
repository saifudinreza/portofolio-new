# 01: Expand the island

**Priority:** HIGH (foundation, do first) **Branch:** `feature/world-expansion` **Depends on:** none

> Original request: "saya ingin lahannya diperluas" (the land should be bigger). The waterfall at the map edge comes in issue 08; this issue only makes the room for it.

## Goal

Make the playable island noticeably larger so the later features (waterfall area, monuments, wider river) have space, without leaving empty dead zones or breaking anything that exists.

## Current state (read these)

- `src/world/layout.ts`: `WORLD_SIZE = 96` (square, metres). Everything derives from it: zone positions, roads, `riverControl`, `isClear`, the river distance grid (`GRID_MIN`, `GRID_N`).
- `src/world/Environment.tsx`: ground plane `planeGeometry args={[WORLD_SIZE, WORLD_SIZE]}` and the cliff-side box.
- `src/world/Atmosphere.tsx`: sea, rocky cliffs around the island.
- `src/world/Grass.tsx`, `Trees.tsx`, `Scenery.tsx`, `Details.tsx`, `Decor.tsx`: scatter things using `WORLD_SIZE` / `HALF`.
- `src/ui/BigMap.tsx` and the minimap in `src/ui/Hud.tsx`: draw the island from `WORLD_SIZE`.
- `src/world/Car.tsx`: falls off the island and respawns via `nearestZone` when outside the bounds.

## Tasks

1. Raise `WORLD_SIZE` from `96` to **`144`** (one constant; keep it square). Grep for `96`, `48` and `WORLD_SIZE` / `HALF` to find any place that hard-codes the old size, and fix those so everything scales from `WORLD_SIZE`.
2. **Do not move existing areas.** Home, Projects, Skills, About, Contact, the pond, the lighthouse and all roads keep their coordinates, so the lap circuit and NPC routes stay valid. The new land is added as a ring around the old area (the old 96 m square stays centred on the origin).
3. The river control points run "past the island edge" (`riverControl`). Extend the first and last points outward so the river still leaves the island cleanly at the new cliff, and re-check `findBridge()` still lands on the Home to Projects road.
4. Cliffs, sea, fog and shadow camera: make sure the cliff ring in `Atmosphere.tsx` hugs the new edge, and that the sun's shadow frustum (look in `Environment.tsx` / the directional light) still covers the area around the car. The shadow only needs to cover near the car, not the whole island.
5. Fill the new land so it is not empty: the existing scatter systems (trees, scenery, details, grass) should pick up the larger area automatically once they use `WORLD_SIZE`. Add a few **new roads** only if needed to reach the south-east and north-west corners (add to `roadSegments`; keep them short, dirt, no new areas yet).
6. Reserve two empty, flat, tree-free pockets for later issues and mark them in `layout.ts` as exported constants (and in `keepClear` so scatter avoids them):
   - `waterfallZone`: the **east edge**, around `x = 62..70`, `z = -10..10`. Issue 08 builds here.
   - `riverBankZone`: nothing new, issue 03 reuses the existing river.
7. Update the minimap and big map so the whole new island is visible and the player dot / pads still line up.

## Out of scope

Waterfall, new buildings, new NPCs, new monuments. Only the bigger land and keeping it populated.

## Acceptance criteria

- [ ] Island is visibly bigger (about 2.25x the area); the camera, fog and shadows still look right at the new edges.
- [ ] No existing area, road, pad, spawn, gate or NPC route moved; the lap circuit still completes.
- [ ] Driving to every edge: the car falls off the cliff and respawns at the nearest zone exactly as before.
- [ ] No large empty flat patch bigger than ~20 m across anywhere except the reserved `waterfallZone`.
- [ ] Minimap and big map show the new size correctly.
- [ ] Draw calls roughly unchanged (instancing counts scale, not new meshes). Load time not noticeably worse.
- [ ] Definition of done in `README.md` is satisfied.
