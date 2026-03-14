'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Megaphone } from 'lucide-react';

const DISMISS_KEY = 'ynai_dismissed_announcement';

export default function SiteAnnouncement() {
  const [announcement, setAnnouncement] = useState('');
  const [dismissed, setDismissed] = useState(true);

  const fetchAnnouncement = useCallback(async () => {
    try {
      const res = await fetch('/api/site-settings');
      if (!res.ok) return;
      const data = await res.json();
      const text = (data.siteAnnouncement || '').trim();
      if (!text) return;

      // Check if user already dismissed this exact announcement
      const prev = localStorage.getItem(DISMISS_KEY);
      if (prev === text) return;

      setAnnouncement(text);
      setDismissed(false);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchAnnouncement();
    // Re-check every 5 minutes for new announcements
    const interval = setInterval(fetchAnnouncement, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAnnouncement]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, announcement);
  };

  if (dismissed || !announcement) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center justify-center gap-3 relative z-50">
      <Megaphone className="h-4 w-4 text-primary shrink-0" />
      <p className="text-sm text-foreground text-center flex-1">{announcement}</p>
      <button
        onClick={handleDismiss}
        className="p-1 rounded-full hover:bg-primary/10 transition-colors shrink-0"
        aria-label="Dismiss announcement"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
