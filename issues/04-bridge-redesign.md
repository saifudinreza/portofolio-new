# 04: A more realistic, attractive bridge

**Priority:** MEDIUM **Branch:** `feature/bridge-redesign` **Depends on:** 03

> Original request: "improvement di jembatannya, bentuk jembatannya lebih realistis dan menarik".

## Goal

Replace the plain flat plank deck with a bridge that looks like a real, charming stone-and-timber arched bridge, while the car still drives over it smoothly.

## Current state (read these)

- `src/world/Bridge.tsx` (116 lines): flat deck `bridge.height = 0.55`, straight ramps (`deckHalf = 4.2`, `ramp = 2.6`, `halfWidth = 1.7`), instanced planks, posts, rails, simple box colliders.
- `src/world/layout.ts`: `bridge` (found by `findBridge()`), `groundHeight(x, z)` (deck + ramps; used by the car and others), `inRiver`.
- `src/world/textures.ts`: `plankMap`.

## Design (keep it simple, build it from primitives)

A **low stone arch bridge with a timber deck and rail**:

- Two stone abutments at the river banks (rounded boxes with a stone texture from `stone.ts`).
- A shallow arch underneath (use a half `TorusGeometry` or an extruded arch shape) so you can see through to the water; stone voussoir lines can be a texture or a few instanced blocks.
- Deck: keep the plank deck on top (it is already instanced); slightly **raised in the middle** (a gentle hump) instead of perfectly flat.
- Side walls (low stone parapet) with a timber hand rail on top, and 4 corner posts with a lantern on each (emissive, `trackLamp`).
- Small details: moss patches and a few vines on the stone (tinted instanced quads or vertex colours), a worn path where the road meets the ramp, a small sign or plaque ("Reza's Bridge") with `Text`/`Signboard` from the existing UI helpers.

## Tasks

1. Rewrite the geometry in `Bridge.tsx` (or a new `BridgeModel.tsx` and keep `Bridge.tsx` as the mount) following the design above. Everything built in code, no assets.
2. **Keep gameplay contract identical:** same `bridge.x/z/yaw`, same footprint (`halfWidth`, `deckHalf`, `ramp`). If the hump raises the deck, update `groundHeight()` in `layout.ts` to match the visual profile exactly (a smooth function of `along`; ramps start at 0 and end at the deck height), so the wheels never float or sink. Document the formula in a comment.
3. **Colliders:** one simple box per ramp plus a flat/humped deck approximated by 3 boxes, and a rail wall on each side (as today). The arch under the bridge is **visual only**. The car must be able to drive across at full speed with no bump or stall, and must not fall off the sides.
4. The river under the bridge must still look right after issue 03 (the bank slope meets the abutments with no gap).
5. Add 2 or 3 small touches near the bridge ends (instanced): a pair of bollards, a bench, flowers. Keep them off the road.

## Acceptance criteria

- [ ] Bridge visibly has an arch, parapets, a hump, lanterns and a plaque; looks good from the driving camera and from above.
- [ ] Drive across it 5 times in each direction at normal and boost speed: no bump, no stall, no falling off, no clipping through rails. Also test with the jump button.
- [ ] `groundHeight()` and the visual deck match (no floating/sinking wheels or NPC feet; the NPC route that crosses the bridge still looks right).
- [ ] Lanterns glow at night and are registered with `trackLamp`.
- [ ] Draw calls added: at most ~6. `low` tier drops the moss/vines.
- [ ] Definition of done in `README.md` is satisfied.
