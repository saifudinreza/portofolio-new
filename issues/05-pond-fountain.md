# 05: Statue fountain in the koi pond

**Priority:** MEDIUM **Branch:** `feature/pond-fountain` **Depends on:** 02

> Original request: "kolam ikannya, saya ingin ada patung air mancur yang bagus dan menarik".

## Goal

Add a beautiful statue fountain in the middle of the koi pond, with animated water jets, falling water, ripples where it lands, and a glow at night. The koi, lily pads and car access must still work.

## Current state (read these)

- `src/world/layout.ts`: `pond = { x: -1.5, z: 27, rx: 5.5, rz: 3.8, water: 0.22 }`, `pondDistance(x, z)` (0 centre, 1 edge).
- `src/world/Pond.tsx` (540 lines): water shader, caustic sand, koi (`FISH_COUNT = 9`), lily pads (`LILY_COUNT`), reeds, ripples (`MAX_RIPPLES = 12`), drops (`MAX_DROPS`), a beach opening on the +z side (`GAP_FROM`/`GAP_TO`) where the car can enter.
- Ripple/drop systems already exist: reuse them to spawn ripples where the fountain water lands. Do not write a second ripple system.

## Design

A **tiered stone fountain with a statue on top**, in the centre of the pond:

- Round stone base (low cylinder with rounded edge) and 2 stacked basins of decreasing size.
- On top, a **statue**. Build it from primitives, in the warm low-poly style. Pick one: a **koi fish leaping upward in a curve** (fits the pond: preferred), or a small figure holding a jug. A koi statue is built as a tapered body with a curved tail and fins using lathe/extruded geometry; keep it under ~600 triangles.
- Water: thin arcs shooting from the statue and from 6 to 8 spouts on the first basin, falling into the lower basin, which overflows as a sheet into the pond. Do this with **one instanced particle system** (positions computed on the GPU in the vertex shader from time, or on the CPU with a fixed pool of ~90 points) following parabolic paths. Semi-transparent, white-blue, additive-ish; no per-frame allocation.
- Mist: a faint soft sprite cloud at the base (a few instanced quads).
- Night: a ring of small emissive underwater lights (`trackLamp`) that tint the water jets warm yellow/teal.

## Tasks

1. New file `src/world/Fountain.tsx` exporting `<Fountain />`; mount it inside `Pond()` or next to it in `Experience.tsx`. Keep `Pond.tsx` changes minimal (only what is needed for exclusion zones and the shared ripple hook).
2. Size: the base radius should stay inside about `0.35` of `pondDistance` so koi and lily pads still have room. Update the koi swim area and lily placement in `Pond.tsx` so they do not pass through the fountain (add an exclusion radius).
3. Spawn ripples via the existing ripple system in a ring around the base, a few per second, so the water surface reacts.
4. Collision: a single cylinder collider for the base (the car can bump it, it is not drivable inside the pond). It must not block the beach entrance.
5. Tier scaling: `high` = full jets and mist; `medium` = half the particles, no mist; `low` = static statue plus 20 particles.
6. Stop the particle animation when the pond is far from the camera (cheap visibility check) to save time.

## Acceptance criteria

- [ ] A recognisable statue fountain sits in the pond centre; water arcs, falls into basins and ripples the pond.
- [ ] Looks good from the driving camera and from above; the fountain is the pond's focal point.
- [ ] Koi, lily pads, reeds and the person sitting by the pond are unaffected and do not clip through the fountain.
- [ ] Night: underwater lights glow; no flicker. Rain: still looks fine.
- [ ] No per-frame allocations in the new code (check with the browser memory profiler for steady heap).
- [ ] Draw calls added: at most ~6. Definition of done in `README.md` is satisfied.
