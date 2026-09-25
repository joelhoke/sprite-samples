"""Extract and mask the new video reference locally, preserving decoded photographic RGB."""
from pathlib import Path
import argparse, json, os, shutil, subprocess

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault('REMBG_HOME', str(ROOT / '.tools/rembg'))
os.environ.setdefault('NUMBA_CACHE_DIR', str(ROOT / '.tools/numba'))
os.environ.setdefault('OMP_NUM_THREADS', '4')
from PIL import Image, ImageChops
import numpy as np
from scipy.interpolate import PchipInterpolator
from edge_masks import feather_inward
from prepare_oil import review

WORK = ROOT / 'work/video-now'
CONFIG = json.loads((ROOT / 'scripts/video-now.json').read_text())

def decode():
    for f in CONFIG['frames']:
        target = WORK / 'frames' / f"{f['id']}.png"
        if not target.exists():
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(ROOT/CONFIG['source']),
                '-map','0:v:0','-vf',f"select=eq(n\\,{f['frameIndex']})",'-frames:v','1',str(target)],check=True)

def segment():
    from rembg import new_session
    import onnxruntime as ort
    options=ort.SessionOptions()
    options.enable_cpu_mem_arena=False; options.enable_mem_pattern=False
    options.intra_op_num_threads=2; options.inter_op_num_threads=1
    session=new_session('birefnet-general',sess_opts=options,providers=['CPUExecutionProvider'])
    for f in CONFIG['frames']:
        path=WORK/'masks'/f"{f['id']}-automatic.png"
        if path.exists(): continue
        crop=Image.open(WORK/'frames'/f"{f['id']}.png").convert('RGB').crop(f['crop'])
        session.predict(crop)[0].save(path)
        print(f"Segmented {f['id']}",flush=True)

def export():
    records=[]
    for f in CONFIG['frames']:
        name=f['id']
        crop=Image.open(WORK/'frames'/f'{name}.png').convert('RGBA').crop(f['crop'])
        alpha=Image.open(WORK/'masks'/f'{name}-automatic.png').convert('L')
        points=np.array(f['jawBoundary'])
        boundary=PchipInterpolator(points[:,0],points[:,1])(np.arange(crop.width))
        jaw=Image.fromarray((np.clip(boundary[None,:]-np.arange(crop.height)[:,None]+.5,0,1)*255).astype('uint8'))
        jaw.save(WORK/'masks'/f'{name}-jaw.png')
        crop.putalpha(ImageChops.multiply(alpha,jaw))
        if f.get('excludeBlueFabric'):
            rgb=np.array(crop,dtype=np.int16)
            fabric=(rgb[:,:,2]>rgb[:,:,0]+12)&(rgb[:,:,2]>rgb[:,:,1]+8)
            clean=np.array(crop.getchannel('A'));clean[fabric]=0
            crop.putalpha(Image.fromarray(clean))
        bounds=crop.getchannel('A').point(lambda a:255 if a>16 else 0).getbbox()
        part=crop.crop(bounds)
        scale=min(660/part.height,520/part.width)
        part=part.resize((round(part.width*scale),round(part.height*scale)),Image.Resampling.LANCZOS)
        offset=((640-part.width)//2,720-part.height)
        canvas=Image.new('RGBA',(640,800));canvas.alpha_composite(part,offset)
        canvas=feather_inward(canvas,2.5)
        canvas.getchannel('A').save(WORK/'masks'/f'{name}-final.png')
        canvas.save(ROOT/f'assets/now/head-{name}.png',optimize=True)
        records.append({'id':name,'file':f'now/head-{name}.png','kind':'photographic-video',
            'source':'IMG_5003.mov','frameIndex':f['frameIndex'],'timeSeconds':f['timeSeconds'],
            'canvas':[640,800],'sourceCrop':f['crop'],'sourceBounds':bounds,'scale':scale,
            'offset':offset,'jawBoundary':f['jawBoundary'],'featherPx':2.5,
            'fabricExclusion':f.get('excludeBlueFabric',False),'alignment':'centered silhouette, chin baseline y=720'})
    manifest=json.loads((ROOT/'assets/manifest.json').read_text())
    manifest['nowFrames']=records
    manifest['nowSource']=CONFIG['sourceInfo']
    prior_now=manifest.get('references',{}).get('now',{})
    manifest['references']={'then':{'headFrames':'frames','styles':['photos','generated','monotone','duotone','oil','watercolor','pencil','ascii']},
        'now':{**prior_now,'headFrames':'nowFrames','hands':'hands','alternateHands':'alternateHands','source':'IMG_5003.mov'}}
    (ROOT/'assets/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    shutil.copytree(ROOT/'assets/now',ROOT/'demo/public/sprites/now',dirs_exist_ok=True)
    shutil.copy2(ROOT/'assets/manifest.json',ROOT/'demo/public/sprites/manifest.json')
    order=['upper-left','up','upper-right','left','center','right','lower-left','down','lower-right']
    review(sorted(records,key=lambda r:order.index(r['id'])),mode='now')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('step',choices=['decode','segment','export','all'])
    args=parser.parse_args()
    for folder in ['frames','masks']:(WORK/folder).mkdir(parents=True,exist_ok=True)
    (ROOT/'assets/now').mkdir(exist_ok=True)
    if args.step in ['decode','all']:decode()
    if args.step in ['segment','all']:segment()
    if args.step in ['export','all']:export()
