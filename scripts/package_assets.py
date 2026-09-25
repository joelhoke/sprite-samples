"""Package finished assets and editable masks without originals, caches, or model weights."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from PIL import Image, ImageDraw
import json

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/"output"
OUTPUT.mkdir(exist_ok=True)
manifest=json.loads((ROOT/"assets/manifest.json").read_text())
assert len(manifest["frames"])==9 and len(manifest["hands"])==2
for item in manifest["frames"]+manifest["hands"]+manifest.get("alternateHands",[])+manifest.get("experimentalFrames",[])+manifest.get("aiFrames",[])+manifest.get("oilFrames",[])+manifest.get("aiHands",[])+manifest.get("oilHands",[])+manifest.get("watercolorFrames",[])+manifest.get("watercolorHands",[])+manifest.get("pencilFrames",[])+manifest.get("pencilHands",[])+manifest.get("nowFrames",[])+manifest.get("nowPencilFrames",[])+manifest.get("nowWatercolorFrames",[]):
    image=Image.open(ROOT/"assets"/item["file"])
    assert image.mode=="RGBA" and list(image.size)==item["canvas"]
    bbox=image.getchannel("A").point(lambda a:255 if a>32 else 0).getbbox()
    if "direction" in item:
        assert bbox and bbox[0]>0 and bbox[1]>8 and bbox[2]<640 and bbox[3]<800, (item["id"],bbox)

head=Image.open(ROOT/"assets/head-center.png")
face=head.crop(head.getchannel("A").getbbox())
face.thumbnail((96,96),Image.Resampling.LANCZOS)
icon=Image.new("RGBA",(96,96));icon.alpha_composite(face,((96-face.width)//2,(96-face.height)//2))
icon.save(ROOT/"demo/public/favicon.png")

for theme,bg in [("light","#f5f2eb"),("dark","#1d2622"),("pattern","#e8eddf")]:
    image=Image.new("RGB",(1200,1030),bg);draw=ImageDraw.Draw(image)
    if theme=="pattern":
        for x in range(0,1200,64):draw.line((x,0,x,1030),fill="#c4d0b9")
        for y in range(0,1030,64):draw.line((0,y,1200,y),fill="#c4d0b9")
    sprite=head.resize((576,720),Image.Resampling.LANCZOS);image.paste(sprite,(312,0),sprite)
    for side,x in [("left",24),("right",828)]:
        sprite=Image.open(ROOT/f"assets/hand-{side}.png")
        sprite=sprite.resize((348,round(sprite.height*348/sprite.width)),Image.Resampling.LANCZOS)
        image.paste(sprite,(x,649),sprite)
    image.save(ROOT/f"work/review/portrait-{theme}.png")

readme="""# Joel's floating portrait assets

The demo opens on Now: Pencil sketch from the new video reference.
Video cutout retains the new photographic head and original photographic hands.
Now also offers new-reference Pencil sketch and Watercolor with their matching generated hands.
Then retains all eight previous styles.
Use headMode="photos" and headAssetPath="/joel/now" for the new video heads.
Use headMode="pencil" with headAssetPath="/joel/now/pencil" for the new sketch heads.
Use headMode="watercolor" with headAssetPath="/joel/now/watercolor" for the new painted heads.
Photos is the component default: nine head-only photographic angles and two hand poses per side.
`assets/ai/` contains nine generated head poses for a complete separate AI version.
Use headMode="generated" for that set; headMode="photos" uses photographs exclusively.
All AI modes have matching generated hands, including the alternate gesture.
Use headMode="monotone" with monotoneColor="#3B9EC8" for a one-color treatment.
Use headMode="duotone" with duotoneShadow="#4D0038" and duotoneHighlight="#3B9EC8" for two colors.
The earlier headMode="blue" remains a monotone alias.
Include BlueTone.tsx with the component; its color filter preserves the original alpha.
ToneControls.tsx and tone-controls.css provide optional color pickers, hex entry, swap, and reset.
`assets/oil/` contains nine painted heads and four painted hand assets; use headMode="oil".
`assets/watercolor/` contains nine watercolor heads and four matching hands; use headMode="watercolor".
`assets/pencil/` contains nine graphite pencil heads and four matching sketched hands; use headMode="pencil".
Watercolor preserves the generated alpha with a subtle 96% display opacity.
`assets/ascii/` contains actual character art derived from the realistic AI set;
use headMode="ascii" for matching text heads and hands. It inherits the surrounding text color.
Photo head and hand edges are feathered inward.
Use animateHands={false} to retain tilt/repulsion without changing the hand pose.

Copy `components/` into a React app and `assets/` into its public directory as `joel/`:

    import { FloatingPortrait } from './components/FloatingPortrait';
    <FloatingPortrait assetPath="/joel" size={200} motionStrength={0.8} />

Head PNGs share a 640 × 800 canvas. Directions are viewer-relative. The manifest records
source photos, alignment, jaw masks and which frames are generated. Original photographs
are not included. Photographic RGB was preserved; only masking and resizing were applied.

`masks/` holds editable grayscale masks. The *-jaw-canvas masks use output coordinates;
other masks use source-crop coordinates. `frames.json` records the photographic jaw curves.
No runtime segmentation, generation, or external service is needed. See PROJECT-README.md for full setup,
interaction options, limitations, and rebuild instructions for the original workspace.
"""
with ZipFile(OUTPUT/"joel-sprite-assets.zip","w",ZIP_DEFLATED) as archive:
    archive.writestr("README.md",readme)
    for file in sorted((ROOT/"assets").rglob("*")):
        if file.is_file():archive.write(file,"assets/"+str(file.relative_to(ROOT/"assets")))
    archive.write(ROOT/"README.md","PROJECT-README.md")
    archive.write(ROOT/"work/generative/prompts.md","generation-prompts.md")
    archive.write(ROOT/"work/generative/full-heads/prompts.md","full-ai-prompts.md")
    archive.write(ROOT/"work/generative/oil-heads/prompts.md","oil-prompts.md")
    archive.write(ROOT/"work/generative/watercolor-heads/prompts.md","watercolor-prompts.md")
    archive.write(ROOT/"work/generative/pencil-heads/prompts.md","pencil-prompts.md")
    archive.write(ROOT/"work/generative/pencil-heads/requests.json","pencil-requests.json")
    archive.write(ROOT/"work/generative/realistic-hands/prompts.md","realistic-hand-prompts.md")
    for file in sorted((ROOT/"work/masks").glob("*.png")):
        if not file.name.endswith("-grabcut.png"):archive.write(file,"masks/"+file.name)
    archive.write(ROOT/"scripts/frames.json","frames.json")
    archive.write(ROOT/"scripts/video-now.json","video-now.json")
    archive.write(ROOT/"work/generative/now-styles-prompts.md","now-styles-prompts.md")
    archive.write(ROOT/"work/generative/now-style-requests.json","now-style-requests.json")
    for file in sorted((ROOT/"work/video-now/masks").glob("*.png")):
        archive.write(file,"masks/video-now/"+file.name)
    for name in ["FloatingPortrait.tsx","AsciiSprite.tsx","BlueTone.tsx","ToneControls.tsx","tone-controls.css","portrait.css","tracking.ts"]:
        archive.write(ROOT/"demo/components"/name,"components/"+name)
print(OUTPUT/"joel-sprite-assets.zip")
