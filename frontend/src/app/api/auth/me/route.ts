import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getBackendApiUrl } from '@/lib/normalizer';
import type { AuthUser } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const backendBase = getBackendApiUrl();
  const authUrl = `${backendBase}/auth/me`;

  // Timeout guard 5000ms untuk mencegah hanging connection
  const timeoutController = new AbortController();
  const timer = setTimeout(() => {
    timeoutController.abort();
  }, 5000);

  const abortListener = () => {
    timeoutController.abort();
  };

  if (request.signal) {
    request.signal.addEventListener('abort', abortListener, { once: true });
  }

  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const res = await fetch(authUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Cookie: cookieHeader,
      },
      cache: 'no-store',
      signal: timeoutController.signal,
    });

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    if (res.status === 401) {
      return NextResponse.json({
        success: false,
        status: 'anonymous',
        user: null,
      });
    }

    if (res.status === 404 || res.status === 501 || res.status === 503) {
      return NextResponse.json({
        success: false,
        status: 'unavailable',
        message: 'Layanan autentikasi sesi saat ini belum tersedia.',
        user: null,
      });
    }

    // Ekstraksi candidate user dari: {success, data: user}, {data: {user}}, atau {user}
    let userCandidate: Record<string, unknown> | null = null;
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      if (d.data && typeof d.data === 'object' && !Array.isArray(d.data)) {
        const nestedData = d.data as Record<string, unknown>;
        if (nestedData.user && typeof nestedData.user === 'object' && !Array.isArray(nestedData.user)) {
          userCandidate = nestedData.user as Record<string, unknown>;
        } else {
          userCandidate = nestedData;
        }
      } else if (d.user && typeof d.user === 'object' && !Array.isArray(d.user)) {
        userCandidate = d.user as Record<string, unknown>;
      }
    }

    if (res.ok && userCandidate) {
      const rawId = userCandidate._id ?? userCandidate.id;
      const id = typeof rawId === 'string' && rawId.trim() ? rawId.trim() : '';

      // ID kosong: JANGAN PERNAH fabrikasi authenticated!
      if (!id) {
        return NextResponse.json({
          success: false,
          status: 'anonymous',
          user: null,
        });
      }

      // Validasi role: jangan fabrikasi authenticated dari role unknown
      const rawRole = typeof userCandidate.role === 'string' ? userCandidate.role.toLowerCase().trim() : '';
      const validRoles = ['pencari', 'pemilik', 'admin'];
      if (!validRoles.includes(rawRole)) {
        return NextResponse.json({
          success: false,
          status: 'anonymous',
          user: null,
        });
      }

      // Periksa apakah akun dalam status suspended atau nonaktif
      const userStatus = typeof userCandidate.status === 'string' ? userCandidate.status.toLowerCase().trim() : 'active';
      if (userStatus === 'suspended' || userStatus === 'banned' || userCandidate.is_suspended === true) {
        return NextResponse.json({
          success: false,
          status: 'unavailable',
          message: 'Akun Anda sedang ditangguhkan.',
          user: null,
        });
      }

      // Whitelist ketat DTO publik: HANYA izinkan id, nama, role, dan status
      const safeUser: AuthUser = {
        id,
        nama: typeof userCandidate.nama === 'string' && userCandidate.nama.trim()
          ? userCandidate.nama.trim()
          : typeof userCandidate.name === 'string' && userCandidate.name.trim()
          ? userCandidate.name.trim()
          : 'Pengguna',
        role: rawRole as AuthUser['role'],
        status: userStatus,
        email: typeof userCandidate.email === 'string' ? userCandidate.email : undefined,
        nomor_telepon: typeof userCandidate.nomor_telepon === 'string' ? userCandidate.nomor_telepon : undefined,
        foto_profil: typeof userCandidate.foto_profil === 'string' ? userCandidate.foto_profil : undefined,
        has_password: userCandidate.has_password === true,
        is_google: userCandidate.is_google === true,
        email_verified: Boolean(userCandidate.email_verified_at || userCandidate.email_verified === true),
        email_verified_at: typeof userCandidate.email_verified_at === 'string' ? userCandidate.email_verified_at : undefined,
        password_updated_at: typeof userCandidate.password_updated_at === 'string' ? userCandidate.password_updated_at : undefined,
      };

      return NextResponse.json({
        success: true,
        status: 'authenticated',
        user: safeUser,
      });
    }

    return NextResponse.json({
      success: false,
      status: 'unavailable',
      message: 'Sesi backend belum terhubung.',
      user: null,
    });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'AbortError' && request.signal?.aborted) {
      return new Response(null, { status: 499 });
    }
    return NextResponse.json({
      success: false,
      status: 'unavailable',
      message: 'Layanan sesi akun backend sedang tidak tersedia.',
      user: null,
    });
  } finally {
    clearTimeout(timer);
    if (request.signal) {
      request.signal.removeEventListener('abort', abortListener);
    }
  }
}
