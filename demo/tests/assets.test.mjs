import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root=new URL("../public/sprites/",import.meta.url);

test("every gaze direction has a valid, aligned transparent PNG",async()=>{
  const manifest=JSON.parse(await readFile(new URL("manifest.json",root),"utf8"));
  assert.equal(manifest.frames.length,9);
  assert.equal(manifest.nowFrames.length,9);
  for(const mode of ["Pencil","Watercolor"]) {
    const key="now"+mode+"Frames";
    assert.equal(manifest[key].length,9);
    assert.equal(new Set(manifest[key].map(frame=>frame.id)).size,9);
    assert.ok(manifest[key].every(frame=>frame.kind==="generated" && frame.reference==="IMG_5003.mov"));
    assert.equal(manifest.references.now.styleSets[mode.toLowerCase()].hands,mode.toLowerCase()+"Hands");
  }
  assert.equal(new Set(manifest.nowFrames.map(f=>f.id)).size,9);
  assert.ok(manifest.nowFrames.every(f=>f.source==="IMG_5003.mov" && f.kind==="photographic-video" && f.timeSeconds>0));
  assert.equal(manifest.references.now.hands,"hands");
  assert.equal(manifest.hands.length,2);
  assert.equal(manifest.experimentalFrames.length,2);
  assert.equal(manifest.alternateHands.length,2);
  assert.equal(manifest.defaultMode,"photos");
  assert.equal(manifest.aiFrames.length,9);
  assert.equal(manifest.oilFrames.length,9);
  assert.equal(manifest.aiHands.length,4);
  assert.equal(manifest.oilHands.length,4);
  assert.equal(manifest.pencilFrames.length,9);
  assert.equal(manifest.pencilHands.length,4);
  assert.equal(manifest.modes.pencil.hands,"pencilHands");
  assert.equal(manifest.modes.pencil.headFrames,"pencilFrames");
  assert.equal(new Set(manifest.pencilFrames.map(frame=>frame.id)).size,9);
  assert.equal(manifest.watercolorFrames.length,9);
  assert.equal(manifest.watercolorHands.length,4);
  assert.equal(manifest.modes.watercolor.hands,"watercolorHands");
  assert.equal(manifest.modes.oil.hands,"oilHands");
  assert.equal(manifest.modes.watercolor.opacity,.96);
  assert.equal(manifest.modes.generated.hands,"aiHands");
  assert.equal(manifest.modes.oil.hands,"oilHands");
  assert.equal(manifest.modes.blue.headFrames,"aiFrames");
  assert.equal(manifest.modes.blue.hands,"aiHands");
  assert.equal(manifest.modes.blue.tint,"#3B9EC8");
  for(const [key,prefix] of [["pencilFrames","pencil/"],["pencilHands","pencil/"],["oilFrames","oil/"],["oilHands","oil/"],["aiHands","ai/"],["watercolorFrames","watercolor/"],["watercolorHands","watercolor/"]])
    assert.ok(manifest[key].every(frame=>frame.kind==="generated" && frame.file.startsWith(prefix)));
  assert.ok(manifest.aiFrames.every(frame=>frame.kind==="generated" && frame.file.startsWith("ai/")));
  assert.equal(new Set(manifest.frames.map(frame=>frame.direction.join(","))).size,9);
  for(const frame of [...manifest.frames,...manifest.hands,...manifest.alternateHands,...manifest.experimentalFrames,...manifest.aiFrames,...manifest.oilFrames,...manifest.aiHands,...manifest.oilHands,...manifest.watercolorFrames,...manifest.watercolorHands,...manifest.pencilFrames,...manifest.pencilHands,...manifest.nowFrames,...manifest.nowPencilFrames,...manifest.nowWatercolorFrames]) {
    const png=await readFile(new URL(frame.file,root));
    assert.equal(png.subarray(1,4).toString(),"PNG");
    assert.equal(png[25],6,"PNG must contain RGB and alpha");
    assert.ok(png.length>10000,"asset must contain a detailed image");
    assert.equal(png.readUInt32BE(16),frame.canvas[0]);
    assert.equal(png.readUInt32BE(20),frame.canvas[1]);
    if(frame.direction) {
      assert.deepEqual(frame.canvas,[640,800]);
      assert.deepEqual(frame.pivot,[320,752]);
    }
    const original=await readFile(new URL(`../../assets/${frame.file}`,import.meta.url));
    assert.deepEqual(png,original,"demo must serve the delivered assets");
  }
});

test("ASCII contains all poses as printable text, matching the delivered source files",async()=>{
  const data=JSON.parse(await readFile(new URL('ascii/frames.json',root),'utf8'));
  const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
  assert.equal(manifest.asciiFrames.length,9);
  assert.equal(manifest.asciiHands.length,4);
  assert.equal(Object.keys(data.frames).length,13);
  const signatures=new Set();
  for(const record of [...manifest.asciiFrames,...manifest.asciiHands]) {
    const frame=data.frames[record.id];
    assert.equal(frame.lines.length,frame.rows);
    assert.ok(frame.lines.every(line=>line.length===frame.columns && /^[\x20-\x7e]+$/.test(line)));
    assert.ok(frame.lines.join('').includes(' '),'transparent negative space');
    assert.ok(frame.lines.join('').trim().length>100,'detailed character portrait');
    const text=frame.lines.join('\n')+'\n';signatures.add(text);
    assert.equal(await readFile(new URL(record.file,root),'utf8'),text);
    assert.equal(await readFile(new URL(`../../assets/${record.file}`,import.meta.url),'utf8'),text);
  }
  assert.equal(signatures.size,13,'each direction and hand pose is distinct');
  assert.deepEqual(await readFile(new URL('ascii/frames.json',root)),await readFile(new URL('../../assets/ascii/frames.json',import.meta.url)));
});
