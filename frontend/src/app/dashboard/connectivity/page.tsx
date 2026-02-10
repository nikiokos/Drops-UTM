'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConnectivityStore } from '@/store/connectivity.store';
import { dronesApi, hubsApi, DeviceRegistration, CertificateBundle } from '@/lib/api';
import {
  Wifi,
  WifiOff,
  Radio,
  Bot,
  Building2,
  Monitor,
  Shield,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Plus,
  Download,
  Trash2,
  Activity,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

export default function ConnectivityPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [certificateDialogOpen, setCertificateDialogOpen] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<CertificateBundle | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  // Form state
  const [deviceType, setDeviceType] = useState<'drone' | 'gateway' | 'gcs'>('drone');
  const [selectedDroneId, setSelectedDroneId] = useState('');
  const [selectedHubId, setSelectedHubId] = useState('');

  const {
    status,
    devices,
    selectedDevice,
    telemetryModes,
    isLoading,
    error,
    fetchStatus,
    fetchDevices,
    fetchTelemetryModes,
    registerDevice,
    revokeDevice,
    generateCertificate,
    revokeCertificate,
    selectDevice,
    clearError,
  } = useConnectivityStore();

  // Fetch drones for registration
  const { data: dronesData } = useQuery({
    queryKey: ['drones'],
    queryFn: () => dronesApi.getAll(),
  });
  const drones = dronesData?.data || [];

  // Fetch hubs for gateway registration
  const { data: hubsData } = useQuery({
    queryKey: ['hubs'],
    queryFn: () => hubsApi.getAll(),
  });
  const hubs = hubsData?.data || [];

  // Initial data fetch
  useEffect(() => {
    fetchStatus();
    fetchDevices();
    fetchTelemetryModes();
  }, [fetchStatus, fetchDevices, fetchTelemetryModes]);

  // Refresh data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
      fetchDevices();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchDevices]);

  const handleRegister = async () => {
    const result = await registerDevice({
      deviceType,
      droneId: deviceType === 'drone' ? selectedDroneId : undefined,
      hubId: deviceType === 'gateway' ? selectedHubId : undefined,
      supportedProtocols: ['websocket'],
    });
    if (result) {
      setRegisterDialogOpen(false);
      setSelectedDroneId('');
      setSelectedHubId('');
    }
  };

  const handleGenerateCertificate = async (deviceId: string) => {
    const cert = await generateCertificate(deviceId);
    if (cert) {
      setSelectedCertificate(cert);
      setCertificateDialogOpen(true);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDownloadCertificate = () => {
    if (!selectedCertificate || !selectedDevice) return;
    const bundle = {
      ...selectedCertificate,
      deviceIdentifier: selectedDevice.deviceIdentifier,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDevice.deviceIdentifier}-certificate.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'offline':
      default:
        return 'bg-gray-400';
    }
  };

  const getRegistrationBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500">Active</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'revoked':
        return <Badge variant="destructive">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'drone':
        return Bot;
      case 'gateway':
        return Building2;
      case 'gcs':
        return Monitor;
      default:
        return Radio;
    }
  };

  const getTelemetryModeInfo = (mode: string) => {
    const modes: Record<string, { color: string; icon: typeof Activity }> = {
      idle: { color: 'text-gray-500', icon: Clock },
      normal: { color: 'text-blue-500', icon: Activity },
      enhanced: { color: 'text-yellow-500', icon: Zap },
      emergency: { color: 'text-red-500', icon: AlertTriangle },
    };
    return modes[mode] || modes.idle;
  };

  // Filter unregistered drones
  const registeredDroneIds = devices.filter((d) => d.droneId).map((d) => d.droneId);
  const availableDrones = drones.filter((d: { id: string }) => !registeredDroneIds.includes(d.id));

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Device Connectivity</h1>
          <p className="text-muted-foreground">
            Manage device connections, certificates, and telemetry
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchStatus();
              fetchDevices();
            }}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setRegisterDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Register Device
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={clearError}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.length}</div>
            <p className="text-xs text-muted-foreground">
              {devices.filter(d => d.registrationStatus === 'active').length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.onlineDevices || 0}</div>
            <Progress
              value={devices.length > 0 ? ((status?.onlineDevices || 0) / devices.length) * 100 : 0}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Commands</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.commands?.pendingCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              In queue for delivery
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Protocol Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.protocols?.websocket?.connected || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              WebSocket connections
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="telemetry">Telemetry Modes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Telemetry Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Telemetry Distribution</CardTitle>
                <CardDescription>Device telemetry modes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {status?.telemetry?.byMode && Object.entries(status.telemetry.byMode).map(([mode, count]) => {
                  const modeInfo = getTelemetryModeInfo(mode);
                  const ModeIcon = modeInfo.icon;
                  const total = status.telemetry.totalDevices || 1;
                  return (
                    <div key={mode} className="flex items-center gap-4">
                      <ModeIcon className={cn('h-4 w-4', modeInfo.color)} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium capitalize">{mode}</span>
                          <span className="text-sm text-muted-foreground">{count}</span>
                        </div>
                        <Progress value={(count / total) * 100} className="h-2" />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Command Priority Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Command Queue</CardTitle>
                <CardDescription>Pending commands by priority</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {status?.commands?.byPriority && Object.entries(status.commands.byPriority).map(([priority, count]) => {
                  const priorityLabels: Record<string, { label: string; color: string }> = {
                    '0': { label: 'Critical (ESTOP, LAND_NOW)', color: 'text-red-500' },
                    '1': { label: 'High (RTH, HOVER)', color: 'text-orange-500' },
                    '2': { label: 'Normal (GOTO, TAKEOFF)', color: 'text-blue-500' },
                    '3': { label: 'Low (UPDATE_MISSION)', color: 'text-gray-500' },
                  };
                  const info = priorityLabels[priority] || { label: `Priority ${priority}`, color: 'text-gray-500' };
                  return (
                    <div key={priority} className="flex items-center justify-between">
                      <span className={cn('text-sm', info.color)}>{info.label}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Connected Devices</CardTitle>
              <CardDescription>Currently online devices</CardDescription>
            </CardHeader>
            <CardContent>
              {devices.filter(d => d.connectionStatus === 'online').length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No devices currently online</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {devices.filter(d => d.connectionStatus === 'online').map((device) => {
                    const DeviceIcon = getDeviceIcon(device.deviceType);
                    return (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <DeviceIcon className="h-5 w-5 text-muted-foreground" />
                            <div className={cn('absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full', getStatusColor(device.connectionStatus))} />
                          </div>
                          <div>
                            <p className="font-medium">{device.deviceIdentifier}</p>
                            <p className="text-xs text-muted-foreground">
                              {device.drone?.manufacturer} {device.drone?.model}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {device.telemetryMode && (
                            <Badge variant="outline" className="text-xs">
                              {device.telemetryMode}
                            </Badge>
                          )}
                          <Badge variant="default" className="bg-green-500">Online</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registered Devices</CardTitle>
              <CardDescription>Manage device registrations and certificates</CardDescription>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No devices registered</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setRegisterDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Register First Device
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {devices.map((device) => {
                    const DeviceIcon = getDeviceIcon(device.deviceType);
                    return (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                              <DeviceIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background', getStatusColor(device.connectionStatus))} />
                          </div>
                          <div>
                            <p className="font-medium">{device.deviceIdentifier}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="capitalize">{device.deviceType}</span>
                              {device.drone && (
                                <>
                                  <span>•</span>
                                  <span>{device.drone.manufacturer} {device.drone.model}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Registration Status */}
                          {getRegistrationBadge(device.registrationStatus)}

                          {/* Certificate Status */}
                          <span title={device.certificateFingerprint ? 'Certificate issued' : 'No certificate'}>
                            {device.certificateFingerprint ? (
                              <ShieldCheck className="h-4 w-4 text-green-500" />
                            ) : (
                              <ShieldAlert className="h-4 w-4 text-yellow-500" />
                            )}
                          </span>

                          {/* Last Seen */}
                          {device.lastSeenAt && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(device.lastSeenAt).toLocaleTimeString()}
                            </span>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            {device.registrationStatus === 'active' && !device.certificateFingerprint && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  selectDevice(device);
                                  handleGenerateCertificate(device.id);
                                }}
                                title="Generate Certificate"
                              >
                                <Shield className="h-4 w-4" />
                              </Button>
                            )}
                            {device.registrationStatus === 'pending' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  selectDevice(device);
                                  handleGenerateCertificate(device.id);
                                }}
                                title="Activate with Certificate"
                              >
                                <ShieldCheck className="h-4 w-4" />
                              </Button>
                            )}
                            {device.certificateFingerprint && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => revokeCertificate(device.id)}
                                title="Revoke Certificate"
                              >
                                <ShieldAlert className="h-4 w-4 text-yellow-500" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => revokeDevice(device.id)}
                              title="Revoke Device"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Telemetry Modes Tab */}
        <TabsContent value="telemetry" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Telemetry Mode Configuration</CardTitle>
              <CardDescription>Adaptive telemetry rate settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {telemetryModes && Object.entries(telemetryModes).map(([mode, config]) => {
                  const modeInfo = getTelemetryModeInfo(mode);
                  const ModeIcon = modeInfo.icon;
                  return (
                    <Card key={mode} className="bg-muted/50">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <ModeIcon className={cn('h-5 w-5', modeInfo.color)} />
                          <CardTitle className="text-base capitalize">{mode}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm text-muted-foreground">{config.description}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Interval:</span>
                            <p className="font-medium">{config.intervalMs}ms</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Rate:</span>
                            <p className="font-medium">{config.rateHz} Hz</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Register Device Dialog */}
      <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register New Device</DialogTitle>
            <DialogDescription>
              Register a drone, gateway, or ground control station
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Device Type</Label>
              <Select value={deviceType} onValueChange={(v) => setDeviceType(v as typeof deviceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drone">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      Drone
                    </div>
                  </SelectItem>
                  <SelectItem value="gateway">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Gateway
                    </div>
                  </SelectItem>
                  <SelectItem value="gcs">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      Ground Control Station
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {deviceType === 'drone' && (
              <div className="space-y-2">
                <Label>Select Drone</Label>
                <Select value={selectedDroneId} onValueChange={setSelectedDroneId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a drone" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDrones.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No unregistered drones available
                      </div>
                    ) : (
                      availableDrones.map((drone: { id: string; registrationNumber: string; manufacturer: string; model: string }) => (
                        <SelectItem key={drone.id} value={drone.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{drone.registrationNumber}</span>
                            <span className="text-muted-foreground">
                              {drone.manufacturer} {drone.model}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {deviceType === 'gateway' && (
              <div className="space-y-2">
                <Label>Select Hub</Label>
                <Select value={selectedHubId} onValueChange={setSelectedHubId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a hub" />
                  </SelectTrigger>
                  <SelectContent>
                    {hubs.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No hubs available
                      </div>
                    ) : (
                      hubs.map((hub: { id: string; name: string; code: string }) => (
                        <SelectItem key={hub.id} value={hub.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{hub.code}</span>
                            <span className="text-muted-foreground">{hub.name}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRegister}
              disabled={
                isLoading ||
                (deviceType === 'drone' && !selectedDroneId) ||
                (deviceType === 'gateway' && !selectedHubId)
              }
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Register
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certificate Dialog */}
      <Dialog open={certificateDialogOpen} onOpenChange={setCertificateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Device Certificate Generated</DialogTitle>
            <DialogDescription>
              Save these credentials securely. The private key will not be shown again.
            </DialogDescription>
          </DialogHeader>

          {selectedCertificate && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Fingerprint</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyToClipboard(selectedCertificate.fingerprint)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  readOnly
                  value={selectedCertificate.fingerprint}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Device Certificate</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyToClipboard(selectedCertificate.deviceCertificate)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <textarea
                  readOnly
                  value={selectedCertificate.deviceCertificate}
                  className="w-full h-24 p-2 text-xs font-mono bg-muted rounded-md resize-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Private Key</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                    >
                      {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyToClipboard(selectedCertificate.privateKey)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={showPrivateKey ? selectedCertificate.privateKey : '••••••••••••••••••••'}
                  className="w-full h-24 p-2 text-xs font-mono bg-muted rounded-md resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCertificateDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handleDownloadCertificate}>
              <Download className="h-4 w-4 mr-2" />
              Download Bundle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
