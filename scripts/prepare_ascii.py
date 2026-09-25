"""Convert the aligned realistic AI portrait to actual, editable ASCII text.

All luminance sampling happens here. The browser only displays finished text.
"""
from pathlib import Path
import json
import shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
OUTPUT = ASSETS / 'ascii'
ORDER = ['upper-left', 'up', 'upper-right', 'left', 'center', 'right', 'lower-left', 'down', 'lower-right']
# Light to dark, with similar-weight alternatives for the typewritten reference.
RAMP = ['.', ',-', ':;', '=+', '*I', 'JLY', 'TXZ', 'K8B', 'MWN', '@#']


def convert(source, columns):
    rgba = Image.open(source).convert('RGBA')
    rows = round(rgba.height / rgba.width * columns * .6)
    # BOX filtering accounts for each cell's complete footprint, including alpha.
    alpha = np.asarray(rgba.getchannel('A'), dtype=float) / 255
    rgb = np.asarray(rgba, dtype=float)[:, :, :3]
    luminance = rgb @ np.array([.2126, .7152, .0722])
    def sample(values):
        return np.asarray(Image.fromarray(values.astype('float32')).resize((columns, rows), Image.Resampling.BOX))
    coverage = sample(alpha)
    tone = sample(luminance * alpha) / np.maximum(coverage, .001)
    # Fixed curve across all poses prevents frame-dependent contrast pumping.
    density = np.clip((225 - tone) / 200, 0, 1) ** .9
    lines = []
    for y in range(rows):
        line = ''
        for x in range(columns):
            if coverage[y, x] < .42:
                line += ' '
                continue
            level = min(len(RAMP)-1, round(float(density[y, x]) * (len(RAMP)-1)))
            letters = RAMP[level]
            # Stable coordinate choice, never random on pointer movement.
            line += letters[(x * 7 + y * 11) % len(letters)]
        lines.append(line)
    return {'columns': columns, 'rows': rows, 'canvas': list(rgba.size), 'lines': lines}


def export():
    OUTPUT.mkdir(exist_ok=True)
    frames = {}
    heads, hands = [], []
    ids = [f'head-{direction}' for direction in ORDER] + ['hand-left', 'hand-right', 'hand-left-flex', 'hand-right-flex']
    for name in ids:
        source = ASSETS / f'ai/{name}.png'
        frame = convert(source, 64 if name.startswith('head-') else 44)
        frames[name] = frame
        (OUTPUT / f'{name}.txt').write_text('\n'.join(frame['lines']) + '\n')
        record = {'id': name, 'file': f'ascii/{name}.txt', 'kind': 'ascii', 'source': f'ai/{name}.png',
                  'canvas': frame['canvas'], 'columns': frame['columns'], 'rows': frame['rows'],
                  'alignment': 'inherits source canvas and anchors; whitespace preserves transparency'}
        (heads if name.startswith('head-') else hands).append(record)
    (OUTPUT / 'frames.json').write_text(json.dumps({'version': 1, 'frames': frames}, separators=(',', ':')) + '\n')
    manifest = json.loads((ASSETS / 'manifest.json').read_text())
    manifest['asciiFrames'] = heads
    manifest['asciiHands'] = hands
    manifest['modes']['ascii'] = {'headFrames': 'asciiFrames', 'hands': 'asciiHands', 'file': 'ascii/frames.json',
                                'rendering': 'monochrome text in currentColor', 'sourceMode': 'generated'}
    (ASSETS / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    shutil.copytree(OUTPUT, ROOT / 'demo/public/sprites/ascii', dirs_exist_ok=True)
    shutil.copy2(ASSETS / 'manifest.json', ROOT / 'demo/public/sprites/manifest.json')
    return frames


def review(frames):
    """Render text-only review sheets, using the same Courier metrics as the demo."""
    out = ROOT / 'work/review'
    font_path = '/System/Library/Fonts/Supplemental/Courier New Bold.ttf'
    def draw_frame(image, name, xy, width, ink):
        f = frames[name]
        cw = width / f['columns']
        height = width * f['canvas'][1] / f['canvas'][0]
        ch = height / f['rows']
        font = ImageFont.truetype(font_path, round(cw / .6))
        d = ImageDraw.Draw(image)
        for y, line in enumerate(f['lines']):
            for x, char in enumerate(line):
                if char != ' ': d.text((xy[0]+x*cw, xy[1]+y*ch+ch*.78), char, font=font, fill=ink, anchor='ls')
    for theme, paper, ink in [('light', '#f5f2eb', '#27312a'), ('dark', '#1d2622', '#e9eddf'), ('pattern', '#e8eddf', '#27392c')]:
        sheet = Image.new('RGB', (1200, 1440), paper)
        d = ImageDraw.Draw(sheet)
        if theme == 'pattern':
            for x in range(0, 1200, 32): d.line((x, 0, x, 1440), fill='#c4d0b9')
            for y in range(0, 1440, 32): d.line((0, y, 1200, y), fill='#c4d0b9')
        for i, direction in enumerate(ORDER):
            x = i % 3 * 400; y = i // 3 * 480
            d.text((x+20, y+10), direction, fill=ink)
            draw_frame(sheet, f'head-{direction}', (x+40, y+30), 320, ink)
        sheet.save(out / f'ascii-heads-{theme}.png')
        hands = Image.new('RGB', (1200, 380), paper)
        hd = ImageDraw.Draw(hands)
        if theme == 'pattern':
            for x in range(0, 1200, 32): hd.line((x, 0, x, 380), fill='#c4d0b9')
            for y in range(0, 380, 32): hd.line((0, y, 1200, y), fill='#c4d0b9')
        for i, name in enumerate(['hand-left', 'hand-right', 'hand-left-flex', 'hand-right-flex']):
            hd.text((i*300+10, 10), name, fill=ink)
            draw_frame(hands, name, (i*300+10, 40), 280, ink)
        hands.save(out / f'ascii-hands-{theme}.png')
        portrait = Image.new('RGB', (1200, 1030), paper)
        d = ImageDraw.Draw(portrait)
        if theme == 'pattern':
            for x in range(0, 1200, 32): d.line((x, 0, x, 1030), fill='#c4d0b9')
            for y in range(0, 1030, 32): d.line((0, y, 1200, y), fill='#c4d0b9')
        draw_frame(portrait, 'head-center', (312, 0), 576, ink)
        draw_frame(portrait, 'hand-left', (24, 649), 348, ink)
        draw_frame(portrait, 'hand-right', (828, 649), 348, ink)
        portrait.save(out / f'ascii-portrait-{theme}.png')


if __name__ == '__main__':
    review(export())
