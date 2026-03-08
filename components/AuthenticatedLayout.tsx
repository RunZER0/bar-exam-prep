'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import Sidebar from '@/components/Sidebar';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import FloatingChat from '@/components/FloatingChat';
import EngagingLoader from '@/components/EngagingLoader';
import { autonomousPreload } from '@/lib/services/autonomous-preload';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { NotificationToast } from '@/components/NotificationBell';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, getIdToken } = useAuth();
  const { collapsed } = useSidebar();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  const mainMargin = collapsed ? 'ml-0 md:ml-[72px]' : 'ml-0 md:ml-64';
  const preloadInitialized = useRef(false);
  const onboardingCheckRef = useRef(false);

  // Check onboarding status for new users
  useEffect(() => {
    if (!user || loading || onboardingCheckRef.current) return;
    if (pathname === '/onboarding') {
      setOnboardingChecked(true);
      return;
    }

    onboardingCheckRef.current = true;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await fetch('/api/onboarding/exam', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.needsOnboarding) {
            router.replace('/onboarding');
            return;
          }
        }
      } catch {
        // Silently continue if check fails
      } finally {
        setOnboardingChecked(true);
      }
    })();
  }, [user, loading, pathname, getIdToken, router]);

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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <EngagingLoader size="lg" message="Setting up your workspace..." />
      </div>
    );
  }

  if (!user) return null;

  return (
    <NotificationProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className={`mt-14 md:mt-0 overflow-y-auto bg-background min-h-screen transition-all duration-300 ${mainMargin}`}>
          <div className="min-h-full">
            {children}
          </div>
        </main>
        <FloatingChat />
        <PWAInstallPrompt />
        <NotificationToast />
      </div>
    </NotificationProvider>
  );
}
