import assert from 'node:assert/strict';
import {PIXEL_FACES,FACE_CATALOG,faceImage} from '../matter/pixel_faces.mjs';
import {renderer,TEXT_SHORTCUTS,TEXT_FACE_GROUPS} from '../matter/cube_lib.mjs';
import {sceneSettings} from '../matter/scenes_store.mjs';
assert.equal(FACE_CATALOG.length,5);
for(const face of FACE_CATALOG){assert.equal(face.thumbnail.pixels.length,25);assert.equal(face.thumbnail.w,5);}
for(const orient of ['up','down','left','right']) {
 const r=renderer(orient),seen=new Set();
 for(const id of Object.keys(PIXEL_FACES)) {
  const image=faceImage(id,orient);assert.equal(image.pixels.length,100);
  assert.ok(image.pixels.every(c=>/^#[0-9a-f]{6}$/.test(c)));
  assert.ok(image.pixels.some(c=>c!=='#000000'));
  assert.equal(image.w,r.LW);assert.equal(image.h,r.LH);
  assert.equal(r.encode(r.picture(image)).length,400);
  seen.add(JSON.stringify(image.pixels));
  if(!r.wide)for(let block=1;block<4;block++)assert.deepEqual(image.pixels.slice(block*25,(block+1)*25),image.pixels.slice(0,25));
 }
 assert.equal(seen.size,5);
}
assert.throws(()=>faceImage('missing'));assert.throws(()=>faceImage('__proto__'));assert.throws(()=>faceImage('cat','bad'));
assert.deepEqual(sceneSettings({mode:'face',face:'cry',schedule:{},rest:{}}),{mode:'face',face:'cry'});
const count=Object.entries(TEXT_SHORTCUTS).filter(([g])=>!TEXT_FACE_GROUPS.includes(g)).reduce((n,[,a])=>n+a.length,0);
assert.equal(count,46);
console.log('46 個符號、五款表情四方向、縮圖、400 bytes 編碼與收藏表情 id 通過');
