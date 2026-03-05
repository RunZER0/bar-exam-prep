'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

/* ─── Types ─── */
export type NotifType =
    | 'study_reminder' | 'daily_plan' | 'weekly_report' | 'diagnosis'
    | 'streak' | 'encouragement' | 'tip' | 'achievement';

export interface AppNotification {
    id: string;
    type: NotifType;
    title: string;
    body: string;
    icon?: string;
    action?: { label: string; href: string };
    createdAt: number;
    read: boolean;
}

interface NotifContextValue {
    notifications: AppNotification[];
    unreadCount: number;
    activeToast: AppNotification | null;
    push: (notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
    markRead: (id: string) => void;
    markAllRead: () => void;
    dismissToast: () => void;
    clear: () => void;
}

const NotifContext = createContext<NotifContextValue | null>(null);

export function useNotifications() {
    const ctx = useContext(NotifContext);
    if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
    return ctx;
}

/* ─── Provider ─── */
const STORAGE_KEY = 'ynai_notifications';
const MAX_STORED = 50;

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [activeToast, setActiveToast] = useState<AppNotification | null>(null);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) setNotifications(JSON.parse(stored));
        } catch { /* fresh */ }
    }, []);

    // Persist on change
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_STORED)));
        } catch { /* quota */ }
    }, [notifications]);

    // Listen for custom events (from API calls, system messages, etc.)
    useEffect(() => {
        const handler = (e: CustomEvent<Omit<AppNotification, 'id' | 'createdAt' | 'read'>>) => {
            pushNotif(e.detail);
        };
        window.addEventListener('ynai:notify' as any, handler);
        return () => window.removeEventListener('ynai:notify' as any, handler);
    }, []);

    const pushNotif = useCallback((data: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
        const notif: AppNotification = {
            ...data,
            id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            createdAt: Date.now(),
            read: false,
        };
        setNotifications(prev => [notif, ...prev].slice(0, MAX_STORED));
        setActiveToast(notif);
        // Auto-dismiss toast after 6 seconds
        setTimeout(() => setActiveToast(prev => prev?.id === notif.id ? null : prev), 6000);
    }, []);

    const markRead = useCallback((id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const dismissToast = useCallback(() => setActiveToast(null), []);

    const clear = useCallback(() => {
        setNotifications([]);
        setActiveToast(null);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <NotifContext.Provider value={{ notifications, unreadCount, activeToast, push: pushNotif, markRead, markAllRead, dismissToast, clear }}>
            {children}
        </NotifContext.Provider>
    );
}
