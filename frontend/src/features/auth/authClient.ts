import type { AuthStatus, AuthUser } from '@/types/auth';
import { sessionRequest, SessionError } from './sessionClient';
export interface AuthMeResponse {success:boolean;status:AuthStatus;user:AuthUser|null;message?:string;}
export async function fetchCurrentUser(signal?:AbortSignal):Promise<AuthMeResponse>{
 try {
  const result=await sessionRequest<{data:Record<string,unknown>}>('/auth/me',{signal});const raw=result.data;
  if(!raw||typeof raw._id!=='string'||typeof raw.nama!=='string'||!['pencari','pemilik','admin'].includes(String(raw.role)))throw new Error('Data akun tidak valid.');
  const user:AuthUser={id:raw._id,nama:raw.nama,role:String(raw.role),status:typeof raw.status==='string'?raw.status:'active',
   email:typeof raw.email==='string'?raw.email:undefined,nomor_telepon:typeof raw.nomor_telepon==='string'?raw.nomor_telepon:undefined,
   foto_profil:typeof raw.foto_profil==='string'?raw.foto_profil:undefined,
   email_verified:Boolean(raw.email_verified_at || raw.email_verified === true),
   email_verified_at:typeof raw.email_verified_at==='string'?raw.email_verified_at:undefined,
   password_updated_at:typeof raw.password_updated_at==='string'?raw.password_updated_at:undefined};
  return {success:true,status:'authenticated',user};
 }catch(error){
  if(signal?.aborted)throw error;
  if(error instanceof SessionError&&error.status===401)return {success:false,status:'anonymous',user:null};
  return {success:false,status:'unavailable',user:null,message:error instanceof Error?error.message:'Layanan akun belum dapat dihubungi.'};
 }
}
