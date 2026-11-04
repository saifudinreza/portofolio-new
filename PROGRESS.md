# ZARE WORLD — DEVELOPMENT PROGRESS #32 | #33 (2a), #34 (2b), #35 (2c), #36 (2d) | #37 | #38 | #39 | #40 | #41 |

**Project:** Zare World Portfolio  
**Live URL:** https://zare-world-portofolio.vercel.app/  
**Reference:** https://bruno-simon.com/  
**Backlog:** [ISSUE.md](./ISSUE.md)

> This file tracks implementation status. Update it after every meaningful development session.

---

## Current Status

**Overall status:** Audit selesai, menunggu persetujuan milestone pertama  
**Current milestone:** Milestone 0 — Audit (kode selesai; uji perangkat/GPU pemilik tertunda)  
**Last updated:** 2026-11-04

### Status legend

- `TODO` — Not started.
- `IN PROGRESS` — Currently being implemented.
- `BLOCKED` — Waiting on a dependency or decision.
- `DONE` — Implemented and tested.
- `ALREADY IMPLEMENTED` — Existing implementation verified during audit.

---

## Milestone Overview

| Milestone | Scope | Status | GitHub |
|---|---|---|---|
| 0 — Audit | ISSUE-000 | IN PROGRESS | — |
| 1 — Stability | ISSUE-014, 020 | IN PROGRESS (PR open) | #32 |
| 2 — Visual overhaul | ISSUE-001 to 003 (2a-2d) | TODO | #33 (2a), #34 (2b), #35 (2c), #36 (2d) |
| 3 — Performance | ISSUE-017, 018, 016 | TODO | #37 |
| 4 — Driving | ISSUE-004 to 007 | TODO | #38 |
| 5 — Portfolio | ISSUE-008 to 009 | TODO | #39 |
| 6 — Exploration | ISSUE-010 to 013 | TODO | #40 |
| 7 — Device testing | ISSUE-019, 020 | TODO | #41 |

---

## Issue Tracker

| Issue | Title | Priority | Status |
|---|---|---|---|
| 000 | Audit the Current Codebase | CRITICAL | IN PROGRESS |
| 001 | Consistent 3D Art Direction | HIGH | PARTIAL |
| 002 | Improve World Environment | HIGH | PARTIAL |
| 003 | Lighting and Atmosphere | HIGH | ALREADY IMPLEMENTED |
| 004 | Vehicle Handling and Physics | HIGH | PARTIAL |
| 005 | Drift Mechanics | MEDIUM | PARTIAL |
| 006 | Camera Follow | HIGH | PARTIAL |
| 007 | Boost and Jump Feedback | MEDIUM | ALREADY IMPLEMENTED |
| 008 | Interactive Portfolio Locations | CRITICAL | PARTIAL |
| 009 | Project Showcase System | CRITICAL | ALREADY IMPLEMENTED |
| 010 | Optional Discoveries | MEDIUM | PARTIAL |
| 011 | Mini-map and Navigation | MEDIUM | ALREADY IMPLEMENTED |
| 012 | Achievement System | LOW | ALREADY IMPLEMENTED |
| 013 | Sound Design | MEDIUM | PARTIAL |
| 014 | Initial Loading Experience | HIGH | PARTIAL |
| 015 | Gameplay HUD and Controls Help | HIGH | ALREADY IMPLEMENTED |
| 016 | Graphics Settings | MEDIUM | ALREADY IMPLEMENTED |
| 017 | Optimize 3D Assets | CRITICAL | PARTIAL |
| 018 | Rendering and Runtime Performance | CRITICAL | PARTIAL |
| 019 | Responsive and Mobile Support | HIGH | PARTIAL |
| 020 | Browser Compatibility and Stability | HIGH | PARTIAL |

---

## Current Sprint

### Sprint 0 — Codebase Audit

**Goal:** Understand the current project before changing code.

- [ ] Inspect project structure and package dependencies.
- [ ] Identify framework and 3D rendering engine.
- [ ] Identify physics and vehicle controller implementation.
- [ ] Inspect camera and input handling.
- [ ] Inspect scene composition, models, materials, and textures.
- [ ] Inspect portfolio UI and interaction systems.
- [ ] Run the project locally.
- [ ] Record console errors and warnings.
- [ ] Measure baseline loading time and FPS.
- [ ] Test desktop and mobile behavior.
- [ ] Classify every issue as missing, partial, or already implemented.
- [ ] Propose the first implementation sprint.

**Sprint outcome:** A codebase audit and an implementation plan approved before major changes.

---

## Technical Notes

Diisi dari pemeriksaan kode 2026-11-04.

