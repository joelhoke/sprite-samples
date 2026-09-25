"""Deterministic alignment of optional generated poses and photographic hand variants."""
from pathlib import Path
import json, shutil, subprocess
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageChops
from scipy import ndimage
import cv2
from edge_masks import feather_inward

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets'
WORK=ROOT/'work'


def hands():
    cv2.setRNGSeed(7)
    records=[]
    source=Image.open(WORK/'decoded/IMG_4900.png').convert('RGB')
    # Crops exclude the opposite hand and the face; seed only skin, not the black shirt.
    for side,box in [('left',(760,1750,1385,2460)),('right',(1386,1690,1990,2450))]:
        path=WORK/f'masks/hand-{side}-flex-edge.png'
        crop=source.crop(box);rgb=np.array(crop);r,g,b=rgb.astype(float).transpose(2,0,1)
        if not path.exists():
            skin=(r>100)&(r-g>18)&(r-b>26)
            skin=ndimage.binary_closing(skin,iterations=2)
            labels,_=ndimage.label(skin);counts=np.bincount(labels.ravel());counts[0]=0
            skin=ndimage.binary_fill_holes(labels==counts.argmax())
            mask=np.where(skin,cv2.GC_PR_FGD,cv2.GC_PR_BGD).astype('uint8')
            mask[ndimage.binary_erosion(skin,iterations=7)]=cv2.GC_FGD
            mask[(r<65)|(r-g<5)]=cv2.GC_BGD
            mask[:2]=0;mask[-2:]=0;mask[:,:2]=0;mask[:,-2:]=0
            cv2.grabCut(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),mask,None,np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),5,cv2.GC_INIT_WITH_MASK)
            alpha=np.isin(mask,[cv2.GC_FGD,cv2.GC_PR_FGD]);labels,_=ndimage.label(alpha)
            counts=np.bincount(labels.ravel());counts[0]=0
            alpha=ndimage.binary_fill_holes(labels==counts.argmax())
            Image.fromarray((alpha*255).astype('uint8')).filter(ImageFilter.GaussianBlur(.6)).save(path)
        alpha=Image.open(path)
        if side=='right':
            region=Image.new('L',crop.size,0)
            from scipy.interpolate import PchipInterpolator
            ys=np.array([2000,2130,2200,2260,2310,2370,2405,2412]);xs=np.array([1875,1875,1915,1930,1920,1880,1810,1750])
            curve=PchipInterpolator(ys,xs)
            wrist=[(1386,1690),(1990,1690),(1990,2000)]+[(float(curve(y)),float(y)) for y in np.linspace(2000,2412,100)]+[(1680,2390),(1386,2380)]
            ImageDraw.Draw(region).polygon([(x-box[0],y-box[1]) for x,y in wrist],fill=255)
            alpha=ImageChops.multiply(alpha,region.filter(ImageFilter.GaussianBlur(1)))
        alpha.save(WORK/f'masks/hand-{side}-flex-final.png')
        rgba=crop.convert('RGBA');rgba.putalpha(alpha)
        bounds=alpha.getbbox();part=rgba.crop(bounds)
        original=Image.open(ASSETS/f'hand-{side}.png')
        # Preserve the original hand canvas and align the wrist instead of the fingertips.
        a=np.array(part.getchannel('A'));ys,xs=np.where(a>128)
        source_wrist=xs[ys>part.height*.93].mean()/part.width
        wrist_x=.49 if side=='left' else .48
        max_width=min((original.width*wrist_x-6)/source_wrist,(original.width*(1-wrist_x)-6)/(1-source_wrist))
        scale=min((original.height-6)/part.height,max_width/part.width,.82)
        part=part.resize((round(part.width*scale),round(part.height*scale)),Image.Resampling.LANCZOS)
        offset=(round(original.width*wrist_x-part.width*source_wrist),original.height-part.height)
        canvas=Image.new('RGBA',original.size);canvas.alpha_composite(part,offset)
        canvas=feather_inward(canvas,2.6)
        canvas.getchannel('A').save(WORK/f'masks/hand-{side}-flex-feathered-canvas.png')
        name=f'hand-{side}-flex.png';canvas.save(ASSETS/name,optimize=True)
        records.append({'id':f'hand-{side}-flex','file':name,'source':'IMG_4900.HEIC','sourceCrop':box,'canvas':list(canvas.size),'scale':scale,'offset':offset,'wristOrigin':[wrist_x,1],'kind':'photograph'})
    return records


