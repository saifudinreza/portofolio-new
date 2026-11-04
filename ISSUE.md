# ZARE WORLD — IMPROVEMENT BACKLOG

**Project:** Zare World Portfolio  
**Reference:** https://bruno-simon.com/  
**Project URL:** https://zare-world-portofolio.vercel.app/  
**Goal:** Develop Zare World into a polished, memorable, interactive 3D portfolio.

> Use Bruno Simon as a quality reference for interaction, visual polish, gameplay, and presentation. Do not copy his world or assets. Build an original visual identity for Zare World.

## How to use this backlog

- Work incrementally; do not implement every issue in one pass.
- Audit the current codebase before changing anything.
- Mark an issue complete only after testing it in the running project.
- Update `PROGRESS.md` whenever work starts, changes status, or is completed.
- Reuse existing systems where practical. Avoid unnecessary rewrites and dependencies.

### Priority definitions

- **CRITICAL:** Core quality, stability, or performance requirement.
- **HIGH:** Important to the main experience.
- **MEDIUM:** Valuable enhancement.
- **LOW:** Optional polish or gamification.

---

# Phase 0 — Audit the Existing Project

## ISSUE-000: Audit the Current Codebase
**Priority:** CRITICAL  
**Category:** Architecture / Planning  
**Status:** IN PROGRESS

> **Audit 2026-11-04.** Audit kode selesai 2026-11-04 tanpa mengubah kode. Belum dicek: konsol di browser, mobile asli, FPS asli; milestone pertama menunggu persetujuan pemilik.

### Objective
Understand what already exists before implementing improvements.

### Tasks
- [x] Inspect the project structure, framework, dependencies, and build scripts.
- [x] Identify the 3D engine, renderer, physics solution, and asset pipeline.
- [x] Inspect the current world, vehicle controller, camera, input handling, and UI.
- [x] Identify existing features that already satisfy issues in this document.
- [ ] Run the project and record console errors, warnings, and performance observations.
- [ ] Check desktop and mobile behavior.
- [x] Produce a short technical audit and recommended implementation sequence.

### Acceptance criteria
- [ ] Existing features are documented.
- [ ] Each issue is classified as missing, partial, or already implemented.
- [ ] No code is changed during the initial audit.
- [ ] A milestone plan is agreed before major implementation.

---

# Phase 1 — Visual Identity & Environment

## ISSUE-001: Establish a Consistent 3D Art Direction
**Priority:** HIGH  
**Category:** Graphics / Art Direction  
**Status:** PARTIAL

> **Audit 2026-11-04.** Palet `palette` di `world/layout.ts`, tekstur prosedural (`textures.ts`, `decorTextures.ts`), semua model dibuat dengan kode. Gaya low-poly hangat konsisten; belum ada dokumen art direction tertulis. **Saran:** Tulis panduan palet/material singkat di docs; tidak perlu ubah kode. Risiko: rendah. Sukses: panduan ada dan aset baru mengikutinya.

### Objective
Give Zare World a distinctive and consistent visual identity.

### Tasks
- [ ] Define an original visual direction (for example, stylized miniature developer island).
- [ ] Establish a cohesive color palette.
- [ ] Standardize material, texture, and object styles.
- [ ] Ensure proportions and asset styles feel consistent.
- [ ] Avoid mixing realistic and cartoon assets without a deliberate design reason.

### Acceptance criteria
- [ ] The world has a recognizable visual identity.
- [ ] Materials, colors, and proportions feel cohesive.
- [ ] The result feels original rather than a direct copy of the reference.

## ISSUE-002: Improve World Environment
**Priority:** HIGH  
**Category:** Environment Design  
**Status:** PARTIAL

