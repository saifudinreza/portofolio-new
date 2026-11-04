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
| 2 — Visual overhaul | ISSUE-001 to 003 (2a-2d) | IN PROGRESS: 2a-2c done; 2d PR open | #33 (2a), #34 (2b), #35 (2c), #36 (2d) |
| 3 — Performance | ISSUE-017, 018, 016 | IN PROGRESS: leak audit done, FPS pengukuran menunggu pemilik | #37 |
| 4 — Driving | ISSUE-004 to 007 | DONE kecuali playtest manusia | #38 |
| 5 — Portfolio | ISSUE-008 to 009 | DONE kecuali thumbnail proyek | #39 |
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

### 2026-11-04 (folder issues/)
- Folder `issues/` berisi 9 file fitur (satu fitur satu issue, GitHub #49–#57) untuk model AI yang lebih murah: perluasan pulau, rumput, sungai, jembatan, air mancur, monumen proyek, gedung About, air terjun + NPC mandi, loading screen. Urutan dan aturan bersama ada di `issues/README.md`. Folder `features/` yang kembar dihapus, `prompt.txt` dihapus.

### 2026-11-04 (M3 / #37, bagian tanpa GPU)
- **Audit listener:** 18 `addEventListener` vs 13 `removeEventListener`; 5 sisanya disengaja (listener singleton di `sound.ts` dan elemen audio hidup selama halaman; listener canvas di `Scene.tsx` ikut hilang dengan elemennya). Tidak ada kebocoran listener.
- **Kebocoran nyata ditemukan dan diperbaiki:** `Fireflies` (dipasang/dilepas saat tier berpindah Low ↔ Medium/High) membuat geometri dan material yang tidak pernah dibuang. Diukur lewat overlay `?stats` (sekarang menampilkan jumlah geometri dan tekstur GPU): sebelum +1 geometri per siklus, sesudah 315 → 315 → 315 setelah 12 siklus Low↔Medium dan 320 stabil di Medium↔High.
- **Kebocoran kecil yang tersisa:** +1 tekstur GPU (kecil) setiap kali tier naik dari Low ke Medium (tidak terjadi Medium ↔ High). Bukan `scene.environment` (sudah dicoba dibuang, tidak berpengaruh); kemungkinan di dalam drei `Environment`. Diabaikan: auto-quality hanya flip-flop maksimum 4 kali lalu berhenti.
- **Pemecahan chunk dicoba dan dibatalkan:** `manualChunks` (three / r3f / rapier) membuat `index.html` memuat `physics-wasm` (842 kB gzip) dan `r3f` (479 kB gzip) lebih dulu lewat modulepreload, merusak pemuatan malas (halaman awal tidak boleh mengunduh 3D). Rapier + WASM base64 ternyata bagian terbesar chunk Scene (±2,2 MB dari 3,5 MB). Ukuran total gzip tidak berubah, jadi tidak dipakai.
- **Menunggu pemilik:** FPS di GPU asli (Low/Medium/High di Home, Projects, sungai; desktop dan HP) lewat `?stats`, lalu optimasi yang terbukti (instancing zona, bayangan benda kecil).

### 2026-11-04 (M5 / #39)
- **Keputusan:** Experience jadi zona sendiri (bukan papan di About), karena area About sedang dibangun ulang di issue lain. Lokasi: ujung barat jalan baru, pad di (-58, -6), spawn (-46, -6,8) di jalan menghadap area; ruang di sekitarnya dikosongkan lewat `keepClear`, jalan sambungan ditambahkan di akhir `roadSegments` (indeks gerbang circuit tidak berubah).
- `world/ExperienceArea.tsx` (baru): pad koral dengan koper melayang, papan besar "EXPERIENCE", dua papan milestone (satu per pekerjaan dari `profile.experience`, menghadap selatan seperti semua papan lain), tumpukan peti. Kartu Experience di `SpotCard`; kartu About tidak lagi memuat daftar kerja (menunjuk ke Experience).
- Terhubung: tombol top bar (nama pendek "Work" di layar sempit), Big map dan teleport, minimap (titik dan label WORK), marker ↵, achievement "Grand tour" kini 6 area (jumlah dari `zones`), kartu di Classic sudah punya Experience.
- **E sama dengan Enter** untuk membuka tautan spot (Menu Controls, README, petunjuk di kartu diperbarui); Y di gamepad tetap. Petunjuk "Press E or Enter" sudah muncul begitu mobil masuk sensor (tidak perlu parkir penuh).
- Diuji: mobil menyetir dari spawn ke pad, kartu Experience terbuka; top bar 390 px muat; tsc, lint, build lolos. Thumbnail proyek: menunggu gambar dari pemilik.

### 2026-11-04 (M4 / #38)
- **Bug "mobil bergerak sendiri":** pelatuk gamepad (`value(7) - value(6)`) tanpa dead zone membuat throttle tidak nol saat nilai istirahat 0,04: rem parkir tidak aktif dan tidak ada hambatan gelinding, jadi mobil merayap lalu terus berakselerasi. Perbaikan di `store.ts`: dead zone pelatuk 0,1; throttle di bawah 0,1 dan steer di bawah 0,05 dianggap 0. Diuji headless dengan gamepad palsu: pelatuk 0,05 dan stick 0,1 membuat mobil diam 12 dtk (0,00 m, parked); pelatuk penuh tetap menjalankan mobil.
- **Drift:** tahan rem (B / Ctrl / gamepad B / tombol sentuh Drift) sambil belok di atas 6 m/s. Grip samping turun (10 menjadi 1,8), belok +15%, hambatan rem ringan; selip dibatasi 0,55 kali kecepatan maju (sekitar 33 derajat); grip kembali sekitar 0,4 dtk setelah dilepas. Steering berkurang 35% di kecepatan tertinggi. Achievement "Sideways" (drift 2 dtk berturut-turut).
- **Kamera:** FOV 38 menjadi 42 menurut kecepatan (tidak dengan reduced motion); raycast dari mobil ke kamera menarik kamera mendekat bila ada benda padat di antaranya (minimum 6 m).
- **Suara dan efek:** suara ban mengikuti selip, tidak hanya rem (jejak ban sudah memakai selip).
- **Verifikasi:** simulasi numerik 60 Hz dengan rumus yang sama (di luar Rapier karena simulasi headless hanya sekitar 1 FPS): drift stabil di kecepatan normal dan boost, tanpa spin, counter-steer bekerja, rem lurus tidak drift. Rasa berkendara di keyboard, sentuh, dan gamepad belum dites manusia.

### 2026-11-04 (M2d / #36)
- `docs/art-direction.md` (baru): palet dengan hex, aturan material, mood cahaya per waktu, checklist aset baru.
- Palet `layout.ts` lebih hangat dan jenuh (pasir, jalan, teal, coral, kuning, daun, horizon). Keyframe siang di `dayCycle.ts`: matahari emas lebih kuat (2.5), fill hangat lebih rendah, zenith teal lebih jenuh; malam lebih biru dengan lampu 2.6x. Post (High): saturasi 0.08 → 0.2, kontras 0.06 → 0.1, bloom threshold 1.2 → 1.0, split tone 0.16 → 0.2.
- Dicek lewat screenshot di About: siang, senja, malam, hujan (High) dan siang (Medium). Tidak ada efek baru, hanya parameter; beban tidak berubah. FPS tidak diukur.

### 2026-11-04 (M2c / #35)
- `world/Scenery.tsx` (baru, semua instanced): 16 tunggul dengan 60% kayu gelondongan di sebelahnya, 12 tumpukan peti (padat, collider), 260 daun gugur di padang (tidak di Low), dan mercusuar di barat daya (-41, 38) sebagai landmark. Di `Details.tsx`: 5 pagar tambahan dan bangku di tepi jalan (hanya yang lolos pengecekan ruang terbuka).
- `?stats` di Home (sebelum → sesudah): draw call 209/378/398 → 213/386/406 (Low/Med/High); segitiga +17k (Scenery 16.7k). FPS tidak diukur.
- Landmark per zona: Home (huruf REZA), Projects (halaman berpaving), Skills (gudang), About, Contact (pad) sudah punya struktur sendiri; tidak ditambah struktur baru per zona, hanya satu landmark jauh (mercusuar).

### 2026-11-04 (M2b / #34)
- Semak tambahan berkelompok di tepi jalan (mulai 14 m dari plaza agar papan petunjuk tidak tertutup) dan di tepi pulau, hanya di Medium/High; Low tetap 70 semak asli.
- Variasi warna: sekitar 30% semak dan 28% pohon oak berwarna kuning-zaitun atau oranye (pengali warna per instance). Pohon 70 → 88. Inti padat tajuk digelapkan supaya terbaca sebagai bayangan, bukan bola plastik.
- `?stats` di Home: Trees Low/Med/High 52k/60k/64k → 66k/75k/81k, Details 51k/55k/57k → 51k/77k/80k segitiga; draw call tetap 209/378/398. Total High 935k → 997k (masih di bawah 1.075k sebelum #33).

### 2026-11-04 (M2a / #33)
- Rumput: satu instance sekarang satu rumpun 5 bilah lebar (15 segitiga) menggantikan satu bilah tipis (7 segitiga). Tanah di bawah rumput diwarnai zaitun lewat mask "meadow" (`meadowMask` di `textures.ts`, `meadowField` di `layout.ts`). Warna rumput dibuat lebih jenuh, tepi jalan lebih jarang.
- Segitiga rumput di Home, diukur dengan `?stats`: Low 224k → 168k, Medium 420k → 315k, High 560k → 420k. Draw call tetap (209 / 378 / 398). FPS tidak diukur (tanpa GPU).
- Screenshot sebelum/sesudah di zona About dan Projects dilihat manual; lint 0 peringatan, tsc dan build lolos.

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
