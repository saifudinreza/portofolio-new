# Zare World: feature issues

One file = one feature = one GitHub issue = one branch = one PR. Written so a cheaper AI model or a junior dev can do each one alone, without guessing.

## Order

Do them in this order. A feature never needs something from a later one.

| # | File | Feature | Needs |
|---|---|---|---|
| 01 | [01-loading-screen.md](01-loading-screen.md) | Game-style, smooth loading screen | nothing |
| 02 | [02-grass-realism.md](02-grass-realism.md) | Thicker, more realistic grass, no bare ground | nothing |
| 03 | [03-pond-fountain.md](03-pond-fountain.md) | Koi pond with a statue fountain | nothing |
| 04 | [04-bridge.md](04-bridge.md) | More realistic, more interesting bridge | nothing |
| 05 | [05-river-banks.md](05-river-banks.md) | Realistic river with sloped, rocky banks | 04 (bridge meets the banks) |
| 06 | [06-projects-monuments.md](06-projects-monuments.md) | Monuments and statues in the Projects area | nothing |
| 07 | [07-about-monument.md](07-about-monument.md) | A real monument building for About me | nothing |
| 08 | [08-island-expansion.md](08-island-expansion.md) | Bigger island | 02, 05 |
| 09 | [09-waterfall-cove.md](09-waterfall-cove.md) | Waterfall, pool and rocks on the new edge | 08 |
| 10 | [10-bathing-npcs.md](10-bathing-npcs.md) | NPCs playing in the water at the waterfall | 09 |

Create the GitHub issue for a feature by pasting its file as the body (`gh issue create --title "<title>" --body-file features/NN-name.md`). Title = the first heading of the file.

## Rules for every feature

Read this section completely before you start. These are the project's rules, learned the hard way.

### Stack and layout
- Vite + React 19 + TypeScript, three.js through React Three Fiber (`@react-three/fiber`, drei), Rapier physics (`@react-three/rapier`), Zustand. **Do not add a dependency** unless the issue says so.
- All 3D code is in `src/world/`. The scene is assembled in `src/world/Experience.tsx`; each part is wrapped in `<P n="Name">` (this is what the `?stats` overlay measures). A new part gets its own `<P>`.
- HTML UI (loader, menu, HUD) is in `src/ui/`. The main bundle must **not** import three.js (it keeps the first page small). Shared types go in `src/store.ts`.
- Colours: use `palette` from `src/world/layout.ts`. Read `docs/art-direction.md` first: warm, rounded, low-poly, saturated, never grey.
- Per-frame state lives in plain mutable objects (`carState`, `input`), **never** in Zustand or React state.
- Anything that glows (lamps, lanterns) is registered with `trackLamp(material)` from `dayCycle.ts` so it brightens at night.

### Performance (hard limits)
- Three quality tiers: `low`, `medium`, `high` (`useStore((s) => s.tier)`). Every new feature must have a cheaper `low` version (fewer instances, no particles, no extra lights) and must never break `low`.
- Repeated objects are **instanced** (`THREE.InstancedMesh`), one draw call per kind. Do not create hundreds of separate meshes.
- No new real-time lights. No new shadow-casting objects unless they are big and solid (small props do not cast shadows).
- Measure before and after with the `?stats` overlay (open `http://localhost:5173/?stats`). Report draw calls and triangles for **Low, Medium and High** in the PR. A feature may add at most about +20 draw calls and +60k triangles on High unless its file says otherwise.
- Respect `reducedMotion()` from `src/ui/device.ts`: no moving particles or big motion when it is true.
- Things created in `useMemo` and mounted/unmounted by tier must be disposed (`geometry.dispose()`, `material.dispose()`) in a `useEffect` cleanup. `<primitive>` objects are **not** disposed for you.

### Gameplay safety
- The island is flat: the ground collider top is y = 0. Colliders only for things the car can really hit. Check with `?debug` (shows the physics shapes).
- Never put solid objects on a road, a spawn point, a project/contact pad or a circuit gate. Use `isClear(x, z, margin)` from `layout.ts` to test a spot. Spawns are in `zones`, circuit gates in `circuitGates`.
- Every localStorage access is in try/catch.
- Do not change the controls, the car physics or the achievements unless the issue says so.

### Testing (all of these must pass before the PR)
```
npx tsc -b          # no errors
npx oxlint          # no warnings
npm run build       # builds
npm run dev         # then look at it in the browser, on Low, Medium and High
```
- Take before/after screenshots (same camera) and put them in `docs/pr/NN-name-before.png` / `-after.png`; mention them in the PR.
- Check day, dusk and night (Menu → Options → Time of day) and rain (Menu → Options → Weather).
- Check the browser console: no errors, no new warnings.
- FPS: if you can, measure on a real GPU with `?stats` and say so. If you cannot, **say that FPS was not measured**. Never invent a number.

### Git
- Start from an up-to-date `main`: `git checkout main && git pull origin main && git checkout -b feature/<name>-<issue number>`.
- Small commits. Commit message ends with the co-author line the tool gives you.
- Update `PROGRESS.md` (a dated entry under Development Log) and tick the feature here.
- Open the PR with `Closes #<issue>`. Do not push to `main`.
- Do not commit `prompt.txt`.

### Definition of done for each file
Every acceptance box ticked, the testing list above passes, screenshots attached, numbers for Low/Medium/High in the PR.
