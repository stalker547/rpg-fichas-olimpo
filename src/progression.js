// Shared rules: used by the renderer and copied to the API on deployment.
(function(root){
 function abilityMaxLevel(type){return type==='passive'?5:type==='active'||!type?10:null}
 function abilityUseGoal(level){return 20+Math.max(1,Number(level)||1)*5}
 function abilityAtMax(ability){const maximum=abilityMaxLevel(ability?.type);return maximum!==null&&Math.max(1,Number(ability?.level)||1)>=maximum}
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
  character.skills||=[];character.quests||=[];
  const completedQuests=character.quests.filter(q=>Number(q.goal)>0&&Number(q.current)>=Number(q.goal));
  for(const quest of completedQuests){
   const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
   const existing=character.skills.find(skill=>key(skill.name)===key(quest.name)),nextValue=Math.min(50,Math.max(1,Number(quest.value)||0)+1);
   if(existing){existing.value=Math.max(Number(existing.value)||0,nextValue);existing.bonus=Math.max(Number(existing.bonus)||0,Number(quest.bonus)||0)}
   else character.skills.push({id:quest.id||`quest-complete-${key(quest.name)}`,name:quest.name||'Nova perícia',value:nextValue,bonus:Number(quest.bonus)||0,successCount:0,failureCount:0});
   changed=true;
  }
  if(completedQuests.length)character.quests=character.quests.filter(q=>!completedQuests.includes(q));
  for(const ability of character.abilities||[]){
   const maximum=abilityMaxLevel(ability.type);
   if(maximum===null){const goal=Math.max(1,Number(ability.useGoal)||25),current=Math.max(0,Number(ability.useCurrent)||0);if(current>=goal){ability.level=Math.max(1,Number(ability.level)||1)+Math.floor(current/goal);ability.useCurrent=current%goal;ability.useGoal=goal;changed=true}continue}
   let level=Math.min(maximum,Math.max(1,Number(ability.level)||1)),current=Math.max(0,Number(ability.useCurrent)||0),goal=abilityUseGoal(level);
   if(level!==Number(ability.level)||Number(ability.useGoal)!==goal){ability.level=level;ability.useGoal=goal;changed=true}
   while(level<maximum&&current>=goal){current-=goal;level+=1;goal=abilityUseGoal(level);changed=true}
   if(level>=maximum&&current!==0){current=0;changed=true}
   ability.level=level;ability.useCurrent=current;ability.useGoal=goal;
  }
  return changed;
 }
 root.RpgProgression={applyProgression,abilityMaxLevel,abilityUseGoal,abilityAtMax};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.RpgProgression;
})(globalThis);
