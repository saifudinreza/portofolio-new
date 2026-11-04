# A real monument building for the About me area

Read `features/README.md` (rules) first.

## Goal
The About area is now only a circle on the ground with a graduation cap on top. Replace it with a proper **monument building**: a small academy hall / rotunda with columns, a dome, steps and statues, that tells who I am (education, certifications, the journey), while the car can still drive up and park on the pad to open the About card.

## Current state (read these files)
- `src/world/Zones.tsx` → `AboutArea()`: a `Pad` (radius 4) at `aboutArea = { x: -22, z: 26 }`, a signboard "ABOUT ME" 6 m north of it, a graduation cap (3 meshes) floating at the centre, a stack of 4 knockable books at `x - 6`, ground text "ABOUT" and the line "Bootcamp 97.26 (A+) · AWS & Python certified", and a `Sensor` that opens the card.
- `src/world/layout.ts`: `aboutArea`, `zones.about.spawn = [-12, 26]` (car respawn point and the road end), road `[0,4] → [-12,26]`, `keepClear` includes `[aboutArea.x, aboutArea.z, 9]` (9 m radius free of trees/props). The koi pond is east of it (`pond` at `[-1.5, 27]`); `trails` footpath ends near `[-8.7, 20]`.
- Content to show: `profile` in `src/data/profile.ts` (education, certificates, summary). The About card UI is `src/ui/SpotCard.tsx`.
- Style: `docs/art-direction.md`. Reusable stone helpers: `src/world/stone.ts`.

## Design
- **Building: "Hall of Learning"** about 12 m wide, built around the pad: 
  - Circular stone platform with 3 steps (radius 6.5, the car can drive up: make the steps a **ramp/low slope or very low (0.08 m) steps** so the car climbs smoothly; otherwise give the platform a flat wide ramp on the east side facing the road).
  - A ring of 8 columns (about 3 m tall, rounded capitals) around the pad, **with an open gap of 3 columns on the road side** so the car can enter; a flat roof ring (entablature) and a low dome or conical roof on top with a gold finial. The inside stays open so the pad is visible from above and the camera is not blocked.
  - On top of the dome or in front: a large graduation-cap sculpture (reuse the existing 3-mesh cap, scaled up) and an open book statue.
  - Four inscription panels between columns (canvas textures or `Text`): "Information Systems · Universitas Terbuka", "Bootcamp 97.26 (A+)", "AWS Certified", "Python Certified" (take the real strings from `profile`, do not invent facts).
  - Lanterns on the columns (`trackLamp` glow), and an inner floor mosaic ring in the palette (a texture drawn in code).
  - Moss on top-facing stone, small bushes and flowers around the platform edge (instanced).
- Keep the existing book stack and "ABOUT ME" sign but move them so they do not overlap the building (sign stays north, books move to the west side).

## Steps
1. Read `Zones.tsx` (`AboutArea`, `Pad`, `Sensor`), `layout.ts`, `Decor.tsx` (paving, `Markers` for the "About" marker at `y: 3.2`: raise it above the roof, e.g. `y: 7`). Screenshot before from the default camera and from the road.
2. Create `src/world/AboutHall.tsx` and render it from `AboutArea()` (keep `Pad`, `Sensor`, `useSpotHandlers` as they are; the sensor must still cover the pad).
3. Merge geometry with vertex colours: stone (columns, steps, roof), gold (finial, trims), glow (lanterns). Target at most 6 draw calls.
4. Colliders: one `CylinderCollider` per column and one for the dome base (so the car cannot drive through columns); platform and steps via a cuboid/cylinder collider with a **walkable ramp** (the pad must remain reachable: drive in from the road side and park on the pad, test with the keyboard and the touch controls).
5. Make `keepClear` in `layout.ts` cover the new building radius (`[aboutArea.x, aboutArea.z, 11]`) so trees, bushes, crates and rocks do not overlap it. Re-check `isClear` users (`Details.tsx`, `Trees.tsx`, `Scenery.tsx`) still place things sensibly.
6. Tiers: `low` = no lantern glow and no flowers around the platform.
7. NPC route "home → about" ends at `[-12, 26]` with `look` at the area: keep that point outside the columns.

## Files
New `src/world/AboutHall.tsx`; edit `src/world/Zones.tsx`, `src/world/layout.ts` (`keepClear`), `src/world/Decor.tsx` (marker height), maybe `src/data/profile.ts` (only to read).

## How to test
- Drive from the road onto the pad, park, the About card opens (also via the "About" button in the top bar teleport, which spawns at `[-12, 26]`).
- Circle the building: columns are solid, the car does not get stuck on the platform edge; jump and boost near it.
- The camera is never blocked by the roof when parked on the pad (check at default zoom and zoomed out).
- `?stats`: at most +10 draw calls and +40k triangles on High.
- Day, dusk, night.

## Acceptance criteria
- [ ] A recognisable monument building replaces the plain circle; it looks great from the default camera.
- [ ] The car can still enter, park on the pad and open the About card; spawn/respawn still works.
- [ ] Inscriptions use real data from `profile.ts`.
- [ ] Nothing overlaps the building (trees, rocks, crates, the pond).
- [ ] Draw calls and triangles for Low/Medium/High in the PR.
