# 08: Waterfall at the map edge, rocky pool and bathing NPCs

**Priority:** MEDIUM **Branch:** `feature/edge-waterfall` **Depends on:** 01, 03

> Original request: "di tepi peta ada air terjun yang bagus dan realistis, di bawah air terjunnya ada batu-batu yang digenangi atau dialiri air, dan ada NPC yang sedang bermain air atau mandi".

## Goal

At the east edge of the (now bigger) island, a tall, beautiful waterfall pours from a rocky cliff into a pool. Below it is a natural rock pool with water flowing between the stones. Two or three NPCs are playing and bathing in the shallows.

## Current state (read these)

- Issue 01 reserved `waterfallZone` (east edge, about `x = 62..70`, `z = -10..10`) in `layout.ts`.
- `src/world/River.tsx`: already has a waterfall "curtain" component for the river mouths (`// ---------- waterfalls ----------`, bows outward as it falls) plus splash drops. **Reuse and generalise it** instead of writing a second waterfall shader.
- `src/world/Atmosphere.tsx`: cliffs and sea around the island.
- `src/world/Npc.tsx` (514 lines), `people.ts`, `actors.ts`: NPC model, walk/sit animation, routes from `layout.ts` (`npcRoutes`, `NpcRoute` with `sit`, `idle`, `look`).
- `src/world/stone.ts`: rock geometry helper.

## Design

**Layered cliff + waterfall + pool**, built in the reserved zone:

- A back **cliff wall** about 9 m tall made of stacked rounded rock blocks (instanced with colour variation, `palette.rock`), with mossy green on top and ledges. A stream source at the top (a short river segment or a spring) feeds the fall.
- **Two or three water curtains** of different widths falling from different ledges (the tallest in the centre). Use the existing curtain with: soft edge fade, vertical streak texture scrolling downward, brighter foam streaks, and a **mist cloud** at the base (instanced sprites, additive) plus a faint rainbow arc (a thin gradient ring mesh, visible only during the day and when not raining; optional on `low`).
- **Splash pool** at the base: a round/oval pool (about 12 x 9 m) with a turquoise water shader (reuse the river water shader with a ring ripple from the impact point), foam ring, and a shallow sandy rim.
- **Rocks in and around the pool:** large boulders partly under water, stepping stones, flat rocks where water flows over (thin animated water sheet meshes running over the stones with a slight shine), small cascades between pool tiers. Use two or three pool tiers stepping down toward a stream that runs out to the cliff edge and falls into the sea.
- **Decoration:** reeds, ferns (instanced crossed quads), a few flowers, a fallen log, and a small wooden sign "Zare Falls".
- **NPCs (2 or 3):** reuse `Npc.tsx`. Add a new behaviour variant, for example `bathe: true` in `NpcRoute`: wade slowly to waist-deep shallows, splash with arms (a simple arm swing and a bob), pause, turn, wade somewhere else; one NPC sits on a rock with feet in the water (reuse the existing `sit` pose, lowered legs). Water splash drops at their feet using the existing drop/ripple systems. Their body must be hidden below the water line only visually (clip by the water surface or just lower the body by 0.4 m when wading; no shader tricks needed).

## Tasks

1. New file `src/world/Waterfall.tsx` exporting `<Waterfall />`, mounted from `Experience.tsx`. If you generalise the curtain from `River.tsx`, extract it to `src/world/waterfallCurtain.tsx` and make `River.tsx` import it (keep river behaviour unchanged).
2. Build the cliff, pool, rocks and decorations as above, using instancing and shared materials; counts scaled by tier. Mist and rainbow off on `low`.
3. Add 2 or 3 bathing NPC routes in `layout.ts` (`npcRoutes`), extend `NpcRoute` and `Npc.tsx` for `bathe`. Do not change the existing routes.
4. Make the pool area **not drivable** into the deep part: colliders on the cliff and the big rocks, shallow rim is walkable by NPCs only. Add a visual low fence or stones so it is clear, and make sure the car can reach a viewing spot (a small wooden deck or lookout with a bench) near the pool without driving into the water.
5. Add a short road or trail to the viewing spot from the nearest existing road (`roadSegments`), a sign on the way, and add a minimap/big-map marker if the other areas have one.
6. Sound is optional: if `src/ui/sound.ts` has a simple way to add an ambient loop, a soft waterfall noise that fades in near the pool is a nice touch; skip it if not trivial.

## Acceptance criteria

- [ ] A tall, multi-curtain waterfall with mist, foam, a pool, rocks with water flowing over them, and plants, at the east edge.
- [ ] 2 or 3 NPCs visibly wade, splash and sit with their feet in the water, never clipping through rocks.
- [ ] The car can reach the viewing spot and cannot enter the deep pool; no invisible walls on the road.
- [ ] The existing river waterfalls still look the same as before (or better) after refactoring the curtain.
- [ ] Day, dusk, night and rain all look good; mist/rainbow behave (no rainbow at night or in rain).
- [ ] Draw calls added: at most ~20. `low` tier clearly cheaper. Definition of done in `README.md` is satisfied.
