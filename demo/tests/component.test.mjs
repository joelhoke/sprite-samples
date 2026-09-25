import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { Window } from 'happy-dom';
import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import React, { act } from 'react';

const window = new Window({ url:'http://localhost:3000', width:1280, height:900 });
Object.assign(globalThis, {window, document:window.document, HTMLElement:window.HTMLElement, IS_REACT_ACT_ENVIRONMENT:true});
Object.defineProperty(globalThis,'navigator',{value:window.navigator,configurable:true});
const media = new Map();
window.matchMedia = query => {
  if (!media.has(query)) {
    const target = new window.EventTarget();
    target.matches = !query.includes('reduced-motion');
    target.media = query;
    media.set(query,target);
  }
  return media.get(query);
};
let requests = new Map(), nextId=0, clock=0;
globalThis.requestAnimationFrame = cb => {const id=++nextId;requests.set(id,cb);return id;};
globalThis.cancelAnimationFrame = id => requests.delete(id);
globalThis.ResizeObserver = class {observe(){} disconnect(){}};
window.HTMLElement.prototype.getBoundingClientRect = function() {
  if(this.classList.contains('portrait-hand-left')) return new window.DOMRect(120,480,174,169);
  if(this.classList.contains('portrait-hand-right')) return new window.DOMRect(540,480,174,153);
  return new window.DOMRect(256,80,288,360);
};
let failDecode=false, failOptional=false, decodedUrls=[];
const asciiData = JSON.parse(await readFile(new URL('../public/sprites/ascii/frames.json',import.meta.url),'utf8'));
let asciiFailure = '', fetchedUrls = [], deferredFetch = null;
globalThis.fetch = async (url, options) => {
  fetchedUrls.push(url);
  if (deferredFetch) return deferredFetch(url, options);
  return {ok:asciiFailure !== 'http',json:async()=>asciiFailure === 'invalid' ? {version:1,frames:{}} : asciiData};
};
globalThis.Image = class { src=''; decode(){decodedUrls.push(this.src);return (failDecode || (failOptional && (this.src.includes('/ai/') || this.src.includes('/oil/') || this.src.includes('/watercolor/') || this.src.includes('/pencil/') || this.src.includes('/now/'))))?Promise.reject(new Error('missing image')):Promise.resolve();} };
await mkdir(new URL('../.test-build/',import.meta.url),{recursive:true});
await build({entryPoints:[new URL('../components/FloatingPortrait.tsx',import.meta.url).pathname],bundle:true,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty'},outfile:new URL('../.test-build/portrait.mjs',import.meta.url).pathname,jsx:'automatic'});
const { FloatingPortrait } = await import('../.test-build/portrait.mjs');
await build({entryPoints:[new URL('../components/ToneControls.tsx',import.meta.url).pathname],bundle:true,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty'},outfile:new URL('../.test-build/controls.mjs',import.meta.url).pathname,jsx:'automatic'});
const { ToneControls } = await import('../.test-build/controls.mjs');
await build({entryPoints:[new URL('../app/page.tsx',import.meta.url).pathname],bundle:true,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty'},outfile:new URL('../.test-build/home.mjs',import.meta.url).pathname,jsx:'automatic',plugins:[{name:'test-link',setup(builder){
  builder.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'test-link'}));
  builder.onResolve({filter:/^react$/,namespace:'test-link'},()=>({path:'react',external:true}));
  builder.onLoad({filter:/.*/,namespace:'test-link'},()=>({contents:'import React from "react"; export default function Link(props) { return React.createElement("a",props); }',loader:'js'}));
}}]});
const { default: Home } = await import('../.test-build/home.mjs');
const { createRoot } = await import('react-dom/client');
let root, container;
async function mount(props={}) {
  container=document.createElement('div'); document.body.append(container); root=createRoot(container);
  await act(async()=>{root.render(React.createElement(FloatingPortrait,props));});
}
function move(x,y,pointerType='mouse') {
  act(()=>window.dispatchEvent(new window.PointerEvent('pointermove',{clientX:x,clientY:y,pointerType})));
}
function flushFrames(count=100) {
  act(()=>{for(let i=0;i<count && requests.size;i++){const queued=[...requests.values()];requests.clear();clock+=16.67;queued.forEach(cb=>cb(clock));}});
}
function preference(query,value) {
  const m=window.matchMedia(query);m.matches=value;
  act(()=>m.dispatchEvent(new window.Event('change')));
}
afterEach(async()=>{
  if(root) await act(async()=>root.unmount());
  root=null;container?.remove();requests.clear();media.clear();failDecode=false;failOptional=false;decodedUrls=[];
  asciiFailure='';fetchedUrls=[];deferredFetch=null;
});

