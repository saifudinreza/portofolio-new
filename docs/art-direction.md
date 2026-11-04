# Zare World: art direction

A small, warm, hand-made island you drive around. Stylised miniature, not realistic. When in doubt: warmer, rounder, more saturated, never grey.

Bruno Simon's site is a reference for *density and colour confidence*, not for his world. Do not copy his assets, layout or palette (his is purple/pink at night, ours stays warm coral, teal and navy).

## Palette

The single source is `palette` in `src/world/layout.ts`. Use it for anything new; add a colour there instead of hard-coding a hex in a component.

| Role | Token | Hex | Use |
|---|---|---|---|
| Sand ground | `ground` | `#EFD7A6` | island top, beaches |
| Cliff / edge | `groundEdge` | `#D4B27E` | island sides |
| Dirt road | `path` | `#E3C690` | roads, footpaths |
| Navy | `navy` | `#1F3864` | text, letters, brand |
| Teal | `teal` | `#1FA595` | accents, gates, Projects |
| Coral | `coral` | `#F2603F` | accents, Contact, jump ramp |
| Yellow | `yellow` | `#F7B02A` | accents, letters |
| Wood | `wood` / `woodDark` | `#C68B59` / `#9A6A42` | benches, fences, crates |
| Leaf | `leaf` / `leafDark` | `#5FAE48` / `#438A3C` | UI-side greens |
| Rock | `rock` | `#B9AD9A` | stones |
| Cream | `cream` | `#FFF6E6` | signs, UI panels |
| Sky / horizon / fog | `sky` | `#F8D49A` | daytime horizon and fog |

Vegetation hues (grass, trees, bushes) live in their own shaders and `foliage.ts`; keep them yellow-leaning greens with some orange/red autumn trees, so the island reads warm.

## Materials

- Flat or soft-gradient colours with `roughness` 0.8 to 1. No glossy plastic, no photographic textures.
- Textures are drawn in code (`textures.ts`, `decorTextures.ts`, `foliageTextures.ts`); keep them low-frequency and tinted by the material colour.
- Shapes are rounded or bevelled (`RoundedBoxGeometry`), low poly with smooth normals. Small props are instanced.
- Anything that glows (lamps, lighthouse, headlights) uses an emissive material registered with `trackLamp` / `trackHeadlight` so it brightens at night.
- Shadows come from the sun only; the solid core of a tree casts the canopy's shadow (the leaf cards do not).

## Light and mood

All values are keyframes in `src/world/dayCycle.ts`; the "day" keyframe is the reference look.

| Time | Sun | Fill | Sky | Mood |
|---|---|---|---|---|
| Day | warm gold `#FFD9A0`, strong (2.5) | warm sky, caramel ground bounce | teal zenith, honey horizon | sunny afternoon |
| Dusk | orange `#FF9E5E` | peach | violet zenith, orange horizon | golden hour |
| Night | cool blue moonlight (0.55) | indigo | deep navy | readable, lamps and headlights glow |
| Rain | dimmer, 40% less sun | greyed | grey-blue | calm, not gloomy; no lightning |

## Post-processing (High only)

ACES tone mapping, a teal/warm split tone, a bloom that catches emissives (threshold 1.0), saturation +0.2, contrast +0.1, a light tilt-shift and a vignette. Low and Medium skip post-processing, so the palette and light values above must look right without it.

## Checklist for a new asset

- [ ] Colours from `palette` (or a documented vegetation hue).
- [ ] Rounded, low-poly, instanced if repeated.
- [ ] Looks right in day, dusk, night and rain.
- [ ] Solid only if the car can really hit it.
- [ ] Not on a road, spawn, pad or circuit gate (`isClear`).
