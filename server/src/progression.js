// Shared rules: used by the renderer and copied to the API on deployment.
(function(root){
 function abilityMaxLevel(type){return type==='passive'?5:type==='active'||!type?10:null}
 function abilityUseGoal(level){return 20+Math.max(1,Number(level)||1)*5}
 function abilityAtMax(ability){const maximum=abilityMaxLevel(ability?.type);return maximum!==null&&Math.max(1,Number(ability?.level)||1)>=maximum}
 function skillKey(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
 function questCompletionBonus(tier){return {10:3,20:7,30:11,40:15,50:20}[tier]||0}
 function startSkillQuests(character){
  character.skills||=[];character.quests||=[];let changed=false;
  for(let index=character.skills.length-1;index>=0;index--){
   const skill=character.skills[index],value=Number(skill.value)||0;
   if([10,20,30,40,50].includes(value)&&Number(skill.bonus)>=questCompletionBonus(value)&&(Number(skill.completedQuestTier)||0)<value){skill.completedQuestTier=value;changed=true}
   if(![10,20,30,40,50].includes(value)||Number(skill.completedQuestTier)>=value)continue;
   if(character.quests.some(quest=>skillKey(quest.name)===skillKey(skill.name)))continue;
   character.quests.push({id:skill.id||`quest-${skillKey(skill.name)}-${value}`,name:skill.name||'Nova perícia',value,bonus:Number(skill.bonus)||0,current:Math.max(0,Number(skill.questEntryProgress)||0),goal:10,successCount:0,failureCount:0});
   character.skills.splice(index,1);changed=true;
  }
  return changed;
 }
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
  for(const quest of character.quests)if(!(Number(quest.goal)>0)){quest.goal=10;changed=true}
  const completedQuests=character.quests.filter(q=>(Number(q.goal)>0&&Number(q.current)>=Number(q.goal))||(questCompletionBonus(Number(q.value))>0&&Number(q.bonus)>=questCompletionBonus(Number(q.value))));
  for(const quest of completedQuests){
   const key=skillKey;
   const existing=character.skills.find(skill=>key(skill.name)===key(quest.name)),nextValue=Math.min(50,Math.max(1,Number(quest.value)||0));
   const bonus=Math.max(Number(quest.bonus)||0,questCompletionBonus(nextValue));
   if(existing){existing.value=Math.max(Number(existing.value)||0,nextValue);existing.bonus=Math.max(Number(existing.bonus)||0,bonus);existing.completedQuestTier=Math.max(Number(existing.completedQuestTier)||0,nextValue)}
   else character.skills.push({id:quest.id||`quest-complete-${key(quest.name)}`,name:quest.name||'Nova perícia',value:nextValue,bonus,successCount:0,failureCount:0,completedQuestTier:nextValue});
   changed=true;
  }
  if(completedQuests.length)character.quests=character.quests.filter(q=>!completedQuests.includes(q));
  for(const skill of character.skills){
   const value=Number(skill.value)||0,tier=Number(skill.completedQuestTier)||0;
   const earned=tier>=50?20:tier>=40||value>40?15:tier>=30||value>30?11:tier>=20||value>20?7:tier>=10||value>10?3:0;
   if(earned>(Number(skill.bonus)||0)){skill.bonus=earned;changed=true}
  }
  for(const quest of character.quests){
   const value=Number(quest.value)||0,earned=value>=50?15:value>=40?11:value>=30?7:value>=20?3:0;
   if(earned>(Number(quest.bonus)||0)){quest.bonus=earned;changed=true}
  }
  if(startSkillQuests(character))changed=true;
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
 root.RpgProgression={applyProgression,startSkillQuests,abilityMaxLevel,abilityUseGoal,abilityAtMax};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.RpgProgression;
})(globalThis);
