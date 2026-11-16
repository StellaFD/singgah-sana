'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card } from '@/components/owner-ui/card';
import { Button } from '@/components/owner-ui/button';
import { Alert, ErrorState } from '@/components/owner-ui/state';
import { Spinner } from '@/components/owner-ui/spinner';
import { useToast } from '@/components/owner-ui/toast';
import { ApiError, errorMessage } from '@/lib/owner/api/client';
import { formatRelativeShort } from '@/lib/owner/format';
import { useSession } from '@/features/auth/use-session';
import {
  createDraft,
  updateDraft,
  submitInitialKos,
  withdrawInitialKos,
  getChangeSubmission,
  upsertChangeDraft,
  withdrawChangeDraft,
  orchestrateSaveAndSubmitChange,
  sanitizeChangeContentPayload,
} from '../../api';
import { deleteDraft, loadDraft } from '../../draft';
import {
  EMPTY_KOS_FORM,
  STEP_FIELDS,
  fromKos,
  kosFormSchema,
  toKosInput,
  toPartialDraftPayload,
  toDraftSnapshotPayload,
  type KosFormValues,
} from '../../schema';
import type { Kos, SubmissionDetail } from '../../types';
import { PhotoPicker, type PhotoPickerItem } from './photo-picker';
import { Stepper, STEP_LABELS } from './stepper';
import { StepInformasi } from './step-informasi';
import { StepLokasi } from './step-lokasi';
import { StepFasilitas } from './step-fasilitas';
import { StepKamar } from './step-kamar';
import { StepTinjau } from './step-tinjau';
import type { KosForm } from './types';

const STEP_DESCRIPTIONS = [
  'Ceritakan identitas dan suasana kosmu.',
  'Tentukan alamat dan titik lokasi pada peta.',
  'Tambahkan foto yang menggambarkan kondisi kos.',
  'Pilih fasilitas dan tulis aturan kos.',
  'Isi harga sewa dan ketersediaan kamar.',
  'Periksa semua informasi sebelum dikirim untuk ditinjau.',
];

const LAST_STEP = STEP_LABELS.length - 1;

type KosWizardProps = {
  kos?: Kos;
};

