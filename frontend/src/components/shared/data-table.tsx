'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  emptyMessage = 'No data found',
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        <span className="text-xs font-mono tracking-[0.15em] text-muted-foreground uppercase">
          Loading data
        </span>
      </div>
    );
  }

  return (
    <div className="hud-frame rounded border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className="text-xs font-semibold tracking-[0.12em] uppercase text-muted-foreground h-9 px-4"
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-sm text-muted-foreground/50 font-mono tracking-wider uppercase"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((item, i) => (
              <TableRow
                key={(item.id as string) ?? i}
                className={`border-border/40 hover:bg-accent/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className="py-2.5 px-4 text-base">
                    {col.render ? col.render(item) : (item[col.key] as React.ReactNode) ?? '—'}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
