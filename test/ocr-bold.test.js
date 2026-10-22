const test=require('node:test');
const assert=require('node:assert/strict');
const {classifyBoldRows}=require('../ocr-table');

test('linhas com traços de negrito viram passivas e as demais ficam ativas',()=>{
  const scores=[.176,.167,.178,.098,.134,.129,.130,.141,.099];
  const result=classifyBoldRows(scores.map((boldScore,index)=>({name:`Habilidade ${index+1}`,boldScore})));
  assert.deepEqual(result.map(item=>item.type),['passive','passive','passive','active','active','active','active','active','active']);
});

test('linhas sem contraste suficiente não são marcadas como passivas',()=>{
  const result=classifyBoldRows([{boldScore:.132},{boldScore:.138},{boldScore:.141}]);
  assert.deepEqual(result.map(item=>item.type),['active','active','active']);
});