> **Update M2c (#35):** tunggul, kayu, peti, daun gugur di padang, mercusuar, pagar dan bangku tambahan; menunggu merge.
>
> **Update M2b (#34):** semak berkelompok di tepi jalan dan tepi pulau, variasi warna musim gugur, 88 pohon; menunggu merge.
>
> **Update M2a (#33):** rumput diganti rumpun lebar (segitiga rumput -25%) dan tanah di bawahnya diwarnai zaitun; menunggu merge. Dekor, pohon, dan palet global menyusul di #34–#36.
>
> **Audit 2026-11-04.** Pulau dengan 5 zona, jalan, sungai, kolam, jembatan, pohon, rumput, NPC, dekor (`Environment`, `Zones`, `Decor`, `Details`, `Trees`, `Grass`, `River`, `Pond`). Kekurangan: 180 mesh kecil di Zones, tidak ada area tersembunyi/landmark besar di luar zona. **Saran:** Tambah 1-2 landmark dan area rahasia lewat komponen yang ada. Risiko: sedang (draw call). Sukses: landmark terlihat dari jalan dan FPS tidak turun.

### Tasks
- [ ] Add or improve terrain variation, roads, paths, and landscape transitions.
- [ ] Add trees, vegetation, buildings, and decorative props where useful.
- [ ] Create recognizable landmarks and points of interest.
- [ ] Improve scene composition and visual depth.
- [ ] Avoid both empty areas and unnecessary visual clutter.
- [ ] Ensure environment objects have appropriate collision behavior.

### Acceptance criteria
- [ ] The world feels intentionally designed and explorable.
- [ ] Important locations are visually recognizable.
- [ ] Props do not obstruct navigation or portfolio content.

## ISSUE-003: Improve Lighting and Atmosphere
**Priority:** HIGH  
**Category:** Rendering / Graphics  
**Status:** ALREADY IMPLEMENTED

> **Audit 2026-11-04.** Matahari + hemisphere + env map, bayangan, N8AO, Bloom, TiltShift, vignette, ACES, fog (`Environment`, `Atmosphere`, `PostFx`), siklus siang/senja/malam dan hujan (`dayCycle.ts`, `Rain.tsx`). Perlu verifikasi visual di GPU asli. **Saran:** Tidak ada pekerjaan baru; tuning setelah uji GPU. Risiko: rendah.

### Tasks
- [ ] Review directional and ambient lighting.
- [ ] Improve shadow softness and quality where affordable.
- [ ] Evaluate ambient occlusion and fog only if they improve the scene.
- [ ] Establish consistent exposure and color grading.
- [ ] Check lighting in all important areas and on key assets.

### Acceptance criteria
- [ ] Lighting supports a consistent atmosphere.
- [ ] Important objects remain readable.
- [ ] Effects do not cause unacceptable frame-rate drops.

---

# Phase 2 — Vehicle Gameplay

## ISSUE-004: Improve Vehicle Handling and Physics
**Priority:** HIGH  
**Category:** Gameplay / Physics  
**Status:** PARTIAL

> **Audit 2026-11-04.** Rapier, `Car.tsx`: akselerasi 24, MAX_SPEED 13, boost 19, rem, hambatan gulir, tilt pitch/roll visual, anti-slide samping, lompat 7.5 m/s. Kekurangan: tanpa suspensi fisik, rasa berkendara belum diuji manusia. **Saran:** Playtest dan tuning konstanta di `Car.tsx`. Risiko: sedang (mudah merusak rasa). Sukses: tidak menempel/terlempar di tepi, diuji pemilik.

### Tasks
- [ ] Review acceleration and deceleration curves.
- [ ] Tune steering sensitivity based on speed.
- [ ] Improve braking, friction, and reverse behavior.
- [ ] Check collision detection and response.
- [ ] Add suspension/body movement if compatible with the current physics system.
- [ ] Prevent unstable movement, clipping, and unintended launches.

### Acceptance criteria
- [ ] Driving feels responsive and predictable.
- [ ] Steering is controllable at low and high speeds.
- [ ] The vehicle interacts reliably with the environment.

## ISSUE-005: Add or Polish Drift Mechanics
**Priority:** MEDIUM  
**Category:** Gameplay / VFX  
**Status:** PARTIAL

> **Keputusan pemilik 2026-11-04: drift sungguhan DIINGINKAN (dikerjakan di Milestone 3).**
>
> **Audit 2026-11-04.** Ada jejak ban, debu, asap (`CarFx.tsx`, 400 skid) dan suara skid (`sound.ts`). Gesekan samping sengaja dimatikan ("carves, not drifts"), jadi drift sungguhan TIDAK ada. **Saran:** Keputusan pemilik: drift diinginkan atau tidak. Jika ya, kurangi peredam sisi saat rem+belok. Risiko: tinggi (rasa kendali).

### Tasks
- [ ] Implement controllable drift or improve the existing drift behavior.
- [ ] Tune grip and sliding based on speed and steering.
- [ ] Add skid marks and tire smoke only if performance permits.
- [ ] Add appropriate audio feedback if audio is enabled.

### Acceptance criteria
- [ ] Drift is controllable and understandable.
- [ ] Visual effects communicate the action without obscuring the scene.

## ISSUE-006: Improve Camera Follow
**Priority:** HIGH  
**Category:** Camera / UX  
**Status:** PARTIAL

> **Audit 2026-11-04.** Kamera mengikuti dengan smoothing, zoom scroll, orbit drag, intro 2 dtk (`Car.tsx`). Kekurangan: tidak ada tes tembus geometri, tidak ada efek kecepatan/getar. **Saran:** Tambah FOV berdasarkan kecepatan (kecil) dan cek tabrakan kamera di rumah/pohon. Risiko: rendah-sedang.

### Tasks
- [ ] Smooth camera follow and rotation.
- [ ] Tune follow distance and height.
- [ ] Prevent camera clipping through important geometry.
- [ ] Keep the vehicle visible during turns and collisions.
- [ ] Evaluate speed-based camera movement or subtle camera shake.

### Acceptance criteria
- [ ] Camera movement feels smooth, not laggy or abrupt.
- [ ] Driving remains comfortable over extended play.
- [ ] Camera avoids major clipping issues.

## ISSUE-007: Polish Boost and Jump Feedback
**Priority:** MEDIUM  
**Category:** Gameplay / VFX  
**Status:** ALREADY IMPLEMENTED

> **Audit 2026-11-04.** Boost dengan api/FX (`CarFx`), lompat (Space/A/tombol), pendaratan dihitung, achievement airtime. Perlu playtest. **Saran:** Tidak ada pekerjaan baru.

### Tasks
- [ ] Tune boost response and duration.
- [ ] Add clear visual and optional audio feedback.
- [ ] Add jump mechanics only if they fit the existing physics design.
- [ ] Make landing stable and predictable.
- [ ] Prevent boost/jump from breaking collisions or vehicle control.

### Acceptance criteria
- [ ] Boost feels responsive and has clear feedback.
- [ ] Jump and landing are stable if implemented.

---

# Phase 3 — Interactive Portfolio

## ISSUE-008: Create Interactive Portfolio Locations
**Priority:** CRITICAL  
**Category:** Interaction / Portfolio  
**Status:** PARTIAL

> **Audit 2026-11-04.** 5 zona ada (home, projects, skills, about, contact) dengan SpotCard; interaksi lewat parkir + tombol Enter/Y (bukan tombol `E`), input dikunci saat panel terbuka, versi Classic sebagai alternatif. Kekurangan: Experience tidak punya zona sendiri (digabung di About), prompt hanya muncul saat parkir. **Saran:** Pertimbangkan zona Experience atau konfirmasi di About. Risiko: sedang (layout). Sukses: lima lokasi dari ISSUE ada dan jelas.

### Proposed locations
1. **About Me** — introduction and developer profile.
2. **Projects** — selected projects and demos.
3. **Skills** — technologies and capabilities.
4. **Experience** — education and work experience.
5. **Contact** — email and social links.

### Tasks
- [ ] Give each location a recognizable visual marker or structure.
- [ ] Detect when the player enters an interaction range.
- [ ] Display a clear interaction prompt.
- [ ] Support keyboard interaction (for example, `E`) and an appropriate mobile equivalent.
- [ ] Open a readable information panel.
- [ ] Pause or safely manage vehicle input while a panel is open.
- [ ] Allow the visitor to close the panel and resume exploring.

### Acceptance criteria
- [ ] Every location has a clear purpose.
- [ ] Prompts appear and disappear at the correct distance.
- [ ] Interactions work consistently.
- [ ] UI does not conflict with driving controls.
- [ ] Portfolio information is also accessible without requiring difficult exploration.

## ISSUE-009: Build a Reusable Project Showcase
**Priority:** CRITICAL  
**Category:** Portfolio / UI  
**Status:** ALREADY IMPLEMENTED

> **Audit 2026-11-04.** `data/profile.ts` terpisah dari gameplay, `ProjectBits.tsx` dan `SpotCard.tsx` seragam, tautan hilang ditangani (AgentMon tanpa tautan). Thumbnail belum ada. **Saran:** Opsional: thumbnail proyek (tambah aset). Risiko: rendah.

### Each project should support
- [ ] Project name and thumbnail.
- [ ] Short description and problem solved.
- [ ] Technology stack.
- [ ] Key features and personal contribution.
- [ ] GitHub link.
- [ ] Live demo link, when available.

### Acceptance criteria
- [ ] Projects use a consistent presentation.
- [ ] External links work.
- [ ] Project content is managed separately from unrelated gameplay logic.
- [ ] Missing demo/repository links are handled gracefully.

---

# Phase 4 — Exploration & Game Features

## ISSUE-010: Add Optional Discoveries
**Priority:** MEDIUM  
**Category:** Exploration  
**Status:** PARTIAL

> **Audit 2026-11-04.** Ada 12 achievement, circuit time trial (6 gerbang), skin terbuka lewat achievement. Tidak ada collectible atau area tersembunyi sungguhan. **Saran:** Tambah collectible kecil memakai `achievements.ts`. Risiko: rendah-sedang.

### Tasks
- [ ] Add optional hidden areas or routes.
- [ ] Add collectibles with clear feedback.
- [ ] Add environmental interactions or developer facts.
- [ ] Add checkpoints if they improve navigation.
- [ ] Keep optional discoveries separate from essential portfolio information.

### Acceptance criteria
- [ ] Discoveries are rewarding but not required to view the portfolio.
- [ ] Collectibles and interactions work reliably.

## ISSUE-011: Add Mini-map and Navigation
**Priority:** MEDIUM  
**Category:** UX / Navigation  
**Status:** ALREADY IMPLEMENTED

> **Audit 2026-11-04.** Peta mini di HUD (`DriveHud`) dan peta besar (`BigMap`, tombol M) dengan teleport ke zona. **Saran:** Tidak ada pekerjaan baru.

### Tasks
- [ ] Create a readable mini-map or world map.
- [ ] Show the player position and major portfolio locations.
- [ ] Add optional destination markers.
- [ ] Make map visibility/toggle behavior clear.
- [ ] Adapt the map to different screen sizes.

### Acceptance criteria
- [ ] Visitors can understand the world layout.
- [ ] Key locations are discoverable without aimless searching.
- [ ] The map does not obstruct gameplay.

## ISSUE-012: Add Achievement System
**Priority:** LOW  
**Category:** Gamification  
**Status:** ALREADY IMPLEMENTED

> **Audit 2026-11-04.** `game/achievements.ts`, toast, daftar di Menu, simpan di localStorage. Achievement beda dari saran (Collector/World Traveler belum ada karena collectible belum ada). **Saran:** Ikuti ISSUE-010.

### Suggested achievements
- First Drive — begin exploring.
- Explorer — visit all major locations.
- Project Hunter — view all featured projects.
- Collector — find optional collectibles.
- World Traveler — discover hidden locations.

### Tasks
- [ ] Define achievement conditions.
- [ ] Track progress reliably.
- [ ] Show unlock feedback and an achievement list.
- [ ] Persist progress locally only where useful and appropriate.

### Acceptance criteria
- [ ] Achievements unlock only when conditions are met.
- [ ] Progress behaves predictably after refresh.
- [ ] Achievement UI is accessible and non-intrusive.

## ISSUE-013: Add Sound Design
**Priority:** MEDIUM  
**Category:** Audio  
**Status:** PARTIAL

> **Audit 2026-11-04.** Mesin, rem/skid, klakson, ambience (ombak, sungai, angin, hujan, burung) semua sintetis; mute (L), slider volume, mulai setelah interaksi. Musik latar didukung tetapi file `public/audio/*.mp3` belum ada. **Saran:** Pemilik menyediakan musik berlisensi dan kredit. Risiko: lisensi.

### Tasks
- [ ] Add optional background music.
- [ ] Add engine, acceleration, braking, and boost sounds.
- [ ] Add interaction sounds and subtle ambience.
- [ ] Provide master mute and volume controls.
- [ ] Respect browser autoplay restrictions; start audio after user interaction.

### Acceptance criteria
- [ ] Audio is balanced and synchronized.
- [ ] Visitors can mute it easily.
- [ ] No unexpected autoplay with sound.

---

# Phase 5 — UI / UX

## ISSUE-014: Improve Initial Loading Experience
**Priority:** HIGH  
**Category:** UI / UX  
**Status:** PARTIAL

> **Update M1 (#32):** ErrorBoundary, context lost, dan pesan loader lambat sudah dikerjakan dan diuji headless; menunggu merge.
>
> **Audit 2026-11-04.** Loader bermerek dengan progres asli dari `useProgress` dan tombol Start saat siap (`Hud.tsx`, `Scene.tsx`). Kekurangan: tidak ada error boundary/penanganan context lost; kegagalan muat lainnya bisa meninggalkan loader macet. **Saran:** Tambah ErrorBoundary + pesan dan tombol ke Classic. Risiko: rendah.

### Tasks
- [ ] Create a branded loading screen.
- [ ] Show real loading progress when measurable.
- [ ] Introduce the world with a short instruction.
- [ ] Provide a clear Start Exploring action.
- [ ] Handle loading failures and prevent a permanent blank screen.

### Acceptance criteria
- [ ] Loading state is polished and informative.
- [ ] Progress is not fabricated.
- [ ] Start becomes available when required assets are ready.
- [ ] Errors provide a useful recovery message.

## ISSUE-015: Improve Gameplay HUD and Controls Help
**Priority:** HIGH  
**Category:** UI / UX  
**Status:** ALREADY IMPLEMENTED

> **Audit 2026-11-04.** Hint tombol singkat, SpotCard kontekstual, tab Controls di Menu (bisa dibuka lagi), peta, kontrol audio, indikator kecepatan. **Saran:** Tidak ada pekerjaan baru.

### Tasks
- [ ] Show concise keyboard control hints.
- [ ] Display interaction prompts contextually.
- [ ] Add speed indicator only if useful to the experience.
- [ ] Provide map and audio controls.
- [ ] Keep HUD readable and visually consistent.
- [ ] Provide a way to reopen the controls guide.

### Acceptance criteria
- [ ] First-time visitors understand how to start.
- [ ] HUD does not dominate the 3D scene.
- [ ] UI adapts to different resolutions.

## ISSUE-016: Add Graphics Settings
**Priority:** MEDIUM  
**Category:** Performance / UX  
**Status:** ALREADY IMPLEMENTED

> **Audit 2026-11-04.** Low/Medium/High mengubah DPR, bayangan, AO, jumlah rumput, hujan (`Scene.tsx`, `PostFx.tsx`, store). Belum diukur pengaruh FPS-nya. **Saran:** Ukur lewat `?stats` di GPU asli.

### Tasks
- [ ] Provide Low, Medium, and High presets if supported by the renderer.
- [ ] Connect presets to actual shadow, resolution, and effect settings.
- [ ] Allow settings to be changed safely during runtime.
- [ ] Choose a sensible default based on device capability where feasible.

### Acceptance criteria
- [ ] Presets make measurable rendering changes.
- [ ] Lower-end devices have a usable option.
- [ ] Changing settings does not break the scene.

---

# Phase 6 — Performance, Responsive Design & Stability

## ISSUE-017: Optimize 3D Assets
**Priority:** CRITICAL  
**Category:** Performance  
**Status:** PARTIAL

> **Audit 2026-11-04.** `public` hanya 434 KB (font, og.jpg); semua geometri prosedural. Bundle: chunk Scene 3,5 MB (1,2 MB gzip) + PostFx 340 KB. Tidak ada GLB untuk dioptimasi. Instancing sudah untuk rumput/pohon; zona belum. **Saran:** Instancing zona, `manualChunks` untuk memisah three/drei. Risiko: sedang; hanya gabung jika FPS/ukuran terbukti membaik.

### Tasks
- [ ] Inspect model sizes, polygon counts, and texture dimensions.
- [ ] Compress and optimize GLB/GLTF assets where appropriate.
- [ ] Reuse geometry and materials.
- [ ] Use instancing for repeated objects when beneficial.
- [ ] Remove unused assets.
- [ ] Load non-essential assets only when needed.

### Acceptance criteria
- [ ] Asset sizes are reasonable for the target experience.
- [ ] Repeated geometry is not duplicated unnecessarily.
- [ ] Visual quality remains acceptable after optimization.

## ISSUE-018: Optimize Rendering and Runtime Performance
**Priority:** CRITICAL  
**Category:** Performance  
**Status:** PARTIAL

> **Audit 2026-11-04.** `?stats` menampilkan FPS/draw call/segitiga (Home: Low 209 call/523k tri, Medium 378/920k, High 398/1,07M; rumput >50% segitiga). FPS asli BELUM diukur (tanpa GPU). Linter: 4 peringatan `react(immutability)` di `Pond.tsx`/`Car.tsx`. 29 listener, 3 dispose: perlu cek kebocoran. **Saran:** Ukur di GPU asli, lalu optimasi yang terbukti. Risiko: sedang.

### Tasks
- [ ] Profile frame time and identify bottlenecks.
- [ ] Reduce unnecessary draw calls and per-frame calculations.
- [ ] Tune shadows and post-processing.
- [ ] Dispose of unused geometries, materials, and textures.
- [ ] Check event listeners and animation loops for leaks.
- [ ] Measure performance in representative areas of the world.

### Suggested targets
- Aim for 60 FPS on capable desktop hardware.
- Maintain a comfortable experience on mid-range devices.
- Provide reduced-quality settings for weaker devices.
- Record actual measurements; do not claim targets are met without testing.

### Acceptance criteria
- [ ] Performance is measured and documented.
- [ ] No major memory leaks or recurring runtime errors.
- [ ] Scene remains responsive during exploration.

## ISSUE-019: Responsive and Mobile Support
**Priority:** HIGH  
**Category:** Responsive Design  
**Status:** PARTIAL

> **Audit 2026-11-04.** Joystick/tombol sentuh, lompat, "I'm stuck", UI responsif, Classic untuk perangkat lemah. Belum diuji di HP asli. **Saran:** Uji perangkat nyata. Risiko: rendah.

### Tasks
- [ ] Implement touch controls or a virtual joystick.
- [ ] Support touch-based camera movement if appropriate.
- [ ] Adapt HUD and panels to mobile screens.
- [ ] Prevent browser gestures from disrupting gameplay where appropriate.
- [ ] Detect unsupported or low-performance devices and provide a graceful fallback.

### Acceptance criteria
- [ ] Core experience is playable on supported mobile devices.
- [ ] Touch controls are comfortable and discoverable.
- [ ] UI does not overlap essential controls.
- [ ] Performance is tested on a real mobile device.

## ISSUE-020: Browser Compatibility and Stability
**Priority:** HIGH  
**Category:** QA / Reliability  
**Status:** PARTIAL

> **Audit 2026-11-04.** Fallback tanpa WebGL → Classic; semua localStorage di try/catch; audio terisolasi. Belum ada tes Firefox/Edge/Chrome manual, tidak ada penanganan `webglcontextlost`, tautan eksternal belum diverifikasi massal. Build lolos, tsc bersih. **Saran:** Tes lintas browser, tambah handler context lost. Risiko: rendah.

### Tasks
- [ ] Test current Chrome, Edge, and Firefox.
- [ ] Handle WebGL or graphics initialization failures.
- [ ] Handle missing or failed asset requests.
- [ ] Check keyboard focus and input conflicts.
- [ ] Test refresh, restart, and returning from portfolio panels.
- [ ] Verify all external links.
- [ ] Check console errors and warnings.

### Acceptance criteria
- [ ] No known critical console errors.
- [ ] Initialization failures show a useful message.
- [ ] Core portfolio information remains accessible when 3D is unavailable.
- [ ] Core flows work in supported browsers.

---

# Recommended Implementation Order

| Milestone | Issues | Main outcome |
|---|---|---|
| 0 — Audit | 000 | Understand current implementation and risks |
| 1 — Stability | 014, 020 | No blank screen on errors; clean lint |
| 2 — Visual overhaul | 001, 002, 003 | Dense, saturated, cohesive world (2a grass and ground, 2b trees and bushes, 2c decor and utilities, 2d palette and lighting) |
| 3 — Performance | 017, 018, 016 | Measured on a real GPU after the visual work |
| 4 — Driving | 004–007 | Real drift, tuned handling, camera polish |
| 5 — Portfolio | 008–009 | Experience zone, easier interaction |
| 6 — Exploration | 010–013 | Collectibles, hidden areas, music |
| 7 — Device testing | 019, 020 | Real phone, Firefox, Edge, links |

> **Revision 2026-11-04:** the visual overhaul moved from last to second. Side-by-side with bruno-simon.com the gap is large: denser and thicker grass, layered textured foliage, many small props (lanterns, benches, fences, rocks, fallen leaves), and bolder colour with strong glow. Keep Zare World's own palette (warmer, more saturated), do not copy assets. Denser grass must be cheap: grass is already over half of the triangles.

## Definition of Done

Zare World is ready for public portfolio use when:

- [ ] It has a distinct and consistent visual identity.
- [ ] Driving and camera controls feel polished.
- [ ] Visitors can easily find About, Projects, Skills, Experience, and Contact.
- [ ] Project details and external links work.
- [ ] Loading, controls, and UI are understandable.
- [ ] Performance has been tested on representative devices.
- [ ] Mobile support or a useful mobile fallback is available.
- [ ] Critical browser and runtime issues are resolved.

**Final vision:** Zare World should feel like a small, playable world that happens to be a developer portfolio — not a traditional portfolio website with a 3D car added to it.
