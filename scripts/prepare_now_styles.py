"""Align the new-reference generated heads, retaining the matching existing styled hands."""
from pathlib import Path
import argparse, json, shutil
from PIL import Image, ImageDraw
from edge_masks import feather_inward
from prepare_oil import ORDER, review

ROOT=Path(__file__).resolve().parents[1]

def export(mode):
    folder=ROOT/f'work/generative/now-{mode}'
    output=ROOT/f'assets/now/{mode}';output.mkdir(parents=True,exist_ok=True)
    records=[]
    for name in ORDER:
        source=folder/f'{name}.png'
        rgba=Image.open(source).convert('RGBA')
        assert rgba.getchannel('A').getextrema()[0]==0, f'{source} needs transparency'
        bounds=rgba.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox()
        part=rgba.crop(bounds)
        scale=min(660/part.height,520/part.width)
        part=part.resize((round(part.width*scale),round(part.height*scale)),Image.Resampling.LANCZOS)
        offset=((640-part.width)//2,720-part.height)
        canvas=Image.new('RGBA',(640,800));canvas.alpha_composite(part,offset)
        canvas=feather_inward(canvas,1.5)
        file=f'now/{mode}/head-{name}.png';canvas.save(ROOT/'assets'/file,optimize=True)
        records.append({'id':name,'file':file,'kind':'generated','style':mode,'reference':'IMG_5003.mov',
            'poseReference':f'assets/now/head-{name}.png','source':str(source.relative_to(ROOT)),
            'canvas':[640,800],'sourceBounds':bounds,'scale':scale,'offset':offset,
            'featherPx':1.5,'alignment':'centered silhouette, chin baseline y=720'})
    path=ROOT/'assets/manifest.json';manifest=json.loads(path.read_text())
    key='now'+mode.title()+'Frames';manifest[key]=records
    now=manifest['references']['now']
    now.setdefault('styleSets',{'photos':{'headFrames':'nowFrames','hands':'hands','alternateHands':'alternateHands'}})
    now['styleSets'][mode]={'headFrames':key,'hands':mode+'Hands','opacity':.96 if mode=='watercolor' else 1}
    now['styles']=list(now['styleSets'])
    path.write_text(json.dumps(manifest,indent=2)+'\n')
    shutil.copytree(output,ROOT/f'demo/public/sprites/now/{mode}',dirs_exist_ok=True)
    shutil.copy2(path,ROOT/'demo/public/sprites/manifest.json')
    sources={}
    for p in folder.glob('*.source.json'):
        item=json.loads(p.read_text());sources[item['id']]=item['source']
    assert len(sources)==9
    (folder/'sources.json').write_text(json.dumps(sources,indent=2)+'\n')
    review(records,mode=f'now-{mode}')
    for theme,bg in [('light','#f5f2eb'),('dark','#1d2622'),('pattern','#e8eddf')]:
        composite=Image.new('RGB',(1200,1030),bg);draw=ImageDraw.Draw(composite)
        if theme=='pattern':
            for x in range(0,1200,64):draw.line((x,0,x,1030),fill='#95a487')
            for y in range(0,1030,64):draw.line((0,y,1200,y),fill='#95a487')
        items=[(output/'head-center.png',(576,720),(312,0))]
        for side,x,height in [('left',24,545),('right',828,492)]:
            items.append((ROOT/f'assets/{mode}/hand-{side}.png',(348,round(height*348/560)),(x,649)))
        for asset,size,offset in items:
            sprite=Image.open(asset).resize(size,Image.Resampling.LANCZOS)
            if mode=='watercolor':sprite.putalpha(sprite.getchannel('A').point(lambda a:round(a*.96)))
            composite.paste(sprite,offset,sprite)
        composite.save(ROOT/f'work/review/now-{mode}-portrait-{theme}.png')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--mode',choices=['pencil','watercolor','all'],default='all')
    args=parser.parse_args()
    for mode in (['pencil','watercolor'] if args.mode=='all' else [args.mode]):export(mode)
