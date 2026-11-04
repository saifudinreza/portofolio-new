# A more realistic and more interesting bridge

Read `features/README.md` (rules) first.

## Goal
Replace the plain plank footbridge with a bridge that is believable and attractive: an arched **stone bridge** (or a wooden arch bridge on stone abutments) with real thickness, an arch underneath, side parapets/railings, lanterns on the posts, moss, and carved details. It must still carry the Home → Projects road and be easy to drive over.

## Current state (read these files)
- `src/world/Bridge.tsx` (116 lines): planks (`PLANK_STEP`), posts (`POST_STEP`), rails, built in local space and rotated to the road. Physics: one deck cuboid, one cuboid per ramp, a rail wall each side.
- Numbers come from `bridge` in `src/world/layout.ts` (function `findBridge()`): `deckHalf: 4.2` (flat deck reaches 4.2 m each side of the centre), `ramp: 2.6` (ramp length to the ground), `halfWidth: 1.7`, `height: 0.55`, plus `x, z, yaw, dirX, dirZ`. `groundHeight(x, z)` in `layout.ts` returns the deck height for the car's logic (flat deck, linear ramps).
- The river under it: `src/world/River.tsx`, half width `RIVER_HALF_WIDTH = 2.6`, water 0.2 above the ground. The river banks are being reworked in `features/05-river-banks.md` (do this issue first; the banks will be fitted to this bridge).

## Rules specific to this feature
- **Keep driving simple.** The drivable surface must stay a flat deck plus two straight ramps matching `groundHeight()`. Do not make the road itself curved or humped, or the car will bounce. The "arch" is **visual**: the underside and the side walls are arched, the top stays flat (like a low causeway bridge).
- If you need more room for the arch, you may raise `height` (0.55) up to 0.9 and lengthen `ramp` so the slope stays under about 12 degrees (`ramp >= height / tan(12 deg)`, about 4.2 m for 0.9). Changing these numbers changes `groundHeight()` and the ramp colliders: update both from the same `bridge` object, never hard-code.
- Water stays 0.2 above the ground; the arch opening must show the river flowing underneath.

## Design
- Deck: a thick stone slab (rounded edges) with an inset cobble or plank pattern on top (`plankMap` exists in `textures.ts`; draw a stone pattern in code if you want cobbles, tinted by the material colour).
- Underneath: a semicircular or segmental **arch** (extruded shape through the deck width, or merged half-cylinders) with a keystone and a darker interior, standing on two stone abutments that meet the bank.
- Sides: parapet walls (about 0.7 m high, stone, with a cap) or wooden railings between stone posts; stone posts every `POST_STEP` with a lantern on the first and last post (`trackLamp` glow).
- Details: moss on top-facing stone (`mossyStoneMaterial` in `stone.ts` already tints upward faces green), a few loose stones at the foot, a small plaque ("Zare Bridge" or similar) on one parapet.
- Palette: warm stone from `palette.rock`, wood from `palette.wood`, per `docs/art-direction.md`.

## Steps
1. Read `Bridge.tsx` and `layout.ts` (`findBridge`, `groundHeight`). Screenshot the current bridge from the default camera and from the side (zoomed out).
2. Rebuild the geometry in `Bridge.tsx` in local space (+z along the road). Use merged geometries with vertex colours so the whole bridge is **at most 4 draw calls**.
3. Keep the physics bodies consistent with `bridge`: deck cuboid, ramp cuboids, side walls. The arch opening has no collider (the car cannot be under the bridge anyway).
4. Lanterns: emissive material registered with `trackLamp`; no real lights.
5. Make sure nothing overlaps the new river banks: leave a 0.3 m gap between the abutments and the bank slope until `05-river-banks` is merged, then re-check.
6. Tiers: all tiers get the same shape; only skip the small decorative stones on `low`.

## Files
`src/world/Bridge.tsx`, `src/world/layout.ts` (`bridge` numbers, only if you change height/ramp), `src/world/textures.ts` (stone pattern), `src/world/stone.ts`.

## How to test
- Drive over the bridge both ways, slowly and at full speed with boost: no bouncing, no clipping, no getting stuck on the rails. Check colliders with `?debug`.
- Look from above, from the side and from the river level; day, dusk, night.
- `?stats`: bridge adds at most +4 draw calls and +20k triangles.
- Jump (Space) on the bridge: lands normally.

## Acceptance criteria
- [ ] The bridge looks like a real arched stone bridge with thickness, parapets and lanterns.
- [ ] The road over it stays flat plus straight ramps; driving is as easy as before.
- [ ] `groundHeight()` and the colliders still match the visible deck.
- [ ] Lanterns glow at night through `trackLamp`; no new real-time lights.
- [ ] Draw calls and triangles reported for Low/Medium/High.
