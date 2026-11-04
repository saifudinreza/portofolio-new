# NPCs playing and bathing in the waterfall pool

Read `features/README.md` (rules) first. Do `09-waterfall-cove.md` before this one.

## Goal
A few NPCs enjoy the waterfall cove: some wade and splash in the pool, one stands under the waterfall, one sits on a rock with feet in the water, one floats or bobs, and a couple of people stand on the bank cheering or taking pictures. They react if the car comes close (they dodge or wave) and they look happy and alive.

## Current state (read these files)
- `src/world/Npc.tsx` (514 lines): `Person({ route, seed })` runs a small state machine, `type State = 'patrol' | 'idle' | 'avoid' | 'sit' | 'knocked' | 'getup'`; walk speed `WALK_SPEED`, sitting drop `SIT_DROP`, `ACTOR_RADIUS`, knock-down on hit. Routes are data: `npcRoutes` in `src/world/layout.ts` (type `NpcRoute`, `Waypoint = { x, z, idle?, look? }`, `sit?`, `hat?`). `Npcs()` creates one `Person` per route.
- `src/world/people.ts`: `Look` (skin, shirt, pants, hair, `hairStyle`, `hat`, `glasses`, `backpack`, `longSleeves`, `shorts`), `buildPerson(look)`: body parts merged into a few meshes sharing one material (`peopleMaterial()`). Body part refs inside `Person` are the torso, head, thighs, shins, upper arms and forearms (see how `legR`, arms and `SIT_DROP` are animated in `Npc.tsx`).
- Actors (anything that bumps the car) are in `src/world/actors.ts`; the car pushes/knocks NPCs.
- The pool, its centre and `inWaterfallPool(x, z)` come from feature 09 (`src/world/layout.ts`, `src/world/Waterfall.tsx`). Water surface is at 0.2 m.

## Design
- Add a new NPC kind, **swimmer**, as extra states in `Npc.tsx`, not a second system:
  - `wade`: walks in the shallows with legs hidden by the water (body lowered by about 0.15 m so the water surface at y = 0.2 hides the shins), arms swinging, slower speed (0.7 m/s), small ripples under the feet (reuse the pond/river ripple function, one ring every 0.6 s).
  - `splash`: stands in the pool and splashes with both arms (forearms swing fast), droplets burst up (small instanced particle burst, 8 drops, same as the existing splash drops) and laughing bob.
  - `bathe`: stands under the waterfall edge with arms raised, body wiggle, head up. Needs a spot inside the mist (check it is not behind the rock wall).
  - `sitRock`: reuse `sit` but with feet hanging and one leg kicking (kick the shin with a sine), sitting on a flat rock.
  - `float`: lies back at the surface (body rotated horizontal, lowered so only the front shows), slow bob. At most one.
  - `cheer`: on the bank, hops and waves, or holds up a phone toward the waterfall.
- 6 swimmers total: 2 wade, 1 splash, 1 bathe, 1 sitRock, 1 float; plus 2 bank NPCs (`cheer`). Use `shorts: true` and bare arms (`longSleeves: false`) and varied looks via `lookFor(seed, hat)`; one with a swim cap-like hair style is fine. Use bright swimwear colours from `palette`.
- Reactions: if the car comes within 4 m, wading NPCs step away from it and wave; if it enters the pool (`inWaterfallPool`) they splash away to the bank (reuse `avoid`/`dodge`). They return to their spot after 5 s.
- Sound: a small laugh/splash sound when a splash burst happens, using the Web Audio synth in `src/ui/sound.ts` (like `splash`), positional if easy; respect mute. Optional.
- Everything must work at night too (they do not disappear; fine).

## Steps
1. Read `Npc.tsx` fully, `people.ts`, `layout.ts` (`npcRoutes`, `NpcRoute`, `Waypoint`). Draw the state machine on paper first: current states, transitions, which part animates in each.
2. Extend `NpcRoute` in `layout.ts` with an optional `activity?: 'wade' | 'splash' | 'bathe' | 'sitRock' | 'float' | 'cheer'` and add 8 routes near the pool (positions inside `inWaterfallPool` for swimmers, on the bank for cheerers). Keep `side` and `points` semantics.
3. Add the new states to `State` and animate them in `Person` (same file, same refs). Keep the code readable: one small function per activity that sets the limb rotations and root offset.
4. Lower the body root by the right amount per activity so the water hides what it should; add the ripple/splash hooks.
5. Reactions to the car and being knocked: make sure `knocked` and `getup` still work in water (no sinking below y = -0.5, return to the activity afterwards).
6. Budget: today `Npcs()` creates one `Person` per route, and the "People" row of `?stats` shows 77 meshes (about 11 per person). 8 more people would add about 88 draw calls, which is too many. Check how `Person` creates its meshes; if each person has its own meshes, either let the swimmers share instanced geometry per body part, or reduce the cove to 4 NPCs. The limit is **+40 draw calls on High**. Report the "People" row before and after.
7. Tiers: `low` = 3 swimmers and no particles, no ripples; `medium` = 6; `high` = all 8 (use `tier` to slice the routes list).

## Files
`src/world/Npc.tsx`, `src/world/people.ts` (only if a new body part pose helper is needed), `src/world/layout.ts` (`NpcRoute`, `npcRoutes`), `src/ui/sound.ts` (optional).

## How to test
- Look at the cove from the default camera: people are clearly playing in the water, each doing something different.
- Drive close: they react. Drive into the pool: they scatter and come back. Hit one (boost): they fall and get up as before.
- NPCs outside the cove (home, projects, about, contact, warehouse, pond) behave exactly as before.
- `?stats` "People" row for Low/Medium/High before and after. Console clean.
- Day, dusk, night, rain.

## Acceptance criteria
- [ ] Up to 8 NPCs in and around the pool with at least 5 different activities that look natural.
- [ ] They react to the car, can be knocked down, and recover to their activity.
- [ ] No NPC clips through the rocks, the wall or underwater; legs look submerged correctly.
- [ ] Existing NPC routes and the knock-down behaviour are unchanged.
- [ ] Low/Medium/High counts and People draw calls reported in the PR.
