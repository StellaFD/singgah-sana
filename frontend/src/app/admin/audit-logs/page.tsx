'use client';

import AdminAppPage from '../../../components/admin/AdminAppPage';
import AdminAuditLogs from '../../../components/admin/AdminAuditLogs';

export default function AdminAuditLogsPage() {
  return (
    <AdminAppPage
      pageDescription="Riwayat log audit tindakan peninjauan dan moderasi administrator."
      pageTitle="Aktivitas Admin"
    >
      {({ token, expireSession }) => (
        <AdminAuditLogs expireSession={expireSession} token={token} />
      )}
    </AdminAppPage>
  );
}
