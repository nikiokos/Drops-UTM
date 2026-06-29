'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/sidebar';
import { useAuthStore } from '@/store/auth.store';
import { Toaster } from '@/components/ui/toaster';
import { EmergencyBanner } from '@/components/emergency/emergency-banner';
import { EmergencyConfirmationModal } from '@/components/emergency/confirmation-modal';
import { CopilotWidget } from '@/components/copilot/copilot-widget';
import { useEmergencyStore } from '@/store/emergency.store';
import { hubsApi, dronesApi, flightsApi } from '@/lib/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const pendingConfirmations = useEmergencyStore((s) => s.pendingConfirmations);

  // Only redirect once the persisted auth store has rehydrated — otherwise a
  // full page refresh briefly sees isAuthenticated=false and bounces to /login.
  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  // Pre-warm cache during render (fires immediately, not after paint like useEffect)
  if (hasHydrated && isAuthenticated) {
    queryClient.prefetchQuery({ queryKey: ['hubs'], queryFn: () => hubsApi.getAll().then((r) => r.data) });
    queryClient.prefetchQuery({ queryKey: ['drones'], queryFn: () => dronesApi.getAll().then((r) => r.data) });
    queryClient.prefetchQuery({ queryKey: ['flights'], queryFn: () => flightsApi.getAll().then((r) => r.data) });
  }

  // Auto-open confirmation modal when there are pending confirmations
  useEffect(() => {
    if (pendingConfirmations.length > 0 && !confirmModalOpen) {
      setConfirmModalOpen(true);
    }
  }, [pendingConfirmations.length, confirmModalOpen]);

  if (!hasHydrated || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <span className="text-xs font-mono tracking-[0.2em] text-muted-foreground">
            AUTHENTICATING
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <EmergencyBanner />
        <main className="relative flex-1 overflow-y-auto">
          <div className="absolute inset-0 hud-grid-bg opacity-20 pointer-events-none" />
          <div className="relative z-10 p-5">
            {children}
          </div>
        </main>
      </div>
      <Toaster />
      <CopilotWidget />
      <EmergencyConfirmationModal
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
      />
    </div>
  );
}
