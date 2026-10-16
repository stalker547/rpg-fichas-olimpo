const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ignored=new Set(['_remoteVersion','_remoteCampaignId','updatedAt','changeNote','changeSource','history']);
function mergeCharacter(base,local,remote){
 function merge(b,l,r,path=''){
  if(equal(l,b))return structuredClone(r);
  if(equal(r,b)||equal(l,r))return structuredClone(l);
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
 merged.history=remote.history||[];merged.changeNote=local.changeNote;merged.changeSource=local.changeSource;return merged;
}
module.exports={mergeCharacter};
