"""Align generated watercolor head angles without changing existing portrait sets."""
from pathlib import Path
import json, shutil
from PIL import Image
from edge_masks import feather_inward
from prepare_oil import ORDER, review

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'


def export():
    (ASSETS / 'watercolor').mkdir(exist_ok=True)
    records = []
    for name in ORDER:
        source = ROOT / f'work/generative/watercolor-heads/{name}.png'
        rgba = Image.open(source).convert('RGBA')
        assert rgba.getchannel('A').getextrema()[0] == 0, f'{name} needs transparency'
        bounds = rgba.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        part = rgba.crop(bounds)
        scale = min(660 / part.height, 520 / part.width)
        part = part.resize((round(part.width * scale), round(part.height * scale)), Image.Resampling.LANCZOS)
        offset = ((640 - part.width) // 2, 720 - part.height)
        canvas = Image.new('RGBA', (640, 800)); canvas.alpha_composite(part, offset)
        canvas = feather_inward(canvas, 1.5)
        file = f'watercolor/head-{name}.png'; canvas.save(ASSETS / file, optimize=True)
        records.append({'id': name, 'file': file, 'kind': 'generated', 'style': 'watercolor',
            'reference': 'IMG_4877.HEIC', 'canvas': [640, 800], 'source': str(source.relative_to(ROOT)),
            'sourceBounds': bounds, 'scale': scale, 'offset': offset, 'featherPx': 1.5,
            'alignment': 'centered silhouette, chin baseline y=720'})
    manifest = json.loads((ASSETS / 'manifest.json').read_text())
    manifest['watercolorFrames'] = records
    manifest['modes']['watercolor'] = {'headFrames': 'watercolorFrames', 'hands': 'watercolorHands', 'opacity': .96}
    (ASSETS / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    shutil.copytree(ASSETS / 'watercolor', ROOT / 'demo/public/sprites/watercolor', dirs_exist_ok=True)
    shutil.copy2(ASSETS / 'manifest.json', ROOT / 'demo/public/sprites/manifest.json')
    return records


if __name__ == '__main__':
    review(export(), mode='watercolor')
