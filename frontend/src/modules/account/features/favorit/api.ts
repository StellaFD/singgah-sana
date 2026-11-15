import { api } from '../../lib/api/client';
import { mapKos, type KosDto } from '../../lib/api/adapters';
import type { Favorit, FavoritSort } from '../../lib/api/types';
export interface FavoriteDto {_id:string;createdAt:string;kos_id:KosDto & {unavailable?:boolean};}
export const favoritApi={
 list:async(q:{tersedia?:boolean;sort?:FavoritSort;page?:number;limit?:number}={},signal?:AbortSignal)=>{
  const result=await api.get<FavoriteDto[]>('/favorit',{signal});
  let data:Favorit[]=result.data.map(item=>({id:item._id,tersimpanPada:item.createdAt,kos:mapKos(item.kos_id)}));
  if(q.tersedia)data=data.filter(item=>item.kos.tampilPublik&&item.kos.kamarTersedia>0);
  data.sort((a,b)=>q.sort==='harga-asc'?a.kos.hargaBulanan-b.kos.hargaBulanan:q.sort==='harga-desc'?b.kos.hargaBulanan-a.kos.hargaBulanan:Date.parse(b.tersimpanPada)-Date.parse(a.tersimpanPada));
  const limit=q.limit||12,page=q.page||1,totalData=data.length;
  return {data:data.slice((page-1)*limit,page*limit),message:result.message,pagination:{totalData,totalPages:Math.ceil(totalData/limit),currentPage:page,limit}};
 },
 remove:(id:string)=>api.delete<null>('/favorit/'+encodeURIComponent(id)),
 add:(id:string)=>api.put<null>('/favorit/'+encodeURIComponent(id)),
};
