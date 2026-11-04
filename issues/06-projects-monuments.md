# 06: A monument or statue for every project

**Priority:** HIGH **Branch:** `feature/projects-monuments` **Depends on:** 01

> Original request: "di area project, setiap project ada monumen-monumen dan patung-patung bersejarah".

## Goal

Turn the Projects field from six round pads with small props into a **monument garden**: each of the six projects gets its own memorable monument/statue on a plinth, themed to what the project is. Think "hall of fame" of a hero's journey.

## Current state (read these)

- `src/world/Zones.tsx`: `ProjectsArea` renders six `ProjectSpot`s on pads. Each uses `ProjectProp kind={p.prop}` (small prop).
- `src/world/layout.ts`: `projectPadPositions` (3 x 2 grid at x = 16, 26, 36 and z = -16, -28), `keepClear` (projects: `[26, -20, 17]`).
- `src/data/profile.ts`: `projects` list (id, name, tagline, color, prop, badge): KasirAI, KostKu, TrustPay, Loka Living, RentWheels, AgentMon.
- `src/world/Props.tsx` / `ProjectBits` (UI): where `ProjectProp` lives.
- `src/world/stone.ts`, `decorTextures.ts`: stone material helpers.

## Design

Each pad keeps its glowing ring (that is the interaction), but behind/beside it stands a monument about 5 to 7 m tall. All are built from primitives (`RoundedBoxGeometry`, cylinders, cones, lathe, extrude) with a **stone plinth** base that has an engraved-look plaque (project name, short tagline) using `Text`. Suggested themes (the implementer may improve, but each must be distinct and recognisable from the top-down camera):

| Project | Monument idea |
|---|---|
| KasirAI | Obelisk topped with a giant glowing coin/cash-register, small stone coins around the base |
| KostKu | Little stone house statue on a pedestal with a golden key |
| TrustPay | Shield monument with a lock; a ring of floating coins/rings |
| Loka Living | A tree-of-life statue (trunk plus leafy canopy in stone and bronze) with a bench |
| RentWheels | A car statue on a plinth (reuse the jeep silhouette from `CarModel.tsx` in bronze) with a wheel arch |
| AgentMon | A robot/creature guardian statue with glowing eyes (emissive, `trackLamp`) |

Additional courtyard dressing: a stone-paved plaza under the whole area (reuse the paving approach from `Decor.tsx` instead of copying it), a low hedge and lanterns along the paths between monuments, a central **grand statue** (a large figure or trophy, about 8 m) at `(26, -22)` between the pads that stands for "the builder" (reuse the `profile` name on its plinth), and 4 banner poles with flags in project colours.

## Tasks

1. New file `src/world/Monuments.tsx` with one small component per monument plus `<ProjectMonuments />`. Mount it with `ProjectsArea` (inside `Scene`/`Experience`). Do not grow `Zones.tsx` beyond mounting it.
2. Position each monument relative to its pad from `projectPadPositions[i]` (not hard-coded copies) at about 3.2 m behind the pad (north, negative z) so the pad and the text remain visible from the south-east camera. The existing pad text and `Sensor` stay exactly as they are.
3. Use a shared stone material and a shared bronze/gold material across all monuments to keep it cheap. Repeated bits (coins, fence pieces, banner poles) are instanced.
4. Make monuments solid with simple colliders (cylinder/box at the plinth). Leave **at least 4 m** free in front of every pad and keep the projects spine road (`[26, -6, 26, -32]`) clear. If the paving changes `isClear`, update `keepClear` in `layout.ts` accordingly.
5. Add subtle motion where it fits: slow rotating coins, floating glints, flags swaying with the wind (`wind.ts`). Respect the tier scaling.
6. The "old project props" (`ProjectProp`) may be moved or removed if they clash; if removed, check `ProjectBits` (UI) and the classic view for references.

## Acceptance criteria

- [ ] Six distinct, recognisable monuments, each clearly matching its project; the central grand statue is present.
- [ ] From the default camera when driving up the projects spine, the area looks grand and readable, not cluttered; every pad is still reachable and its card opens as before.
- [ ] Plaques have readable text on desktop and 390 px wide mobile.
- [ ] Emissive parts glow at night; flags move; nothing z-fights or floats.
- [ ] The jump ramp, circuit gates and NPC route through the projects spine are not blocked.
- [ ] Draw calls added: at most ~25 (shared materials). Definition of done in `README.md` is satisfied.