| Area | Current implementation | Notes / risks |
|---|---|---|
| Framework | Vite 8 + React 19 + TypeScript 6, Zustand 5 | Chunk utama (88 kB gzip) tidak memuat three.js |
| 3D engine / renderer | three 0.186 lewat React Three Fiber 9 + drei, postprocessing (N8AO, Bloom, TiltShift, SMAA) | Chunk Scene 3,5 MB (1,2 MB gzip), PostFx 340 kB |
| Physics engine | Rapier (@react-three/rapier) | Gaya berkendara diatur manual di `Car.tsx` (gaya dorong, hambatan, anti-slide) |
| Vehicle controller | `world/Car.tsx`, state per-frame di `carState` | MAX 13 / boost 19 m/s, tanpa drift sungguhan |
| Camera | Follow + smoothing, zoom scroll, orbit drag, intro | Tanpa tes tabrakan kamera |
| Input system | Keyboard, sentuh, gamepad (`store.ts`) | Tombol interaksi Enter, bukan E |
| Asset formats | Tanpa GLB; geometri/tekstur prosedural, font TTF/JSON, og.jpg (public 434 KB) | Musik latar menunggu file |
| UI system | HTML/CSS di luar Canvas: HUD, Menu, BigMap, Classic, SpotCard | Classic = fallback tanpa WebGL |
| Hosting / deployment | Vercel (known deployment URL) | |

---

## Performance Baseline

Record measurements before and after optimization. Test the same device, browser, and scene when comparing results.

| Metric | Baseline | Latest | Notes |
|---|---:|---:|---|
| Initial load time | Not measured | — | perlu uji di jaringan nyata |
| Average FPS | Not measured | — | tanpa GPU di lingkungan audit; ukur dengan `?stats` |
| Lowest observed FPS | Not measured | — | |
| Initial asset transfer size | JS gzip: 88 + 1.206 + 164 kB | — | dari output build, bukan transfer jaringan |
| Memory usage | Not measured | — | |
| Mobile performance | Not tested | — | |

---

## Completed Work

_Belum ada issue dari backlog ini yang ditandai DONE. Pekerjaan sebelumnya (PR #31, issue GitHub #30) mencakup menu, peta besar, lompat, ambience, siklus siang/malam, hujan, circuit, gamepad, `?stats`; status "ALREADY IMPLEMENTED" di tracker berdasar pemeriksaan kode, belum playtest manusia._

| Date | Issue | What changed | Verification |
|---|---|---|---|
| — | — | — | — |

---

## Known Bugs / Blockers

_Add reproducible bugs, blockers, and relevant browser/device details here._

- ~~Linter: peringatan~~ Koreksi: audit awal menyebut 4 peringatan, padahal ada 55 (hampir semua `react/immutability` dan `react/purity` di `src/world`, pola normal R3F). Ditangani di #32: aturan itu dimatikan untuk `src/world`, sisanya diperbaiki; lint kini 0 peringatan.
- ~~Tidak ada ErrorBoundary / handler `webglcontextlost`~~ Ditambahkan di #32 (ErrorBoundary, context lost, loader lambat 30 dtk), diuji untuk chunk diblokir, error render, dan context lost.
- Chunk Scene 3,5 MB memicu peringatan ukuran Vite.
- FPS, mobile asli, Firefox, dan konsol browser belum diverifikasi.

---

## Development Log

### 2026-11-04
- Created the improvement backlog in `ISSUE.md`.
- Created this progress tracker.
- Next action: perform ISSUE-000 (codebase audit).
- No implementation status has been assumed or marked complete.

### 2026-11-04 (M1 / #32)
- Branch `feature/stability-32`: `src/ui/ErrorBoundary.tsx` (boundary + layar pemulihan Reload/Classic), `sceneError` di store, handler `webglcontextlost`/`restored` di `Scene.tsx`, pesan loader lambat 30 dtk, `.oxlintrc.json` override untuk `src/world`, perbaikan `set-state-in-effect` di `KeyHints`.
- Diuji headless Edge: chunk Scene diblokir, error render, context lost + restore, start normal. Lint 0 peringatan, `tsc` dan build lolos. Belum diuji: Firefox, HP asli.

### 2026-11-04 (revisi urutan)
- Dari perbandingan screenshot dengan bruno-simon.com, selisih visual besar (rumput, foliage, dekor, warna). Visual overhaul dinaikkan menjadi Milestone 2, performa jadi Milestone 3.

### 2026-11-04 (keputusan)
- Pemilik memutuskan drift sungguhan diinginkan; masuk ISSUE-005 / Milestone 3.

### 2026-11-04 (audit)
- Audit kode: struktur, dependensi, physics, kamera, input, UI, aset, bundle. `tsc` dan build lolos, lint 4 peringatan. Tidak ada kode diubah.
- Semua 21 issue diklasifikasikan di ISSUE.md: 7 ALREADY IMPLEMENTED (003, 007, 009, 011, 012, 015, 016), 13 PARTIAL, 1 IN PROGRESS (000); tidak ada MISSING murni, tidak ada BLOCKED.
- Keterbatasan: situs referensi bruno-simon.com tidak dibandingkan ulang di sesi ini; FPS dan mobile asli tidak diukur.

---

## Rules for Updating This File

1. Do not mark an issue `DONE` until it has been tested in the running application.
2. If a feature already exists, mark it `ALREADY IMPLEMENTED` after verifying its behavior.
3. If partially implemented, describe what works and what remains.
4. Record important files changed and tests performed in the development log.
5. Update the performance baseline when making rendering or asset optimizations.
6. Keep the issue tracker synchronized with `ISSUE.md`.
7. Do not start a large new milestone while critical regressions from the current milestone remain unresolved.
