"""Align generated realistic, oil, watercolor, and pencil hands to the established wrist anchors."""
from pathlib import Path
import json, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from edge_masks import feather_inward

ROOT=Path(__file__).resolve().parents[1];ASSETS=ROOT/'assets';WORK=ROOT/'work'
NAMES=['hand-left','hand-right','hand-left-flex','hand-right-flex']


def export(modes=None):
    manifest=json.loads((ASSETS/'manifest.json').read_text())
    for mode,folder in [('ai','realistic-hands'),('oil','oil-hands'),('watercolor','watercolor-hands'),('pencil','pencil-hands')]:
        if modes and mode not in modes:continue
        records=[]
        for name in NAMES:
            source=WORK/f'generative/{folder}/{name}.png'
            rgba=Image.open(source).convert('RGBA')
            assert rgba.getchannel('A').getextrema()[0]==0,f'{source} needs transparency'
            bounds=rgba.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox()
            part=rgba.crop(bounds);side=name.split('-')[1]
            size=(560,545 if side=='left' else 492);wrist=.49 if side=='left' else .48
            alpha=np.array(part.getchannel('A'));ys,xs=np.where(alpha>128)
            source_wrist=float(xs[ys>part.height*.93].mean()/part.width)
            max_width=min((size[0]*wrist-6)/source_wrist,(size[0]*(1-wrist)-6)/(1-source_wrist))
            scale=min((size[1]-6)/part.height,max_width/part.width)
            resized=part.resize((round(part.width*scale),round(part.height*scale)),Image.Resampling.LANCZOS)
            offset=(round(size[0]*wrist-resized.width*source_wrist),size[1]-resized.height-3)
            canvas=Image.new('RGBA',size);canvas.alpha_composite(resized,offset)
            canvas=feather_inward(canvas,2 if mode=='ai' else 1.5)
            file=f'{mode}/{name}.png';canvas.save(ASSETS/file,optimize=True)
            records.append({'id':name,'file':file,'kind':'generated','style':{'ai':'photorealistic','oil':'impasto oil painting','watercolor':'watercolor','pencil':'graphite pencil'}[mode],'pose':'flex' if name.endswith('-flex') else 'open','side':'viewer-'+side,'reference':'IMG_4900.HEIC' if name.endswith('-flex') else 'IMG_4877.HEIC','source':str(source.relative_to(ROOT)),'canvas':list(size),'sourceBounds':bounds,'scale':scale,'offset':offset,'wristOrigin':[wrist,1]})
        key=f'{mode}Hands';manifest[key]=records
        manifest['modes']['generated' if mode=='ai' else mode]['hands']=key
        review(mode,records)
        shutil.copytree(ASSETS/mode,ROOT/f'demo/public/sprites/{mode}',dirs_exist_ok=True)
    (ASSETS/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    shutil.copy2(ASSETS/'manifest.json',ROOT/'demo/public/sprites/manifest.json')


def review(mode,records):
    font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',14)
    for theme,bg in [('light','#f5f2eb'),('dark','#1d2622'),('pattern','#e8eddf')]:
        sheet=Image.new('RGB',(1200,400),bg);draw=ImageDraw.Draw(sheet)
        if theme=='pattern':
            for y in range(0,400,20):
                for x in range(0,1200,20):
                    if (x//20+y//20)%2:draw.rectangle((x,y,x+19,y+19),fill='#95a487')
        for i,item in enumerate(records):
            im=Image.open(ASSETS/item['file']);im.thumbnail((280,300),Image.Resampling.LANCZOS)
            if mode=='watercolor':im.putalpha(im.getchannel('A').point(lambda a:round(a*.96)))
            sheet.paste(im,(i*300+10,60),im)
            draw.text((i*300+10,20),item['id'],font=font,fill='#dbe4d0' if theme=='dark' else '#263826')
        sheet.save(WORK/f'review/{mode}-hands-{theme}.jpg',quality=95)
        portrait=Image.new('RGB',(1200,1030),bg);d=ImageDraw.Draw(portrait)
        if theme=='pattern':
            for x in range(0,1200,64):d.line((x,0,x,1030),fill='#95a487')
            for y in range(0,1030,64):d.line((0,y,1200,y),fill='#95a487')
        head=Image.open(ASSETS/f'{mode}/head-center.png').resize((576,720),Image.Resampling.LANCZOS)
        if mode=='watercolor':head.putalpha(head.getchannel('A').point(lambda a:round(a*.96)))
        portrait.paste(head,(312,0),head)
        for side,x in [('left',24),('right',828)]:
            hand=Image.open(ASSETS/f'{mode}/hand-{side}.png')
            hand=hand.resize((348,round(hand.height*348/hand.width)),Image.Resampling.LANCZOS)
            if mode=='watercolor':hand.putalpha(hand.getchannel('A').point(lambda a:round(a*.96)))
            portrait.paste(hand,(x,649),hand)
        portrait.save(WORK/f'review/{mode}-portrait-{theme}.png')

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--mode',choices=['ai','oil','watercolor','pencil','all'],default='all')
    args=parser.parse_args();export(None if args.mode=='all' else [args.mode])
