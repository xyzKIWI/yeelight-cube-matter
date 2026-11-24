import assert from 'node:assert/strict';
import {renderer} from '../matter/cube_lib.mjs';
import {clockCanvas,clockPixelAccent} from '../matter/clock_colors.mjs';
const now=new Date('2026-01-01T14:22:00Z');
for(const orient of ['up','left','right','down'])for(const font of ['classic','compact']) {
 const r=renderer(orient,font);
 for(const effect of ['fixed','pulse','sparkle']) {
  for(const colors of [{color:'',color2:''},{color:'#00e0ff',color2:'#ff40a0'}]) {
   const canvas=clockCanvas(r,{...colors,colorFx:effect},now);
   const actual=canvas.flat().map(p=>clockPixelAccent(p,effect,0,false));
   const lit=new Set(actual.filter(p=>p.some(Boolean)).map(String));
   assert.equal(lit.size,2,`${orient}/${font}/${effect} must retain both colors`);
   assert.equal(r.encode(canvas).length,400);
  }
 }
 const mask=clockCanvas(r,{color:'#00e0ff',color2:'#ff40a0',colorFx:'flow'},now);
 assert.deepEqual([...new Set(mask.flat().filter(p=>p.some(Boolean)).map(String))],['255,255,255']);
}
assert.deepEqual(clockPixelAccent([0,0,0],'sparkle',0,true),[0,0,0]);
assert.deepEqual(clockPixelAccent([0,100,200],'sparkle',0,true),[255,255,255]);
console.log('四方向、兩字型的固定／呼吸／閃亮皆保留雙色；彩虹遮罩與黑底正確');
