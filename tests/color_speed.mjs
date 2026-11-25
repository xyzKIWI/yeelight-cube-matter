import assert from 'node:assert/strict';
import {colorPhase,normalizeColorSpeed,DEFAULT_COLOR_SPEED} from '../matter/color_speed.mjs';
import {renderer,TEXT_SHORTCUTS,TEXT_FACE_GROUPS,COMPACT_FONT} from '../matter/cube_lib.mjs';
assert.equal(normalizeColorSpeed(),DEFAULT_COLOR_SPEED);
assert.equal(normalizeColorSpeed(0),.1);assert.equal(normalizeColorSpeed(100),1.5);
assert.throws(()=>normalizeColorSpeed('invalid'));
assert.equal(colorPhase(10,.15),1.5);assert.equal(colorPhase(10,1),10);
for(const key of TEXT_FACE_GROUPS)for(const face of TEXT_SHORTCUTS[key]){
 assert.ok([...face].length<=4,face);
 for(const orient of ['up','left','right','down'])for(const font of ['classic','compact']){
  const pages=renderer(orient,font).staticPages(face,[255,255,255]);assert.equal(pages.length,1,face);
 }
}
for(const font of [COMPACT_FONT])for(const ch of Object.values(TEXT_SHORTCUTS).flat().join(''))assert.ok(font[ch],ch);
console.log('顏色速度範圍、慢速相位、22 組表情與所有方向單頁顯示通過');
