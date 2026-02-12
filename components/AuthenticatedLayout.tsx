'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import Sidebar from '@/components/Sidebar';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import FloatingChat from '@/components/FloatingChat';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { collapsed } = useSidebar();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className={`mt-14 md:mt-0 overflow-y-auto bg-muted/30 min-h-screen transition-all duration-300 ${collapsed ? 'ml-0 md:ml-[72px]' : 'ml-0 md:ml-64'}`}>
        <div className="min-h-full">
          {children}
        </div>
      </main>
      <FloatingChat />
      <PWAInstallPrompt />
    </div>
  );
}
