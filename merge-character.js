const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ignored=new Set(['_remoteVersion','_remoteCampaignId','updatedAt','changeNote','changeSource','history','pointGrantNotices']);
const mergeableText=new Set(['notes','story','goals','relationships','extraInfo','inventory']);
function mergeCharacter(base,local,remote,{preferRemote=[]}={}){
 const remoteWins=new Set(preferRemote);
 function mergeArray(b,l,r,path){
  const uniqueIds=items=>Array.isArray(items)&&items.every(item=>item&&typeof item==='object'&&typeof item.id==='string'&&item.id)&&new Set(items.map(item=>item.id)).size===items.length;
  const uniqueNames=items=>Array.isArray(items)&&items.every(item=>item&&typeof item==='object'&&typeof item.name==='string'&&item.name.trim())&&new Set(items.map(item=>item.name.trim().toLocaleLowerCase('pt-BR'))).size===items.length;
  const keyOf=uniqueIds(b)&&uniqueIds(l)&&uniqueIds(r)?item=>item.id:uniqueNames(b)&&uniqueNames(l)&&uniqueNames(r)?item=>item.name.trim().toLocaleLowerCase('pt-BR'):null;
  if(!keyOf){
   if(l.length<b.length||r.length<b.length)throw new Error(`Outra pessoa também alterou ${path}. Suas alterações continuam na tela. Recarregue a ficha antes de tentar novamente.`);
   const result=[],originalNames=new Map(b.map((item,index)=>[item?.name,index]).filter(([name])=>name));
   for(let i=0;i<b.length;i++){
    const original=b[i],left=l[i],right=r[i];
    if(original&&typeof original==='object'&&original.name){
     const moved=items=>items.slice(0,b.length).some((item,index)=>index!==i&&item?.name===original.name);
     if(moved(l)||moved(r)||[left,right].some(item=>item?.name!==original.name&&originalNames.has(item?.name)&&originalNames.get(item.name)!==i))throw new Error(`Outra pessoa também reorganizou ${path}. Recarregue a ficha antes de tentar novamente.`);
    }
    result.push(merge(original,left,right,`${path}[${i}]`));
   }
   const remoteAdded=r.slice(b.length),localAdded=l.slice(b.length);
   result.push(...remoteAdded.map(item=>structuredClone(item)));
   for(const item of localAdded){if(remoteAdded.some(other=>equal(other,item)))continue;if(item?.name&&remoteAdded.some(other=>other?.name===item.name))throw new Error(`Outra pessoa também adicionou ${item.name} em ${path}. Recarregue a ficha antes de tentar novamente.`);result.push(structuredClone(item))}
   return result;
  }
  const baseById=new Map(b.map(item=>[keyOf(item),item])),localById=new Map(l.map(item=>[keyOf(item),item])),remoteById=new Map(r.map(item=>[keyOf(item),item]));
  if([...baseById.keys()].some(key=>!localById.has(key)&&!remoteById.has(key))&&l.some(item=>!baseById.has(keyOf(item)))&&r.some(item=>!baseById.has(keyOf(item))))throw new Error(`Outra pessoa também alterou ${path}. Recarregue a ficha antes de tentar novamente.`);
  const merged=[];
  for(const item of r){
   const key=keyOf(item),original=baseById.get(key),changed=localById.get(key);
   if(!original){if(changed&&!equal(changed,item))throw new Error(`Outra pessoa também alterou ${path}[${key}]. Recarregue a ficha antes de tentar novamente.`);merged.push(structuredClone(item));continue}
   if(!changed){if(!equal(item,original))throw new Error(`Outra pessoa também alterou ${path}[${key}]. Recarregue a ficha antes de tentar novamente.`);continue}
   merged.push(merge(original,changed,item,`${path}[${key}]`));
  }
  for(const item of l){
   const key=keyOf(item);if(remoteById.has(key))continue;
   const original=baseById.get(key);
   if(original){if(!equal(item,original))throw new Error(`Outra pessoa também alterou ${path}[${key}]. Recarregue a ficha antes de tentar novamente.`);continue}
   merged.push(structuredClone(item));
  }
  if(path==='receptacles'){
   const occupied=new Set();let nextSlot=Math.max(0,...merged.map(item=>Number(item.slot)||0))+1;
   for(const item of merged){const slot=Number(item.slot);if(!Number.isSafeInteger(slot)||slot<1||occupied.has(slot))item.slot=nextSlot++;occupied.add(Number(item.slot))}
  }
  return merged;
 }
 function merge(b,l,r,path=''){
  if(path&&remoteWins.has(path))return structuredClone(r);
  if(equal(l,b))return structuredClone(r);
  if(equal(r,b)||equal(l,r))return structuredClone(l);
  if(Array.isArray(b)&&Array.isArray(l)&&Array.isArray(r))return mergeArray(b,l,r,path);
  if(mergeableText.has(path)&&typeof l==='string'&&typeof r==='string'&&l.includes(r))return l;
  if(b&&l&&r&&typeof b==='object'&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(b)&&!Array.isArray(l)&&!Array.isArray(r)){
   const result={};for(const key of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])){
    if(!path&&ignored.has(key))continue;
    const value=merge(b[key],l[key],r[key],path?`${path}.${key}`:key);if(value!==undefined)result[key]=value;
   }return result;
  }
  throw new Error(`Outra pessoa também alterou ${path||'esta ficha'}. Suas alterações continuam na tela. Recarregue a ficha antes de tentar novamente.`);
 }
 const merged=merge(base,local,remote);
 for(const key of ['_remoteVersion','_remoteCampaignId','updatedAt'])merged[key]=remote[key];
 merged.history=remote.history||[];merged.pointGrantNotices=remote.pointGrantNotices||[];merged.changeNote=local.changeNote;merged.changeSource=local.changeSource;return merged;
}
module.exports={mergeCharacter};
