const visibleStatuses=new Set(['Pedido para a mestre','Aprovada','Em desenvolvimento']);

export function hidePlayerDrafts(row,user){
 if(user?.role!=='primary_master'||row?.owner_user_id===user.id)return row;
 return {...row,data:{...row.data,ideas:(row.data?.ideas||[]).filter(idea=>visibleStatuses.has(idea.status))}};
}

export function preservePlayerDrafts(data,stored,user,ownerUserId){
 if(user?.role!=='primary_master'||ownerUserId===user.id)return data;
 const hidden=(stored?.ideas||[]).filter(idea=>!visibleStatuses.has(idea.status));
 const hiddenIds=new Set(hidden.map(idea=>idea.id).filter(Boolean));
 const incoming=(data.ideas||[]).filter(idea=>!hiddenIds.has(idea.id));
 return {...data,ideas:[...incoming,...hidden]};
}
