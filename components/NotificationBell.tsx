'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications, AppNotification } from '@/contexts/NotificationContext';
import { Bell, X, Check, CheckCheck, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ================================================================
   FLOATING TOAST  —  appears when a new notification arrives
   ================================================================ */
export function NotificationToast() {
    const { activeToast, dismissToast, markRead } = useNotifications();
    const router = useRouter();

    if (!activeToast) return null;

    const handleClick = () => {
        markRead(activeToast.id);
        dismissToast();
        if (activeToast.action?.href) router.push(activeToast.action.href);
    };

    return (
        <div className="fixed top-4 right-4 z-[70] max-w-sm w-full animate-in slide-in-from-top-2 fade-in duration-300">
            <div
                onClick={handleClick}
                className="bg-card border border-border/60 rounded-2xl shadow-2xl p-4 cursor-pointer hover:shadow-xl transition-shadow flex items-start gap-3"
            >
                {/* Icon */}
                <span className="text-2xl flex-shrink-0 mt-0.5">{activeToast.icon || '🔔'}</span>
                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{activeToast.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{activeToast.body}</p>
                    {activeToast.action && (
                        <span className="inline-block mt-1.5 text-xs font-medium text-primary hover:text-primary/80">{activeToast.action.label} &rarr;</span>
                    )}
                </div>
                {/* Dismiss */}
                <button
                    onClick={(e) => { e.stopPropagation(); dismissToast(); }}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

/* ================================================================
   NOTIFICATION BELL  —  header/sidebar icon with dropdown panel
   ================================================================ */
export function NotificationBell({ collapsed }: { collapsed?: boolean }) {
    const { notifications, unreadCount, markRead, markAllRead, clear } = useNotifications();
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open]);

    const handleNotifClick = (n: AppNotification) => {
        markRead(n.id);
        setOpen(false);
        if (n.action?.href) router.push(n.action.href);
    };

    const timeAgo = (ts: number) => {
        const diff = Date.now() - ts;
        if (diff < 60_000) return 'Just now';
        if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
        return `${Math.floor(diff / 86_400_000)}d ago`;
    };

    return (
        <div ref={panelRef} className="relative">
            {/* Bell Button */}
            <button
                onClick={() => setOpen(!open)}
                className={cn(
                    "relative p-2 rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-accent",
                    open && "bg-accent text-foreground"
                )}
                title="Notifications"
            >
                <Bell className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {open && (
                <div className="absolute left-0 top-full mt-2 w-80 max-h-[28rem] bg-card border border-border/60 rounded-2xl shadow-2xl z-50 flex flex-col animate-in fade-in scale-in duration-150 origin-top-left">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="p-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    title="Mark all as read"
                                >
                                    <CheckCheck className="h-3.5 w-3.5" />
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button
                                    onClick={() => { clear(); setOpen(false); }}
                                    className="p-1.5 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    title="Clear all"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-12 text-center">
                                <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.slice(0, 20).map(n => (
                                <button
                                    key={n.id}
                                    onClick={() => handleNotifClick(n)}
                                    className={cn(
                                        "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0",
                                        !n.read && "bg-primary/5"
                                    )}
                                >
                                    <span className="text-lg flex-shrink-0 mt-0.5">{n.icon || '🔔'}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                                            <p className={cn("text-xs font-semibold truncate", n.read ? "text-foreground/70" : "text-foreground")}>{n.title}</p>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
                                        <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
