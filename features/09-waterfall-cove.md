# Waterfall cove: a beautiful waterfall, a pool and rocks with flowing water

Read `features/README.md` (rules) first. Do `08-island-expansion.md` before this one.

## Goal
At the north edge of the expanded island, build a **waterfall cove**: a tall mossy rock wall with a realistic waterfall pouring into a plunge pool, mist at the base, big rocks in and around the pool with thin streams of water running over them, and the pool feeding the river that flows south through the island. It must look beautiful from the default camera and be a place worth driving to.

## Current state (read these files)
- After feature 08 the island is 128 x 128 and the area around `x = 5`, `z < -56` is reserved and empty (`keepClear`).
- The river already starts at the north: `riverControl` in `src/world/layout.ts` (first points around `[5,-70]`, `[5,-54]`), and `src/world/River.tsx` draws a small waterfall at each end of the river (`fallGeometry`, outward over the island edge). In this feature **the north end becomes the source**: the river begins at the pool, and the old outward waterfall at the north end is removed. The east end keeps its outward waterfall.
- Water materials and ripples exist: `waterMaterial()` in `src/world/Pond.tsx` and `River.tsx`. Rocks: `rockGeometry`, `mossyStoneMaterial` in `src/world/stone.ts`. Wading: the car slows in water (`WATER_SPEED`, `inRiver()` in `layout.ts`, used in `src/world/Car.tsx`).
- Ground is flat (top y = 0). Cliffs along the edge: `Cliffs()` in `src/world/Atmosphere.tsx`.

## Design
- **Layout** (all in a new file `src/world/Waterfall.tsx`, one `Waterfall` component, mounted under `<P n="Waterfall">` in `Experience.tsx`; coordinates and radii as constants at the top):
  - **Rock wall:** about 14 m wide and 11 m tall, curved (a crescent), at the north edge behind the pool. Build it from one custom merged mesh (a lumpy displaced surface with vertex colours: grey-brown rock, moss green on ledges, dark wet streaks) plus about 40 instanced big boulders at its foot (use `rockGeometry`). The wall is solid (a few cuboid or convex colliders along its base; the car cannot drive into it).
  - **Waterfall:** a main sheet about 4 m wide falling 10 m from a lip at the top of the wall, plus 2 thin side streams. Each is a vertical ribbon mesh with a shader: scrolling vertical streaks (noise stretched in y), brighter white in the middle, foam at the lip, transparent edges. Use `time` uniform; no CPU per frame.
  - **Splash and mist at the base:** a foam ring on the pool surface (a ring decal scaled with time) and one instanced mist of soft billboard sprites (24 on High) drifting up and fading. Mist off on Low and with `reducedMotion()`.
  - **Plunge pool:** an ellipse about 12 x 8 m in front of the wall; water surface at 0.2 like the river (`RIVER_WATER`), reuse the river/pond water shader with a lighter turquoise colour; sandy-stone rim with pebbles; shallow and drivable (the car slows like in the river: extend the "wet" check in `Car.tsx` with a small `inWaterfallPool(x, z)` exported from `layout.ts`, and the "Wet paws" achievement may also count it).
  - **Rocks in the water:** 10 to 14 rocks of different sizes inside and around the pool (some flat stepping stones, some tall boulders), water flowing over and around them: thin streams (narrow versions of the waterfall ribbon, 0.3 to 0.6 m wide) running down 2 or 3 of the rocks into the pool, white foam rings at the rock bases (decals), darker colour near the water line (instance colour, wetter = darker), moss on top.
  - **Outlet:** the pool's south side connects to the start of the river (`riverControl` first point). The river's first metres should look like they come out of the pool.
  - **Decor:** ferns and reeds (reuse reed instancing from `River.tsx`), flowers and a few trees on the sides (through `Trees`/`Details` scatter or small dedicated instances), fallen logs, a small wooden sign "Waterfall Cove".
- **Sound:** a loud, wide waterfall rumble layer in `createAmbience` (`src/ui/sound.ts`, filtered noise like the river layer, volume from the distance to the pool, off when muted). The existing surf and river layers keep working.
- **Light:** a soft rainbow arc in the mist at day only (a thin additive ring mesh, `daySample` not needed: just fade with `dayState.night`), optional. Respect the rule "no new real-time lights".
- **Map:** add a waterfall marker to the minimap and the Big map (`src/ui/DriveHud.tsx`) so people can find it.
- **Achievement (optional):** "Waterfall hunter: drive to the waterfall" in `src/game/achievements.ts` (`unlock` when the car comes within 8 m of the pool).

## Steps
1. Read `River.tsx` (`ribbon`, `fallGeometry`, `waterMaterial`, how the ends are drawn) and `layout.ts` (river section). Decide the exact pool centre, for example `(5, -58)`, and write the constants once in `layout.ts` (`waterfallPool`, `inWaterfallPool`).
2. Change `riverControl` so the river starts at the pool outlet; remove the north outward waterfall in `River.tsx` (keep the east one). Check the river still looks right at the join.
3. Build `Waterfall.tsx` piece by piece (wall, sheets, pool, rocks, mist). After each piece take a screenshot.
4. Colliders: wall base (cuboids), big rocks (cylinders), pool is walkable. Check with `?debug`.
5. Add the sound, map marker, and (optional) achievement.
6. Tiers: `low` = wall, one waterfall sheet, pool and rocks, no mist, no side streams, no foam rings; `medium` = side streams and foam, half the mist; `high` = all.
7. Dispose geometries and materials on unmount (this part mounts with the scene).

## Files
New `src/world/Waterfall.tsx`; edit `src/world/layout.ts`, `src/world/River.tsx`, `src/world/Experience.tsx`, `src/world/Car.tsx` (wet check), `src/ui/sound.ts`, `src/ui/DriveHud.tsx`, optionally `src/game/achievements.ts`.

## How to test
- Drive to the waterfall: the wall is solid, the pool is wadable, the car slows in it and can leave; no getting stuck on rocks.
- Look from the default camera and from far away, day, dusk, night, rain: the waterfall is the star of the scene and nothing flickers.
- Follow the river from the pool south to the bridge: the join is seamless.
- Sound gets louder when you approach and goes quiet far away; mute works.
- `?stats`: budget at most +25 draw calls and +80k triangles on High (this feature is allowed more than the default). Report all tiers.

## Acceptance criteria
- [ ] A tall, good-looking waterfall with animated water, foam and mist (mist off on Low and with reduced motion).
- [ ] A pool with rocks that have water flowing over them, and the river starts from it.
- [ ] Solid wall and boulders; wadable pool; no stuck car.
- [ ] Sound, minimap marker, and numbers for Low/Medium/High in the PR.
- [ ] Nothing in the new area overlaps roads, gates or other zones.
