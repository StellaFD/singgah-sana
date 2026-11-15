'use client';

import { useAsync } from '@/lib/owner/use-async';
import { listInquiryPemilik } from './api';

export function useInquiryPemilik() {
  return useAsync((signal) => listInquiryPemilik(signal), []);
}
