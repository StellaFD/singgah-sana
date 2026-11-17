import { sessionRequest, SessionError } from '@/features/auth/sessionClient';
import type { ApiFailure, ErrorCode } from './types';
export class ApiError extends Error {
  readonly errors: Record<string,string[]>;
  readonly code: ErrorCode;
  constructor(public status:number, body: Pick<ApiFailure,'message'|'code'> & {errors?:Record<string,string[]>}) {
    super(body.message); this.name='ApiError'; this.code=body.code; this.errors=body.errors || {};
  }
}
export interface RequestOptions { query?:Record<string,string|number|boolean|undefined>; body?:unknown; signal?:AbortSignal; }
export interface Result<T> {code?: string; data:T; message:string; pagination?:{totalData:number; totalPages:number; currentPage:number; limit:number};}
let sessionHandler:((error:ApiError)=>void)|null=null;
export function setSessionErrorHandler(handler:typeof sessionHandler) {sessionHandler=handler;}
async function request<T>(method:string,path:string,options:RequestOptions={}):Promise<Result<T>> {
  const query=new URLSearchParams();
  for (const [key,value] of Object.entries(options.query||{})) if(value!==undefined) query.set(key,String(value));
  try {
    return await sessionRequest<Result<T>>(path+(query.size?'?'+query:''),{method,signal:options.signal,
      body:options.body===undefined?undefined:options.body instanceof FormData?options.body:JSON.stringify(options.body)});
  } catch(error) {
    if(error instanceof SessionError) {
      const converted=new ApiError(error.status,{message:error.message,errors:error.errors,
        code:(error.code || ({401:'UNAUTHENTICATED',403:'FORBIDDEN',409:'CONFLICT',422:'VALIDATION_ERROR',429:'RATE_LIMITED'}[error.status]) || 'UNKNOWN') as ErrorCode});
      if(error.status===401 && !path.startsWith('/auth/')) sessionHandler?.(converted);
      throw converted;
    }
    if(error instanceof DOMException && error.name==='AbortError') throw error;
    throw new ApiError(0,{message:'Layanan tidak dapat dihubungi. Coba lagi.',code:'NETWORK_ERROR'});
  }
}
export const api={
 get:<T>(path:string,options?:RequestOptions)=>request<T>('GET',path,options),
 post:<T>(path:string,body?:unknown,options?:RequestOptions)=>request<T>('POST',path,{...options,body}),
 put:<T>(path:string,body?:unknown,options?:RequestOptions)=>request<T>('PUT',path,{...options,body}),
 patch:<T>(path:string,body?:unknown,options?:RequestOptions)=>request<T>('PATCH',path,{...options,body}),
 delete:<T>(path:string,body?:unknown,options?:RequestOptions)=>request<T>('DELETE',path,{...options,body}),
};
export function errorMessage(error:unknown,fallback='Terjadi kesalahan. Coba lagi.') {return error instanceof Error?error.message:fallback;}
