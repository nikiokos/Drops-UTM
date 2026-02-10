'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFleetStore } from '@/store/fleet.store';
import {
  Bot,
  Building2,
  Activity,
  Battery,
  ArrowRightLeft,
  CheckCircle,
  Clock,
  AlertTriangle,
  Settings2,
  RefreshCw,
  Play,
  X,
  ChevronRight,
  Zap,
  Scale,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FleetDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');

  const {
    overview,
    hubStatuses,
    pendingRebalancing,
    activeRebalancing,
    recommendations,
    activeConfig,
    allConfigs,
    isLoading,
    fetchOverview,
    fetchPendingRebalancing,
    fetchActiveRebalancing,
    analyzeRebalancing,
    fetchActiveConfig,
    fetchAllConfigs,
    approveRebalancing,
    executeRebalancing,
    cancelRebalancing,
    activateConfig,
  } = useFleetStore();

  // Initial data fetch
  useEffect(() => {
    fetchOverview();
    fetchPendingRebalancing();
    fetchActiveRebalancing();
    fetchActiveConfig();
    fetchAllConfigs();
  }, [fetchOverview, fetchPendingRebalancing, fetchActiveRebalancing, fetchActiveConfig, fetchAllConfigs]);

  // Refresh data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOverview();
      fetchPendingRebalancing();
      fetchActiveRebalancing();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchOverview, fetchPendingRebalancing, fetchActiveRebalancing]);

  const handleAnalyze = () => {
    analyzeRebalancing();
  };

  const handleApprove = async (taskId: string) => {
    await approveRebalancing(taskId);
    await executeRebalancing(taskId);
  };

  const handleCancel = async (taskId: string) => {
    await cancelRebalancing(taskId, 'Cancelled by operator');
  };

  const handleConfigChange = async (configId: string) => {
    await activateConfig(configId);
  };

  // Calculate stats
  const stats = useMemo(() => {
    if (!overview) return null;
    return {
      utilization: overview.totalDrones > 0
        ? Math.round((overview.busyDrones / overview.totalDrones) * 100)
        : 0,
      availability: overview.totalDrones > 0
        ? Math.round((overview.availableDrones / overview.totalDrones) * 100)
        : 0,
    };
  }, [overview]);

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fleet Intelligence</h1>
          <p className="text-muted-foreground">
            Smart drone assignment and fleet rebalancing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOverview()}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Select
            value={activeConfig?.id || ''}
            onValueChange={handleConfigChange}
          >
            <SelectTrigger className="w-48">
              <Settings2 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              {allConfigs.map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  <div className="flex items-center gap-2">
                    {config.name === 'Efficiency Mode' && <Zap className="h-3 w-3" />}
                    {config.name === 'Balanced Mode' && <Scale className="h-3 w-3" />}
                    {config.name === 'Fleet Health Mode' && <Heart className="h-3 w-3" />}
                    {config.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overview?.totalDrones ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Total Drones</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overview?.availableDrones ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Activity className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overview?.busyDrones ?? '-'}</p>
                <p className="text-xs text-muted-foreground">In Flight</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Battery className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overview?.chargingDrones ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Charging</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Building2 className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overview?.hubStatuses?.length ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Active Hubs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <Heart className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overview?.fleetHealth ?? '-'}%</p>
                <p className="text-xs text-muted-foreground">Fleet Health</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Utilization Bar */}
      {stats && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Fleet Utilization</span>
              <span className="text-sm text-muted-foreground">{stats.utilization}% in use</span>
            </div>
            <Progress value={stats.utilization} className="h-2" />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{overview?.availableDrones} available</span>
              <span>{overview?.busyDrones} busy</span>
              <span>{overview?.chargingDrones} charging</span>
              <span>{overview?.maintenanceDrones} maintenance</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Hub Status</TabsTrigger>
          <TabsTrigger value="rebalancing">
            Rebalancing
            {pendingRebalancing.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                {pendingRebalancing.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        {/* Hub Status Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {overview?.hubStatuses?.map((hub) => (
              <Card key={hub.hubId} className="relative overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium">
                      {hub.hubName}
                    </CardTitle>
                    <Badge
                      variant={hub.availableDrones >= 2 ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {hub.availableDrones} available
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-medium">{hub.totalDrones} drones</span>
                    </div>
                    <Progress
                      value={hub.capacityUtilization}
                      className="h-1.5"
                    />
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded bg-emerald-500/10 py-1">
                        <p className="font-medium text-emerald-600">{hub.availableDrones}</p>
                        <p className="text-muted-foreground">Ready</p>
                      </div>
                      <div className="rounded bg-amber-500/10 py-1">
                        <p className="font-medium text-amber-600">{hub.busyDrones}</p>
                        <p className="text-muted-foreground">Busy</p>
                      </div>
                      <div className="rounded bg-blue-500/10 py-1">
                        <p className="font-medium text-blue-600">{hub.chargingDrones}</p>
                        <p className="text-muted-foreground">Charging</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
                {hub.availableDrones < 2 && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-destructive" />
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Rebalancing Tab */}
        <TabsContent value="rebalancing" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Rebalancing Tasks</h3>
              <p className="text-sm text-muted-foreground">
                Manage drone repositioning between hubs
              </p>
            </div>
            <Button onClick={handleAnalyze} disabled={isLoading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
              Analyze Needs
            </Button>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recommendations</CardTitle>
                <CardDescription>
                  Suggested rebalancing based on current hub status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{rec.sourceHub.hubName}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{rec.targetHub.hubName}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Priority: {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xs truncate">
                      {rec.reason}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pending Tasks */}
          {pendingRebalancing.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Pending Approval
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingRebalancing.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {task.sourceHub?.name ?? 'Unknown'}
                          <ChevronRight className="h-4 w-4" />
                          {task.targetHub?.name ?? 'Unknown'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Drone: {task.drone?.registrationNumber ?? task.droneId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancel(task.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => handleApprove(task.id)}>
                        <Play className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Active Tasks */}
          {activeRebalancing.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  In Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {activeRebalancing.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-primary/5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <ArrowRightLeft className="h-5 w-5 text-primary" />
                        <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full animate-pulse" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {task.sourceHub?.name ?? 'Unknown'}
                          <ChevronRight className="h-4 w-4" />
                          {task.targetHub?.name ?? 'Unknown'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Drone: {task.drone?.registrationNumber ?? task.droneId}
                        </p>
                      </div>
                    </div>
                    <Badge>{task.status.replace('_', ' ')}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {pendingRebalancing.length === 0 &&
            activeRebalancing.length === 0 &&
            recommendations.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
                  <h3 className="font-medium">Fleet is Balanced</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    All hubs have adequate drone coverage
                  </p>
                </CardContent>
              </Card>
            )}
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Active Config Display */}
            {activeConfig && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Active Configuration</CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {activeConfig.isPreset ? 'Preset' : 'Custom'}
                    </Badge>
                  </div>
                  <CardDescription>{activeConfig.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Scoring Weights</h4>
                    <div className="space-y-2">
                      {Object.entries(activeConfig.weights).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground capitalize w-24">
                            {key}
                          </span>
                          <Progress value={value * 100} className="h-1.5 flex-1" />
                          <span className="text-xs font-mono w-8">{(value * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Thresholds Display */}
            {activeConfig && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Fleet Thresholds</CardTitle>
                  <CardDescription>Operational limits for fleet management</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Min Drones per Hub</p>
                      <p className="font-medium">{activeConfig.thresholds.minDronesPerHub}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Max Idle Time</p>
                      <p className="font-medium">{activeConfig.thresholds.maxIdleTimeMinutes} min</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Rebalance Cooldown</p>
                      <p className="font-medium">{activeConfig.thresholds.rebalanceCooldownMinutes} min</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Min Donor Reserve</p>
                      <p className="font-medium">{activeConfig.thresholds.minDonorReserve}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Max Concurrent Repositions</p>
                      <p className="font-medium">{activeConfig.thresholds.maxConcurrentRepositions}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Min Battery for Reposition</p>
                      <p className="font-medium">{activeConfig.thresholds.minBatteryForReposition}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Available Presets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Available Configurations</CardTitle>
              <CardDescription>Switch between preset or custom configurations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {allConfigs.map((config) => (
                  <div
                    key={config.id}
                    className={cn(
                      'p-4 rounded-lg border cursor-pointer transition-colors',
                      config.isActive
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-muted-foreground/50',
                    )}
                    onClick={() => handleConfigChange(config.id)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {config.name === 'Efficiency Mode' && <Zap className="h-4 w-4 text-amber-500" />}
                      {config.name === 'Balanced Mode' && <Scale className="h-4 w-4 text-blue-500" />}
                      {config.name === 'Fleet Health Mode' && <Heart className="h-4 w-4 text-rose-500" />}
                      <span className="font-medium text-sm">{config.name}</span>
                      {config.isActive && (
                        <Badge variant="default" className="ml-auto text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
