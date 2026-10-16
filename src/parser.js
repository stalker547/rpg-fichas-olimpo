(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FichaParser = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const clean = line => line.replace(/\*\*/g, '').trim();
  const num = value => Number(String(value).replace(',', '.')) || 0;
  const fieldMap = {
    nome: ['name'], idade: ['profile','age'], corrente: ['profile','current'], parente: ['profile','parent'],
    reconhecido: ['profile','recognized'], nível: ['profile','level'], nivel: ['profile','level'], xp: ['profile','xp'],
    'vida atual': ['profile','healthCurrent'], 'vida máxima': ['profile','healthMax'], 'vida maxima': ['profile','healthMax'],
    'bônus divino': ['profile','divineBonus'], 'bonus divino': ['profile','divineBonus'],
    'pontos de atributos para gastar': ['pointPools','attributes'], 'pontos para gastar em atributos': ['pointPools','attributes'],
    'pontos de perícias para gastar': ['pointPools','skills'], 'pontos de pericias para gastar': ['pointPools','skills'],
    'pontos para gastar em perícias': ['pointPools','skills'], 'pontos para gastar em pericias': ['pointPools','skills']
  };
  const sectionNames = {
    atributos:'attributes', pericias:'skills', perícias:'skills', 'perícias em quest':'questSkills', 'pericias em quest':'questSkills',
    quest:'questProgress', 'criação de habilidade':'creation', 'criacao de habilidade':'creation', 'corrente de receptáculos':'inventory', 'caixa de receptáculos':'inventory', deuses:'gods'
  };
  function setNested(target, path, value) { let o=target;path.slice(0,-1).forEach(k=>o=o[k]||(o[k]={}));o[path.at(-1)]=value; }
  function parse(text) {
    const result={profile:{},pointPools:{},attributes:{},skills:[],learning:[],quests:[],gods:{},inventoryParts:[],recognized:[]};
    const lines=String(text||'').replace(/\r/g,'').split('\n').map(clean);
    let section='', lastQuest='';
    for (const raw of lines) {
      if (!raw || raw==='.') continue;
      const lower=raw.toLocaleLowerCase('pt-BR');
      const normalized=lower.replace(/:$/,'').trim();
      if(sectionNames[normalized]){section=sectionNames[normalized];continue;}
      const colon=raw.match(/^([^:]+):\s*(.*)$/);
      if(colon){
        const key=colon[1].trim().toLocaleLowerCase('pt-BR');
        const allowedGlobal=key==='bônus divino'||key==='bonus divino'||fieldMap[key]?.[0]==='pointPools';
        if(fieldMap[key]&&(!section||allowedGlobal)){const isNumber=['level','xp','divineBonus','coins','attributes','skills','healthCurrent','healthMax'].includes(fieldMap[key].at(-1));setNested(result,fieldMap[key],isNumber?num(colon[2]):colon[2]);result.recognized.push(colon[1].trim());continue;}
        if(key==='moedas')continue;
      }
      if(section==='attributes' && colon){
        const value=colon[2].trim(),totalMatch=value.match(/^\s*(-?\d+(?:[.,]\d+)?)/),bonusMatch=value.match(/\(\s*([+-]?\d+(?:[.,]\d+)?)\s*\)/);
        if(totalMatch){const total=num(totalMatch[1]),bonus=bonusMatch?num(bonusMatch[1]):0;result.attributes[colon[1].trim()]=total-bonus;}
        continue;
      }
      if(section==='skills'){
        const learning=raw.match(/^(.*?)\s+aprendendo\s*\((\d+)\s*\/\s*(\d+)\)$/i);
        if(learning){result.learning.push({name:learning[1].trim(),current:num(learning[2]),goal:num(learning[3])});continue;}
        const skill=raw.match(/^(.*?)\s*-\s*(-?\d+)(?:\s*\(\+?(-?\d+)\))?$/);
        if(skill){result.skills.push({name:skill[1].trim(),value:num(skill[2]),bonus:num(skill[3])});continue;}
      }
      if(section==='questSkills'){
        const q=raw.match(/^(.*?)\s*-\s*(-?\d+)(?:\s*\(\+?(-?\d+)\))?$/);if(q){result.quests.push({name:q[1].trim(),value:num(q[2]),bonus:q[3]===undefined?0:num(q[3]),current:0,goal:10,action:'use'});continue;}
      }
      if(section==='questProgress'){
        const req=raw.match(/^Requisito:\s*(?:(use|acerte)\s*)?(\d+)\s*\/\s*(\d+)$/i);
        if(req && lastQuest){let q=result.quests.find(x=>x.name.toLocaleLowerCase('pt-BR')===lastQuest.toLocaleLowerCase('pt-BR'));if(!q){q={name:lastQuest,value:0,current:0,goal:10,action:'use'};result.quests.push(q);}q.current=num(req[2]);q.goal=num(req[3]);q.action=num(q.value)>=20?'use':String(req[1]||'use').toLocaleLowerCase('pt-BR');continue;}
        lastQuest=raw;continue;
      }
      if(section==='gods'){
        const god=raw.match(/^(.*?)\s*-\s*(-?\d+)$/);if(god){result.gods[god[1].trim()]=num(god[2]);continue;}
      }
      if(section==='inventory') result.inventoryParts.push(raw);
    }
    result.inventory=result.inventoryParts.join('\n');delete result.inventoryParts;
    return result;
  }
  function apply(character, parsed) {
    const out=JSON.parse(JSON.stringify(character));
    if(parsed.name)out.name=parsed.name;
    out.profile={...out.profile,...parsed.profile};
    if(Object.keys(parsed.pointPools||{}).length)out.pointPools={...(out.pointPools||{}),...parsed.pointPools};
    if(Object.keys(parsed.attributes).length)out.attributes={...out.attributes,...parsed.attributes};
    if(parsed.skills.length)out.skills=parsed.skills;
    if(parsed.learning.length)out.learning=parsed.learning;
    if(parsed.quests.length)out.quests=parsed.quests;
    if(Object.keys(parsed.gods).length)out.gods=parsed.gods;
    if(parsed.inventory)out.inventory=parsed.inventory;
    return out;
  }
  return { parse, apply };
});
