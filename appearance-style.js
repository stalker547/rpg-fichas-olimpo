const colorKeys=['bg','bg2','panel','panel2','sidebar','input','line','accent','accent2','text','muted','gold','danger','toast','toastError','dirtyBar','notification'];
const angles=new Set(['45deg','90deg','135deg','180deg']);

function validateStyle(source){
 const input=source?.appearance||source;
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Arquivo de estilo inválido.');
 const appearance={};
 for(const key of colorKeys){
  const color=input[key];
  if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))throw new Error(`Cor inválida no estilo: ${key}.`);
  appearance[key]=color.toUpperCase();
 }
 if(typeof input.gradientEnabled!=='boolean'||!angles.has(input.gradientAngle))throw new Error('Degradê inválido no estilo.');
 appearance.gradientEnabled=input.gradientEnabled;
 appearance.gradientAngle=input.gradientAngle;
 return appearance;
}

function exportStyle(appearance,name='Meu estilo'){
 return JSON.stringify({format:'rpg-fichas-style',version:1,name:String(name).slice(0,60),appearance:validateStyle(appearance)},null,2);
}

function importStyle(contents){
 if(Buffer.byteLength(contents,'utf8')>32768)throw new Error('Arquivo de estilo grande demais.');
 let file;try{file=JSON.parse(contents)}catch{throw new Error('Este arquivo não é um JSON válido.')}
 if(file?.format!=='rpg-fichas-style'||file.version!==1)throw new Error('Este arquivo não é um estilo do RPG Fichas.');
 return {name:String(file.name||'Estilo importado').slice(0,60),appearance:validateStyle(file.appearance)};
}

module.exports={colorKeys,exportStyle,importStyle};
