'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEmergencyStore } from '@/store/emergency.store';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  PieChart,
  BarChart3,
  Calendar,
  Lightbulb,
} from 'lucide-react';
import { format, subDays, subWeeks, subMonths } from 'date-fns';

const SEVERITY_COLORS = {
  warning: '#f59e0b',
  critical: '#f97316',
  emergency: '#ef4444',
};

const TYPE_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#f97316', '#eab308', '#84cc16', '#22c55e',
];

export default function TrendAnalysisPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [interval, setInterval] = useState<'day' | 'week' | 'month'>('day');

  const { stats, trends, fetchStats, fetchTrends } = useEmergencyStore();

  const { from, to } = useMemo(() => {
    const now = new Date();
    let fromDate: Date;
    switch (timeRange) {
      case '7d':
        fromDate = subDays(now, 7);
        break;
      case '90d':
        fromDate = subMonths(now, 3);
        break;
      default:
        fromDate = subDays(now, 30);
    }
    return {
      from: fromDate.toISOString(),
      to: now.toISOString(),
    };
  }, [timeRange]);

  useEffect(() => {
    fetchStats(from, to);
    fetchTrends(from, to, interval);
  }, [fetchStats, fetchTrends, from, to, interval]);

  // Calculate insights
  const insights = useMemo(() => {
    if (!stats || !trends.length) return [];

    const result: Array<{ type: 'info' | 'warning' | 'success'; message: string }> = [];

    // Trend direction
    if (trends.length >= 2) {
      const recent = trends.slice(-3).reduce((sum, t) => sum + t.total, 0) / 3;
      const earlier = trends.slice(0, 3).reduce((sum, t) => sum + t.total, 0) / 3;
      const change = ((recent - earlier) / (earlier || 1)) * 100;

      if (change > 20) {
        result.push({
          type: 'warning',
          message: `Incidents increased ${Math.round(change)}% compared to earlier in this period`,
        });
      } else if (change < -20) {
        result.push({
          type: 'success',
          message: `Incidents decreased ${Math.round(Math.abs(change))}% - safety improving!`,
        });
      }
    }

    // Top issue type
    if (stats.byType.length > 0) {
      const top = stats.byType.sort((a, b) => Number(b.count) - Number(a.count))[0];
      result.push({
        type: 'info',
        message: `Most common issue: ${top.type.replace(/_/g, ' ')} (${top.count} incidents)`,
      });
    }

    // Problematic drones
    if (stats.byDrone.length > 0) {
      const topDrone = stats.byDrone[0];
      if (Number(topDrone.count) > 5) {
        result.push({
          type: 'warning',
          message: `Drone ${topDrone.droneId.slice(0, 8)} has ${topDrone.count} incidents - consider maintenance check`,
        });
      }
    }

    // Response time
    if (stats.avgResponseTimeSeconds > 30) {
      result.push({
        type: 'warning',
        message: `Average response time is ${Math.round(stats.avgResponseTimeSeconds)}s - consider enabling Auto mode`,
      });
    } else if (stats.avgResponseTimeSeconds > 0) {
      result.push({
        type: 'success',
        message: `Excellent response time: ${Math.round(stats.avgResponseTimeSeconds)}s average`,
      });
    }

    return result;
  }, [stats, trends]);

  // Calculate totals for the period
  const totals = useMemo(() => {
    if (!stats) return { total: 0, warnings: 0, critical: 0, emergencies: 0 };

    return {
      total: stats.bySeverity.reduce((sum, s) => sum + Number(s.count), 0),
      warnings: Number(stats.bySeverity.find((s) => s.severity === 'warning')?.count || 0),
      critical: Number(stats.bySeverity.find((s) => s.severity === 'critical')?.count || 0),
      emergencies: Number(stats.bySeverity.find((s) => s.severity === 'emergency')?.count || 0),
    };
  }, [stats]);

  // Find max for scaling charts
  const maxTrendValue = Math.max(...trends.map((t) => t.total), 1);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trend Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze incident patterns and identify areas for improvement
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-[130px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={interval} onValueChange={(v) => setInterval(v as typeof interval)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">By Day</SelectItem>
              <SelectItem value="week">By Week</SelectItem>
              <SelectItem value="month">By Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Incidents</p>
                <p className="text-3xl font-bold mt-1">{totals.total}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <Activity className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-3xl font-bold mt-1 text-amber-400">{totals.warnings}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/20">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-3xl font-bold mt-1 text-orange-400">{totals.critical}</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/20">
                <AlertTriangle className="h-6 w-6 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Emergencies</p>
                <p className="text-3xl font-bold mt-1 text-red-400">{totals.emergencies}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/20">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Automated Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border ${
                    insight.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : insight.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-blue-500/10 border-blue-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {insight.type === 'warning' ? (
                      <TrendingUp className="h-4 w-4 text-amber-400" />
                    ) : insight.type === 'success' ? (
                      <TrendingDown className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Lightbulb className="h-4 w-4 text-blue-400" />
                    )}
                    <span className="text-sm">{insight.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Incidents Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Incidents Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trends.length > 0 ? (
              <div className="space-y-2">
                {/* Stacked bar chart */}
                <div className="flex items-end gap-1 h-48">
                  {trends.map((t, i) => (
                    <div
                      key={i}
                      className="flex-1 flex flex-col justify-end"
                      title={`${t.period}: ${t.total} total`}
                    >
                      <div className="flex flex-col">
                        {t.emergencies > 0 && (
                          <div
                            className="bg-red-500 rounded-t"
                            style={{ height: `${(t.emergencies / maxTrendValue) * 180}px` }}
                          />
                        )}
                        {t.critical > 0 && (
                          <div
                            className="bg-orange-500"
                            style={{ height: `${(t.critical / maxTrendValue) * 180}px` }}
                          />
                        )}
                        {t.warnings > 0 && (
                          <div
                            className={`bg-amber-500 ${t.emergencies === 0 && t.critical === 0 ? 'rounded-t' : ''}`}
                            style={{ height: `${(t.warnings / maxTrendValue) * 180}px` }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* X-axis labels */}
                <div className="flex gap-1 text-xs text-muted-foreground">
                  {trends.map((t, i) => (
                    <div key={i} className="flex-1 text-center truncate">
                      {interval === 'day' ? format(new Date(t.period), 'MM/dd') : t.period}
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-4">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-amber-500" />
                    <span className="text-xs">Warning</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-orange-500" />
                    <span className="text-xs">Critical</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-500" />
                    <span className="text-xs">Emergency</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No data for selected period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Incidents by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Incidents by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats && stats.byType.length > 0 ? (
              <div className="space-y-3">
                {stats.byType
                  .sort((a, b) => Number(b.count) - Number(a.count))
                  .slice(0, 8)
                  .map((item, i) => {
                    const total = stats.byType.reduce((sum, t) => sum + Number(t.count), 0);
                    const percentage = (Number(item.count) / total) * 100;

                    return (
                      <div key={item.type} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{item.type.replace(/_/g, ' ')}</span>
                          <span className="font-medium">{item.count}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: TYPE_COLORS[i % TYPE_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                No data for selected period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drones with Most Incidents */}
      <Card>
        <CardHeader>
          <CardTitle>Drones with Most Incidents</CardTitle>
        </CardHeader>
        <CardContent>
          {stats && stats.byDrone.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {stats.byDrone.slice(0, 8).map((drone, i) => (
                <div key={drone.droneId} className="p-4 rounded-lg border bg-card">
                  <p className="font-mono text-sm truncate">{drone.droneId}</p>
                  <p className="text-2xl font-bold mt-1">{drone.count}</p>
                  <p className="text-xs text-muted-foreground">incidents</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No drone-specific data for selected period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Response Performance */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-5xl font-bold">
                {stats?.avgResponseTimeSeconds
                  ? `${Math.round(stats.avgResponseTimeSeconds)}s`
                  : '--'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Average time from detection to action
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resolution Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {stats && stats.resolutionStats.length > 0 ? (
              <div className="text-center py-4">
                {(() => {
                  const successful = Number(stats.resolutionStats.find((r) => r.success)?.count || 0);
                  const failed = Number(stats.resolutionStats.find((r) => !r.success)?.count || 0);
                  const total = successful + failed;
                  const rate = total > 0 ? (successful / total) * 100 : 0;

                  return (
                    <>
                      <p className={`text-5xl font-bold ${rate >= 90 ? 'text-emerald-400' : rate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                        {rate.toFixed(1)}%
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {successful} successful / {failed} failed
                      </p>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No resolution data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
