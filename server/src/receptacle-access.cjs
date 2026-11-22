function playerMaySaveReceptacles(before,after,catalog,{consume=false}={}){
 const previous=Array.isArray(before)?before:[],current=Array.isArray(after)?after:[];
 const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
 const fixedFields=item=>{const copy={...item};delete copy.equipped;delete copy.slot;return copy};
 if(current.length<previous.length){
  if(!consume||current.length!==previous.length-1)return false;
  const matchingIndexes=new Set(),removed=[];
  for(const item of previous){const index=current.findIndex((candidate,i)=>!matchingIndexes.has(i)&&same(fixedFields(item),fixedFields(candidate)));if(index<0)removed.push(item);else matchingIndexes.add(index)}
  if(removed.length!==1||matchingIndexes.size!==current.length)return false;
  const item=removed[0],effects=item.effects?.length?item.effects:[{targetType:item.targetType,bonus:item.bonus}];
  return Boolean(item.equipped&&effects.some(effect=>['god','skillPoints'].includes(effect.targetType)&&Number(effect.bonus)>0));
 }
 if(previous.some((item,index)=>!same(fixedFields(item),fixedFields(current[index]||{}))))return false;
 const models=[...(catalog?.builtinGroups||[]).flatMap(group=>group.items||[]),...(catalog?.items||[])];
 for(const item of current.slice(previous.length)){
  if(item.equipped||item.containerType==='custom')return false;
  const matched=models.some(model=>{
   const name=String(model.name||'');
   return [name,`Receptáculo de ${name}`].includes(item.name)&&same(item.effects,model.effects);
  });
  if(!matched)return false;
 }
 return true;
}
module.exports={playerMaySaveReceptacles};
