'use client';

import AdminAppPage from '../../../components/admin/AdminAppPage';
import AdminKosManagement from '../../../components/admin/AdminKosManagement';

export default function AdminKosPage() {
  return (
    <AdminAppPage
      pageDescription="Lihat dan kelola status listing kos."
      pageTitle="Semua kos"
    >
      {({ token, expireSession }) => (
        <AdminKosManagement expireSession={expireSession} token={token} />
      )}
    </AdminAppPage>
  );
}
