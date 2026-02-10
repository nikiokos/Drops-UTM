'use client';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth.store';
import { User, Shield, Fingerprint } from 'lucide-react';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="Settings" description="Operator profile and access configuration" />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-primary" />
            <CardTitle>Operator Profile</CardTitle>
          </div>
          <div className="h-px bg-gradient-to-r from-primary/20 to-transparent" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                First Name
              </label>
              <p className="text-base font-medium mt-0.5">{user?.firstName || '—'}</p>
            </div>
            <div>
              <label className="text-xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
                Last Name
              </label>
              <p className="text-base font-medium mt-0.5">{user?.lastName || '—'}</p>
            </div>
          </div>
          <Separator className="bg-border/50" />
          <div>
            <label className="text-xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
              Operator ID
            </label>
            <p className="text-base font-mono mt-0.5">{user?.email || '—'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <CardTitle>Access & Clearance</CardTitle>
          </div>
          <div className="h-px bg-gradient-to-r from-primary/20 to-transparent" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-semibold tracking-[0.12em] uppercase text-muted-foreground">
              Clearance Level
            </label>
            <div className="mt-1.5">
              <span className="inline-flex items-center rounded border border-primary/25 bg-primary/10 px-2.5 py-1 text-sm font-semibold font-mono tracking-wider uppercase text-primary">
                {(user?.role || 'unknown').replace(/_/g, ' ')}
              </span>
            </div>
          </div>
          <Separator className="bg-border/50" />
          <div>
            <label className="text-xs font-semibold tracking-[0.12em] uppercase text-muted-foreground flex items-center gap-1.5">
              <Fingerprint className="h-3 w-3" />
              System ID
            </label>
            <p className="text-sm font-mono text-muted-foreground/70 mt-1 select-all">
              {user?.id || '—'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
