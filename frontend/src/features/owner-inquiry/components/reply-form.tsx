'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import { Button } from '@/components/owner-ui/button';
import { Field, Textarea, describedBy } from '@/components/owner-ui/field';
import { useToast } from '@/components/owner-ui/toast';
import { errorMessage } from '@/lib/owner/api/client';
import { balasInquiry, kirimPesanPemilik } from '../api';
import { balasanSchema, type BalasanValues } from '../schema';
import type { OwnerInquiry } from '../types';

type ReplyFormProps = {
  inquiry: OwnerInquiry;
  onReplied: (updated: OwnerInquiry) => void;
};

export function ReplyForm({ inquiry, onReplied }: ReplyFormProps) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BalasanValues>({
    resolver: zodResolver(balasanSchema),
    defaultValues: { balasan: '' },
    mode: 'onTouched',
  });
  const length = useWatch({ control, name: 'balasan' })?.length ?? 0;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const teks = values.balasan.trim();
      const clientMsgId = `owner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      if (inquiry.status === 'menunggu' && !inquiry.balasan) {
        // Balasan pertama menggunakan endpoint reply kanonikal
        const result = await balasInquiry(inquiry._id, teks);
        onReplied({ ...inquiry, balasan: result.data.balasan, status: result.data.status, updatedAt: result.data.updatedAt });
      } else {
        // Pesan lanjutan menggunakan endpoint messages multi-turn dengan client_msg_id
        const result = await kirimPesanPemilik(inquiry._id, teks, clientMsgId);
        const existingList = inquiry.pesan_list || [];
        onReplied({
          ...inquiry,
          status: 'dibalas',
          pesan_list: [...existingList, result.data],
          updatedAt: result.data.createdAt,
        });
      }
      reset();
      toast.success('Pesan balasan terkirim.');
    } catch (error) {
      setError('balasan', { type: 'server', message: errorMessage(error) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <Field id="balasan" label="Balasan untuk calon penghuni" hint={`${length}/1.000 karakter`} error={errors.balasan?.message}>
        <Textarea
          id="balasan"
          rows={3}
          placeholder="Tulis balasan atau pesan untuk calon penghuni…"
          invalid={!!errors.balasan}
          aria-describedby={describedBy('balasan', errors.balasan?.message, true)}
          {...register('balasan')}
        />
      </Field>
      <div>
        <Button type="submit" loading={isSubmitting} icon={<Send className="h-4 w-4" aria-hidden />}>
          Kirim balasan
        </Button>
      </div>
      <p className="text-xs text-ink-muted">Jangan bagikan kata sandi, OTP, atau data pribadi sensitif melalui pesan.</p>
    </form>
  );
}
