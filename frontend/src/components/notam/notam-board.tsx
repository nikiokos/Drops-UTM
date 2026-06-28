'use client';

import { useQuery } from '@tanstack/react-query';
import { notamApi, type Notam } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, AlertTriangle } from 'lucide-react';

const sevStyle: Record<Notam['significance'], { dot: string; label: string }> = {
  critical: { dot: 'bg-red-500', label: 'text-red-400' },
  warning: { dot: 'bg-amber-500', label: 'text-amber-400' },
  info: { dot: 'bg-blue-500', label: 'text-blue-400' },
};

function fmtEnd(n: Notam): string {
  if (n.permanent) return 'PERM';
  if (!n.end) return '';
  return new Date(n.end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/**
 * Live NOTAM board for the Athinai FIR (autorouter feed). Active NOTAMs sorted
 * by operational significance for UAS — restricted/danger areas first.
 */
export function NotamBoard({ icaos, limit = 12 }: { icaos?: string; limit?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['notams', icaos ?? 'LGGG'],
    queryFn: () => notamApi.getNotams(icaos).then((r) => r.data),
    refetchInterval: 5 * 60 * 1000,
  });

  const notams = data?.notams ?? [];
  const critical = notams.filter((n) => n.significance === 'critical').length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-orange-400" />
          NOTAMs — Athinai FIR
          <span className="text-xs font-normal text-muted-foreground">(live · autorouter)</span>
          {critical > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs font-normal text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {critical} restricted/danger
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground py-4">Loading NOTAMs…</p>}
        {!isLoading && data && !data.enabled && (
          <p className="text-sm text-muted-foreground py-4">NOTAM feed not configured.</p>
        )}
        {!isLoading && data?.enabled && notams.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">No active NOTAMs.</p>
        )}
        {notams.length > 0 && (
          <div className="space-y-1.5 max-h-[28rem] overflow-y-auto pr-1">
            {notams.slice(0, limit).map((n) => (
              <div key={n.id} className="rounded border border-border bg-card/50 p-2.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${sevStyle[n.significance].dot}`} />
                  <span className="font-mono text-xs font-bold">{n.ref}</span>
                  <span className={`text-xs font-medium ${sevStyle[n.significance].label}`}>{n.subject}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {n.scope}
                    {fmtEnd(n) ? ` · ${fmtEnd(n)}` : ''}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground line-clamp-3 whitespace-pre-line">
                  {n.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
