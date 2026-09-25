"""Align oil-painted heads while leaving photo and realistic-AI modes intact."""
from pathlib import Path
import json, shutil
from PIL import Image, ImageDraw, ImageFont
from edge_masks import feather_inward

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets';WORK=ROOT/'work'
ORDER=['upper-left','up','upper-right','left','center','right','lower-left','down','lower-right']


def export():
    (ASSETS/'oil').mkdir(exist_ok=True)
    records=[]
    for name in ORDER:
        source=WORK/f'generative/oil-heads/{name}.png'
        rgba=Image.open(source).convert('RGBA')
        assert rgba.getchannel('A').getextrema()[0]==0,f'{name} needs a transparent background'
        bounds=rgba.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox()
        part=rgba.crop(bounds)
        scale=min(660/part.height,520/part.width)
        part=part.resize((round(part.width*scale),round(part.height*scale)),Image.Resampling.LANCZOS)
        offset=((640-part.width)//2,720-part.height)
        canvas=Image.new('RGBA',(640,800));canvas.alpha_composite(part,offset)
        canvas=feather_inward(canvas,1.5)
        file=f'oil/head-{name}.png';canvas.save(ASSETS/file,optimize=True)
        records.append({'id':name,'file':file,'kind':'generated','style':'impasto oil painting','reference':'IMG_4877.HEIC','canvas':[640,800],'source':str(source.relative_to(ROOT)),'sourceBounds':bounds,'scale':scale,'offset':offset,'alignment':'centered silhouette, chin baseline y=720','featherPx':1.5})
    manifest=json.loads((ASSETS/'manifest.json').read_text())
    manifest['oilFrames']=records
    manifest['modes']['oil']={'headFrames':'oilFrames','hands':'oilHands'}
    (ASSETS/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    shutil.copytree(ASSETS/'oil',ROOT/'demo/public/sprites/oil',dirs_exist_ok=True)
    shutil.copy2(ASSETS/'manifest.json',ROOT/'demo/public/sprites/manifest.json')
    return records


def review(records, mode='oil'):
    font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',14)
    for theme,bg in [('light','#f5f2eb'),('dark','#1d2622'),('pattern','#e8eddf')]:
        sheet=Image.new('RGB',(960,1320),bg);draw=ImageDraw.Draw(sheet)
        if theme=='pattern':
            for y in range(0,1320,24):
                for x in range(0,960,24):
                    if (x//24+y//24)%2:draw.rectangle((x,y,x+23,y+23),fill='#95a487')
        for i,item in enumerate(records):
            x=(i%3)*320;y=(i//3)*440
            part=Image.open(ASSETS/item['file']);part.thumbnail((288,360),Image.Resampling.LANCZOS)
            if mode in ['watercolor','now-watercolor']:part.putalpha(part.getchannel('A').point(lambda a:round(a*.96)))
            sheet.paste(part,(x+16,y+40),part)
            draw.text((x+15,y+12),item['id'],font=font,fill='#dbe4d0' if theme=='dark' else '#263826')
        sheet.save(WORK/f'review/{mode}-heads-{theme}.jpg',quality=95)

if __name__=='__main__':review(export())