test('decoded images track the mouse and reset on pointer exit',async()=>{
  await mount();
  const portrait=container.querySelector('.portrait');
  assert.equal(portrait.dataset.ready,'true');
  move(1100,267);
  assert.equal(portrait.dataset.direction,'right');
  assert.match(container.querySelector('.portrait-head').src,/head-right.png$/);
  flushFrames();
  assert.ok(parseFloat(portrait.style.getPropertyValue('--head-x'))>0);
  act(()=>window.dispatchEvent(new window.PointerEvent('pointerout',{relatedTarget:null})));
  flushFrames();
  assert.equal(portrait.dataset.direction,'center');
  assert.equal(parseFloat(portrait.style.getPropertyValue('--head-x')),0);
});

test('reduced motion keeps gaze selection but suppresses all translation',async()=>{
  preference('(prefers-reduced-motion: reduce)',true);
  await mount();move(400,850);flushFrames();
  const portrait=container.querySelector('.portrait');
  assert.equal(portrait.dataset.direction,'down');
  assert.equal(parseFloat(portrait.style.getPropertyValue('--head-y')),0);
  assert.equal(parseFloat(portrait.style.getPropertyValue('--left-y')),0);
});

test('coarse pointers and touch gestures keep the neutral portrait',async()=>{
  preference('(any-hover: hover) and (any-pointer: fine)',false);
  await mount();move(1100,267);flushFrames();
  assert.equal(container.querySelector('.portrait').dataset.direction,'center');
  preference('(any-hover: hover) and (any-pointer: fine)',true);
  move(1100,267);assert.equal(container.querySelector('.portrait').dataset.direction,'right');
  move(200,267,'touch');assert.equal(container.querySelector('.portrait').dataset.direction,'center');
});

test('asset-load failure keeps a neutral image and gives a useful message',async()=>{
  failDecode=true;await mount({assetPath:'/custom'});move(1100,267);
  assert.equal(container.querySelector('.portrait').dataset.direction,'center');
  assert.match(container.querySelector('.portrait-head').src,/custom\/head-center.png$/);
  assert.match(container.textContent,/couldn’t load/);
});

test('blur returns to neutral and unmount releases animation and listeners',async()=>{
  await mount();move(200,267);
  assert.equal(container.querySelector('.portrait').dataset.direction,'left');
  act(()=>window.dispatchEvent(new window.Event('blur')));flushFrames();
  assert.equal(container.querySelector('.portrait').dataset.direction,'center');
  await act(async()=>root.unmount());root=null;
  assert.equal(requests.size,0);
  move(1100,267);assert.equal(requests.size,0);
});


test('hands repel independently, tilt, change pose, and reset on exit',async()=>{
  await mount();move(225,560);flushFrames();
  const portrait=container.querySelector('.portrait');
  const left=container.querySelector('.portrait-hand-left img'),right=container.querySelector('.portrait-hand-right img');
  assert.match(left.src,/hand-left-flex.png$/);assert.match(right.src,/hand-right.png$/);
  assert.ok(parseFloat(portrait.style.getPropertyValue('--left-x'))<0);
  assert.notEqual(portrait.style.getPropertyValue('--left-tilt'),portrait.style.getPropertyValue('--right-tilt'));
  act(()=>window.dispatchEvent(new window.PointerEvent('pointerout',{relatedTarget:null})));flushFrames();
  assert.match(left.src,/hand-left.png$/);
  for(const side of ['left','right']) for(const prop of ['x','y','tilt']) assert.equal(parseFloat(portrait.style.getPropertyValue(`--${side}-${prop}`)),0);
});

test('reduced motion resets hand poses and tilt immediately',async()=>{
  await mount();move(225,560);flushFrames();
  preference('(prefers-reduced-motion: reduce)',true);flushFrames();
  assert.match(container.querySelector('.portrait-hand-left img').src,/hand-left.png$/);
  assert.equal(parseFloat(container.querySelector('.portrait').style.getPropertyValue('--left-tilt')),0);
});

test('switching modes selects a complete head set and restores photographic frames',async()=>{
  await mount({headMode:'generated'});move(550,267);
  assert.match(container.querySelector('.portrait-head').src,/ai\/head-right.png$/);
  move(1100,267);assert.match(container.querySelector('.portrait-head').src,/sprites\/ai\/head-right.png$/);
  await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:'photos'})));
  move(550,267);assert.match(container.querySelector('.portrait-head').src,/sprites\/head-right.png$/);
});

