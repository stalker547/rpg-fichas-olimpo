const test=require('node:test');
const assert=require('node:assert/strict');
const {colorKeys,exportStyle,importStyle}=require('../appearance-style');

const appearance=Object.fromEntries(colorKeys.map((key,index)=>[key,index%2?'#123ABC':'#0B152A']));
appearance.gradientEnabled=true;
appearance.gradientAngle='135deg';

test('exported appearance colors can be imported without account data or image paths',()=>{
 const json=exportStyle({...appearance,backgroundPath:'C:/private/photo.png',presets:[{name:'Secret'}]},'Solo Leveling');
 assert.equal(json.includes('private'),false);
 assert.equal(json.includes('Secret'),false);
 assert.deepEqual(importStyle(json),{name:'Solo Leveling',appearance});
});

test('invalid appearance files are rejected',()=>{
 assert.throws(()=>importStyle('{"format":"rpg-fichas-style","version":1,"appearance":{"bg":"red"}}'),/inválida|inválido/);
 assert.throws(()=>importStyle('{"format":"other","version":1}'),/não é um estilo/);
});
