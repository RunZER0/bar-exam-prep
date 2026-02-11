'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredEvent(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredEvent) return;
    deferredEvent.prompt();
    const result = await deferredEvent.userChoice;
    if (result.outcome === 'accepted') {
      setDeferredEvent(null);
    }
  };

  if (!deferredEvent || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-80 bg-card border shadow-lg rounded-xl p-4 z-50 animate-fade-in">
      <div className="flex items-start gap-3">
        <Download className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-sm">Install Ynai</p>
          <p className="text-xs text-muted-foreground mt-1">
            Install this app on your device for quick access, even offline.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={install}>Install</Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
              Later
            </Button>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