test('AI loading failure never mixes photographic heads into the AI set',async()=>{
  failOptional=true;await mount({headMode:'generated'});move(550,267);
  assert.equal(container.querySelector('.portrait').dataset.ready,'false');
  assert.match(container.querySelector('.portrait-head').src,/sprites\/ai\/head-center.png$/);
  assert.match(container.textContent,/AI portrait set couldn’t load/);
  await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:'photos'})));
  move(550,267);
  assert.equal(container.querySelector('.portrait').dataset.ready,'true');
  assert.match(container.querySelector('.portrait-head').src,/sprites\/head-right.png$/);
});

test('every AI direction and neutral frame stays generated with matching generated hands',async()=>{
  await mount({headMode:'generated'});
  for(const [x,y,id] of [[1100,267,'right'],[1100,850,'lower-right'],[400,850,'down'],[0,850,'lower-left'],[0,267,'left'],[0,0,'upper-left'],[400,0,'up'],[800,0,'upper-right']]) {
    move(x,y);assert.match(container.querySelector('.portrait-head').src,new RegExp('/ai/head-'+id+'.png$'));
    for(const hand of container.querySelectorAll('.portrait-hand')) assert.match(hand.src,/\/ai\/hand-/);
  }
  act(()=>window.dispatchEvent(new window.PointerEvent('pointerout',{relatedTarget:null})));
  assert.match(container.querySelector('.portrait-head').src,/ai\/head-center.png$/);
});

test('hand pose toggle preserves motion and zero strength keeps all hands still',async()=>{
  await mount({animateHands:false});move(225,560);flushFrames();
  assert.match(container.querySelector('.portrait-hand-left img').src,/hand-left.png$/);
  assert.ok(parseFloat(container.querySelector('.portrait').style.getPropertyValue('--left-x'))<0);
  await act(async()=>root.render(React.createElement(FloatingPortrait,{motionStrength:0})));
  move(225,560);flushFrames();
  assert.equal(parseFloat(container.querySelector('.portrait').style.getPropertyValue('--left-x')),0);
  assert.match(container.querySelector('.portrait-hand-left img').src,/hand-left.png$/);
});


test('Photo only never downloads generated assets',async()=>{
  await mount();
  assert.ok(decodedUrls.length>=11);
  assert.ok(decodedUrls.every(url=>!url.includes('/ai/') && !url.includes('/oil/') && !url.includes('/experimental/')));
});


test('oil painting mode uses painted heads and both painted hand poses',async()=>{
  await mount({headMode:'oil'});
  const portrait=container.querySelector('.portrait');
  assert.equal(portrait.dataset.mode,'oil');
  assert.match(portrait.getAttribute('aria-label'),/oil-painted head and two oil-painted hands/);
  for(const [x,y,id] of [[1100,267,'right'],[1100,850,'lower-right'],[400,850,'down'],[0,850,'lower-left'],[0,267,'left'],[0,0,'upper-left'],[400,0,'up'],[800,0,'upper-right']]) {
    move(x,y);assert.match(container.querySelector('.portrait-head').src,new RegExp('/oil/head-'+id+'.png$'));
  }
  move(225,560);flushFrames();
  assert.match(container.querySelector('.portrait-hand-left img').src,/oil\/hand-left-flex.png$/);
  assert.match(container.querySelector('.portrait-hand-right img').src,/oil\/hand-right.png$/);
  assert.ok(parseFloat(portrait.style.getPropertyValue('--left-x'))<0);
  preference('(prefers-reduced-motion: reduce)',true);flushFrames();
  assert.match(container.querySelector('.portrait-hand-left img').src,/oil\/hand-left.png$/);
  assert.equal(parseFloat(portrait.style.getPropertyValue('--left-tilt')),0);
  act(()=>window.dispatchEvent(new window.PointerEvent('pointerout',{relatedTarget:null})));
  assert.match(container.querySelector('.portrait-head').src,/oil\/head-center.png$/);
  assert.ok(decodedUrls.every(url=>url.includes('/oil/')));
});

test('realistic AI hand gesture stays generated and switching to photos restores photographic hands',async()=>{
  await mount({headMode:'generated'});move(225,560);
  assert.match(container.querySelector('.portrait-hand-left img').src,/ai\/hand-left-flex.png$/);
  await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:'photos'})));
  move(225,560);
  assert.match(container.querySelector('.portrait-hand-left img').src,/sprites\/hand-left-flex.png$/);
});

test('oil loading failure is explicit and switching back to Photos recovers',async()=>{
  failOptional=true;await mount({headMode:'oil'});move(1100,267);
  assert.equal(container.querySelector('.portrait').dataset.ready,'false');
  assert.match(container.querySelector('.portrait-head').src,/oil\/head-center.png$/);
  assert.match(container.textContent,/oil painting set couldn’t load/);
  await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:'photos'})));
  move(1100,267);assert.equal(container.querySelector('.portrait').dataset.ready,'true');
  assert.match(container.querySelector('.portrait-head').src,/sprites\/head-right.png$/);
});

