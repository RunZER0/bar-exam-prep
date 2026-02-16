'use client';

/**
 * Sheet/Drawer Component
 * 
 * A smooth sliding panel that overlays content from the side.
 * Perfect for showing details without navigating away.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: 'left' | 'right' | 'bottom';
  className?: string;
}

export function Sheet({ open, onClose, children, side = 'right', className }: SheetProps) {
  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Prevent body scroll when open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const slideClasses = {
    right: {
      container: 'right-0 top-0 h-full',
      enter: 'translate-x-0',
      exit: 'translate-x-full',
    },
    left: {
      container: 'left-0 top-0 h-full',
      enter: 'translate-x-0',
      exit: '-translate-x-full',
    },
    bottom: {
      container: 'bottom-0 left-0 w-full',
      enter: 'translate-y-0',
      exit: 'translate-y-full',
    },
  };

  const config = slideClasses[side];

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Sheet Panel */}
      <div
        className={cn(
          'fixed z-50 bg-background shadow-2xl transition-transform duration-300 ease-out',
          config.container,
          side === 'bottom' ? 'max-h-[85vh] rounded-t-2xl' : 'w-full max-w-lg',
          open ? config.enter : config.exit,
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </>
  );
}

interface SheetHeaderProps {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export function SheetHeader({ children, onClose, className }: SheetHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between p-4 border-b', className)}>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface SheetContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SheetContent({ children, className }: SheetContentProps) {
  return (
    <div className={cn('p-4 overflow-y-auto max-h-[calc(100vh-80px)]', className)}>
      {children}
    </div>
  );
}

interface SheetTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function SheetTitle({ children, className }: SheetTitleProps) {
  return (
    <h2 className={cn('text-lg font-semibold', className)}>
      {children}
    </h2>
  );
}

interface SheetDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function SheetDescription({ children, className }: SheetDescriptionProps) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      {children}
    </p>
  );
}
