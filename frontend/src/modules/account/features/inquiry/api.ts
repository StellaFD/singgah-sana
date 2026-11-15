import { api } from '../../lib/api/client';
import type { KosDto } from '../../lib/api/adapters';
import type { Percakapan, Pesan } from '../../lib/api/types';
export interface InquiryDto {_id:string;pesan:string;balasan:string;status:'menunggu'|'dibalas';createdAt:string;updatedAt:string;kos_id:KosDto;pemilik_id:{_id:string;nama:string};}
async function records(signal?:AbortSignal){return (await api.get<InquiryDto[]>('/inquiry/my',{signal})).data;}
async function record(id:string,signal?:AbortSignal){const item=(await records(signal)).find(item=>item._id===id);if(!item)throw new Error('Pertanyaan tidak ditemukan.');return item;}
export const inquiryApi={
 list:async(signal?:AbortSignal):Promise<Percakapan[]> =>(await records(signal)).map(item=>({id:item._id,pemilik:{id:item.pemilik_id._id,nama:item.pemilik_id.nama},
 kos:{id:item.kos_id._id,nama:item.kos_id.nama,hargaBulanan:item.kos_id.harga_per_bulan,kamarTersedia:item.kos_id.jumlah_kamar_tersedia,fotoUrl:item.kos_id.foto?.[0]||'/assets/placeholder-kos.svg'},
 cuplikan:item.balasan||item.pesan,waktu:item.updatedAt,belumDibaca:0,status:item.status})),
 messages:async(id:string,signal?:AbortSignal):Promise<Pesan[]>=>{const item=await record(id,signal);return [{id:item._id+'-q',dari:'saya',isi:item.pesan,waktu:item.createdAt,status:'terkirim'},
 ...(item.balasan?[{id:item._id+'-a',dari:'pemilik' as const,isi:item.balasan,waktu:item.updatedAt,status:'terkirim' as const}]:[])];},
 send:async(id:string,isi:string):Promise<Pesan>=>{const previous=await record(id);const result=await api.post<InquiryDto>('/inquiry',{kos_id:previous.kos_id._id,pesan:isi});return {id:result.data._id,dari:'saya',isi:result.data.pesan,waktu:result.data.createdAt,status:'terkirim'};},
 start:async(kosId:string,isi:string)=>{const result=await api.post<InquiryDto>('/inquiry',{kos_id:kosId,pesan:isi});return {percakapanId:result.data._id};},
};