test('ASCII displays actual text for every gaze direction and matching hand gestures',async()=>{
  await mount({headMode:'ascii',assetPath:'/custom'});
  const portrait=container.querySelector('.portrait');
  assert.equal(portrait.dataset.ready,'true');
  assert.match(portrait.getAttribute('aria-label'),/ASCII head and two ASCII hands/);
  assert.equal(container.querySelectorAll('img').length,0);
  assert.equal(container.querySelectorAll('pre[aria-hidden="true"]').length,3);
  assert.deepEqual(fetchedUrls,['/custom/ascii/frames.json']);
  assert.deepEqual(decodedUrls,[]);
  for(const [x,y,id] of [[1100,267,'right'],[1100,850,'lower-right'],[400,850,'down'],[0,850,'lower-left'],[0,267,'left'],[0,0,'upper-left'],[400,0,'up'],[800,0,'upper-right']]) {
    move(x,y);
    assert.equal(container.querySelector('.portrait-head').textContent,asciiData.frames['head-'+id].lines.join('\n'));
  }
  move(225,560);flushFrames();
  assert.equal(container.querySelector('.portrait-hand-left pre').dataset.asciiFrame,'hand-left-flex');
  assert.equal(container.querySelector('.portrait-hand-right pre').dataset.asciiFrame,'hand-right');
  assert.ok(parseFloat(portrait.style.getPropertyValue('--left-x'))<0);
  assert.notEqual(parseFloat(portrait.style.getPropertyValue('--left-tilt')),0);
  preference('(prefers-reduced-motion: reduce)',true);flushFrames();
  assert.equal(container.querySelector('.portrait-hand-left pre').dataset.asciiFrame,'hand-left');
  assert.equal(parseFloat(portrait.style.getPropertyValue('--left-tilt')),0);
  act(()=>window.dispatchEvent(new window.PointerEvent('pointerout',{relatedTarget:null})));
  assert.equal(container.querySelector('.portrait-head').dataset.asciiFrame,'head-center');
  move(1100,267,'touch');
  assert.equal(container.querySelector('.portrait-head').dataset.asciiFrame,'head-center');
  await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:'photos'})));
  assert.equal(container.querySelectorAll('pre').length,0);
  assert.match(container.querySelector('.portrait-head').src,/sprites\/head-center.png$/);
});

test('ASCII load or incomplete-set errors stop interaction and allow photo recovery',async()=>{
  for(const failure of ['http','invalid']) {
    asciiFailure=failure;
    await mount({headMode:'ascii'});move(1100,267);
    assert.equal(container.querySelector('.portrait').dataset.ready,'false');
    assert.match(container.textContent,/ASCII set couldn’t load/);
    assert.equal(container.querySelector('.portrait-head').dataset.asciiFrame,'head-center');
    await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:'photos'})));
    move(1100,267);assert.equal(container.querySelector('.portrait').dataset.ready,'true');
    assert.match(container.querySelector('.portrait-head').src,/head-right.png$/);
    await act(async()=>root.unmount());root=null;container.remove();
  }
});

test('late ASCII responses cannot replace the active photographic portrait',async()=>{
  let finish, signal;
  deferredFetch=(_url,options)=>{signal=options.signal;return new Promise(resolve=>{finish=resolve;});};
  await mount({headMode:'ascii'});
  assert.equal(container.querySelector('.portrait').dataset.ready,'false');
  await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:'photos'})));
  assert.equal(signal.aborted,true);
  await act(async()=>finish({ok:true,json:async()=>asciiData}));
  move(1100,267);
  assert.equal(container.querySelector('.portrait').dataset.mode,'photos');
  assert.equal(container.querySelector('.portrait').dataset.ready,'true');
  assert.match(container.querySelector('.portrait-head').src,/head-right.png$/);
});

