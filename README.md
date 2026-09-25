# Joel's floating portrait

The demo opens on **Now → Pencil sketch**, generated from the new IMG_5003.mov reference.
Now also offers **Watercolor** with matching generated hands and the original **Video cutout**
with photographic hands. Each new AI style has nine generated head angles.
**Then** retains all eight earlier styles:
Photo only, AI simulated, Monotone, Duotone, Oil painting, Watercolor, Pencil sketch, and ASCII.
Each tab remembers its own style selection; background and hand-motion
settings are shared. Tabs support arrow keys, Home, and End.

Each set has nine head directions. The implied torso stays transparent. The reusable
component still defaults to the original Photo only set. Original HEIC and MOV files
remain untouched; a working video copy is stored under `work/video-now/`.

## Open the demo

```sh
cd demo
npm ci --ignore-scripts   # only needed on a fresh checkout
npm run dev
```

Open http://localhost:3002. The port is fixed to avoid the other local project using
port 3000. Nothing is published.

- **Photo only** uses only original photographic pixels for all nine head directions.
  Jaw corners and a flatter chin follow the photographed anatomy. Head edges have a
  3px inward feather and hands a 2.6px feather at full asset resolution (roughly 1px
  at demo size). RGB stays sharp; the feather changes alpha only and avoids exterior halos.
- **AI simulated** uses generated heads for neutral and all eight surrounding directions,
  with no photographed heads mixed into
  this mode. Hands are generated in the same realistic style. A 25% contrast boost and
  15% saturation boost apply to the head and hands in this mode only. This is a generated sprite set,
  not a live 3D face model or real-time video generator; some frame differences remain.
- **Oil painting** uses nine AI-generated head angles and four matching painted hand assets.
  Thick impasto brushwork, golden ochre/vermilion highlights and cobalt/teal shadows follow
  the supplied painting reference. The neutral painted head is the style master for every
  other head angle and all painted hands.
