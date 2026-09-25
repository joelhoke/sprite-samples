import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function render() {
  const { default: worker } = await import('../dist/server/index.js');
  return worker.fetch(new Request('http://localhost/', {headers:{accept:'text/html'}}),
    {ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},
    {waitUntil(){},passThroughOnException(){}});
}

test('renders the portrait and accessible background controls without the starter', async()=>{
  const response=await render();
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html, /Joel.*Here\. Almost\./);
  assert.match(html, /head-center\.png/);
  assert.match(html, /hand-left\.png/);
  assert.match(html, /hand-right\.png/);
  assert.match(html, /Set the scene/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /id="reference-then"/);
  assert.match(html, /id="reference-now"/);
  assert.match(html, /Original · 8 styles/);
  for(const label of ['New reference · 3 styles','Video cutout','Pencil sketch','Watercolor']) assert.ok(html.includes(label));
  assert.match(html, /sprites\/now\/pencil\/head-center\.png/);
  assert.match(html, /id="panel-now"/);
  assert.match(html, /aria-pressed="true"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|SkeletonPreview/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
});

test('production build includes the real photographic assets',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../dist/client/sprites/manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.frames.length,9);
  assert.equal(manifest.nowFrames.length,9);
  assert.equal(manifest.nowPencilFrames.length,9);
  assert.equal(manifest.nowWatercolorFrames.length,9);
  assert.equal(manifest.hands.length,2);
  assert.equal(manifest.aiFrames.length,9);
  assert.equal(manifest.oilFrames.length,9);
  assert.equal(manifest.aiHands.length,4);
  assert.equal(manifest.oilHands.length,4);
  assert.equal(manifest.pencilFrames.length,9);
  assert.equal(manifest.pencilHands.length,4);
  assert.equal(manifest.watercolorFrames.length,9);
  assert.equal(manifest.watercolorHands.length,4);
  assert.equal(manifest.modes.blue.tint,'#3B9EC8');
  assert.equal(manifest.modes.monotone.tint,'#3B9EC8');
  assert.equal(manifest.modes.duotone.duotoneShadow,'#4D0038');
  assert.equal(manifest.modes.duotone.duotoneHighlight,'#3B9EC8');
  assert.equal(manifest.asciiFrames.length,9);
  const ascii=JSON.parse(await readFile(new URL('../dist/client/sprites/ascii/frames.json',import.meta.url),'utf8'));
  assert.equal(Object.keys(ascii.frames).length,13);
});
