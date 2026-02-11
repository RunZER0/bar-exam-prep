'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  ClipboardCheck,
  Lightbulb,
  Search,
  Shield,
  LogOut,
  Menu,
  X,
  Scale,
  Coffee,
  MessageCircleQuestion,
  Flame,
  History,
} from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/drafting', label: 'Legal Drafting', icon: FileText },
  { href: '/study', label: 'Study', icon: BookOpen },
  { href: '/exams', label: 'Examinations', icon: ClipboardCheck },
  { href: '/quizzes', label: 'Quizzes & Trivia', icon: Lightbulb },
  { href: '/research', label: 'Research', icon: Search },
  { href: '/clarify', label: 'Get Clarification', icon: MessageCircleQuestion },
  { href: '/banter', label: 'Legal Banter', icon: Coffee },
  { href: '/history', label: 'Chat History', icon: History },
];

const ADMIN_ITEM = { href: '/admin', label: 'Admin Panel', icon: Shield };

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const nav = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 pt-6 pb-8">
        <Scale className="h-7 w-7 text-primary shrink-0" />
        <div className="leading-tight">
          <p className="font-bold text-base">Ynai</p>
          <p className="text-[11px] text-muted-foreground">Kenya Bar Exam Prep</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`sidebar-link ${isActive(item.href) ? 'active' : 'text-muted-foreground'}`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {/* Admin (only hinted visually; server-side checks enforce role) */}
        <div className="pt-4 mt-4 border-t">
          <Link
            href={ADMIN_ITEM.href}
            onClick={() => setMobileOpen(false)}
            className={`sidebar-link ${isActive(ADMIN_ITEM.href) ? 'active' : 'text-muted-foreground'}`}
          >
            <ADMIN_ITEM.icon className="h-[18px] w-[18px] shrink-0" />
            {ADMIN_ITEM.label}
          </Link>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t px-3 py-4 space-y-2">
        <ThemeToggle />
        <div className="flex items-center gap-2 pt-2">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{user?.displayName || 'Student'}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="sidebar-link text-muted-foreground w-full"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-primary" />
          <span className="font-bold">Ynai</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 rounded-lg hover:bg-accent">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — desktop always visible, mobile slide-in */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen w-64 bg-card border-r flex flex-col
          transition-transform duration-200
          md:translate-x-0 md:static md:z-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {nav}
      </aside>
    </>
  );
}
