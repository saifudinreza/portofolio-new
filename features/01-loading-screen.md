# Game-style loading screen with smooth progress

Read `features/README.md` (rules) first.

## Goal
The screen before the visitor enters the world should feel like the loading screen of a game: full-screen artwork, an animated logo, a progress bar that moves **smoothly** (never freezes, never jumps), a stage label ("Downloading the world", "Starting physics", "Building the island", "Preparing graphics"), rotating tips, and a clear **Start driving** button when ready. Loading must not feel stuck or stuttery, and the page must stay responsive while it loads.

## Current state (read these files)
- `src/ui/Hud.tsx` → `Loader()` (the loader markup, tips, progress bar, "still loading" message after 30 s). Styles: `.loader`, `.loader-box`, `.bar` in `src/index.css`.
- `src/store.ts` → `loadProgress`, `loadDone`, `setLoad`, `started`, `start`.
- `src/world/Scene.tsx` → `LoadReporter` copies drei's `useProgress()` into the store.
- `src/App.tsx` → `useLoadIntent()` starts fetching the 3D chunk on the first mouse/key/touch, or 4 s (`IDLE_START_MS`) after page load. The 3D side is a lazy chunk (`lazy(() => import('./world/Scene'))`, about 1.2 MB gzip, mostly three.js and the Rapier WASM).
- Problem: all assets are procedural, so `useProgress` has almost nothing to count. Progress sits at 0 and jumps to 100. The real waiting happens in stages that report nothing: downloading the chunk, starting Rapier, building the world in JS (grass scatter, meadow mask, tree layout), compiling about 75 shader programs on the first frames.

## Rules specific to this feature
- **No fake progress.** The bar may only move for real reasons. It is allowed to *ease* (animate smoothly) towards the real value; it must never run ahead of what is actually done, and it must be monotonic (never goes backwards).
- The main bundle must not import three.js (see README).
- Animate only `transform` and `opacity` (cheap, no layout). Respect `reducedMotion()`: no big motion, a plain bar and fade.
- Keep it accessible: `role="progressbar"` with `aria-valuenow`, the label in `aria-live="polite"`, Start button focusable.

## Steps
1. **Measure first.** Run `npm run build && npm run preview`, open Chrome DevTools → Performance, record the page load with CPU 4x slowdown. Write down in the PR: time to first paint of the loader, time until Start is enabled, and every task longer than 50 ms during loading ("long tasks") with what causes it. This tells you what to fix.
2. **Stage model.** In `src/store.ts` replace the single progress number by stages, each with a weight that sums to 100. Suggested: `download` 35, `physics` 10, `build` 25, `graphics` 30. Add `loadStage` (string id) and keep `loadProgress` as the weighted real total. Each stage reports its own 0..1.
3. **Report real stage progress.**
   - `download`: the Scene chunk is loaded with `import()`, which has no progress. Keep an indeterminate shimmer on the bar during this stage (that is honest), and set the stage to 1 when the import resolves.
   - `physics` and `build`: set the stage when Rapier is ready and when the world components have mounted (a small `<StageDone stage="build" />` component inside `<Suspense>` in `Experience.tsx`, or a `useEffect` in `Scene.tsx`).
   - `graphics`: after the world is mounted, call `gl.compileAsync(scene, camera)` (three supports it; it uses parallel shader compilation) so the shaders are compiled **before** Start is enabled. Without this the first seconds of driving stutter. Fall back to `gl.compile` if `compileAsync` is missing.
4. **Break up long tasks.** For any synchronous task over 50 ms found in step 1 (likely the grass scatter in `Grass.tsx`, `meadowMask()` in `textures.ts`, tree and bush layout), split it into chunks that yield to the browser between chunks (`await new Promise(r => setTimeout(r))` or `scheduler.yield()` when available), or build it lazily behind the loader. The loader animation must keep running at 60 fps while this happens. Do not change what the world looks like.
5. **Smooth display.** In `Loader()` keep a displayed value that eases towards the real value every animation frame (for example `displayed += (real - displayed) * 0.08`), never above the real value, never decreasing. Drive the bar with `transform: scaleX()` (origin left), not `width`.
6. **Game look.** Full-screen, behind the text: a gradient sky in the palette, a simple island silhouette and the jeep (inline SVG or CSS, no image files and no new libraries), a few slow floating leaves or clouds (CSS transform animations, off with reduced motion). Big logo text "ZARE WORLD" with the name and role under it, stage label above the bar, percentage, rotating tip below. Keep the existing "Classic view" button and the error and slow-load behaviour (`SceneError`, `SLOW_LOAD_MS`).
7. **Start.** When `loadDone` is true the bar fills and the button becomes **Start driving** (also Enter / Space / W / ArrowUp, as now). Leaving the loader fades out (existing `leaving` class) without a hitch. Starting must not cause a frame drop longer than 100 ms; check in the Performance panel.
8. Start loading earlier if it helps: the 3D chunk may start as soon as the page is idle (keep the "first sign of a visitor" trigger, but lower `IDLE_START_MS` to 1500 if step 1 shows the loader is visible long before the download begins).

## Files
`src/ui/Hud.tsx`, `src/index.css`, `src/store.ts`, `src/world/Scene.tsx`, `src/world/Experience.tsx`, `src/App.tsx`, and wherever step 4 finds a long task (`src/world/Grass.tsx`, `src/world/textures.ts`, `src/world/Trees.tsx`).

## How to test
- `npm run build && npm run preview`, DevTools → Network → "Slow 4G" and CPU 4x slowdown: the bar keeps moving, the stage label changes in order, no jump from 0 to 100, Start enables at the end.
- Performance panel: no long task above 50 ms between the loader's first paint and Start (or list the ones left, with a reason).
- First 5 seconds of driving after Start: no shader-compile hitch (compare the frame-time graph before and after).
- Reduced motion (DevTools → Rendering → Emulate prefers-reduced-motion): calm bar, no floating shapes.
- Block the Scene chunk in DevTools: the error screen from `SceneError` still appears.

## Acceptance criteria
- [ ] The loader looks like a game loading screen (artwork, logo, stage label, tips, Start).
- [ ] Progress is real, monotonic and eased; no jump from 0 to 100; stage labels match what is happening.
- [ ] Shaders are compiled before Start is enabled; the first seconds of driving do not stutter.
- [ ] Long tasks during load are removed or listed with a reason (before/after numbers in the PR).
- [ ] Works with reduced motion, keyboard, screen reader, and the error/slow-load paths still work.
- [ ] Main bundle size does not grow by more than 10 kB gzip; it still contains no three.js.
