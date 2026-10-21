# DESIGN — Dark editorial system

The look for the NIBRS dashboard. Values live in [web/css/tokens.css](web/css/tokens.css); this file holds the rules. Page code uses the variables only, never raw hex.

## Tone
Analytical and respectful. Every number is a person's bad day, so nothing in the page dramatises it.
- No gore, crime-scene tape, sirens, police lights, blood splatter, bullet holes or grunge textures.
- Plain verbs in copy ("incidents", "victims", "cleared"). No "shocking", "deadly", "epidemic".
- Decoration is restraint: whitespace, hairlines and type. Nothing else.

## Presentation target
The dashboard is presented live, in front of a class, on a 16:9 projector or screen. Design for that one frame.
- **16:9, desktop only.** There is no mobile or tablet layout and no responsive breakpoints. Every screen must fit one 16:9 viewport without scrolling inside it.
- **Resolution-independent.** Classroom projectors often run at 1280×720 or 1366×768, not 1920×1080. Size layout with `vw`/`vh` (all type and spacing tokens already do), and draw charts as SVG with a `viewBox` that scales to its container, so a screen looks the same at every 16:9 resolution. Check each screen at **1280×720 and 1920×1080**.
- **One theme.** No light/dark toggle and no `prefers-color-scheme` switch.
- **Readable from the back of the room.** At 1920×1080: body ≈ 19px, labels and ticks ≥ 16px. Text sizes are viewport-relative (see *Type*), so they keep the same projected size at any 16:9 resolution.
- **Few series per chart.** Projectors wash out subtle differences, so a chart should not ask the audience to tell many series apart. Keep about 6–8 visible and group or grey the rest (see *Categories* below).
- **Narrow-screen fallback:** below 1024px wide, show a one-line "Best viewed on a desktop" notice. Don't build a layout for it.
- **Rehearse on the room's projector** before presenting. It is the only real test of contrast and of the red signal.

## Colour

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0b0b0b` | Page background |
| `--surface` | `#141414` | Cards, tooltip, table header |
| `--bone` | `#e8e2d6` | Primary text, headings, numbers |
| `--bone-60` | bone @ 60% | Secondary text, axis labels, context series |
| `--bone-35` | bone @ 35% | Disabled controls, decorative text only |
| `--hairline` | bone @ 20% | 1px rules, gridlines, axis domain |
| `--signal` | `#e5383b` | Red **text and data marks** |
| `--signal-fill` | `#9d0208` | Red **fills** |

**No other hues and no gradients.** (The chart ramp below is a data scale, not a gradient on a surface.)

### Red is a signal
Red marks the one thing the reader should look at. Allowed only on:
1. key statistics (the headline number in a KPI),
2. highlighted data (the selected series, bar or cell),
3. active filters (the chosen toggle or legend item),
4. the primary button.

Constraints:
- **Max 2 red elements per viewport.** A chart whose sequential ramp reaches red counts as one.
- Never on decoration, borders, dividers, icons, headings, backgrounds of large areas or hover states for plain links.
- If everything matters, nothing is red: drop to bone.

## Type

| Role | Font | Style |
|---|---|---|
| Headings (title, chapter, screen) | Instrument Serif | *italic*, UPPERCASE, `line-height: 0.9`, viewport-relative sizes with px floors (`--fs-display` 136, `--fs-h2` 72, `--fs-h3` 40px at 1920 wide) |
| Body, nav, labels, captions, numbers | JetBrains Mono | 400 / 700, viewport-relative: `--fs-body` 1vw, `--fs-small` 0.9vw, `--fs-label` 0.833vw (19 / 17 / 16px at 1920 wide), with 13 / 12 / 11px floors |
| KPI numbers | JetBrains Mono | 700, `--fs-stat` (80px at 1920 wide), `font-variant-numeric: tabular-nums` |

- Labels and nav: uppercase, `letter-spacing: var(--tracking-label)`.
- Numbers always use tabular figures so columns and ticks align.
- Serif never goes below `--fs-h3`; it is a display face, not a reading face.

## Shape
- `border-radius: 0` everywhere. No shadows, no blur, no glow.
- Structure comes from **1px hairlines** in `--hairline` (`--rule`) and spacing tokens `--s-1`…`--s-6` (4 / 8 / 16 / 24 / 40 / 64px at 1280 wide, scaling with viewport width). Hairlines stay 1px.
- Cards are `--surface` with no border, or `--bg` with a hairline. Not both.

## Charts (D3)
- **Sequential:** `d3.scaleLinear().domain([0, 1/3, 2/3, 1]).range([ramp-0 … ramp-3])` over the normalised value: `#2a2a2a` → `#9d0208` → `#e5383b` → bone. Use for the density grid and heatmaps. Use a log or quantile domain when the data is skewed.
  - The low end is a neutral grey, not black: a projector lifts black to grey, so black and very dark red merge into the background. Zero or no data draws **no mark** (the background shows); the smallest non-zero value is `--ramp-0`, so it always stays visible.
- **Context vs highlight:** every series is `--context` (bone 60%) by default; the one highlighted series is `--signal`. Non-highlighted lines 1px, highlighted 2px.
- **Categories:** there is no categorical hue palette. Tell categories apart by position (small multiples, ordered bars), direct labels at line ends, and bone opacity steps (100 / 60 / 35) when they must share a plot. The category order is fixed across pages so a category always sits in the same place.
- Gridlines and axis domains: `--hairline`. Tick labels: `--bone-60`, mono, `--fs-label`.
- Tooltip: `--surface`, `--rule`, mono 12px, no radius, no shadow.
- Caveat notes: one mono line in `--bone-60`, linking to `#about`.
- No chart zooms on the wheel (see TASK.md).

## Accessibility
- **Red text must be `#e5383b` at large or bold sizes only** (≥ 24px regular, or ≥ 18.66px bold). It measures 4.65:1 on `--bg` and 4.35:1 on `--surface`, so it is not safe for small body text. Never set text in `#9d0208` (2.3:1).
- `--signal-fill` (`#9d0208`) is 2.3:1 against the background, under the 3:1 non-text minimum. A red fill must always carry a bone label or value, so meaning never depends on the fill alone.
- `--bone-35` is 2.7:1: never for content a reader needs. Body and labels use `--bone` (15:1) or `--bone-60` (5.9:1).
- Red is never the only cue. A highlighted series also gets a heavier stroke and a direct label; an active filter also gets a marker or underline.
- Focus ring: `outline: 1px solid var(--bone); outline-offset: 2px`. Never red, never removed.
- Respect `prefers-reduced-motion`: entry animations become instant.
