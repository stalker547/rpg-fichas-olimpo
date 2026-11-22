(function(root){
 const categories=new Set(['Divino','Lendário','Raro','Incomum','Comum']);
 const clean=(value,max)=>String(value||'').trim().slice(0,max);
 function parse(text){
  const source=JSON.parse(text);
  if(source?.format!=='rpg-receptaculos'||source?.version!==1||!Array.isArray(source.folders))throw new Error('Arquivo de receptáculos inválido.');
  if(source.folders.length>50)throw new Error('O arquivo tem pastas demais.');
  const folders=source.folders.map(folder=>{
   const category=clean(folder.category,40),name=clean(folder.name,80);
   if(!categories.has(category)||!name||!Array.isArray(folder.models)||folder.models.length>200)throw new Error('Pasta ou categoria inválida no arquivo.');
   const models=folder.models.map(model=>{
    const modelName=clean(model.name,80);
    if(!modelName||!Array.isArray(model.effects)||model.effects.length<1||model.effects.length>2)throw new Error('Modelo inválido no arquivo.');
    const effects=model.effects.map(effect=>{
     const targetType=effect.type,attribute=clean(effect.target,80),bonus=Number(effect.bonus);
     if(!['attribute','god'].includes(targetType)||!attribute||!Number.isInteger(bonus)||bonus< -100||bonus>100)throw new Error('Efeito inválido no arquivo.');
     return {attribute,targetType,bonus};
    });
    return {name:modelName,effects};
   });
   return {category,name,models};
  });
  return folders;
 }
 function merge(catalog,folders,defaults,makeId){
  const next={...catalog,folders:[...(catalog.folders||[])],items:[...(catalog.items||[])]};
  let addedFolders=0,addedModels=0,skippedModels=0;
  const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  for(const folder of folders){
   const builtin=defaults.find(item=>item.parent===folder.category&&key(item.title)===key(folder.name));
   let targetId=builtin?.id;
   if(!targetId){let custom=next.folders.find(item=>item.parent===folder.category&&key(item.name)===key(folder.name));if(!custom){custom={id:makeId(),parent:folder.category,name:folder.name};next.folders.push(custom);addedFolders++}targetId=custom.id}
   const names=new Set([...(builtin?.items||[]).map(item=>key(item.name)),...next.items.filter(item=>item.folderId===targetId).map(item=>key(item.name))]);
   for(const model of folder.models){if(names.has(key(model.name))){skippedModels++;continue}names.add(key(model.name));next.items.push({id:makeId(),folderId:targetId,name:model.name,effects:model.effects});addedModels++}
  }
  return {catalog:next,addedFolders,addedModels,skippedModels};
 }
 function exportCatalog(groups){
  const folders=groups.filter(group=>Array.isArray(group.items)&&group.items.length).map(group=>({
   category:categories.has(group.parent)?group.parent:group.id==='god-rare'?'Raro':'Divino',
   name:String(group.title||'Receptáculos'),
   models:group.items.map(item=>({name:item.name,effects:(item.effects||[]).map(effect=>({type:effect.targetType,target:effect.attribute,bonus:Number(effect.bonus)||0}))}))
  }));
  const data={format:'rpg-receptaculos',version:1,folders};parse(JSON.stringify(data));return data;
 }
 const api={parse,merge,exportCatalog};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ReceptacleImport=api;
})(typeof window!=='undefined'?window:globalThis);
