# Koi pond with a statue fountain

Read `features/README.md` (rules) first.

## Goal
The koi pond gets a beautiful, eye-catching **statue fountain** in the middle: a stone basin or pedestal with a sculpture (for example a koi fish arching out of the water, or a figure holding a vessel) with jets of water that arc into the pond, ripples where the water lands, and soft light at night. The pond should feel like a small garden centrepiece.

## Current state (read these files)
- `src/world/Pond.tsx` (540 lines): `Pond()` builds the water (custom shader, `waterMaterial()`), a sand rim with a beach opening on the camera side (`GAP_FROM`/`GAP_TO`), rim rocks, lily pads, flowers, reeds, 9 koi (`FISH_COUNT`, `koiGeometry()`), ripples (`MAX_RIPPLES`) and splash drops (`MAX_DROPS`).
- Pond shape and place: `pond` in `src/world/layout.ts` = `{ x: -1.5, z: 27, rx: 5.5, rz: 3.8, water: 0.22 }` (an ellipse). Helpers: `pondDistance(x, z)` (1 at the water edge), `onEllipse(angle, r)` inside `Pond.tsx`.
- The koi swim around inside (fish update loop around line 388 of `Pond.tsx`); the car can drive into the pond (`actors`, ripples and splash on entry).
- Stones use `rockGeometry` + `mossyStoneMaterial` from `src/world/stone.ts`. Glow materials use `trackLamp`.

## Design
- **Place:** the pond centre `(pond.x, pond.z)`. A round stone basin (radius about 1.1 m, height about 0.5 m, rounded rim), a central column, and the sculpture on top (total height about 2.2 m). The pond is shallow, so the basin stands on the pond bed (y = 0) and the pond water surface is `pond.water` (0.22).
- **Sculpture (pick one and say which in the PR):** (a) three koi leaping in a spiral around a column, (b) a stylised woman or boy statue pouring water from a jug, (c) a lotus flower made of petals with a koi on top. Build it from merged primitives (cylinders, spheres, lathe, rounded boxes) with vertex colours, in warm stone, with a darker bronze or teal-green patina on details. It must read well from the top-down camera (about 20 m away): chunky, simple silhouette.
- **Water jets:** 4 to 6 thin arcs from the sculpture into the pond. One `InstancedMesh` of small droplets (like the existing splash drops in `Pond.tsx`) following parabolic paths computed **in the vertex shader** from a time uniform (no per-frame CPU work). A glassy thin tube mesh for the main arc is allowed. Where drops land, spawn the existing ripple effect on a timer (reuse the ripple code, no new system).
- **Night:** a soft warm glow from inside the basin (emissive material through `trackLamp`, plus the existing bloom does the rest). No new real-time light.
- **Sound (optional):** a quiet fountain loop using the existing Web Audio engine in `src/ui/sound.ts` (filtered noise, louder when the car is near, like the surf and river layers in `createAmbience`). Respect mute.

## Steps
1. Read `Pond.tsx` fully, and the fish update loop. The fish must **not swim through the fountain**: add an avoid radius (about 1.5 m) around the centre in their steering.
2. Create `src/world/Fountain.tsx` (the basin, sculpture, jets, glow). Export `Fountain` and mount it **inside `<Pond />`** or next to it in `Experience.tsx` under `<P n="Pond">`. Use the pond position from `layout.ts`; do not hard-code numbers twice.
3. Collider: a `CylinderCollider` for the basin only (the car must not drive through the statue), inside a fixed `RigidBody` with `userData={{ material: 'stone' }}`.
4. Make the water around the basin ripple: reuse the ripple spawn function, one ring every 0.3 to 0.6 s at random landing points.
5. Tiers: `low` = no droplets (static basin and sculpture only); `medium` = 40 droplets; `high` = 90. `reducedMotion()` = no droplets, a still water column.
6. Dispose geometries and materials in a `useEffect` cleanup (this part mounts by tier).

## Files
New `src/world/Fountain.tsx`; edit `src/world/Pond.tsx` (fish avoid, ripple hook), `src/world/Experience.tsx` (only if mounted there), `src/ui/sound.ts` (optional).

## How to test
- `?stats`: draw calls and triangles on Low/Medium/High (budget: at most +6 draw calls, +25k triangles).
- Park the camera near the pond and zoom out: the sculpture reads clearly; jets and ripples look natural; koi avoid it.
- Drive into the pond: no stuck car, no clipping into the basin (check with `?debug`).
- Night and dusk: glow visible, not blown out. Rain: still fine.

## Acceptance criteria
- [ ] A distinctive statue fountain stands in the pond; it looks good from the default camera and close up.
- [ ] Water jets and ripples animate with no per-frame CPU cost (GPU time uniform).
- [ ] Koi, lilies and reeds still work and do not overlap the fountain.
- [ ] Solid collider on the basin only; the car cannot get stuck.
- [ ] Low has no moving droplets; reduced motion respected; numbers in the PR.
