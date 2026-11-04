# 03: More realistic river with sloped banks, rocks and decoration

**Priority:** HIGH **Branch:** `feature/river-realism` **Depends on:** 01, 02

> Original request: "sungainya lebih realistis, dan ada lereng miring di pinggirnya yang nanti diisi batu-batu dan hiasan lainnya".

## Goal

The river should read as a real stream cut into the land: banks that **slope down** into the water, a visible depth gradient, and the slopes dressed with rocks, pebbles, reeds, grass, flowers and a few props.

## Current state (read these)

- `src/world/layout.ts`: `riverControl`, `RIVER_HALF_WIDTH = 2.6`, `RIVER_BANK = 1.6`, `RIVER_WATER = 0.2`, `riverPath` (sampled with `s`, `tx`, `tz`), `riverDistance(x, z)` (1 m grid), `inRiver`, `groundHeight` (bridge only).
- `src/world/River.tsx` (508 lines): animated water, river bed "decal on the flat ground", banks, pebbles, boulders, reeds (`REED_CLUSTERS`), waterfalls at both island ends, splashes. **The ground itself is flat**, which is why the river looks painted on.
- `src/world/Environment.tsx`: flat ground plane (with a cliff box), plus the meadow tint.
- `src/world/stone.ts`: helper for stone geometry/material.
- `src/world/Grass.tsx` and `Trees.tsx` use `riverDistance` to stay off the river.

## Tasks

1. **Real bank slope.** Build a dedicated bank mesh (a strip along `riverPath` using a ribbon geometry) that dips from ground level (y = 0) at distance `RIVER_HALF_WIDTH + RIVER_BANK` down to about `y = -0.6` at the water's edge, and a flat bed below the water. Prefer a smooth cosine/smoothstep profile, not a straight wedge. Because the main ground is a flat plane, either (a) cut/hide the plane under the river and use the bank mesh to fill the trench, or (b) displace the plane's vertices. Pick whichever is simpler, and state which in the PR. The trench must not show gaps or z-fighting.
2. **Collision / driving.** The car must not drive on a slope that looks like a cliff and must not sink visually. Simplest correct approach: keep the existing rule (`inRiver` water is not drivable except the bridge) and make the bank slope a **purely visual** dip that is within ~0.6 m, and keep physics ground flat. State this decision in the PR. Do not change `groundHeight()` semantics (the bridge depends on it).
3. **Water realism.** Water colour gradient from shallow (light teal, sandy bed visible) at the edges to deeper (darker teal-navy) in the middle, using the distance to centreline in the existing water shader. Add soft white foam where the water meets rocks and the bank. Keep the existing flow animation direction.
4. **Dress the slopes** (all instanced, counts scaled by tier, positions from `rng(seed)` and `riverPath`, none on the bridge or road: reuse the exclusion helper at the top of `River.tsx`):
   - rocks of 3 or more sizes, partly sunk in the slope, some half in the water, a few stepping-stone lines;
   - pebbles along the water line;
   - reed/cattail clusters (extend `REED_CLUSTERS`);
   - grass tufts and a few flowers on the upper bank (use the shared grass material, do not make a second system);
   - 3 to 5 **hand-placed hero props** along the river: a small wooden fishing dock, a moored rowing boat, an old stone retaining wall segment, a lantern post. Use `RoundedBoxGeometry` and `palette` colours.
5. **Width variation.** Make the river slightly wider and narrower along its length (vary `RIVER_HALF_WIDTH` between about 2.2 and 3.4 as a function of `s`) so it does not look like a constant ribbon. If this touches `riverDistance`, keep `inRiver` and the bridge position consistent (re-check `findBridge()`).
6. The river now ends at the bigger island edge (issue 01) with its existing waterfalls; make sure they still line up with the cliff.

## Out of scope

The bridge itself (issue 04) and the big edge waterfall (issue 08).

## Acceptance criteria

- [ ] From the driving camera, the river clearly sits **below** the surrounding ground with sloped banks (compare before/after screenshots at the same angle).
- [ ] No gaps, z-fighting or floating rocks anywhere along the river; check both banks and both ends.
- [ ] Rocks, pebbles, reeds and the hero props are present and look good at day, dusk, night.
- [ ] The car can still use the bridge and cannot drive through the water; no new invisible walls on land.
- [ ] Grass and trees still avoid the river and its bank.
- [ ] Draw calls added: at most ~8. `low` tier reduces counts clearly.
- [ ] Definition of done in `README.md` is satisfied.
