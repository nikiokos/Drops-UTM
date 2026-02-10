'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await authApi.login(email, password);
      const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
      setAuth(
        {
          id: payload.sub,
          email: payload.email,
          firstName: payload.firstName || email.split('@')[0],
          lastName: payload.lastName || '',
          role: payload.role,
        },
        data.accessToken,
      );
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(msg || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 hud-grid-bg opacity-40" />

      {/* Radial gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, hsl(185 80% 45% / 0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-sm px-6 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 mb-4">
            <Radio className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-base font-bold tracking-[0.3em] text-primary font-mono">
            DROPS UTM
          </h1>
          <p className="text-xs tracking-[0.2em] text-muted-foreground mt-1 uppercase">
            Unmanned Traffic Management
          </p>
        </div>

        {/* Login form */}
        <div className="hud-frame rounded-lg border border-border bg-card p-6">
          <div className="mb-5">
            <h2 className="text-sm font-semibold tracking-[0.15em] uppercase text-foreground/80">
              System Access
            </h2>
            <div className="h-px bg-gradient-to-r from-primary/30 to-transparent mt-2" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive font-mono">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground" htmlFor="email">
                Operator ID
              </label>
              <Input
                id="email"
                type="email"
                placeholder="operator@drops.aero"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-9 text-base bg-background/50 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground" htmlFor="password">
                Access Key
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Enter access key"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-9 text-base bg-background/50"
              />
            </div>
            <Button type="submit" className="w-full h-9 text-sm font-semibold tracking-wider uppercase" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border border-primary-foreground/30 border-t-primary-foreground" />
                  Authenticating
                </span>
              ) : (
                'Authorize'
              )}
            </Button>
          </form>

          <div className="mt-4 pt-3 border-t border-border/50">
            <p className="text-center text-xs text-muted-foreground tracking-wide">
              No access?{' '}
              <Link href="/register" className="text-primary hover:text-primary/80 transition-colors font-medium">
                REQUEST CREDENTIALS
              </Link>
            </p>
          </div>
        </div>

        {/* System status */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground/50 font-mono tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
            SYS ONLINE
          </span>
          <span>v1.0.0</span>
          <span>SEC:AES-256</span>
        </div>
      </div>
    </div>
  );
}
