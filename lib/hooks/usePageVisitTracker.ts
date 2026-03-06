'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * usePageVisitTracker - tracks time spent on a page section
 * Reports visits to /api/page-visits for history tracking.
 * Only records if user spends >= 5 minutes on the page.
 */
export function usePageVisitTracker(section: string, label?: string) {
  const { user } = useAuth();
  const startTimeRef = useRef<number>(Date.now());
  const elapsedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visibleRef = useRef(true);
  const reportedRef = useRef(false);

  const reportVisit = useCallback(async (seconds: number) => {
    if (!user || reportedRef.current) return;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 5) return; // Only track 5+ min visits
    reportedRef.current = true;
    try {
      const token = await user.getIdToken();
      await fetch('/api/page-visits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ section, label, minutes }),
      });
    } catch {
      // Silent fail
    }
  }, [user, section, label]);

  useEffect(() => {
    if (!user) return;
    startTimeRef.current = Date.now();
    elapsedRef.current = 0;
    reportedRef.current = false;

    const tick = () => {
      if (!visibleRef.current) return;
      elapsedRef.current += 1;
    };

    intervalRef.current = setInterval(tick, 1000);

    const onVisChange = () => { visibleRef.current = !document.hidden; };
    const onFocus = () => { visibleRef.current = true; };
    const onBlur = () => { visibleRef.current = false; };

    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      // Report on unmount
      reportVisit(elapsedRef.current);
    };
  }, [user, reportVisit]);
}