test('blue monotone keeps AI heads and gestures aligned and removes tint on mode change',async()=>{
  await mount({headMode:'blue'});
  const portrait=container.querySelector('.portrait');
  assert.equal(portrait.dataset.ready,'true');
  assert.match(portrait.getAttribute('aria-label'),/monotone AI-generated head/);
  assert.ok(portrait.style.getPropertyValue('--portrait-tone').includes(container.querySelector('filter').id));
  for(const [x,y,id] of [[1100,267,'right'],[1100,850,'lower-right'],[400,850,'down'],[0,850,'lower-left'],[0,267,'left'],[0,0,'upper-left'],[400,0,'up'],[800,0,'upper-right']]) {
    move(x,y);assert.match(container.querySelector('.portrait-head').src,new RegExp('/ai/head-'+id+'.png$'));
    for(const hand of container.querySelectorAll('.portrait-hand')) assert.match(hand.src,/\/ai\/hand-/);
  }
  move(225,560);flushFrames();
  assert.match(container.querySelector('.portrait-hand-left img').src,/ai\/hand-left-flex.png$/);
  assert.ok(parseFloat(portrait.style.getPropertyValue('--left-x'))<0);
  preference('(prefers-reduced-motion: reduce)',true);flushFrames();
  assert.match(container.querySelector('.portrait-hand-left img').src,/ai\/hand-left.png$/);
  assert.equal(parseFloat(portrait.style.getPropertyValue('--left-tilt')),0);
  act(()=>window.dispatchEvent(new window.PointerEvent('pointerout',{relatedTarget:null})));
  assert.match(container.querySelector('.portrait-head').src,/ai\/head-center.png$/);
  assert.ok(decodedUrls.every(url=>url.includes('/ai/')));
  await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:'generated'})));
  assert.equal(container.querySelector('filter'),null);
  assert.equal(portrait.style.getPropertyValue('--portrait-tone'),'none');
  assert.match(container.querySelector('.portrait-head').src,/ai\/head-center.png$/);
});

test('blue instances have independent filters with exact tint and unchanged alpha',async()=>{
  await mount({headMode:'blue'});
  await act(async()=>root.render(React.createElement(React.Fragment,null,
    React.createElement(FloatingPortrait,{headMode:'blue'}),
    React.createElement(FloatingPortrait,{headMode:'blue'}))));
  const filters=[...container.querySelectorAll('filter')];
  assert.equal(new Set(filters.map(f=>f.id)).size,2);
  for(const filter of filters) {
    assert.equal(filter.getAttribute('color-interpolation-filters'),'sRGB');
    const channels=['feFuncR','feFuncG','feFuncB'].map(tag=>
      Number(filter.querySelector(tag).getAttribute('tableValues').split(' ')[1]));
    assert.deepEqual(channels.map(value=>Math.round(value*255)),[59,158,200]);
    assert.equal(filter.querySelector('feFuncA').getAttribute('type'),'identity');
  }
});

function toneColors() {
  const tables=['feFuncR','feFuncG','feFuncB'].map(tag=>container.querySelector(tag).getAttribute('tableValues').split(' ').map(Number));
  return tables[0].map((_,index)=>tables.map(channel=>Math.round(channel[index]*255)));
}

test('duotone uses the plum/blue endpoints for all AI directions and hand poses',async()=>{
  await mount({headMode:'duotone'});
  assert.deepEqual(toneColors(),[[77,0,56],[59,158,200]]);
  assert.equal(container.querySelector('feFuncA').getAttribute('type'),'identity');
  for(const [x,y,id] of [[1100,267,'right'],[1100,850,'lower-right'],[400,850,'down'],[0,850,'lower-left'],[0,267,'left'],[0,0,'upper-left'],[400,0,'up'],[800,0,'upper-right']]) {
    move(x,y);assert.match(container.querySelector('.portrait-head').src,new RegExp('/ai/head-'+id+'.png$'));
  }
  move(225,560);flushFrames();
  assert.match(container.querySelector('.portrait-hand-left img').src,/ai\/hand-left-flex.png$/);
  assert.ok(parseFloat(container.querySelector('.portrait').style.getPropertyValue('--left-x'))<0);
  preference('(prefers-reduced-motion: reduce)',true);flushFrames();
  assert.match(container.querySelector('.portrait-hand-left img').src,/ai\/hand-left.png$/);
  assert.equal(parseFloat(container.querySelector('.portrait').style.getPropertyValue('--left-tilt')),0);
  act(()=>window.dispatchEvent(new window.PointerEvent('pointerout',{relatedTarget:null})));
  assert.match(container.querySelector('.portrait-head').src,/ai\/head-center.png$/);
  assert.ok(decodedUrls.every(url=>url.includes('/ai/')));
});

test('color edits preserve the active pose and loaded assets; malformed props fall back safely',async()=>{
  await mount({headMode:'monotone'});move(1100,267);
  const requestsBefore=decodedUrls.length;
  await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:'monotone',monotoneColor:'#ff8800'})));
  assert.deepEqual(toneColors(),[[0,0,0],[255,136,0],[255,255,255]]);
  assert.equal(container.querySelector('.portrait').dataset.direction,'right');
  assert.equal(decodedUrls.length,requestsBefore);
  await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:'monotone',monotoneColor:'invalid'})));
  assert.deepEqual(toneColors()[1],[59,158,200]);
  await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:'duotone',duotoneShadow:'#123456',duotoneHighlight:'abcdef'})));
  assert.deepEqual(toneColors(),[[18,52,86],[171,205,239]]);
  await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:'duotone',duotoneShadow:'',duotoneHighlight:'nope'})));
  assert.deepEqual(toneColors(),[[77,0,56],[59,158,200]]);
});

