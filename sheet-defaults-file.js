const FORMAT='rpg-ficha-padrao';
function normalizeSheetDefaults(value){
 if(value?.format!==FORMAT||value.version!==1)throw new Error('Arquivo de ficha padrão inválido.');
 const attributes=Number(value.attributes),newSkills=Number(value.newSkills),gods=value.gods;
 if(!Number.isSafeInteger(attributes)||attributes<0||attributes>1000||!Number.isSafeInteger(newSkills)||newSkills<0||newSkills>1000)throw new Error('Pontos iniciais inválidos.');
 if(!gods||typeof gods!=='object'||Array.isArray(gods))throw new Error('Relação com os deuses inválida.');
 const entries=Object.entries(gods).map(([name,amount])=>[name.trim(),Number(amount)]);
 if(entries.length>100||entries.some(([name,amount])=>!name||name.length>80||!Number.isFinite(amount))||new Set(entries.map(([name])=>name.toLocaleLowerCase('pt-BR'))).size!==entries.length)throw new Error('Divindades inválidas ou repetidas.');
 return {attributes,newSkills,gods:Object.fromEntries(entries)};
}
function makeSheetDefaultsFile(defaults){return {format:FORMAT,version:1,...normalizeSheetDefaults({format:FORMAT,version:1,...defaults})}}
module.exports={normalizeSheetDefaults,makeSheetDefaultsFile};
