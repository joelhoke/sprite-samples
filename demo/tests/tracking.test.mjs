import assert from "node:assert/strict";
import test from "node:test";
import { selectDirection, normalizedPointer, motionTarget, smoothPoint, trackingState } from "../components/tracking.ts";

test("gaze follows all eight viewer-relative directions", () => {
  for (const [x,y,expected] of [
    [1,0,"right"],[1,1,"lower-right"],[0,1,"down"],[-1,1,"lower-left"],
    [-1,0,"left"],[-1,-1,"upper-left"],[0,-1,"up"],[1,-1,"upper-right"],
  ]) assert.equal(selectDirection(x,y),expected);
});

test("neutral zone uses separate entry and exit thresholds", () => {
  assert.equal(selectDirection(0.17,0,"center"),"center");
  assert.equal(selectDirection(0.17,0,"right"),"right");
  assert.equal(selectDirection(0.13,0,"right"),"center");
  assert.equal(selectDirection(0.2,0,"center"),"right");
});

test("sector boundaries hold the previous image until cursor clears hysteresis", () => {
  const at = (degrees,previous) => selectDirection(Math.cos(degrees*Math.PI/180), Math.sin(degrees*Math.PI/180),previous);
  assert.equal(at(24,"right"),"right");
  assert.equal(at(31,"right"),"lower-right");
  assert.equal(at(21,"lower-right"),"lower-right");
  assert.equal(at(14,"lower-right"),"right");
  assert.equal(at(359,"right"),"right");
});

test("pointer exit and touch-only input reset to the neutral pose", () => {
  assert.deepEqual(trackingState(null,"left",true),{direction:"center",pointer:{x:0,y:0}});
  assert.equal(trackingState({x:1,y:1},"up",false).direction,"center");
});

test("movement stays within head/hand limits, including diagonal motion", () => {
  for(const limit of [4,6]) {
    const point=motionTarget({x:1,y:1},limit,1,false);
    assert.ok(Math.hypot(point.x,point.y)<=limit+1e-10);
    assert.deepEqual(motionTarget({x:1,y:1},limit,1,true),{x:0,y:0});
    assert.deepEqual(motionTarget({x:1,y:1},limit,0,false),{x:0,y:0});
  }
});

test("normalization handles resized viewports and clamps distant cursors", () => {
  assert.deepEqual(normalizedPointer({x:5000,y:-5000},{x:100,y:100},{x:300,y:600}),{x:1,y:-1});
  assert.deepEqual(normalizedPointer({x:100,y:100},{x:100,y:100},{x:0,y:0}),{x:0,y:0});
  assert.equal(selectDirection(NaN,0),"center");
});

test("smoothing approaches its target without overshoot at different frame rates", () => {
  let slow={x:0,y:0}, fast={x:0,y:0};
  for(let i=0;i<30;i++) slow=smoothPoint(slow,{x:6,y:-4},1000/30);
  for(let i=0;i<120;i++) fast=smoothPoint(fast,{x:6,y:-4},1000/120);
  assert.ok(Math.abs(slow.x-fast.x)<1e-8);
  assert.ok(slow.x<6 && slow.y>-4);
});

const {selectHeadFrame,handTarget,handFlex}=await import('../components/tracking.ts');
test('generated distance bands have hysteresis and never alter diagonal photos',()=>{
  assert.equal(selectHeadFrame({x:.3,y:0},'right','center',true),'inner-right');
  assert.equal(selectHeadFrame({x:.55,y:0},'right','inner-right',true),'inner-right');
  assert.equal(selectHeadFrame({x:.59,y:0},'right','inner-right',true),'right');
  assert.equal(selectHeadFrame({x:.5,y:0},'right','right',true),'right');
  assert.equal(selectHeadFrame({x:.3,y:0},'right','inner-right',false),'right');
  assert.equal(selectHeadFrame({x:.3,y:.3},'lower-right','inner-right',true),'lower-right');
});
test('hand repulsion points away, has finite center behavior, and respects limits',()=>{
  const center={x:100,y:100},gaze={x:1,y:1};
  for(let x=0;x<210;x+=10) for(let y=0;y<210;y+=10) {
    const hand=handTarget({x,y},center,gaze,140,-1,1,false);
    assert.ok(Math.hypot(hand.x,hand.y)<=12+1e-9);
    assert.ok(Math.abs(hand.tilt)<=7);
  }
  assert.ok(handTarget({x:110,y:100},center,{x:0,y:0},140,-1,1,false).x<0);
  assert.deepEqual(handTarget(center,center,gaze,140,-1,1,true),{x:0,y:0,tilt:0});
  assert.deepEqual(handTarget(null,center,gaze,140,-1,1,false),{x:0,y:0,tilt:0});
  assert.equal(handFlex({x:70,y:0},{x:0,y:0},100,false,true),false);
  assert.equal(handFlex({x:70,y:0},{x:0,y:0},100,true,true),true);
  assert.equal(handFlex({x:81,y:0},{x:0,y:0},100,true,true),false);
});
