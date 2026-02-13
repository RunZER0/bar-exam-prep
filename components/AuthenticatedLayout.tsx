'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import Sidebar from '@/components/Sidebar';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import FloatingChat from '@/components/FloatingChat';
import { autonomousPreload } from '@/lib/services/autonomous-preload';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading, getIdToken } = useAuth();
  const { collapsed } = useSidebar();
  const preloadInitialized = useRef(false);

  // Initialize autonomous preloading when user is authenticated
  useEffect(() => {
    if (user && !preloadInitialized.current) {
      preloadInitialized.current = true;
      
      // Initialize with token getter
      autonomousPreload.init(getIdToken);
      
      // Start autonomous background tasks
      getIdToken().then(token => {
        if (token) {
          autonomousPreload.setAuthToken(token);
          autonomousPreload.start();
        }
      });
    }

    // Cleanup on unmount
    return () => {
      if (preloadInitialized.current) {
        autonomousPreload.stop();
        preloadInitialized.current = false;
      }
    };
  }, [user, getIdToken]);

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
      <main className={`mt-14 md:mt-0 overflow-y-auto bg-background min-h-screen transition-all duration-300 ${collapsed ? 'ml-0 md:ml-[72px]' : 'ml-0 md:ml-64'}`}>
        <div className="min-h-full">
          {children}
        </div>
      </main>
      <FloatingChat />
      <PWAInstallPrompt />
    </div>
  );
}
