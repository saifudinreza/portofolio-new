# Monuments and statues in the Projects area

Read `features/README.md` (rules) first.

## Goal
Each of the six projects gets its own **monument**: a stone plinth with a heroic statue or sculpture themed on the project, an engraved plaque (name, year), steps, and small details (laurel wreaths, banners, lanterns). The Projects area should feel like a "museum garden of achievements". The existing pads, markers and interaction stay.

## Current state (read these files)
- `src/data/profile.ts` → `projects` (6): KasirAI (prop `register`, AI POS, 2026), KostKu (`house`, boarding house SaaS, 2026), TrustPay (`coins`, digital wallet, 2026), Loka Living (`sofa`, furniture e-commerce, 2026), RentWheels (`key`, vehicle rental, 2025), AgentMon (`phone`, phone monitor for coding agents, 2026). Each has a `color`.
- `src/world/layout.ts` → `projectPadPositions`: 3 x 2 grid `[16,-16] [26,-16] [36,-16] [16,-28] [26,-28] [36,-28]`. The paved courtyard is `{ x: 26, z: -21, hx: 15.5, hz: 12.8 }` (`pavedAreas` in `src/world/Decor.tsx`). The Projects road comes from `[26,-6]` and a spine runs to `[26,-32]`.
- `src/world/Zones.tsx` → `ProjectsArea()`, `ProjectSpot({index})` (pad + `ProjectProp` + sensor), `Pad`. `src/world/Props.tsx` → `ProjectProp` (the small 3D prop on each pad: `Register`, `House`, `Coins`, `Sofa`, `Key`, `Phone`).
- The camera looks from the south (+z) towards the north (-z), so things at smaller z are "behind" the pads.
- `isClear()` keeps trees/props 5 m away from each pad (`projectPadPositions`).

## Design
For every project build a monument **behind its pad (north, about 5 m from the pad centre, so z = pad z - 5)**, never on the pad itself and not blocking the car path (the car reaches pads from the south and the spine at x = 26).
- Common parts (build once as a reusable component `Monument` in `src/world/Monuments.tsx`): 2-step stone base, a plinth (rounded box, about 1.4 m square, 1.2 m tall) with a front plaque (a canvas texture drawn in code with the project name and year, or `Text` from drei like the signboards), carved top cap. Warm stone, mossy on top (`mossyStoneMaterial`), a project-coloured banner or ribbon in the project's `color`.
- Statue on top (about 2.5 m tall, simple chunky shapes that read from 20 m): 
  - KasirAI: a heroic robot clerk raising a giant cash-register receipt, or a big golden register with a glowing eye.
  - KostKu: a stone house with a lit window held up by two hands, or a lighthouse-like building.
  - TrustPay: a figure holding a balance scale with two coins, laurel wreath.
  - Loka Living: a classic armchair/sofa sculpted in marble with a reading lamp.
  - RentWheels: a heroic key held skyward, with a stylised car silhouette.
  - AgentMon: a phone obelisk with a glowing screen and small orbiting agent cubes (static, no animation needed on Low).
- Lighting: a small warm uplight glow at the base (emissive material through `trackLamp`, no real lights).
- "Historical" feel: weathered stone colours, a few cracks (dark vertex colour lines), a laurel wreath, Roman-style lettering via the existing display font (`DISPLAY_FONT` in `common.tsx`).

## Steps
1. Read `Zones.tsx`, `Props.tsx`, `Decor.tsx` (`pavedAreas`, `Markers`), `profile.ts`. Screenshot the courtyard (before).
2. Create `src/world/Monuments.tsx`: `Monuments()` renders six monuments from `projects` and `projectPadPositions` (position = pad x, pad z - 5). Each statue is its own small component built from merged primitives with vertex colours (about 2 draw calls per monument: stone and glow).
3. Mount `<Monuments />` inside `<ProjectsArea />` or under `<P n="Zones">` in `Experience.tsx`.
4. Colliders: one `CuboidCollider` per plinth (the car bumps into stone); statues have no collider of their own.
5. Update the minimap/big map only if a marker is needed (not required).
6. Make sure the six `ProjectSpot` pads, sensors and the floating markers (`Markers` in `Decor.tsx`) are untouched and the markers do not clip inside statues (raise them if needed in `markerSpots`).
7. Tiers: `low` keeps plinths and statues, drops the glow and banner; texture-based plaques stay.

## Files
New `src/world/Monuments.tsx`; edit `src/world/Zones.tsx` (mount), `src/world/Decor.tsx` (marker height only if needed), maybe `src/world/Props.tsx` (reuse shapes).

## How to test
- Each of the six monuments is visible and recognisable from the default camera when parked on its pad; the project name is readable on the plaque when zoomed in.
- Park on every pad: the card opens, markers fine, no clipping.
- Drive around the courtyard, over the spine road: nothing blocks the path.
- `?stats`: at most +14 draw calls and +40k triangles on High, +8 on Low.
- Day, dusk, night.

## Acceptance criteria
- [ ] Six unique monuments, one per project, themed on the project, with name and year plaques.
- [ ] They sit behind the pads, are solid at the plinth, and never block pads or the road.
- [ ] Glow at night via `trackLamp`; no new real-time lights.
- [ ] The existing pads, markers, cards and project data still work.
- [ ] Numbers for Low/Medium/High in the PR.
