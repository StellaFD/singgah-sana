import { sessionRequest, SessionError } from '@/features/auth/sessionClient';
type ApiRequestOptions=Omit<RequestInit,'headers'>&{headers?:HeadersInit;token?:string};
export class ApiError extends Error {constructor(message:string,public status:number){super(message);this.name='ApiError';}}
export async function apiRequest<T=unknown>(path:string,{token:_token,...options}:ApiRequestOptions={}):Promise<T> {
 try{return await sessionRequest<T>(path,options);}catch(error){if(error instanceof SessionError)throw new ApiError(error.message,error.status);throw error;}
}
export async function apiDownload(path:string,_options:{token?:string}={}):Promise<{blob:Blob;filename:string}> {
 const response=await fetch('/api/private'+path,{cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new ApiError('File tidak dapat diunduh.',response.status);
 if(!response.headers.get('content-type')?.includes('text/csv'))throw new Error('Respons bukan CSV.');
 return {blob:await response.blob(),filename:'rekap_kos_singgah_sana.csv'};
}
