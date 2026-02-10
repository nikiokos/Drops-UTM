'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Plane,
  Bot,
  Building2,
  Map,
  AlertTriangle,
  Cloud,
  Settings,
  LogOut,
  Radio,
  Gamepad2,
  Route,
  Network,
  ShieldAlert,
  Wifi,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import type { LucideIcon } from 'lucide-react';

const navigation: { name: string; href: string; icon: LucideIcon }[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Control Center', href: '/dashboard/control', icon: Gamepad2 },
  { name: 'Emergency', href: '/dashboard/emergency', icon: ShieldAlert },
  { name: 'Fleet', href: '/dashboard/fleet', icon: Network },
  { name: 'Connectivity', href: '/dashboard/connectivity', icon: Wifi },
  { name: 'Missions', href: '/dashboard/missions', icon: Route },
  { name: 'Flights', href: '/dashboard/flights', icon: Plane },
  { name: 'Drones', href: '/dashboard/drones', icon: Bot },
  { name: 'Hubs', href: '/dashboard/hubs', icon: Building2 },
  { name: 'Airspace', href: '/dashboard/airspace', icon: Map },
  { name: 'Conflicts', href: '/dashboard/conflicts', icon: AlertTriangle },
  { name: 'Weather', href: '/dashboard/weather', icon: Cloud },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <div className="flex h-full w-60 flex-col border-r border-border/60 bg-card/50 backdrop-blur-sm">
      {/* Brand */}
      <div className="flex h-14 items-center gap-3 border-b border-border/60 px-5">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="relative flex h-8 w-8 items-center justify-center">
            <div className="absolute inset-0 rounded bg-primary/20 group-hover:bg-primary/30 transition-colors" />
            <Radio className="h-4 w-4 text-primary relative z-10" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-[0.2em] text-primary font-mono leading-none">
              DROPS
            </span>
            <span className="text-sm tracking-[0.15em] text-muted-foreground leading-none mt-0.5">
              UTM SYSTEM
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="px-3 mb-3 text-sm font-semibold tracking-[0.15em] text-muted-foreground/60 uppercase">
          Operations
        </p>
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded px-3 py-2 text-base font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              {isActive && (
                <div className="absolute left-0 w-0.5 h-5 bg-primary rounded-r" />
              )}
              <Icon className={cn(
                'h-5 w-5 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground/70',
              )} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="px-3 pb-2">
        <ThemeToggle />
      </div>

      {/* User section */}
      {user && (
        <div className="border-t border-border/60 p-3">
          <div className="flex items-center gap-3 rounded px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-primary/10 text-primary">
              <span className="text-sm font-bold font-mono">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium truncate leading-none">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-muted-foreground truncate mt-0.5 font-mono leading-none">
                {user.role?.toUpperCase()}
              </p>
            </div>
            <button
              onClick={logout}
              className="rounded p-1.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
