'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className={cn(
          'flex items-center gap-3 rounded px-3 py-2 text-base font-medium text-muted-foreground transition-all duration-150',
          className,
        )}
        disabled
      >
        <Sun className="h-5 w-5" />
        <span>Theme</span>
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'group flex items-center gap-3 rounded px-3 py-2 text-base font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all duration-150 w-full',
        className,
      )}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-muted-foreground/70 group-hover:text-foreground/70 transition-colors" />
      ) : (
        <Moon className="h-5 w-5 text-muted-foreground/70 group-hover:text-foreground/70 transition-colors" />
      )}
      <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  );
}
