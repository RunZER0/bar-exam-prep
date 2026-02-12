'use client';

import Image from 'next/image';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: 20, text: 'text-sm' },
  md: { icon: 24, text: 'text-base' },
  lg: { icon: 32, text: 'text-lg' },
  xl: { icon: 48, text: 'text-2xl' },
};

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const { icon, text } = sizes[size];
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/favicon-32x32.png"
        alt="Ynai Logo"
        width={icon}
        height={icon}
        className="shrink-0"
        priority
      />
      {showText && (
        <span className={`font-bold ${text}`}>Ynai</span>
      )}
    </div>
  );
}

export function LogoIcon({ size = 'md', className = '' }: Omit<LogoProps, 'showText'>) {
  const { icon } = sizes[size];
  
  return (
    <Image
      src="/favicon-32x32.png"
      alt="Ynai Logo"
      width={icon}
      height={icon}
      className={`shrink-0 ${className}`}
      priority
    />
  );
}
