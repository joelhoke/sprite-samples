"""Reproducible photographic cutouts. RGB is never generated or repainted."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("REMBG_HOME", str(ROOT / ".tools/rembg"))
os.environ.setdefault("NUMBA_CACHE_DIR", str(ROOT / ".tools/numba"))
os.environ.setdefault("OMP_NUM_THREADS", "4")

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
import numpy as np
from edge_masks import feather_inward

CONFIG = json.loads((ROOT / "scripts/frames.json").read_text())
ASSETS = ROOT / "assets"
WORK = ROOT / "work"


def decode():
    for source in sorted({f["source"] for f in CONFIG["frames"] + CONFIG["hands"]}):
        target = WORK / "decoded" / f"{source}.png"
        if not target.exists():
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i",
                            str(ROOT / f"{source}.HEIC"), "-frames:v", "1",
                            "-compression_level", "1", str(target)], check=True)


def segment(only=None):
    pending = [f for f in CONFIG["hands"] + CONFIG["frames"]
               if (not only or f["id"] in only)
               and not (WORK / "masks" / f"{f['id']}-automatic.png").exists()]
    if not pending:
        return
    from rembg import new_session
    import onnxruntime as ort
    options = ort.SessionOptions()
    # Release activation buffers between operators on a 16 GB Mac; retained
    # arenas otherwise create substantial memory pressure alongside the demo.
    options.enable_cpu_mem_arena = False
    options.enable_mem_pattern = False
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    session = new_session("birefnet-general", sess_opts=options, providers=["CPUExecutionProvider"])
    for frame in pending:
        dest = WORK / "masks" / f"{frame['id']}-automatic.png"
        if dest.exists():
            continue
        source = Image.open(WORK / "decoded" / f"{frame['source']}.png").convert("RGB")
        crop = source.crop(frame["crop"])
        mask = session.predict(crop)[0]
        mask.save(dest)
        print(f"Segmented {frame['id']}", flush=True)


def region_mask(frame, size):
    """Editable geometric mask removes neck clothing / sleeves without synthesis."""
    x, y, right, bottom = frame["crop"]
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    if "jawBoundary" in frame:
        return Image.new("L",size,255)
    if "neck" in frame:
        boundary = frame["neck"]
        points = [(x,y), (right,y), (right,boundary[0][1])]
        # Smooth the authored neck boundary; this changes alpha only.
        control = [boundary[0], *boundary, boundary[-1]]
        curve = []
        for i in range(1,len(control)-2):
            a,b,c,d = [np.array(p,dtype=float) for p in control[i-1:i+3]]
            for t in np.linspace(0,1,12,endpoint=False):
                p = .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
                curve.append(tuple(p))
        points += curve + [tuple(boundary[-1])]
        points += [(x,boundary[-1][1])]
    else:
        return Image.new("L",size,255)
    draw.polygon([(px-x,py-y) for px,py in points], fill=255)
    return mask.filter(ImageFilter.GaussianBlur(1.0))


def refine_hands():
    """Separate skin from sleeves using local colour/edge modelling, not image generation."""
    import cv2
    from scipy import ndimage
    cv2.setRNGSeed(7)
    for hand in CONFIG["hands"]:
        crop = Image.open(WORK/"decoded"/f"{hand['source']}.png").convert("RGB").crop(hand["crop"])
        rgb = np.array(crop)
        r,g,b = rgb.astype(float).transpose(2,0,1)
        skin = (r>85)&(r-g>10)&(r-b>15)
        skin = ndimage.binary_closing(skin,iterations=2)
        labels,_ = ndimage.label(skin)
        counts = np.bincount(labels.ravel()); counts[0] = 0
        skin = ndimage.binary_fill_holes(labels==counts.argmax())
        mask = np.where(skin,cv2.GC_PR_FGD,cv2.GC_PR_BGD).astype("uint8")
        automatic = np.array(Image.open(WORK/"masks"/f"{hand['id']}-automatic.png"))
        mask[automatic<10] = cv2.GC_BGD
        mask[ndimage.binary_erosion(skin,iterations=8)] = cv2.GC_FGD
        mask[:3]=0; mask[-3:]=0; mask[:,:3]=0; mask[:,-3:]=0
        for x,y in hand["foreground_points"]:
            cv2.circle(mask,(x-hand["crop"][0],y-hand["crop"][1]),12,int(cv2.GC_FGD),-1)
        if "fabric_patch" in hand:
            x1,y1,x2,y2 = hand["fabric_patch"]
            x1-=hand["crop"][0];x2-=hand["crop"][0];y1-=hand["crop"][1];y2-=hand["crop"][1]
            patch=mask[y1:y2,x1:x2]
            patch[r[y1:y2,x1:x2]<140] = cv2.GC_BGD
        cv2.grabCut(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),mask,None,
                    np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),6,cv2.GC_INIT_WITH_MASK)
        alpha = np.isin(mask,[cv2.GC_FGD,cv2.GC_PR_FGD])
        labels,_ = ndimage.label(alpha); counts=np.bincount(labels.ravel());counts[0]=0
        alpha = ndimage.binary_fill_holes(labels==counts.argmax())
        Image.fromarray((alpha*255).astype("uint8")).filter(ImageFilter.GaussianBlur(.65)).save(WORK/"masks"/f"{hand['id']}-edge.png")
        print(f"Refined {hand['id']}",flush=True)


def export():
    manifest = {"version":3,"cutout":"jaw-following","edgeFeatherPx":CONFIG["edgeFeatherPx"],"coordinateSystem":"viewer: +x right, +y down",
                "canvas":CONFIG["canvas"],"pivot":CONFIG["pivot"],"frames":[],"hands":[]}
    for frame in CONFIG["frames"] + CONFIG["hands"]:
        automatic_path = WORK / "masks" / f"{frame['id']}-automatic.png"
        if not automatic_path.exists():
            continue
        source = Image.open(WORK / "decoded" / f"{frame['source']}.png").convert("RGB")
        crop = source.crop(frame["crop"])
        automatic = Image.open(automatic_path).convert("L")
        region = region_mask(frame, crop.size)
        region.save(WORK / "masks" / f"{frame['id']}-region.png")
        # A supplied refinement is a full replacement alpha mask in crop coordinates.
        refined = WORK / "masks" / f"{frame['id']}-refined.png"
        edge = WORK / "masks" / f"{frame['id']}-edge.png"
        alpha = (Image.open(refined).convert("L") if refined.exists()
                 else Image.open(edge).convert("L") if edge.exists()
                 else ImageChops.multiply(automatic,region))
        if frame.get("fabric_exclusions") and not refined.exists():
            # Small source-space annotations target dark fabric, leaving skin RGB intact.
            exclusion=Image.new("L",crop.size,255)
            pixels=np.array(crop)
            for area in frame["fabric_exclusions"]:
                ax,ay,bx,by=area["rect"]
                ax-=frame["crop"][0];bx-=frame["crop"][0]
                ay-=frame["crop"][1];by-=frame["crop"][1]
                keep=(pixels[ay:by,ax:bx,0]>=area["maxRed"])*255
                exclusion.paste(Image.fromarray(keep.astype("uint8")),(ax,ay))
            alpha=ImageChops.multiply(alpha,exclusion.filter(ImageFilter.GaussianBlur(.6)))
        alpha.save(WORK / "masks" / f"{frame['id']}-final.png")
        rgba = crop.convert("RGBA"); rgba.putalpha(alpha)
        if "direction" in frame:
            scale = frame["scale"]
            resized = rgba.resize(tuple(round(n*scale) for n in crop.size), Image.Resampling.LANCZOS)
            anchor = [frame["anchor"][i]-frame["crop"][i] for i in range(2)]
            offset = [round(CONFIG["pivot"][i]-anchor[i]*scale) for i in range(2)]
            canvas = Image.new("RGBA", tuple(CONFIG["canvas"]),(0,0,0,0))
            canvas.alpha_composite(resized,tuple(offset))
            if "jawBoundary" in frame:
                from scipy.interpolate import PchipInterpolator
                points = np.array(frame["jawBoundary"])
                boundary = PchipInterpolator(points[:,0],points[:,1])(np.arange(canvas.width))
                # A continuous, antialiased jaw curve in aligned-canvas coordinates.
                jaw = Image.fromarray((np.clip(boundary[None,:]-np.arange(canvas.height)[:,None]+.5,0,1)*255).astype("uint8"))
                jaw.save(WORK/"masks"/f"{frame['id']}-jaw-canvas.png")
                canvas.putalpha(ImageChops.multiply(canvas.getchannel("A"),jaw))
            record = {"id":frame["id"],"file":f"head-{frame['id']}.png",
                      "direction":frame["direction"],"source":frame["source"]+".HEIC",
                      "sourceCrop":frame["crop"],"sourceAnchor":frame["anchor"],
                      "scale":scale,"canvas":CONFIG["canvas"],"pivot":CONFIG["pivot"],
                      "jawBoundary":frame.get("jawBoundary"),"cutout":"head-only"}
            manifest["frames"].append(record)
        else:
            bounds = alpha.getbbox()
            canvas = rgba.crop(bounds)
            # Large enough for retina rendering; preserve the anatomical hand proportions.
            canvas.thumbnail((560,560),Image.Resampling.LANCZOS)
            record = {"id":frame["id"],"file":frame["id"]+".png",
                      "source":frame["source"]+".HEIC","sourceCrop":frame["crop"],
                      "canvas":list(canvas.size),"side":"viewer-"+frame["id"].split('-')[1]}
            manifest["hands"].append(record)
        feather=CONFIG["edgeFeatherPx"]["head" if "direction" in frame else "hand"]
        canvas=feather_inward(canvas,feather)
        canvas.getchannel("A").save(WORK/"masks"/f"{frame['id']}-feathered-canvas.png")
        record["featherPx"]=feather
        canvas.save(ASSETS / record["file"],optimize=True)
        print(f"Exported {record['file']}",flush=True)
    (ASSETS / "manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    dest=ROOT / "demo/public/sprites"
    dest.mkdir(parents=True,exist_ok=True)
    for file in ASSETS.iterdir():
        if file.suffix in {".png",".json"}: shutil.copy2(file,dest/file.name)


def review():
    names=["upper-left","up","upper-right","left","center","right","lower-left","down","lower-right"]
    backgrounds={"light":"#f4f1e9","dark":"#171c1a","pattern":"#dae5cb"}
    font=ImageFont.truetype("/System/Library/Fonts/Menlo.ttc",15)
    for name,color in backgrounds.items():
        sheet=Image.new("RGB",(960,1320),color)
        d=ImageDraw.Draw(sheet)
        if name=="pattern":
            for y in range(0,1320,24):
                for x in range(0,960,24):
                    if (x//24+y//24)%2: d.rectangle((x,y,x+23,y+23),fill="#879d77")
        for i,id in enumerate(names):
            file=ASSETS/f"head-{id}.png"
            if not file.exists(): continue
            im=Image.open(file); im.thumbnail((288,360))
            x=(i%3)*320; y=(i//3)*440
            sheet.paste(im,(x+16,y+40),im)
            d.text((x+15,y+12),id,font=font,fill="#9da78c" if name=="dark" else "#233523")
        sheet.save(WORK / "review" / f"heads-{name}.jpg",quality=95)
    hands=Image.new("RGB",(1200,650),"#ece8df"); d=ImageDraw.Draw(hands)
    for i,id in enumerate(["hand-left","hand-right"]):
        path=ASSETS/f"{id}.png"
        if path.exists():
            im=Image.open(path); hands.paste(im,(i*600+20,40),im)
            d.text((i*600+20,10),id,font=font,fill="#233523")
    hands.save(WORK / "review/hands.jpg",quality=95)


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("stage",choices=["all","decode","segment","refine-hands","export","review"])
    parser.add_argument("--only",nargs="+",help="Limit the segmentation stage to these asset IDs")
    args=parser.parse_args()
    for path in [ASSETS,WORK/"decoded",WORK/"masks",WORK/"review"]: path.mkdir(parents=True,exist_ok=True)
    if args.stage in ["all","decode"]: decode()
    if args.stage in ["all","segment"]: segment(args.only)
    if args.stage in ["all","refine-hands"]: refine_hands()
    if args.stage in ["all","export"]: export()
    if args.stage in ["all","review"]: review()