test('color controls edit hex and picker values, reject invalid input, swap, reset, and retain independent palettes',async()=>{
  // eslint-disable-next-line react/prop-types -- Local test harness with fixed test inputs.
  function Editor({mode}) {
    const [mono,onMonotone]=React.useState('#3B9EC8');
    const [shadow,onShadow]=React.useState('#4D0038');
    const [highlight,onHighlight]=React.useState('#3B9EC8');
    return React.createElement(React.Fragment,null,
      React.createElement(ToneControls,{key:mode,mode,monotone:mono,shadow,highlight,onMonotone,onShadow,onHighlight}),
      React.createElement(FloatingPortrait,{headMode:mode,monotoneColor:mono,duotoneShadow:shadow,duotoneHighlight:highlight}));
  }
  await mount();
  await act(async()=>root.render(React.createElement(Editor,{mode:'monotone'})));
  function input(label,value) {
    const field=container.querySelector(`input[aria-label="${label}"]`);
    act(()=>{
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(field,value);
      field.dispatchEvent(new window.Event('input',{bubbles:true}));
      field.dispatchEvent(new window.Event('change',{bubbles:true}));
    });
    return field;
  }
  const button=label=>[...container.querySelectorAll('button')].find(node=>node.textContent===label);
  input('Midtones hex','#CC8844');
  assert.deepEqual(toneColors()[1],[204,136,68]);
  const invalid=input('Midtones hex','#oops');
  assert.equal(invalid.getAttribute('aria-invalid'),'true');
  assert.deepEqual(toneColors()[1],[204,136,68]);
  act(()=>invalid.dispatchEvent(new window.FocusEvent('focusout',{bubbles:true})));
  assert.equal(invalid.value,'#CC8844');
  await act(async()=>root.render(React.createElement(Editor,{mode:'duotone'})));
  input('Shadows color','#112233');
  assert.deepEqual(toneColors()[0],[17,34,51]);
  act(()=>button('Swap colors').click());
  assert.deepEqual(toneColors(),[[59,158,200],[17,34,51]]);
  await act(async()=>root.render(React.createElement(Editor,{mode:'monotone'})));
  assert.deepEqual(toneColors()[1],[204,136,68]);
  act(()=>button('Reset colors').click());
  assert.deepEqual(toneColors()[1],[59,158,200]);
  await act(async()=>root.render(React.createElement(Editor,{mode:'duotone'})));
  assert.deepEqual(toneColors(),[[59,158,200],[17,34,51]]);
  act(()=>button('Reset colors').click());
  assert.deepEqual(toneColors(),[[77,0,56],[59,158,200]]);
});

test('watercolor keeps all directions and both hand poses painted, with the existing movement',async()=>{
  await mount({headMode:'watercolor'});
  const portrait=container.querySelector('.portrait');
  assert.equal(portrait.dataset.ready,'true');
  assert.match(portrait.getAttribute('aria-label'),/watercolor head and two watercolor hands/);
  assert.equal(container.querySelector('filter'),null);
  for(const [x,y,id] of [[1100,267,'right'],[1100,850,'lower-right'],[400,850,'down'],[0,850,'lower-left'],[0,267,'left'],[0,0,'upper-left'],[400,0,'up'],[800,0,'upper-right']]) {
    move(x,y);assert.match(container.querySelector('.portrait-head').src,new RegExp('/watercolor/head-'+id+'.png$'));
  }
  move(225,560);flushFrames();
  assert.match(container.querySelector('.portrait-hand-left img').src,/watercolor\/hand-left-flex.png$/);
  assert.match(container.querySelector('.portrait-hand-right img').src,/watercolor\/hand-right.png$/);
  assert.ok(parseFloat(portrait.style.getPropertyValue('--left-x'))<0);
  preference('(prefers-reduced-motion: reduce)',true);flushFrames();
  assert.match(container.querySelector('.portrait-hand-left img').src,/watercolor\/hand-left.png$/);
  assert.equal(parseFloat(portrait.style.getPropertyValue('--left-tilt')),0);
  act(()=>window.dispatchEvent(new window.PointerEvent('pointerout',{relatedTarget:null})));
  assert.match(container.querySelector('.portrait-head').src,/watercolor\/head-center.png$/);
  assert.ok(decodedUrls.every(url=>url.includes('/watercolor/')));
});