- **Monotone** applies a uniform color treatment (initially #3B9EC8) to the realistic AI head and
  hands, including alternate poses. It uses the same finished PNGs and preserves their alpha,
  detail, alignment, and anatomy. A small SVG color filter desaturates the image and maps
  luminance from black through the selected color at 50% gray to white in sRGB. A 1.35× contrast
  boost around that midpoint deepens shadows and brightens highlights. This is a display
  effect, not a newly generated face or a baked replacement asset. It affects only the portrait.
- **Pencil sketch** uses nine generated graphite head angles and four matching sketched hands.
  Fine hatching, crosshatching, soft shading and pale highlights preserve the likeness and
  keep the drawing readable on light and dark backgrounds. The torso stays transparent.
- **Watercolor** uses nine generated head angles and four matching painted hands, guided
  by the supplied watercolor sunset reference. Peach/coral/gold washes, blue-violet shadows,
  fine pigment texture, and softer edges retain the likeness. The generated alpha is preserved;
  a subtle 96% display opacity lets a little of the background show through. It has its own
  complete sprite set and uses no monochrome, contrast, or saturation filter.
- **Duotone** maps the realistic AI head and hands between two colors: #4D0038 for shadows
  and #3B9EC8 for highlights by default, with the same contrast boost and unchanged alpha.
  Monotone and duotone expose color pickers and six-digit hex fields. Duotone also has Swap
  colors; Reset colors restores the selected mode's starting palette. Choices stay independent
  while switching modes during the current visit. Partial/invalid hex input retains the last
  valid color and returns to it on blur. Neither mode reloads its images when colors change.
- **ASCII** turns the realistic AI heads and hands into actual monochrome text characters,
  following the supplied typewritten portrait reference. The full set is precomputed locally;
  the browser loads one small JSON file and displays text, with no image processing.
  Spaces and the gaps between characters are transparent. Ink inherits the page text color,
  so the demo automatically uses light lettering on dark backgrounds. The 64-column heads
  and 44-column hands retain the same source canvas alignment and all existing movement.
- **Let the hands change pose** switches to the second gesture near each hand. Both poses
  match the selected mode. Uncheck it to keep the open hands with tilt and repulsion.
  This is a two-pose gesture, not a continuous finger animation.
- **Light / Dark / Pattern** demonstrates the transparent cutouts.

## Files and rollback

- `assets/now/`: nine photographic video head cutouts, with source frame indices and timestamps in the manifest.
- `assets/`: nine 640 × 800 head PNGs, four hand PNGs, and `manifest.json`.
- `assets/ai/`: nine realistic AI heads and four matching generated hand assets.
- `assets/oil/`: nine oil-painted AI heads and four matching painted hand assets.
- `assets/pencil/`: nine graphite pencil heads and four matching sketched hand assets.
- `assets/watercolor/`: nine watercolor AI heads and four matching painted hand assets.
- `assets/ascii/`: nine text heads, four text hands, and the browser's `frames.json`.
- `assets/experimental/`: the retained earlier two-frame experiment, not loaded by the demo.
- `demo/public/sprites/`: identical finished assets served by the demo.
- `demo/components/`: the portrait, ASCII and color filters, optional tone controls, and their styles.
- `scripts/frames.json`: photographic crops, scale, original alignment anchors, and jaw curves.
- `work/masks/`: editable source-crop masks and explicitly named `*-jaw-canvas.png` masks.
- `work/review/`: cutout contact sheets on light, dark, and patterned backgrounds.
- `work/generative/`: unmodified generator outputs and the exact generation prompts.
- `output/joel-sprite-assets.zip`: portable components, assets, and masks.
- `versions/v1-original/`: the original neck-crop implementation.
- `versions/v2-mixed-demo/`: the previous mixed photo/AI experiment, before this revision.

For a photo-only integration, use `headMode="photos"` (the default); it loads no generated assets.
Use `headMode="generated"` for the realistic AI portrait, `headMode="oil"` for the oil-painted
portrait, `headMode="pencil"` for pencil sketch, `headMode="watercolor"` for watercolor, `headMode="ascii"` for character art, `headMode="monotone"` for one-color AI, or
`headMode="duotone"` for two-color AI. The earlier `headMode="blue"` remains a monotone alias.
The earlier neck cutouts also remain in the version backup.
To restore the entire earlier implementation, copy its `assets/` into both asset directories,
its `components/` into `demo/components/`, and its `page.tsx` into `demo/app/page.tsx`.
Restore its `frames.json` before rebuilding the older photo cutouts.

## React integration

Copy the component files (including `AsciiSprite.tsx` and `BlueTone.tsx`) into your app and `assets/` into `public/joel/`:

```tsx
import { FloatingPortrait } from './components/FloatingPortrait';

<FloatingPortrait
  assetPath="/joel"
  size={200}
  motionStrength={0.8}
  headMode="photos"
  animateHands={true}
/>
```

`size` is approximate visible head width; the composition is about three times that width
and scales to its container. `motionStrength` is clamped to 0–1: at full strength the head
translates at most 6px; each hand has up to 4px parallax plus 8px local repulsion and 7° tilt.
The wrists keep fixed layout anchors. Set strength to 0 to disable movement and hand-pose
changes while retaining head-direction selection. `animateHands={false}` disables only
hand-pose swaps. Optional `className` and `onDirectionChange(direction)` support integration.
Set `monotoneColor`, `duotoneShadow`, and `duotoneHighlight` with six-digit hex colors to
customize the treatments. Defaults are blue, plum, and blue respectively; invalid component
props fall back to those defaults. `ToneControls.tsx` (with its imported stylesheet) supplies
the optional controlled UI. Each portrait gets its own filter ID for multiple-instance safety.
ASCII uses Courier New / Courier / monospace and CSS container units to keep text aligned
at every size. Set `color` or `--ascii-ink` on the portrait to choose its ink color in another app.

Frames switch immediately after decoding. Neutral, angular, and
hand-proximity hysteresis prevent boundary chatter. Positional movement eases over time.
Pointer exit, blur, and hidden pages reset the portrait. Touch-only devices show neutral.
Reduced motion disables translation, tilt, and hand-pose changes, but retains head gaze.
An AI loading failure holds its neutral frame and asks you to select Photo only; it never
silently substitutes photographic heads or hands into an AI mode. Optional hand-pose failures retain
the open hands belonging to the selected mode.

Directions are viewer-relative. Photographs retain the original 640 × 800 canvas and
alignment reference (320, 752); this is the old neck pivot, not a visible part of the new
head-only crop. Per-frame anatomical jaw curves remove the neck and feather inward without changing RGB.
The manifest distinguishes photographic and generated assets and records their alignment.
No segmentation or image generation happens in the browser.

## Rebuild and refine assets

Use Python 3.12 and FFmpeg. The workspace `.venv` is already prepared. Fresh setup:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements.txt
.venv/bin/python scripts/prepare_assets.py all
.venv/bin/python scripts/prepare_variants.py
.venv/bin/python scripts/prepare_ai.py
.venv/bin/python scripts/prepare_oil.py
.venv/bin/python scripts/prepare_watercolor.py
.venv/bin/python scripts/prepare_pencil.py
.venv/bin/python scripts/prepare_generated_hands.py
.venv/bin/python scripts/prepare_ascii.py
.venv/bin/python scripts/package_assets.py
```

Photographic segmentation uses rembg's explicit `birefnet-general` model locally on CPU.
Its first download is roughly 1 GB; caches are under `.tools/`. FFmpeg decodes the HEICs.
The complete AI set used the built-in image generation tool with the neutral photographic
head as an identity reference. Prompts are in `work/generative/full-heads/prompts.md`; the
earlier horizontal intermediates are documented in `work/generative/prompts.md`.
Oil generation prompts are in `work/generative/oil-heads/prompts.md`; realistic generated
hand prompts are in `work/generative/realistic-hands/prompts.md`. The generated hands use
the photo hand poses as anatomy references and the matching neutral head as their style
reference. Raw generated outputs remain under `work/generative/`. Rerunning
local scripts only aligns the saved outputs and does not call a generative service.
Watercolor prompts are in `work/generative/watercolor-heads/prompts.md`. The neutral
watercolor head is the identity/style master for the other eight angles and all four hands.
Use `prepare_watercolor.py` followed by `prepare_generated_hands.py --mode watercolor`
to rebuild only the watercolor set from saved outputs.
`scripts/prepare_ascii.py` samples the aligned realistic AI cutouts into a fixed character
grid using alpha and luminance. It saves editable `.txt` files and `ascii/frames.json`;
it does not generate new anatomy. Edit the conversion script and rerun it for lasting
changes to character density, grid size, or contrast. Review images are under `work/review/ascii-*`.

Automatic masks are `ID-automatic.png`; local GrabCut hand refinements are `ID-edge.png`.
A manual source-crop mask named `ID-refined.png` overrides the automatic head/hand result.
Photo RGB always comes from the decoded originals. Head alpha is additionally intersected
with a smooth jaw curve defined in aligned 640 × 800 coordinates in `frames.json`.
`ID-jaw-canvas.png` records that second mask. `ID-feathered-canvas.png` is the final
output alpha. The feather width is editable in `frames.json` (`edgeFeatherPx`). White is
opaque, black transparent.
The flex-hand script retains cached edge masks and applies the authored wrist boundary.

After changing a photographic mask or jaw curve:

```sh
.venv/bin/python scripts/prepare_assets.py export
.venv/bin/python scripts/prepare_assets.py review
.venv/bin/python scripts/prepare_variants.py
.venv/bin/python scripts/prepare_ai.py
.venv/bin/python scripts/prepare_oil.py
.venv/bin/python scripts/prepare_watercolor.py
.venv/bin/python scripts/prepare_pencil.py
.venv/bin/python scripts/prepare_generated_hands.py
.venv/bin/python scripts/prepare_ascii.py
.venv/bin/python scripts/package_assets.py
```

Run the steps in order: photographic export, photo hand variants, realistic AI heads, oil
watercolor and pencil heads, generated hands, then ASCII. Each updates the same manifest; the final step records the
text version of the realistic AI head and hand sets. To rerun only selected
BiRefNet masks, remove the relevant cached automatic mask and use
`segment --only center hand-left`. Photo open hands come from IMG_4877;
alternate photo hands come from IMG_4900. They also provide pose references for the generated hands. Checksums for all 23 HEICs are in `work/originals.sha256`.

## Validation

```sh
cd demo
npm test
npm run lint
npm run typecheck
npm run build
npm run test:render
```

Automated checks cover all gaze directions, boundary stability, separation of modes and loading failures,
hand repulsion/tilt limits, independent hand responses, pointer exit, touch, reduced motion,
zero strength, decoded asset dimensions, and server-rendered content. Review the contact
sheets for mask quality and the local page for the subjective feel of frame changes.
Browser automation was unavailable in this session; DOM interactions were tested in happy-dom.

```sh
shasum -a 256 -c work/originals.sha256
```

Pencil prompts and exact per-asset requests are in `work/generative/pencil-heads/`.
Rebuild only this set with `.venv/bin/python scripts/prepare_pencil.py`, followed by
`.venv/bin/python scripts/prepare_generated_hands.py --mode pencil`.

## New video reference (Now)

The new clip was decoded at its original 720 × 1280 portrait resolution. Source head
regions are about 200–250 pixels wide, so this set is softer than the full-resolution
photographs. Nine selected frames retain a similar smile; these remain discrete gaze
poses, not continuous video playback. No facial detail is generated or repainted.

```tsx
<FloatingPortrait headMode="photos" headAssetPath="/joel/now" assetPath="/joel" />
```

`headAssetPath` overrides head assets for `photos`, `pencil`, and `watercolor`. Hands and
their alternate poses still come from the corresponding style under `assetPath`. Other
modes ignore this override.

`scripts/video-now.json` records exact zero-based decoded frame indices, timestamps,
source dimensions, source hash, crop rectangles and authored jaw boundaries. Masks live
in `work/video-now/masks/`. Local BiRefNet segmentation removes the background; jaw masks
remove neck and clothing, followed by 2.5px inward feathering. Two masks also exclude
small blue-shirt remnants by color without changing source RGB.

Rebuild only Now, preserving the previous sets:

```sh
.venv/bin/python scripts/prepare_video_now.py all
.venv/bin/python scripts/package_assets.py
```

Cached decoded frames and automatic masks are reused. After changing frame indices or
crop bounds, remove the affected cached frame and automatic mask before rebuilding.
After editing only the jaw curve, run `prepare_video_now.py export`.


### New-reference AI styles

Pencil sketch and Watercolor were generated with the built-in image tool from the new
video cutouts. Each set uses a neutral master to keep the smile, bun, shading, and materials
consistent across eight surrounding gaze directions. These are AI interpretations of the
new reference; the Video cutout choice remains the photographic comparison.

```tsx
<FloatingPortrait headMode="pencil" headAssetPath="/joel/now/pencil" assetPath="/joel" />
<FloatingPortrait headMode="watercolor" headAssetPath="/joel/now/watercolor" assetPath="/joel" />
```

The heads are aligned on a 640 × 800 canvas with the chin at y=720 and 1.5px inward
feathering. They reuse the existing matching generated pencil/watercolor hands, including
the alternate gestures. Watercolor has 96% display opacity. No old head or hand files
are replaced. `references.now.styleSets` maps each choice to its frame and hand sets.

Raw generated sources, exact requests, and provenance are under
`work/generative/now-pencil/`, `work/generative/now-watercolor/`, and
`work/generative/now-style-requests.json`. See `work/generative/now-styles-prompts.md`.
Rebuild the finished assets from the cached generated sources:

```sh
.venv/bin/python scripts/prepare_now_styles.py
.venv/bin/python scripts/package_assets.py
```

Review sheets and full portrait composites are saved in `work/review/now-*-*.png`.
