// Shared rules: used by the renderer and copied to the API on deployment.
(function(root){
 function applyProgression(character){
  if(!character)return false;let changed=false;
  character.creations||=[];character.ideas||=[];
  const completed=character.creations.filter(c=>Number(c.requirement)>0&&Number(c.current)<=0);
  for(const creation of completed){
   let idea=creation.ideaId?character.ideas.find(i=>i.id===creation.ideaId):null;
   if(!idea){const matching=character.ideas.filter(i=>String(i.name||'').trim().toLowerCase()===String(creation.name||'').trim().toLowerCase());if(matching.length===1)idea=matching[0]}
   if(!idea){idea={id:creation.ideaId||creation.id||`completed-${creation.name}`,name:creation.name||'Nova habilidade',type:'active',status:'Em desenvolvimento',effect:creation.effect||''};character.ideas.push(idea)}
   idea.creationCompleted=true;idea.completedCreation={...creation,current:0};changed=true;
  }
  if(completed.length)character.creations=character.creations.filter(c=>!completed.includes(c));
  for(const ability of character.abilities||[]){
   const goal=Math.max(1,Number(ability.useGoal)||25),current=Math.max(0,Number(ability.useCurrent)||0);
   if(current>=goal){ability.level=Math.max(1,Number(ability.level)||1)+Math.floor(current/goal);ability.useCurrent=current%goal;ability.useGoal=goal;changed=true}
  }
  return changed;
 }
 root.RpgProgression={applyProgression};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.RpgProgression;
})(globalThis);