test('watercolor loading failure recovers when switching to Photo only',async()=>{
  failOptional=true;await mount({headMode:'watercolor'});move(1100,267);
  assert.equal(container.querySelector('.portrait').dataset.ready,'false');
  assert.match(container.textContent,/watercolor set couldn’t load/);
  await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:'photos'})));
  assert.equal(container.querySelector('.portrait').dataset.ready,'true');
  assert.match(container.querySelector('.portrait-head').src,/sprites\/head-center.png$/);
});

test('pencil keeps all directions and both hand poses sketched, with the existing movement',async()=>{
  await mount({headMode:'pencil'});
  const portrait=container.querySelector('.portrait');
  assert.equal(portrait.dataset.ready,'true');
  assert.match(portrait.getAttribute('aria-label'),/pencil-sketched head and two pencil-sketched hands/);
  assert.equal(container.querySelector('filter'),null);
  for(const [x,y,id] of [[1100,267,'right'],[1100,850,'lower-right'],[400,850,'down'],[0,850,'lower-left'],[0,267,'left'],[0,0,'upper-left'],[400,0,'up'],[800,0,'upper-right']]) {
    move(x,y);assert.match(container.querySelector('.portrait-head').src,new RegExp('/pencil/head-'+id+'.png$'));
  }
  move(225,560);flushFrames();
  assert.match(container.querySelector('.portrait-hand-left img').src,/pencil\/hand-left-flex.png$/);
  assert.match(container.querySelector('.portrait-hand-right img').src,/pencil\/hand-right.png$/);
  assert.ok(parseFloat(portrait.style.getPropertyValue('--left-x'))<0);
  preference('(prefers-reduced-motion: reduce)',true);flushFrames();
  assert.match(container.querySelector('.portrait-hand-left img').src,/pencil\/hand-left.png$/);
  assert.equal(parseFloat(portrait.style.getPropertyValue('--left-tilt')),0);
  act(()=>window.dispatchEvent(new window.PointerEvent('pointerout',{relatedTarget:null})));
  assert.match(container.querySelector('.portrait-head').src,/pencil\/head-center.png$/);
  assert.ok(decodedUrls.every(url=>url.includes('/pencil/')));
});

test('pencil loading failure recovers when switching to Photo only',async()=>{
  failOptional=true;await mount({headMode:'pencil'});move(1100,267);
  assert.equal(container.querySelector('.portrait').dataset.ready,'false');
  assert.match(container.textContent,/pencil sketch set couldn’t load/);
  await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:'photos'})));
  assert.equal(container.querySelector('.portrait').dataset.ready,'true');
  assert.match(container.querySelector('.portrait-head').src,/sprites\/head-center.png$/);
});


test('new video heads keep all directions and original photo hand gestures',async()=>{
  await mount({headAssetPath:'/sprites/now/'});
  assert.equal(container.querySelector('.portrait').dataset.ready,'true');
  for(const [x,y,id] of [[1100,267,'right'],[1100,850,'lower-right'],[400,850,'down'],[0,850,'lower-left'],[0,267,'left'],[0,0,'upper-left'],[400,0,'up'],[800,0,'upper-right']]) {
    move(x,y);assert.match(container.querySelector('.portrait-head').src,new RegExp('/now/head-'+id+'.png$'));
  }
  move(225,560);flushFrames();
  assert.match(container.querySelector('.portrait-hand-left img').src,/sprites\/hand-left-flex.png$/);
  assert.ok(!decodedUrls.some(url=>url.includes('/now/hand-')));
  assert.ok(!decodedUrls.some(url=>url.includes('/ai/')));
  preference('(prefers-reduced-motion: reduce)',true);flushFrames();
  assert.equal(parseFloat(container.querySelector('.portrait').style.getPropertyValue('--left-tilt')),0);
  act(()=>window.dispatchEvent(new window.PointerEvent('pointerout',{relatedTarget:null})));
  assert.match(container.querySelector('.portrait-head').src,/now\/head-center.png$/);
});

test('new head loading failure can recover by returning to original heads',async()=>{
  failOptional=true;await mount({headAssetPath:'/sprites/now'});
  assert.match(container.textContent,/new video cutouts couldn’t load/);
  await act(async()=>root.render(React.createElement(FloatingPortrait)));
  assert.equal(container.querySelector('.portrait').dataset.ready,'true');
  move(1100,267);assert.match(container.querySelector('.portrait-head').src,/sprites\/head-right.png$/);
});

