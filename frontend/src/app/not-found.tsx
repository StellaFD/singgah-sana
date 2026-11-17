import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Button from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mx-auto max-w-md">
          <span className="inline-block text-6xl font-bold text-brand-primary mb-4 font-sora">
            404
          </span>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl font-sora mb-3">
            Halaman Tidak Ditemukan
          </h1>
          <p className="text-ink-muted text-base mb-8 leading-relaxed">
            Halaman atau listing kos yang Anda cari mungkin telah dihapus, diarsipkan, atau alamat URL yang dituju tidak tersedia.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/" className="w-full sm:w-auto">
              <Button variant="primary" size="md" className="w-full sm:w-auto px-6">
                Kembali ke Beranda
              </Button>
            </Link>
            <Link href="/jelajah" className="w-full sm:w-auto">
              <Button variant="secondary" size="md" className="w-full sm:w-auto px-6">
                Jelajah Kos
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