def generated():
    records=[]
    for side in ['left','right']:
        source=WORK/f'generative/inner-{side}-original.png'
        rgba=Image.open(source).convert('RGBA')
        bounds=rgba.getchannel('A').getbbox()
        # Match the halfway pose's head height and centered composition to the photos.
        part=rgba.crop(bounds)
        height=660;scale=height/part.height
        part=part.resize((round(part.width*scale),height),Image.Resampling.LANCZOS)
        offset=(round((640-part.width)/2),55)
        canvas=Image.new('RGBA',(640,800));canvas.alpha_composite(part,offset)
        from scipy.interpolate import PchipInterpolator
        jaw=([[0,450],[166,580],[215,642],[280,670],[346,651],[410,593],[455,535],[640,420]] if side=='left' else
             [[0,420],[185,535],[230,593],[294,651],[360,670],[425,642],[474,580],[640,450]])
        points=np.array(jaw);boundary=PchipInterpolator(points[:,0],points[:,1])(np.arange(640))
        mask=Image.fromarray((np.clip(boundary[None,:]-np.arange(800)[:,None]+.5,0,1)*255).astype('uint8'))
        canvas.putalpha(ImageChops.multiply(canvas.getchannel('A'),mask))
        mask.save(WORK/f'masks/inner-{side}-jaw-canvas.png')
        file=f'experimental/head-inner-{side}.png';canvas.save(ASSETS/file,optimize=True)
        records.append({'id':f'inner-{side}','file':file,'kind':'generated','references':['IMG_4877.HEIC','IMG_4883.HEIC' if side=='left' else 'IMG_4890.HEIC'],'canvas':[640,800],'sourceBounds':bounds,'scale':scale,'offset':offset,'jawBoundary':jaw,'experimental':True})
    return records


def review(manifest):
    items=manifest['frames'][:1]+manifest['experimentalFrames']+manifest['hands']+manifest['alternateHands']
    for theme,bg in [('light','#f5f2eb'),('dark','#1d2622'),('pattern','#e8eddf')]:
        from PIL import ImageDraw
        sheet=Image.new('RGB',(1260,840),bg);draw=ImageDraw.Draw(sheet)
        if theme=='pattern':
            for y in range(0,840,20):
                for x in range(0,1260,20):
                    if (x//20+y//20)%2:draw.rectangle((x,y,x+19,y+19),fill='#95a487')
        for i,item in enumerate(items):
            x=(i%4)*315;y=(i//4)*420
            part=Image.open(ASSETS/item['file']);part.thumbnail((288,360),Image.Resampling.LANCZOS)
            sheet.paste(part,(x+(315-part.width)//2,y+35),part)
            draw.text((x+12,y+12),item['id'],fill='#dbe4d0' if theme=='dark' else '#263826')
        sheet.save(WORK/f'review/variants-{theme}.jpg',quality=95)


if __name__=='__main__':
    decoded=WORK/'decoded/IMG_4900.png'
    if not decoded.exists():
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(ROOT/'IMG_4900.HEIC'),'-frames:v','1',str(decoded)],check=True)
    manifest=json.loads((ASSETS/'manifest.json').read_text())
    manifest['alternateHands']=hands()
    manifest['experimentalFrames']=generated()
    manifest['defaultMode']='photos'
    (ASSETS/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    shutil.copytree(ASSETS,ROOT/'demo/public/sprites',dirs_exist_ok=True)
    review(manifest)
