'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
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
  Coffee,
  MessageCircleQuestion,
  History,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Crown,
  Users,
  Target,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/mastery', label: 'Mastery Hub', icon: Target },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/progress', label: 'My Progress', icon: TrendingUp },
  { href: '/drafting', label: 'Legal Drafting', icon: FileText },
  { href: '/study', label: 'Study', icon: BookOpen },
  { href: '/exams', label: 'Examinations', icon: ClipboardCheck },
  { href: '/quizzes', label: 'Quizzes & Trivia', icon: Lightbulb },
  { href: '/community', label: 'Community', icon: Users },
  { href: '/research', label: 'Research', icon: Search },
  { href: '/clarify', label: 'Get Clarification', icon: MessageCircleQuestion },
  { href: '/banter', label: 'Legal Banter', icon: Coffee },
  { href: '/history', label: 'Chat History', icon: History },
];

const PREMIUM_ITEM = { href: '/subscribe', label: 'Upgrade', icon: Crown };

const ADMIN_ITEM = { href: '/admin', label: 'Admin Panel', icon: Shield };

// Admin emails - you can add more or use an API check
const ADMIN_EMAILS = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.split(',') || [];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  const isActive = (href: string) => {
    if (href === '/mastery') return pathname === '/mastery' || pathname === '/';
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  const nav = (
    <>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 pt-6 pb-6 ${collapsed ? 'justify-center' : ''}`}>
        <Image
          src="/favicon-32x32.png"
          alt="Ynai Logo"
          width={32}
          height={32}
          className="shrink-0"
          priority
        />
        {!collapsed && (
          <div className="leading-tight">
            <p className="font-bold text-base">Ynai</p>
            <p className="text-[10px] text-muted-foreground">Bar Exam Prep</p>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${active 
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Upgrade to Premium */}
        <div className="pt-4 mt-4 border-t border-border/50">
          <Link
            href={PREMIUM_ITEM.href}
            onClick={() => setMobileOpen(false)}
            title={collapsed ? PREMIUM_ITEM.label : undefined}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              ${isActive(PREMIUM_ITEM.href) 
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-500 border border-amber-500/30' 
                : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 hover:from-amber-500/20 hover:to-orange-500/20'
              }
              ${collapsed ? 'justify-center' : ''}
            `}
          >
            <PREMIUM_ITEM.icon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>{PREMIUM_ITEM.label}</span>}
          </Link>
        </div>

        {/* Admin - only show to admin users */}
        {isAdmin && (
          <div className="pt-4 mt-4 border-t border-border/50">
            <Link
              href={ADMIN_ITEM.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? ADMIN_ITEM.label : undefined}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive(ADMIN_ITEM.href) 
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
            >
              <ADMIN_ITEM.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{ADMIN_ITEM.label}</span>}
            </Link>
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-border/50 px-3 py-4 space-y-3">
        {!collapsed && <ThemeToggle />}
        
        <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="h-9 w-9 rounded-full shrink-0" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-semibold text-sm shrink-0">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || '?'}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{user?.displayName || 'Student'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
        </div>
        
        <button
          onClick={signOut}
          title={collapsed ? 'Sign Out' : undefined}
          className={`
            flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full
            text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200
            ${collapsed ? 'justify-center' : ''}
          `}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/favicon-32x32.png"
            alt="Ynai Logo"
            width={28}
            height={28}
            className="shrink-0"
            priority
          />
          <span className="font-bold text-lg">Ynai</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-xl hover:bg-accent">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm" 
          onClick={() => setMobileOpen(false)} 
        />
      )}

      {/* Sidebar - always fixed, desktop always visible, mobile slide-in */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen bg-background border-r border-border/50 flex flex-col
          transition-all duration-300 ease-in-out
          md:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'w-[72px]' : 'w-64'}
        `}
      >
        {nav}
        
        {/* Collapse toggle - desktop only */}
        <button
          onClick={toggleCollapse}
          className="hidden md:flex absolute -right-3 top-20 h-6 w-6 items-center justify-center rounded-full bg-card border border-border hover:bg-accent transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      </aside>
    </>
  );
}
