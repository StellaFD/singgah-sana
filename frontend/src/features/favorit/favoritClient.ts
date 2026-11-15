import { sessionRequest } from '@/features/auth/sessionClient';
import type { ApiResponse } from '@/types/api';
export async function toggleFavoritApi(kosId:string,signal?:AbortSignal):Promise<ApiResponse<{bookmarked:boolean}>> {
 try {
  const list=await sessionRequest<{data:Array<{kos_id:{_id:string}}>}>('/favorit',{signal});
  const bookmarked=!list.data.some(item=>item.kos_id?._id===kosId);
  await sessionRequest('/favorit/'+encodeURIComponent(kosId),{method:bookmarked?'PUT':'DELETE',signal});
  window.dispatchEvent(new Event('ss:favorites-changed'));
  return {success:true,data:{bookmarked},message:bookmarked?'Kos disimpan ke favorit.':'Kos dihapus dari favorit.'};
 }catch(error){return {success:false,message:error instanceof Error?error.message:'Favorit belum dapat diperbarui.'};}
}
