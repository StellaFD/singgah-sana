import { sessionRequest } from '@/features/auth/sessionClient';
import type { ApiResponse } from '@/types/api';
export interface SendInquiryPayload {kos_id:string;pesan:string;kontak_pemohon?:string;client_msg_id?:string;}
export async function sendInquiryApi(payload:SendInquiryPayload,signal?:AbortSignal):Promise<ApiResponse<{inquiry_id?:string}>> {
 if(!payload.pesan.trim()||payload.pesan.length>1000)return {success:false,isValidationError:true,message:'Pertanyaan wajib diisi, maksimal 1.000 karakter.'};
 try {const result=await sessionRequest<{data:{_id:string};message:string}>('/inquiry',{method:'POST',body:JSON.stringify({kos_id:payload.kos_id,pesan:payload.pesan.trim(),client_msg_id:payload.client_msg_id}),signal});
 return {success:true,data:{inquiry_id:result.data._id},message:result.message};}
 catch(error){return {success:false,message:error instanceof Error?error.message:'Pertanyaan belum terkirim.'};}
}
