# Zare World: feature issues (v2 visual and polish round)

One feature = one issue file = one branch = one PR. Do them **in order**: later issues build on earlier ones.
These are written for a smaller/cheaper AI model, so each file says exactly which files to touch and how to check the result.

> The older root `ISSUE.md` is the previous backlog (Bruno Simon-style audit). It is kept as is. This folder is the new work.

## Order and dependencies

| # | GitHub | File | Feature | Depends on |
|---|---|---|---|---|
| 01 | #49 | [01-world-expansion.md](./01-world-expansion.md) | Bigger island (foundation for the rest) | none |
| 02 | #50 | [02-grass-dense-realistic.md](./02-grass-dense-realistic.md) | Thicker, tighter, more realistic grass, no bare soil | 01 (#49) |
| 03 | #51 | [03-river-realism.md](./03-river-realism.md) | Realistic river with sloped banks, rocks and decor | 01 (#49), 02 (#50) |
| 04 | #52 | [04-bridge-redesign.md](./04-bridge-redesign.md) | More realistic, attractive bridge | 03 (#51) |
| 05 | #53 | [05-pond-fountain.md](./05-pond-fountain.md) | Statue fountain in the koi pond | 02 (#50) |
| 06 | #54 | [06-projects-monuments.md](./06-projects-monuments.md) | A monument or statue per project | 01 (#49) |
| 07 | #55 | [07-about-monument.md](./07-about-monument.md) | A real monument building for About Me | 01 (#49) |
| 08 | #56 | [08-edge-waterfall-bathing-npcs.md](./08-edge-waterfall-bathing-npcs.md) | Edge waterfall, rocky pool, NPCs bathing | 01 (#49), 03 (#51) |
| 09 | #57 | [09-loading-screen.md](./09-loading-screen.md) | Game-style, smooth loading screen | none (can be done any time) |

The two-digit numbers (01 to 09) are file numbers. Wherever an issue says "Depends on: 03", look up the GitHub number in this table (#51).

## Rules that apply to every issue

Read these once before starting any issue.

1. **Read first, then code.** Read `docs/art-direction.md` and the files named in the issue before editing. The style is a *warm, rounded, low-poly miniature*, not photoreal. "Realistic" in these issues means *believable and richly detailed within that style*, not photographic.
2. **Branch.** Start from `main`: `git switch main && git pull && git switch -c feature/<issue-slug>`. The working tree may hold someone else's uncommitted edits (for example `prompt.txt`). Do not commit or revert files you did not change for this issue.
3. **Colours** come from `palette` in `src/world/layout.ts`. Add a new token there rather than hard-coding a hex in a component.
4. **Performance budget.** The scene already runs on weak phones. For every new thing:
   - repeated objects (rocks, reeds, stones, flowers) must be **instanced** (`InstancedMesh`), one draw call per kind;
   - respect quality tiers: read `useStore((s) => s.tier)` (`'low' | 'medium' | 'high'`) and scale counts down on `low` and `medium` (see `GRASS_DENSITY` in `Grass.tsx` or `REED_CLUSTERS` in `River.tsx` for the pattern);
   - no new dependencies, no image/model files: textures are drawn in code (`textures.ts`, `decorTextures.ts`), geometry is built in code;
   - dispose geometries/materials/textures you create in an effect cleanup (see commit `7704612`, which fixed a leak of this kind);
   - frame time must not get visibly worse. Check with `?stats` on the URL (the `Stats.tsx` overlay) before and after, and write both numbers in the PR.
5. **Night, dusk, rain.** Anything that glows uses an emissive material registered with `trackLamp` (see how the lighthouse or lanterns do it) so it brightens at night. Check the look at day, dusk, night and rain (the day/rain controls are in the menu).
6. **Collision.** Only make something solid (Rapier `RigidBody` / collider) if the car can really hit it, and keep colliders simple (boxes, cylinders). Never put a collider across a road or in front of a pad. Use `isClear(x, z)` from `layout.ts` when scattering.
7. **Determinism.** Use `rng(seed)` from `layout.ts`, never `Math.random()`, for anything placed at load, so the world looks the same on every visit.
8. **Mobile.** Anything new must also be fine on the touch UI at 390 px wide. No text smaller than the existing HUD text.
9. **Keep files small.** Put new components in a **new file** under `src/world/` (for example `Fountain.tsx`) and mount it from `Experience.tsx` or `Scene.tsx`. Do not grow `Decor.tsx` / `Pond.tsx` / `River.tsx` further than needed.
10. **Don't break what exists.** Drivable roads, spawns, project pads, the lap circuit gates, NPC routes, the minimap/big map and the classic (2D) view must still work after your change.

## Definition of done (every issue)

- [ ] `npm run lint` and `npm run build` both pass with no new warnings.
- [ ] `npm run dev`, then drive to the changed area. No console errors or warnings.
- [ ] Looked at in day, night and rain. Checked on `low` and `high` quality (menu > graphics).
- [ ] Before/after screenshots saved in `docs/pr/<issue-number>-<name>-before.jpg` / `-after.jpg` (same camera angle).
- [ ] `?stats` frame time and draw calls before vs after are written in the PR description.
- [ ] `docs/art-direction.md` updated **only** if the issue introduced a new palette token or material rule.
- [ ] `PROGRESS.md` gets one line for this issue.
- [ ] PR title: `feat: <short description> (#<GitHub issue number>)`, e.g. `feat: statue fountain in the koi pond (#53)`, and the PR body says `Closes #53`. Use the GitHub number from the table above, not the file number. Keep the PR limited to this one issue.

## If you get stuck

Do not widen the scope. Ship the smaller version that meets the acceptance criteria, and list what you skipped under "Follow-ups" in the PR. If a requirement conflicts with the performance budget, the budget wins and you say so in the PR.
