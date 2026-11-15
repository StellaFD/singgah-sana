'use client';

import { useParams } from 'next/navigation';
import AdminAppPage from '../../../../components/admin/AdminAppPage';
import AdminLegacyReviewDetail from '../../../../components/admin/AdminLegacyReviewDetail';
import AdminSubmissionDetail from '../../../../components/admin/AdminSubmissionDetail';
import { isMockAdminSubmissionId } from '../../../../lib/adminSubmissionApi';
import { shouldUseAdminV1Api } from '../../../../lib/adminApiMode';

export default function AdminReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const submissionId =
    typeof params?.id === 'string' ? params.id : '';
  const useSubmissionContract =
    shouldUseAdminV1Api() || isMockAdminSubmissionId(submissionId);

  return (
    <AdminAppPage
      pageDescription="Periksa snapshot dan perubahan sebelum mengambil keputusan."
      pageTitle="Detail pengajuan"
    >
      {({ token, expireSession }) =>
        useSubmissionContract ? (
          <AdminSubmissionDetail
            expireSession={expireSession}
            submissionId={submissionId}
            token={token}
          />
        ) : (
          <AdminLegacyReviewDetail
            expireSession={expireSession}
            token={token}
          />
        )
      }
    </AdminAppPage>
  );
}
