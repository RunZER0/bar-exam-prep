'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * useTimeTracker - tracks active time on any section and reports to /api/streaks
 * 
 * Tracks elapsed seconds while the tab is visible/focused.
 * Reports every 60 seconds of active time (1 minute increments).
 * Pauses when tab is hidden/blurred.
 * Reports remaining time on unmount.
 */
export function useTimeTracker(section: string) {
  const { user } = useAuth();
  const elapsedRef = useRef(0);       // seconds accumulated since last report
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visibleRef = useRef(true);
  const sectionRef = useRef(section);
  sectionRef.current = section;

  const reportTime = useCallback(async (minutes: number) => {
    if (minutes <= 0 || !user) return;
    try {
      const token = await user.getIdToken();
      await fetch('/api/streaks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ minutes, questions: 0, sessions: 0 }),
      });
    } catch {
      // Silent fail - don't interrupt user experience
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const tick = () => {
      if (!visibleRef.current) return;
      elapsedRef.current += 1;
      // Report every 60 seconds
      if (elapsedRef.current >= 60) {
        const mins = Math.floor(elapsedRef.current / 60);
        elapsedRef.current = elapsedRef.current % 60;
        reportTime(mins);
      }
    };

    intervalRef.current = setInterval(tick, 1000);

    const onVisChange = () => {
      visibleRef.current = !document.hidden;
    };

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

      // Report remaining accumulated time on unmount
      if (elapsedRef.current >= 30) {
        // Round up if 30+ seconds
        reportTime(1);
      }
    };
  }, [user, reportTime]);
}
