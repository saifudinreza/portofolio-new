# Realistic river with sloped, rocky banks

Read `features/README.md` (rules) first. Do `04-bridge.md` before this one (the bridge meets the banks).

## Goal
Make the river look real: a natural meandering channel with **sloping banks** (the ground rises gently from the water to the meadow), banks covered with rocks, pebbles, reeds, driftwood and flowers, water that has depth variation, flow lines, foam around rocks, and a believable edge where the water meets the land. The car can still drive into the river (slowly) and over the bridge.

## Current state (read these files)
- `src/world/layout.ts`: `riverControl` (points of a Catmull-Rom curve, from the north shore `[5,-54]` down to `[16.5,5]` and east to `[54, 9.6]`), `riverPath`, `riverDistance(x,z)` (metres to the centreline; water is `< RIVER_HALF_WIDTH = 2.6`), `RIVER_BANK = 1.6`, `RIVER_WATER = 0.2` (the water surface is **0.2 above the flat ground**; the bed is a decal), `inRiver()`, `bridge`.
- `src/world/River.tsx` (508 lines): `ribbon()` builds strips along the path, `waterMaterial()`, `bedMaterial()`, `fallGeometry()` (the waterfall where the river leaves the island at both ends), `reedMaterial()`, `River()` (water, bed, banks, reeds, rocks, splash drops `MAX_DROPS`, flow `FLOW_SPEED`).
- The ground is flat: `Ground()` in `src/world/Environment.tsx` has a cuboid collider whose top is y = 0. Car slows in water: `WATER_SPEED = 0.45` in `src/world/Car.tsx` (uses `inRiver`).
- `isClear()` keeps trees, props and grass away from the river (`RIVER_HALF_WIDTH + RIVER_BANK`).

## Design decision (read carefully)
The ground is a flat plane, so you cannot dig a trench without rebuilding the whole terrain. Instead build the banks as a **raised embankment (levee) on both sides of the water**, as geometry plus a matching physics trimesh:
- Water surface stays at `RIVER_WATER` (0.2).
- Inner slope: from the water edge (`riverDistance = RIVER_HALF_WIDTH`, y = 0.2) **up** to a crest at about `riverDistance = RIVER_HALF_WIDTH + 0.9` (y = 0.45).
- Outer slope: from the crest **down** to the ground (y = 0) at about `riverDistance = RIVER_HALF_WIDTH + 2.6`.
- Slopes must stay under about 15 degrees so the car can drive up and into the river without getting stuck.
- Leave the bridge crossing alone: at the bridge (`bridge.x, bridge.z`, within `bridge.deckHalf + bridge.ramp` along the road) the embankment fades to 0 so the ramps meet flat ground (check against `groundHeight()`). The bridge feature already fits this.

## Steps
1. Read `River.tsx`, `layout.ts` (river section) and `Bridge.tsx`. Screenshot the river from three camera spots (before).
2. **Bank mesh.** In `River.tsx` build one merged bank geometry along `riverPath` for each side (vertex rows at the offsets above, normals pointing up/out, vertex colours: sandy at the water line, grass green on the crest, dark soil on the outer slope). Fade the height to 0 near the bridge and near the island ends (where the waterfall is).
3. **Bank physics.** Add a static `TrimeshCollider` (from `@react-three/rapier`) built from the same vertices and indices, in a fixed `RigidBody` with `userData={{ material: 'ground' }}`. Check with `?debug` that the car drives up the slope into the water smoothly and can leave again.
4. **Rocks and decor on the banks** (all instanced, one draw call per kind): boulders (use `rockGeometry`/`mossyStoneMaterial` from `src/world/stone.ts`), pebbles in the shallows, flat stepping stones, driftwood logs, reed clumps (exists, increase near the edges), cattails, a few flowers and fallen branches. Scatter along `riverPath` with a seeded `rng` so it is the same on every load. Rocks in the water get a white foam ring (a small additive ring decal or an extra ripple).
5. **Water realism** in `waterMaterial()`: shallow water near the edges is lighter and clearer (use the distance from the centreline in the fragment shader: `abs(vLocal.x)/halfWidth`), deeper in the middle (darker teal), flow streaks that follow the current, soft white foam along the banks and around rocks, a gentle sun sparkle. No refraction pass (too expensive).
6. **Meadow integration.** The grass and meadow ground must stay off the bank slopes' water side and cover the crest and outer slope (the meadow mask in `src/world/textures.ts` uses `isClear`, which already keeps clear of `RIVER_HALF_WIDTH + RIVER_BANK`: widen that margin to match the new outer slope, `RIVER_HALF_WIDTH + 2.6`, and check trees and props still keep away). Update `RIVER_BANK` in `layout.ts` accordingly, in one place.
7. **Audio.** River sound already exists in `createAmbience` (`src/ui/sound.ts`); no change needed.
8. Tiers: `low` = bank mesh and colliders but no pebbles/driftwood/foam decals; `medium` = half the rocks; `high` = all.

## Files
`src/world/River.tsx`, `src/world/layout.ts` (`RIVER_BANK`, helper for bank height), `src/world/Environment.tsx` and `src/world/textures.ts` (ground/meadow mask margins), `src/world/Bridge.tsx` (only to check the fit), `src/world/stone.ts`.

## How to test
- Drive into the river from each side, along it, out again, across the bridge both ways, with boost and jumping: never stuck, never launched.
- The "Wet paws" achievement (`wet` in `src/game/achievements.ts`, drive through the river) still unlocks.
- `?debug`: collider matches the visible bank.
- `?stats`: at most +15 draw calls and +50k triangles on High.
- Day, dusk, night, rain. The river ends (where it falls off the island edge) still look right.

## Acceptance criteria
- [ ] Banks slope smoothly from the water to the meadow, covered with rocks, pebbles, reeds and decorations.
- [ ] The car drives into and out of the river without getting stuck; the bridge still fits.
- [ ] The water looks deeper in the middle, clearer at the edges, with flow lines and foam.
- [ ] Trees, grass and props do not overlap the banks.
- [ ] Draw calls and triangles reported for Low/Medium/High; Low is cheaper.
