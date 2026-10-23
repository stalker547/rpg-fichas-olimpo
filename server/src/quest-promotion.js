const skillName=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const completionBonus={10:3,20:7,30:11,40:15,50:20};

export function isAuthorizedPromotion(before,after,skill){
 const name=skillName(skill.name);
 const quest=(before.quests||[]).find(item=>skillName(item.name)===name);
 const learning=(before.learning||[]).find(item=>skillName(item.name)===name);
 if(quest&&!(after.quests||[]).some(item=>skillName(item.name)===name)){
  const tier=Number(quest.value)||0,required=completionBonus[tier];
  if(Number(skill.value)===Math.min(50,tier+1))return true;
  if(required&&Number(quest.bonus)>=required&&Number(skill.value)===tier&&Number(skill.bonus)>=required)return true;
 }
 return Boolean(learning&&!(after.learning||[]).some(item=>skillName(item.name)===name)&&Number(skill.value)===1);
}
