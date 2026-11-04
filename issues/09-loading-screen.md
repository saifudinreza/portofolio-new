# 09: Game-style loading screen, smooth with no stutter

**Priority:** HIGH **Branch:** `feature/loading-screen` **Depends on:** none

> Original request: "halaman loading sebelum masuk project seperti loading screen game, dan proses loading-nya smooth, tidak kelihatan macet-macet dan patah".

## Goal

The entry screen should feel like a game's loading screen (art, animation, tips, progress, a clear "press to start"), and the progress bar must move **smoothly**: no freezing then jumping, no frame drops while the scene compiles behind it.

## Current state (read these)

- `src/ui/Hud.tsx`: `Loader()` (lines ~21 to 80): name, role, bar, rotating tips, "Start driving" button, "Classic view" button, slow-load message after `SLOW_LOAD_MS = 30_000`.
- `src/world/Scene.tsx` (line 13 to 14): `useProgress()` from drei calls `setLoad(progress, !active && progress >= 100)`. Drei progress only counts loaded assets, so it jumps and stalls (procedural textures and shader compiles do not count).
- `src/App.tsx`: `useLoadIntent()` delays downloading the 3D chunk until the user shows intent or a few seconds pass; the 3D side is lazy loaded; `Suspense fallback={null}`.
- `src/store.ts`: `loadProgress`, `loadDone`, `setLoad`, `started`, `start`.
- `src/ui/ErrorBoundary.tsx` reuses the loader look for errors.
- CSS: find the `.loader`, `.loader-box`, `.bar` styles (search the repo for `.loader`).

## Why it stutters today

1. Progress is "real" asset progress and jumps (0, then 60, then 100).
2. Procedural texture generation, instancing setup and shader compilation block the main thread in big lumps, so the bar and CSS animation freeze.

## Tasks

1. **Smooth progress.** Keep a *display* value that eases toward the real target every frame (`requestAnimationFrame` lerp, e.g. `shown += (target - shown) * 0.08`, never goes backwards, never exceeds the target while loading). Real stages feed the target: chunk downloaded (0 to 40%), world assets (40 to 70%), shaders compiled/warmed (70 to 100%). Expose stage progress in the store (`loadProgress` stays the single number consumers read; add `loadStage` text such as "Building the island", "Planting grass", "Filling the river", "Warming up the engine").
2. **No main-thread freezes behind the screen.** Spread the heavy setup across frames: after the chunk loads, run expensive world init in small slices (use `requestIdleCallback` with a `setTimeout` fallback, or yield every few ms with `await new Promise(r => setTimeout(r))`), and call `gl.compileAsync(scene, camera)` (three supports it) to pre-compile shaders before revealing the world, instead of compiling on the first visible frame. Do the warm-up render while the loading screen is still opaque.
3. **Animate the loader only with `transform`/`opacity`** (compositor-only) so it stays smooth even when the main thread is busy. No layout-changing animation on the bar: scale a full-width bar with `transform: scaleX()` instead of animating `width`.
4. **Game-style design** (CSS and a little SVG, no image files, follow `docs/art-direction.md` palette):
   - Full-screen warm gradient (sky colours) with a parallax silhouette of the island and floating clouds (CSS transforms), the little jeep driving along a road line at the bottom whose position follows the progress (a tiny SVG car).
   - Title "SAIFUDIN REZA" large, role under it, a stage text line (from `loadStage`), a thick rounded progress bar with a shimmer, and a percentage.
   - Rotating tips as today, in a "TIP" card, with a fade between tips.
   - When ready: the bar fills, the stage text becomes "Ready", and a pulsing **"Press Enter or tap to start"** replaces the percentage; keep the Start and Classic view buttons.
   - Leaving: a quick fade/zoom out (keep the existing `leaving` class and `reducedMotion()` handling).
5. **Accessibility and fallbacks:** keep `role="progressbar"` with `aria-valuenow`, keep the slow-load message and the Classic view button, respect `prefers-reduced-motion` (no parallax or shimmer), and still work if the 3D chunk fails (the existing `SceneError`).
6. **Do not lengthen the load.** Never fake extra waiting; the screen must dismiss as soon as everything is truly ready (the ease-out lerp should finish within ~400 ms after ready).

## Out of scope

Changing what gets loaded (that is performance work in other milestones) and the in-game HUD.

## Acceptance criteria

- [ ] Record the load on a throttled CPU (DevTools: 4x slowdown) and slow 4G: the bar moves continuously, never jumps backward, never sits frozen for more than ~0.5 s, and the car/clouds animation keeps running smoothly.
- [ ] Performance panel: no single long task over ~100 ms during the loading screen after the chunk arrives (before/after numbers in the PR).
- [ ] No frame hitch in the first 2 seconds after pressing Start (shaders were pre-compiled).
- [ ] Looks like a game loading screen on desktop and at 390 px wide; text readable.
- [ ] `prefers-reduced-motion`, keyboard start (Enter, Space, W, Arrow Up), Classic view and the slow-load message all still work.
- [ ] Definition of done in `README.md` is satisfied.