export function KosWizard({ kos }: KosWizardProps) {
  const router = useRouter();
  const toast = useToast();
  const { session } = useSession();
  const userId = session?.user._id;

  const editing = Boolean(kos);
  const isApproved = kos?.status_verifikasi === 'approved';

  // State sinkronisasi server
  const [currentKos, setCurrentKos] = useState<Kos | undefined>(kos);
  const [activeSubmission, setActiveSubmission] = useState<SubmissionDetail | null>(null);
  const [isLoadingChange, setIsLoadingChange] = useState(isApproved);
  const [changeLoadError, setChangeLoadError] = useState<string | null>(null);

  // Status pending
  const isInitialPending = currentKos?.status_verifikasi === 'pending';
  const isChangePending = activeSubmission?.status === 'pending';
  const isReadOnlyPending = isInitialPending || isChangePending;

  // Draf lokal pemulihan opsional
  const [localDraftPrompt, setLocalDraftPrompt] = useState<{
    values: KosFormValues;
    savedAt: string;
  } | null>(null);

  // Foto yang terunggah secara nyata
  const initialPhotos: PhotoPickerItem[] = (currentKos?.foto_items || []).map((f) => ({
    asset_id: f.asset_id,
    url: f.url,
    alt: f.alt,
    is_legacy: f.asset_id === null,
  }));
  const [photos, setPhotos] = useState<PhotoPickerItem[]>(initialPhotos);

  const form: KosForm = useForm({
    resolver: zodResolver(kosFormSchema),
    defaultValues: currentKos ? fromKos(currentKos) : EMPTY_KOS_FORM,
    mode: 'onTouched',
  });

  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(editing ? LAST_STEP : 0);
  const [photoError, setPhotoError] = useState<string | undefined>();
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);

  // Cek draf lokal untuk tawaran pemulihan opsional
  useEffect(() => {
    if (!editing && userId) {
      const saved = loadDraft(userId);
      if (saved && saved.values && (saved.values.nama || saved.values.alamat)) {
        setLocalDraftPrompt({
          values: saved.values,
          savedAt: saved.savedAt,
        });
      }
    }
  }, [editing, userId]);

  // Muat draf perubahan yang ada untuk kos approved dengan penanganan loading dan retry
  const loadChangeDraft = useCallback(async () => {
    if (!kos || !isApproved) {
      setIsLoadingChange(false);
      return;
    }
    setIsLoadingChange(true);
    setChangeLoadError(null);
    try {
      const submission = await getChangeSubmission(kos._id);
      if (submission) {
        setActiveSubmission(submission);
        if (submission.after) {
          const after = submission.after;
          form.reset({
            nama: after.nama,
            tipe: after.tipe,
            area_kampus: after.area_kampus || '',
            deskripsi: after.deskripsi,
            alamat: after.alamat,
            latitude: String(after.koordinat.latitude),
            longitude: String(after.koordinat.longitude),
            foto_ids: after.foto.map((p) => p.asset_id).filter((id): id is string => Boolean(id)),
            foto_urls: after.foto.map((p) => p.url),
            fasilitas: after.fasilitas,
            peraturan: after.peraturan || [],
            harga_per_bulan: String(after.harga_per_bulan),
            luas_kamar: after.luas_kamar || '',
            jumlah_kamar_total: String(after.jumlah_kamar_total),
            jumlah_kamar_tersedia: String(currentKos?.jumlah_kamar_tersedia ?? 0),
          });
          setPhotos(
            after.foto.map((p) => ({
              asset_id: p.asset_id,
              url: p.url,
              alt: p.alt,
              is_legacy: p.asset_id === null,
            }))
          );
        }
      }
    } catch (err) {
      setChangeLoadError(errorMessage(err));
    } finally {
      setIsLoadingChange(false);
    }
  }, [kos, isApproved, form, currentKos?.jumlah_kamar_tersedia]);

  useEffect(() => {
    void loadChangeDraft();
  }, [loadChangeDraft]);

  // Sinkronkan state photos ke form foto_ids dan foto_urls
  const handlePhotosChange = (nextPhotos: PhotoPickerItem[]) => {
    setPhotos(nextPhotos);
    const validIds = nextPhotos
      .map((p) => p.asset_id)
      .filter((id): id is string => Boolean(id));
    form.setValue('foto_ids', validIds, { shouldValidate: true, shouldDirty: true });
    form.setValue('foto_urls', nextPhotos.map((p) => p.url), { shouldDirty: true });
    if (nextPhotos.length > 0) {
      setPhotoError(undefined);
    }
  };

  const goTo = (target: number) => {
    setStep(target);
    setMaxReached((current) => Math.max(current, target));
    headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validatePhotos = () => {
    if (photos.length === 0) {
      setPhotoError('Tambahkan minimal satu foto kos.');
      return false;
    }
    setPhotoError(undefined);
    return true;
  };

  const next = async () => {
    const fields = STEP_FIELDS[step] ?? [];
    const valid =
      fields.length === 0
        ? true
        : await form.trigger(fields as Path<KosFormValues>[], { shouldFocus: true });
    const photosOk = step === 2 ? validatePhotos() : true;
    if (valid && photosOk) goTo(step + 1);
  };

  // Simpan draf parsial ke server
  const onSaveServerDraft = async () => {
    setIsSavingDraft(true);
    setSubmitError(null);
    try {
      const values = form.getValues();
      const photoIds = photos.map((p) => p.asset_id).filter((id): id is string => Boolean(id));

      if (isApproved && kos) {
        const expectedVersion = activeSubmission?.version ?? kos.version;
        const snapshotPayload = toDraftSnapshotPayload({
          ...values,
          foto_ids: photoIds,
        });
        const changePayload = sanitizeChangeContentPayload(snapshotPayload);
        const result = await upsertChangeDraft(kos._id, expectedVersion, changePayload);
        setActiveSubmission(result);
        toast.success('Draf perubahan berhasil disimpan di server.');
      } else if (currentKos?._id) {
        const snapshotPayload = toDraftSnapshotPayload({
          ...values,
          foto_ids: photoIds,
        });
        const updated = await updateDraft(currentKos._id, currentKos.version, snapshotPayload);
        setCurrentKos(updated);
        toast.success(`Draf listing diperbarui (versi ${updated.version}).`);
      } else {
        const partialPayload = toPartialDraftPayload({
          ...values,
          foto_ids: photoIds,
        });
        const created = await createDraft(partialPayload);
        setCurrentKos(created);
        toast.success('Draf listing baru berhasil disimpan di server.');
        router.replace(`/pemilik/kos/${created._id}/edit`);
      }
    } catch (error) {
      setSubmitError(errorMessage(error));
      toast.error(errorMessage(error));
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Penarikan pengajuan yang sedang pending
  const onWithdraw = async () => {
    if (!currentKos) return;
    setWithdrawing(true);
    setSubmitError(null);
    try {
      if (isApproved && activeSubmission) {
        const updated = await withdrawChangeDraft(currentKos._id, activeSubmission.version);
        setActiveSubmission(updated);
        toast.success('Pengajuan perubahan berhasil ditarik. Anda dapat menyunting kembali.');
      } else {
        const targetVersion = currentKos.perubahan_tertunda?.version ?? currentKos.version;
        const updatedKos = await withdrawInitialKos(currentKos._id, targetVersion);
        setCurrentKos(updatedKos);
        toast.success('Pengajuan berhasil ditarik dan kembali menjadi draf.');
      }
    } catch (error) {
      setSubmitError(errorMessage(error));
      toast.error(errorMessage(error));
    } finally {
      setWithdrawing(false);
    }
  };

  const applyServerErrors = (error: ApiError) => {
    if (!error.fieldErrors) return;
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if (field in EMPTY_KOS_FORM && messages[0]) {
        form.setError(field as Path<KosFormValues>, {
          type: 'server',
          message: messages[0],
        });
      }
    }
  };

  const submit = () =>
    form.handleSubmit(
      async (values) => {
        if (!confirmed) {
          setConfirmError('Centang pernyataan ini sebelum mengirim.');
          return;
        }
        if (!validatePhotos()) {
          goTo(2);
          return;
        }

        setConfirmError(undefined);
        setSubmitError(null);
        setSubmitting(true);

        try {
          const input = toKosInput(values);

          if (isApproved && kos) {
            // Pengajuan perubahan untuk listing yang sudah approved (orkestrasi version respons upsert -> submit)
            const baseVersion = kos.version;
            const sub = await orchestrateSaveAndSubmitChange(
              kos._id,
              activeSubmission?.version ?? baseVersion,
              input
            );
            setActiveSubmission(sub);
            toast.success('Pengajuan perubahan berhasil dikirim untuk ditinjau.');
            router.push(`/pemilik/kos/${kos._id}`);
            return;
          }

          let targetKos = currentKos;
          if (!targetKos?._id) {
            // Buat draf awal jika belum pernah disimpan
            targetKos = await createDraft(input);
          } else {
            // Update draf awal ke konten lengkap
            targetKos = await updateDraft(targetKos._id, targetKos.version, input);
          }

          // Ajukan draf awal
          await submitInitialKos(targetKos._id, targetKos.version);

          if (userId) {
            deleteDraft(userId);
          }

          toast.success('Listing berhasil diajukan untuk ditinjau admin.');
          router.push(`/pemilik/kos/${targetKos._id}`);
        } catch (error) {
          if (error instanceof ApiError) applyServerErrors(error);
          setSubmitError(errorMessage(error));
          setSubmitting(false);
        }
      },
      (errors) => {
        const firstStep = STEP_FIELDS.findIndex((fields) =>
          fields.some((field) => field in errors)
        );
        if (firstStep >= 0) goTo(firstStep);
      }
    )();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-bold outline-none sm:text-[28px]"
        >
          {editing
            ? isApproved
              ? `Edit perubahan: ${kos?.nama}`
              : `Edit ${currentKos?.nama || 'kos'}`
            : STEP_LABELS[step] === 'Informasi'
            ? 'Informasi kos'
            : STEP_LABELS[step]}
        </h1>
        <p className="mt-2 text-[15px] text-ink-muted">
          Langkah {step + 1} dari {STEP_LABELS.length} · {STEP_DESCRIPTIONS[step]}
        </p>
      </div>

      <Stepper current={step} maxReached={maxReached} onSelect={goTo} />

      {/* Banner pemulihan draf lokal */}
      {localDraftPrompt ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-brand-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-brand">Ditemukan draf tersimpan di perangkat ini</p>
            <p className="text-xs text-ink-muted">
              Disimpan {formatRelativeShort(localDraftPrompt.savedAt)}. Ingin memulihkan data tersebut?
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                form.reset(localDraftPrompt.values);
                setLocalDraftPrompt(null);
                toast.success('Draf perangkat dipulihkan.');
              }}
            >
              Gunakan draf
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (userId) deleteDraft(userId);
                setLocalDraftPrompt(null);
              }}
            >
              Abaikan
            </Button>
          </div>
        </div>
      ) : null}

      {/* Penjelasan mode approved edit */}
      {isApproved ? (
        <Alert>
          Listing ini sedang terbit untuk publik. Perubahan yang Anda buat di sini akan disimpan
          sebagai draf perubahan dan ditinjau oleh admin. Versi terbit saat ini tetap aktif sampai perubahan disetujui.
        </Alert>
      ) : null}

      {/* Catatan revisi/penolakan jika ada */}
      {currentKos?.status_verifikasi === 'revision' && currentKos.catatan_verifikasi ? (
        <Alert tone="warning">
          <strong>Catatan revisi admin:</strong> {currentKos.catatan_verifikasi}
        </Alert>
      ) : null}
      {currentKos?.status_verifikasi === 'rejected' && currentKos.catatan_verifikasi ? (
        <Alert tone="danger">
          <strong>Catatan penolakan admin:</strong> {currentKos.catatan_verifikasi}
        </Alert>
      ) : null}

      {/* Proteksi loading dan error saat memuat draf perubahan */}
      {isLoadingChange ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Spinner label="Memeriksa draf perubahan di server…" />
        </Card>
      ) : changeLoadError ? (
        <ErrorState
          message={`Gagal memuat draf perubahan: ${changeLoadError}`}
          onRetry={loadChangeDraft}
        />
      ) : isReadOnlyPending ? (
        /* Mode pending read-only dengan tombol tarik */
        <Card className="flex flex-col gap-4 border-amber-200 bg-amber-50/50 p-6">
          <h2 className="font-semibold text-amber-900">
            Pengajuan sedang dalam peninjauan admin
          </h2>
          <p className="text-sm text-amber-800">
            {isApproved
              ? 'Perubahan konten sedang ditinjau admin. Anda tidak dapat menyunting data sebelum menarik pengajuan atau menunggu keputusan admin.'
              : 'Listing baru sedang ditinjau admin. Untuk mengubah informasi, tarik pengajuan terlebih dahulu.'}
          </p>
          <div>
            <Button
              variant="secondary"
              loading={withdrawing}
              onClick={onWithdraw}
            >
              Tarik pengajuan
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (step === LAST_STEP) void submit();
              else void next();
            }}
          >
            {step === 0 ? <StepInformasi form={form} /> : null}
            {step === 1 ? <StepLokasi form={form} /> : null}
            {step === 2 ? (
              <PhotoPicker
                photos={photos}
                onPhotosChange={handlePhotosChange}
                error={photoError ?? form.formState.errors.foto_ids?.message}
                disabled={submitting}
              />
            ) : null}
            {step === 3 ? <StepFasilitas form={form} /> : null}
            {step === 4 ? <StepKamar form={form} editing={isApproved} /> : null}
            {step === LAST_STEP ? (
              <StepTinjau
                form={form}
                photos={photos}
                editing={isApproved}
                confirmed={confirmed}
                onConfirmedChange={(value) => {
                  setConfirmed(value);
                  if (value) setConfirmError(undefined);
                }}
                confirmError={confirmError}
              />
            ) : null}

            {submitError ? (
              <Alert tone="danger" className="mt-6">
                {submitError}
              </Alert>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              {step > 0 ? (
                <Button
                  variant="secondary"
                  onClick={() => goTo(step - 1)}
                  disabled={submitting || isSavingDraft}
                >
                  Kembali
                </Button>
              ) : null}
              <Button
                variant="secondary"
                onClick={onSaveServerDraft}
                disabled={submitting}
                loading={isSavingDraft}
              >
                Simpan draf ke server
              </Button>
              <Button type="submit" loading={submitting} disabled={isSavingDraft}>
                {step === LAST_STEP
                  ? isApproved
                    ? 'Ajukan perubahan'
                    : 'Kirim untuk ditinjau'
                  : `Lanjut: ${STEP_LABELS[step + 1]?.toLowerCase()}`}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