test('Then and Now tabs retain all styles, support keyboard navigation, and remember the comparison choice',async()=>{
  await mount();await act(async()=>root.render(React.createElement(Home)));
  const tab=id=>container.querySelector('#reference-'+id);
  const button=text=>[...container.querySelectorAll('button')].find(b=>b.textContent===text);
  assert.equal(tab('now').getAttribute('aria-selected'),'true');
  assert.match(container.querySelector('.portrait-head').src,/now\/pencil\/head-center.png$/);
  for(const text of ['Video cutout','Pencil sketch','Watercolor']) assert.ok(button(text));
  await act(async()=>button('Watercolor').click());
  assert.match(container.querySelector('.portrait-head').src,/now\/watercolor\/head-center.png$/);
  assert.match(container.querySelector('.portrait-hand-left img').src,/sprites\/watercolor\/hand-left.png$/);
  await act(async()=>tab('then').click());
  for(const text of ['Photo only','AI simulated','Monotone','Duotone','Oil painting','Watercolor','Pencil sketch','ASCII']) assert.ok(button(text));
  await act(async()=>button('Pencil sketch').click());
  assert.match(container.querySelector('.portrait-head').src,/pencil\/head-center.png$/);
  await act(async()=>tab('then').dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
  assert.equal(document.activeElement,tab('now'));
  assert.equal(tab('now').tabIndex,0);assert.equal(tab('then').tabIndex,-1);
  assert.equal(container.querySelector('#panel-then').hidden,true);
  assert.match(container.querySelector('.portrait-head').src,/now\/watercolor\/head-center.png$/);
  assert.equal(container.querySelector('filter'),null);
  await act(async()=>tab('now').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Home',bubbles:true})));
  assert.equal(document.activeElement,tab('then'));
  assert.equal(button('Pencil sketch').getAttribute('aria-pressed'),'true');
  assert.match(container.querySelector('.portrait-head').src,/pencil\/head-center.png$/);
  await act(async()=>tab('then').dispatchEvent(new window.KeyboardEvent('keydown',{key:'End',bubbles:true})));
  assert.equal(tab('now').getAttribute('aria-selected'),'true');
  assert.equal(button('Watercolor').getAttribute('aria-pressed'),'true');
  await act(async()=>button('Video cutout').click());
  assert.match(container.querySelector('.portrait-head').src,/now\/head-center.png$/);
  assert.match(container.querySelector('.portrait-hand-left img').src,/sprites\/hand-left.png$/);
});


for(const mode of ['pencil','watercolor']) {
  test(`new ${mode} heads use their own angles and matching generated hands`,async()=>{
    await mount({headMode:mode,headAssetPath:`/sprites/now/${mode}/`});
    assert.equal(container.querySelector('.portrait').dataset.ready,'true');
    for(const [x,y,id] of [[1100,267,'right'],[1100,850,'lower-right'],[400,850,'down'],[0,850,'lower-left'],[0,267,'left'],[0,0,'upper-left'],[400,0,'up'],[800,0,'upper-right']]) {
      move(x,y);assert.match(container.querySelector('.portrait-head').src,new RegExp('/now/'+mode+'/head-'+id+'.png$'));
    }
    move(225,560);flushFrames();
    assert.match(container.querySelector('.portrait-hand-left img').src,new RegExp('/sprites/'+mode+'/hand-left-flex.png$'));
    assert.ok(!decodedUrls.some(url=>url.includes('/now/'+mode+'/hand-')));
    assert.ok(!decodedUrls.some(url=>url.includes('/sprites/'+mode+'/head-')));
    assert.ok(parseFloat(container.querySelector('.portrait').style.getPropertyValue('--left-x'))<0);
    preference('(prefers-reduced-motion: reduce)',true);flushFrames();
    assert.equal(parseFloat(container.querySelector('.portrait').style.getPropertyValue('--left-tilt')),0);
    act(()=>window.dispatchEvent(new window.PointerEvent('pointerout',{relatedTarget:null})));
    assert.match(container.querySelector('.portrait-head').src,new RegExp('/now/'+mode+'/head-center.png$'));
    await act(async()=>root.render(React.createElement(FloatingPortrait,{headMode:mode})));
    assert.match(container.querySelector('.portrait-head').src,new RegExp('/sprites/'+mode+'/head-center.png$'));
  });
  test(`new ${mode} load failure is explicit and returning to video recovers`,async()=>{
    failOptional=true;await mount({headMode:mode,headAssetPath:`/sprites/now/${mode}`});
    assert.match(container.textContent,/new styled portrait couldn’t load/);
    failOptional=false;
    await act(async()=>root.render(React.createElement(FloatingPortrait,{headAssetPath:'/sprites/now'})));
    assert.equal(container.querySelector('.portrait').dataset.ready,'true');
    assert.match(container.querySelector('.portrait-head').src,/now\/head-center.png$/);
  });
}
