# 07: A real monument building for About Me

**Priority:** HIGH **Branch:** `feature/about-monument` **Depends on:** 01

> Original request: "di area aboutme atau fitur-fitur profil saya, dibangun bangunan monumen yang bagus, jadi tidak hanya area lingkaran dan ada icon di tengahnya saja".

## Goal

Replace the About Me "circle pad with a graduation cap floating in the middle" by an actual **building**: a small academy/library monument that tells the profile story. Driving into it still opens the About card.

## Current state (read these)

- `src/world/Zones.tsx`: `AboutArea()` has a `Pad` (teal, radius 4), a `Signboard` ("ABOUT ME"), a floating graduation cap, a stack of physics books and ground text. `Sensor` at `[x, 1, z]` size `[7, 2, 7]` opens the card.
- `src/world/layout.ts`: `aboutArea = { x: -22, z: 26 }`, `keepClear` has `[aboutArea.x, aboutArea.z, 9]`; the About road goes to `(-12, 26)`; spawn `zones.about.spawn = [-12, 26]`, yaw `-PI/2` (car faces west, toward the area).
- `src/data/profile.ts`: `education`, `certifications` (bootcamp 97.26, AWS, Python), `experience`, `skillGroups`.
- `src/ui/SpotCard.tsx`: the card shown when parked on About.

## Design

A **domed library / academy** facing the road (east side), about 10 m wide and 8 m tall:

- Stone podium with 5 wide steps up to a portico (front), 4 to 6 round columns, a triangular pediment with the text "ABOUT ME" (use `Text`), and a teal dome with a small lantern on top.
- Two side wings: left wing = "Education" with a small relief sign, right wing = "Certifications" with three framed certificate plaques (use the cert names from `profile.ts`: Dibimbing Bootcamp 97.26 A+, AWS Cloud & GenAI, Python). Frames are instanced rounded boxes with a cream texture.
- Front courtyard: a short paved approach, two statues flanking the steps (a graduate figure and an open-book monument built from primitives), hedges, lanterns (emissive, `trackLamp`), a flag in `palette.teal`.
- Interior is open and drive-in friendly: the car does **not** drive inside; the pad/sensor sits on the courtyard in front of the steps instead (move the pad to the courtyard, keep its teal ring).
- Roof dome and windows glow warm at night.

## Tasks

1. New file `src/world/AboutMonument.tsx` exporting `<AboutMonument />`; in `AboutArea()` remove the floating cap/old decorations that the building replaces (keep the physics book stack but move it next to the steps as a playful knockable), and mount the new component. Keep `AboutArea`'s `Signboard`/ground text only if they still make sense (avoid duplicating "ABOUT ME" twice).
2. Orientation: the building front faces the About road (east, +x) so the camera from the south-east sees the facade. Position and rotation derived from `aboutArea`.
3. Keep `aboutArea` coordinates and the `Sensor` still reachable from the spawn `(-12, 26)`; the pad is now the courtyard pad about 6 m east of the building centre (update `keepClear` and the `Decor.tsx` marker position `y: 3.2` for the "About" marker to float above the new building; if that file has uncommitted edits from someone else, make only the one-line marker change).
4. Colliders: one box for the podium and the main hall, cylinders for columns (or one box across them to keep it cheap), and the statues. Keep the road side and the pad free.
5. Build with `RoundedBoxGeometry`, cylinders, lathe (dome), extrude (pediment); columns and windows instanced. Shared stone/gold/teal materials.
6. Tier scaling: `low` drops the hedges and the small certificate frames.

## Acceptance criteria

- [ ] The About area is clearly a building with steps, columns, pediment, dome, wings and statues, not just a circle with an icon.
- [ ] Parking on the courtyard pad still opens the About card; the card content is unchanged.
- [ ] The new building does not intersect the About road, the pond, the warehouse, the footpath trail or the lap circuit gates (`circuitGates` near the About road).
- [ ] Readable text on desktop and mobile; glow at night; no z-fighting; no floating parts.
- [ ] Draw calls added: at most ~20. Definition of done in `README.md` is satisfied.
