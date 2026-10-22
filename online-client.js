const API_URL='https://olimpo.astratoons.com';
const {applyProgression}=require('./src/progression');
const mapUser=user=>({...user,role:user.role==='primary_master'?'admin':user.role});
class OnlineClient {
 constructor({fetch=globalThis.fetch,baseUrl=API_URL}={}){this.fetch=fetch;this.baseUrl=baseUrl;this.token=null;this.user=null;this.campaign=null;}
 async request(route,method='GET',body){
  const headers={};if(this.token)headers.Authorization=`Bearer ${this.token}`;
  if(body!==undefined)headers['Content-Type']='application/json';
  let response,text;const attempts=method==='GET'?3:1;
  for(let attempt=0;attempt<attempts;attempt++)try{
   response=await this.fetch(this.baseUrl+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
   text=await response.text();break;
  }catch(cause){
   if(attempt+1<attempts)continue;
   const code=String(cause.code||cause.cause?.code||cause.name||'falha de rede').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60);
   const error=new Error(`Não foi possível conectar ao servidor online (${code}). Suas alterações continuam na tela; tente salvar novamente.`);error.networkFailure=true;error.cause=cause;throw error;
  }
  let data;try{data=JSON.parse(text)}catch{throw new Error('O servidor bloqueou a conexão ou retornou uma resposta inválida. Suas alterações continuam na tela.')}
  if(!response.ok){const error=new Error(data.error||'Não foi possível concluir a operação online.');error.status=response.status;throw error}return data;
 }
 async login(credentials){const result=await this.request('/auth/login','POST',credentials);this.token=result.token;this.user=mapUser(result.user);const campaigns=await this.request('/campaigns');this.campaign=campaigns.find(c=>c.kind==='real')||campaigns[0];if(!this.campaign)throw new Error('Sua conta ainda não foi adicionada a uma campanha. Peça à mestre para vincular você.');return this.load()}
 async load(){
  if(!this.token||!this.campaign)throw new Error('Sessão expirada. Entre novamente.');
  const id=this.campaign.id,admin=this.user.role==='admin';
  const [active,archived,settings,users]=await Promise.all([this.request(`/campaigns/${id}/characters`),admin?this.request(`/campaigns/${id}/characters?archived=true`):[],this.request(`/campaigns/${id}/settings`),admin?this.request('/users'):[]]);
  return {characters:[...active,...archived].map(row=>{const character={...row.data,id:row.id,name:row.name,ownerUserId:row.owner_user_id,archived:Boolean(row.archived_at),updatedAt:row.updated_at,_remoteVersion:row.version,_remoteCampaignId:row.campaign_id};applyProgression(character);return character}),settings,npcs:admin?(settings.npcs||[]):[],users:users.filter(u=>u.active).map(mapUser),sessionUser:this.user,online:true};
 }
 async save(character){
  const data={...character};delete data._remoteVersion;delete data._remoteCampaignId;
  applyProgression(data);
  let row;if(character._remoteVersion){row=await this.request(`/characters/${character.id}`,'PUT',{version:character._remoteVersion,data,source:character.changeSource})}
  else row=await this.request(`/campaigns/${this.campaign.id}/characters`,'POST',{data,ownerUserId:character.ownerUserId});
  if(Boolean(character.archived)!==Boolean(row.archived_at))await this.request(`/characters/${row.id}/archive`,'PATCH',{archived:Boolean(character.archived)});
  return row;
 }
 async settings(data){return this.request(`/campaigns/${this.campaign.id}/settings`,'PUT',data)}
 async createUser(data){if(data.role==='admin')throw new Error('A campanha possui uma Mestre Principal. Crie uma conta de jogador.');const user=await this.request('/users','POST',data);await this.request(`/campaigns/${this.campaign.id}/members`,'POST',{userId:user.id});return user}
 async assign(id,owner){return this.request(`/characters/${id}/owner`,'PATCH',{ownerUserId:owner})}
 async updateAppearance(appearance){this.user=mapUser(await this.request('/me/appearance','PUT',appearance));return this.user}
 async saveAppearancePreset(name){this.user=mapUser(await this.request('/me/appearance-presets','POST',{name}));return this.user}
 async overwriteAppearancePreset(id){this.user=mapUser(await this.request(`/me/appearance-presets/${encodeURIComponent(id)}`,'PUT'));return this.user}
 async applyAppearancePreset(id){this.user=mapUser(await this.request(`/me/appearance-presets/${encodeURIComponent(id)}/apply`,'POST'));return this.user}
 async deleteAppearancePreset(id){this.user=mapUser(await this.request(`/me/appearance-presets/${encodeURIComponent(id)}`,'DELETE'));return this.user}
 async uploadBackground(bytes,mime){const response=await this.fetch(`${this.baseUrl}/me/background`,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/octet-stream','X-Mime-Type':mime},body:bytes,signal:AbortSignal.timeout(30000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível enviar a imagem.');this.user=mapUser(data);return this.user}
 async removeBackground(){this.user=mapUser(await this.request('/me/background','DELETE'));return this.user}
 async backup(){return this.request(`/campaigns/${this.campaign.id}/backup`)}
 async restore(backup){return this.request(`/campaigns/${this.campaign.id}/restore`,'POST',backup)}
 async upload(characterId,bytes,name,mime){const response=await this.fetch(`${this.baseUrl}/characters/${characterId}/media`,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(name),'X-Mime-Type':mime},body:bytes,signal:AbortSignal.timeout(30000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível enviar a imagem.');return `/media/${data.id}`}
}
module.exports={OnlineClient,mapUser,API_URL};
