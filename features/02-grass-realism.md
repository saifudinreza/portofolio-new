# Thicker, more realistic grass with no bare ground

Read `features/README.md` (rules) first.

## Goal
The meadows must look like a lush, realistic lawn: grass so dense that **no bare soil shows between the blades**, with natural variation (blade shape, height, colour, clumps, a few wildflowers and dry tufts). It keeps the stylised look of the island, it is just fuller and more believable.

## Current state (read these files)
- `src/world/Grass.tsx`: one instanced mesh. Each instance is a **tuft** of 5 wide blades (15 triangles, `tuftGeometry()`); positions come from `scatter(target)` (28000 tufts on desktop `TUFTS_FULL`, 8500 on touch devices `TUFTS_COARSE`), thinned per tier by `GRASS_DENSITY` (0.4 / 0.75 / 1) and `GRASS_HEIGHT`. Wind and car footprints are in the vertex shader (`vertexBody`), colour in `fragmentColor`.
- `src/world/Environment.tsx` → `Ground()` and `meadowShader()`: the ground is sand tinted olive where `meadowMask()` (`src/world/textures.ts`) says grass grows; `meadowField()` in `layout.ts` is the lushness field.
- Today grass still leaves large sand areas (roads, plazas are intentional) and small gaps inside meadows. Grass is more than 40% of all triangles on High (about 420k), so **more instances is not the answer**.

## Rules specific to this feature
- Keep grass triangles at or below today's numbers on every tier (Low 168k, Medium 315k, High 420k at Home in `?stats`), or justify any increase in the PR. Get density from smarter geometry, not from raw count.
- Keep wind, car footprints, `isClear` exclusions (roads, pads, pond, river), and the road-edge thinning.
- Roads, plazas and beaches stay sand/stone. Only meadow ground becomes fully covered.

## Steps
1. **Measure and look.** Screenshot a meadow close and far (zones About and Projects, camera zoomed out and in). Note in the PR where the soil still shows.
2. **Ground colour under grass.** Make the meadow ground a rich dark green-brown that matches the grass root colour (`grassBase` in `Grass.tsx`), so any gap still looks like shaded lawn, not sand. Tune the colour in `meadowShader()` in `Environment.tsx` and make the meadow mask reach 1.0 in meadows (see `meadowMask()` in `textures.ts`, currently `0.65 + meadowField * 0.35`). Add a subtle noise/mottling so it is not flat.
3. **Denser coverage cheaply.**
   - Use a second, much cheaper layer: a *ground-cover* mesh of low (0.1 to 0.2 m) wide blades, 1 to 2 blades per instance (3 to 6 triangles), only within the camera's area (cull or fade by distance to the car: draw only tufts within about 35 m of `carState`, update the instance count or a distance fade in the shader). This gives the dense carpet where the player looks.
   - Far tufts (beyond ~35 m) can be sparser and lower. Use `uniform vec2 uCenter` (car position) and fade by distance in the vertex shader (scale height towards 0 beyond the limit), no CPU work per frame.
4. **Realism of the blade.** Change `tuftGeometry()`: 7 to 8 thinner blades per tuft with 3 segments (curved, not straight), narrower tips, blades curving in different directions, each with its own height factor (0.5 to 1.2) and a darker base. Keep the tuft at or below 24 triangles; if that costs too much, lower `TUFTS_FULL` and report the numbers.
5. **Realistic colour.** Per-blade colour variation (the `aShape.y` tint shift exists): yellow-green tips, deep green roots, an occasional dry/straw blade (5%), a darker green in shade areas (use the same `meadowField`), light translucency at the tips against the sun (add a small tip brightening in the fragment shader; no extra lights).
6. **Life.** Wildflowers (small yellow/white dots) are already a separate instanced mesh in `Details.tsx` (`useVegetation`); raise their count a little inside dense meadow only. Keep it instanced.
7. **Check every tier.** Low must still look like a lawn (fewer, a bit shorter) and not like patches on sand. Check phones (`TUFTS_COARSE`).

## Files
`src/world/Grass.tsx`, `src/world/Environment.tsx`, `src/world/textures.ts` (`meadowMask`), `src/world/layout.ts` (`meadowField`), `src/world/Details.tsx` (flowers).

## How to test
- Screenshots before/after, same camera, at About, Projects, and a zoomed-out view from the plaza, on Low, Medium, High, day and dusk.
- `?stats`: grass triangles per tier, total draw calls (the ground-cover layer may add 1 draw call).
- Drive through the grass: the wind sways it and the car still leaves a trail (footprints).
- Rain and night: grass still readable, not black.

## Acceptance criteria
- [ ] From the default camera no bare soil/sand is visible inside meadows (roads, plazas and beaches excluded).
- [ ] Blades look natural: varied height, curve and colour; no obvious repeating tufts.
- [ ] Grass triangles are not higher than today on any tier (or the increase is justified with numbers).
- [ ] Wind, footprints, exclusions and road-edge thinning still work.
- [ ] Low and phone settings still look like grass.
