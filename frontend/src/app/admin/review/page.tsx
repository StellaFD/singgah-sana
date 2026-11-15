'use client';

import AdminAppPage from '../../../components/admin/AdminAppPage';
import AdminModerationQueue from '../../../components/admin/AdminModerationQueue';

export default function AdminReviewPage() {
  return (
    <AdminAppPage
      pageDescription="Periksa pengajuan kos yang menunggu keputusan."
      pageTitle="Peninjauan"
    >
      {({ token, expireSession }) => (
        <AdminModerationQueue expireSession={expireSession} token={token} />
      )}
    </AdminAppPage>
  );
}
