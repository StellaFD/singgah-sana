import { apiRequest } from '@/lib/owner/api/client';
import type { ApiResult } from '@/lib/owner/api/types';
import type { OwnerInquiry, OwnerInquiryDetail, ChatMessage } from './types';

/** GET /api/inquiries/owner  (target: GET /inquiry/owner) */
export async function listInquiryPemilik(signal?: AbortSignal): Promise<OwnerInquiry[]> {
  const result = await apiRequest<ApiResult<OwnerInquiry[]>>('/inquiries/owner', { signal });
  return result.data;
}

/** GET /api/inquiries/:id  (target: GET /inquiry/:id) */
export async function getInquiryDetail(id: string, signal?: AbortSignal, before?: string): Promise<OwnerInquiryDetail> {
  const query = before ? `?before=${encodeURIComponent(before)}` : '';
  const result = await apiRequest<ApiResult<OwnerInquiryDetail>>(`/inquiries/${encodeURIComponent(id)}${query}`, { signal });
  return result.data;
}

/** POST /api/inquiries/:id/messages  (target: POST /inquiry/:id/messages) */
export async function kirimPesanPemilik(id: string, pesan: string, clientMsgId?: string): Promise<ApiResult<ChatMessage>> {
  return apiRequest<ApiResult<ChatMessage>>(`/inquiries/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body: { pesan, client_msg_id: clientMsgId },
  });
}

/** PATCH /api/inquiries/:id/reply  (target: PATCH /inquiry/:id/reply). Kompatibilitas balasan pertama. */
export async function balasInquiry(id: string, balasan: string): Promise<ApiResult<OwnerInquiry>> {
  return apiRequest<ApiResult<OwnerInquiry>>(`/inquiries/${encodeURIComponent(id)}/reply`, {
    method: 'PATCH',
    body: { balasan },
  });
}
