'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Play,
  Code,
  BookOpen,
  TestTube,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { integrationApi } from '@/lib/api';
import type { ApiKeyInfo } from '@/lib/api';
import { usePermissions } from '@/hooks/use-permissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

type TabId = 'keys' | 'quickstart' | 'tester' | 'reference';

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'keys', label: 'API Keys', icon: Key },
  { id: 'quickstart', label: 'Quick Start', icon: BookOpen },
  { id: 'tester', label: 'API Tester', icon: TestTube },
  { id: 'reference', label: 'API Reference', icon: Code },
];

export default function DeveloperPage() {
  const { canManageApiKeys } = usePermissions();
  const [activeTab, setActiveTab] = useState<TabId>('keys');

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <h2 className="text-lg font-bold tracking-wide uppercase">Developer Portal</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Integrate drones with the DROPS UTM via REST API
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/60">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'keys' && <ApiKeysTab />}
      {activeTab === 'quickstart' && <QuickStartTab />}
      {activeTab === 'tester' && <ApiTesterTab />}
      {activeTab === 'reference' && <ApiReferenceTab />}
    </div>
  );
}

// ============ API Keys Tab ============

function ApiKeysTab() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyVisible, setNewKeyVisible] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    manufacturerName: '',
    contactEmail: '',
    rateLimit: 100,
  });

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['integration-keys'],
    queryFn: () => integrationApi.listKeys().then((r) => r.data),
  });

  const keyList: ApiKeyInfo[] = Array.isArray(keys) ? keys : (keys as unknown as { data: ApiKeyInfo[] })?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => integrationApi.createKey(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['integration-keys'] });
      const rawKey = response.data?.apiKey || (response.data as unknown as { apiKey: string })?.apiKey;
      if (rawKey) {
        setNewKeyVisible(rawKey);
      }
      toast({ title: 'API Key created', description: 'Copy the key now — it will not be shown again.' });
      setFormData({ name: '', manufacturerName: '', contactEmail: '', rateLimit: 100 });
      setCreateDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create API key.', variant: 'destructive' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => integrationApi.revokeKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-keys'] });
      toast({ title: 'Key revoked', description: 'The API key has been revoked.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to revoke key.', variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-4">
      {/* New key banner */}
      {newKeyVisible && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">Your new API key — copy it now!</p>
                <p className="text-xs text-muted-foreground">
                  This key will only be shown once. Store it securely.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-card border px-3 py-2 text-sm font-mono break-all">
                    {newKeyVisible}
                  </code>
                  <CopyButton text={newKeyVisible} />
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setNewKeyVisible(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {keyList.length} key{keyList.length !== 1 ? 's' : ''} registered
        </p>
        <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create Key
        </Button>
      </div>

      {/* Keys table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : keyList.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No API keys yet. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Prefix</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Manufacturer</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Requests</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keyList.map((key) => (
                    <tr key={key.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{key.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{key.keyPrefix}...</td>
                      <td className="px-4 py-3">{key.manufacturerName}</td>
                      <td className="px-4 py-3 font-mono">{key.totalRequests}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            key.isActive
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-red-500/10 text-red-500'
                          }`}
                        >
                          {key.isActive ? 'Active' : 'Revoked'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {key.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            onClick={() => {
                              if (confirm(`Revoke key "${key.name}"?`)) {
                                revokeMutation.mutate(key.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for drone integration.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="keyName" className="text-sm font-medium">Key Name</label>
              <Input
                id="keyName"
                placeholder="Production Key"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="manufacturer" className="text-sm font-medium">Manufacturer</label>
              <Input
                id="manufacturer"
                placeholder="DJI, Parrot, etc."
                value={formData.manufacturerName}
                onChange={(e) => setFormData((p) => ({ ...p, manufacturerName: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium">Contact Email</label>
              <Input
                id="email"
                type="email"
                placeholder="dev@manufacturer.com"
                value={formData.contactEmail}
                onChange={(e) => setFormData((p) => ({ ...p, contactEmail: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="rateLimit" className="text-sm font-medium">Rate Limit (req/min)</label>
              <Input
                id="rateLimit"
                type="number"
                value={formData.rateLimit}
                onChange={(e) => setFormData((p) => ({ ...p, rateLimit: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={createMutation.isPending || !formData.name || !formData.manufacturerName || !formData.contactEmail}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ Quick Start Tab ============

function QuickStartTab() {
  const apiBase = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001/api/v1`
    : 'http://localhost:3001/api/v1';

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Get your API Key</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Go to the <strong>API Keys</strong> tab and create a new key. Copy it immediately — it will only be shown once.</p>
          <p>Include the key in every request via the <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">X-API-Key</code> header.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Send Telemetry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">cURL</span>
              <CopyButton text={`curl -X POST ${apiBase}/integration/telemetry \\
  -H "X-API-Key: drps_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "droneId": "DRN-001",
    "latitude": 37.9838,
    "longitude": 23.7275,
    "altitude": 100,
    "heading": 270,
    "speed": 15.5,
    "batteryLevel": 85
  }'`} />
            </div>
            <pre className="rounded bg-muted/50 border p-4 text-xs font-mono overflow-x-auto whitespace-pre">{`curl -X POST ${apiBase}/integration/telemetry \\
  -H "X-API-Key: drps_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "droneId": "DRN-001",
    "latitude": 37.9838,
    "longitude": 23.7275,
    "altitude": 100,
    "heading": 270,
    "speed": 15.5,
    "batteryLevel": 85
  }'`}</pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Python</span>
              <CopyButton text={`import requests

API_KEY = "drps_YOUR_KEY_HERE"
BASE_URL = "${apiBase}"

response = requests.post(
    f"{BASE_URL}/integration/telemetry",
    headers={
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
    },
    json={
        "droneId": "DRN-001",
        "latitude": 37.9838,
        "longitude": 23.7275,
        "altitude": 100,
        "heading": 270,
        "speed": 15.5,
        "batteryLevel": 85,
    },
)
print(response.json())`} />
            </div>
            <pre className="rounded bg-muted/50 border p-4 text-xs font-mono overflow-x-auto whitespace-pre">{`import requests

API_KEY = "drps_YOUR_KEY_HERE"
BASE_URL = "${apiBase}"

response = requests.post(
    f"{BASE_URL}/integration/telemetry",
    headers={
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
    },
    json={
        "droneId": "DRN-001",
        "latitude": 37.9838,
        "longitude": 23.7275,
        "altitude": 100,
        "heading": 270,
        "speed": 15.5,
        "batteryLevel": 85,
    },
)
print(response.json())`}</pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">JavaScript / Node.js</span>
              <CopyButton text={`const response = await fetch("${apiBase}/integration/telemetry", {
  method: "POST",
  headers: {
    "X-API-Key": "drps_YOUR_KEY_HERE",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    droneId: "DRN-001",
    latitude: 37.9838,
    longitude: 23.7275,
    altitude: 100,
    heading: 270,
    speed: 15.5,
    batteryLevel: 85,
  }),
});
const data = await response.json();
console.log(data);`} />
            </div>
            <pre className="rounded bg-muted/50 border p-4 text-xs font-mono overflow-x-auto whitespace-pre">{`const response = await fetch("${apiBase}/integration/telemetry", {
  method: "POST",
  headers: {
    "X-API-Key": "drps_YOUR_KEY_HERE",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    droneId: "DRN-001",
    latitude: 37.9838,
    longitude: 23.7275,
    altitude: 100,
    heading: 270,
    speed: 15.5,
    batteryLevel: 85,
  }),
});
const data = await response.json();
console.log(data);`}</pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Register a Drone (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Drones are auto-registered on first telemetry submission. Use this endpoint to pre-register with details.
          </p>
          <pre className="rounded bg-muted/50 border p-4 text-xs font-mono overflow-x-auto whitespace-pre">{`curl -X POST ${apiBase}/integration/register \\
  -H "X-API-Key: drps_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "registrationNumber": "DRN-001",
    "manufacturer": "Acme Drones",
    "model": "SkyRunner X1",
    "maxFlightTime": 45,
    "maxSpeed": 72,
    "maxAltitude": 400,
    "weight": 2.5,
    "batteryCapacity": 5200
  }'`}</pre>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ API Tester Tab ============

function ApiTesterTab() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [endpoint, setEndpoint] = useState('telemetry');
  const [method, setMethod] = useState('POST');
  const [body, setBody] = useState(JSON.stringify({
    droneId: 'DRN-TEST-001',
    latitude: 37.9838,
    longitude: 23.7275,
    altitude: 100,
    heading: 270,
    speed: 15.5,
    batteryLevel: 85,
  }, null, 2));
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const apiBase = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001/api/v1`
    : 'http://localhost:3001/api/v1';

  const endpoints: { value: string; label: string; method: string; path: string; defaultBody?: string }[] = [
    {
      value: 'telemetry',
      label: 'Submit Telemetry',
      method: 'POST',
      path: '/integration/telemetry',
      defaultBody: JSON.stringify({ droneId: 'DRN-TEST-001', latitude: 37.9838, longitude: 23.7275, altitude: 100, heading: 270, speed: 15.5, batteryLevel: 85 }, null, 2),
    },
    {
      value: 'register',
      label: 'Register Drone',
      method: 'POST',
      path: '/integration/register',
      defaultBody: JSON.stringify({ registrationNumber: 'DRN-TEST-001', manufacturer: 'Test Manufacturer', model: 'Test Model', maxFlightTime: 45, maxSpeed: 72, maxAltitude: 400, weight: 2.5 }, null, 2),
    },
    {
      value: 'status',
      label: 'Get Status',
      method: 'GET',
      path: '/integration/status',
    },
  ];

  const selectedEndpoint = endpoints.find((e) => e.value === endpoint)!;

  const handleSend = useCallback(async () => {
    if (!apiKey) {
      toast({ title: 'Missing API Key', description: 'Enter your API key above.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setResponse(null);
    setStatus(null);
    try {
      const url = `${apiBase}${selectedEndpoint.path}`;
      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      };
      if (selectedEndpoint.method === 'POST' && body) {
        options.body = body;
      }
      const res = await fetch(url, options);
      setStatus(res.status);
      const text = await res.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text);
      }
    } catch (err) {
      setResponse(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [apiKey, apiBase, selectedEndpoint, body]);

  return (
    <div className="grid gap-6 lg:grid-cols-2 max-w-5xl">
      {/* Request */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">API Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder="drps_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Endpoint</label>
            <select
              value={endpoint}
              onChange={(e) => {
                const ep = endpoints.find((ep) => ep.value === e.target.value)!;
                setEndpoint(ep.value);
                setMethod(ep.method);
                if (ep.defaultBody) setBody(ep.defaultBody);
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {endpoints.map((ep) => (
                <option key={ep.value} value={ep.value}>
                  {ep.method} {ep.path} — {ep.label}
                </option>
              ))}
            </select>
          </div>

          {selectedEndpoint.method === 'POST' && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">Body (JSON)</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y"
              />
            </div>
          )}

          <Button onClick={handleSend} disabled={loading} className="w-full">
            <Play className="h-4 w-4 mr-1.5" />
            {loading ? 'Sending...' : 'Send Request'}
          </Button>
        </CardContent>
      </Card>

      {/* Response */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Response</CardTitle>
            {status !== null && (
              <span
                className={`font-mono text-sm font-medium ${
                  status < 300 ? 'text-emerald-500' : status < 500 ? 'text-amber-500' : 'text-red-500'
                }`}
              >
                {status}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {response === null ? (
            <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground border border-dashed rounded">
              Send a request to see the response
            </div>
          ) : (
            <pre className="rounded bg-muted/50 border p-4 text-xs font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
              {response}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ API Reference Tab ============

function ApiReferenceTab() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Authentication</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-muted-foreground">
            All integration endpoints require an API key in the <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">X-API-Key</code> header.
          </p>
          <pre className="rounded bg-muted/50 border p-3 text-xs font-mono">{`X-API-Key: drps_your_api_key_here`}</pre>
          <p className="text-muted-foreground text-xs">
            Rate limit: configurable per key (default 100 req/min). Exceeding returns <code className="px-1 py-0.5 bg-muted rounded">429 Too Many Requests</code>.
          </p>
        </CardContent>
      </Card>

      <EndpointDoc
        method="POST"
        path="/api/v1/integration/telemetry"
        title="Submit Telemetry"
        description="Send real-time position and status data for a drone. If the drone is not registered, it will be auto-created."
        requestBody={{
          droneId: { type: 'string', required: true, description: 'Drone registration number (e.g. "DRN-001")' },
          latitude: { type: 'number', required: true, description: 'WGS84 latitude (-90 to 90)' },
          longitude: { type: 'number', required: true, description: 'WGS84 longitude (-180 to 180)' },
          altitude: { type: 'number', required: true, description: 'Altitude in meters MSL' },
          heading: { type: 'number', required: true, description: 'Heading in degrees (0-360)' },
          speed: { type: 'number', required: true, description: 'Ground speed in m/s' },
          batteryLevel: { type: 'number', required: true, description: 'Battery percentage (0-100)' },
          verticalSpeed: { type: 'number', required: false, description: 'Vertical speed in m/s' },
          satellites: { type: 'number', required: false, description: 'Number of GPS satellites' },
          signalStrength: { type: 'number', required: false, description: 'Signal strength (0-100)' },
        }}
        responseExample={`{
  "success": true,
  "droneId": "uuid-here",
  "registrationNumber": "DRN-001",
  "timestamp": "2025-01-15T10:30:00.000Z"
}`}
      />

      <EndpointDoc
        method="POST"
        path="/api/v1/integration/register"
        title="Register Drone"
        description="Pre-register a drone with detailed specifications. Not required — drones are auto-registered on first telemetry."
        requestBody={{
          registrationNumber: { type: 'string', required: true, description: 'Unique drone identifier' },
          manufacturer: { type: 'string', required: true, description: 'Manufacturer name' },
          model: { type: 'string', required: true, description: 'Drone model' },
          maxFlightTime: { type: 'number', required: false, description: 'Max flight time in minutes' },
          maxSpeed: { type: 'number', required: false, description: 'Max speed in km/h' },
          maxAltitude: { type: 'number', required: false, description: 'Max altitude in meters' },
          weight: { type: 'number', required: false, description: 'Weight in kg' },
          batteryCapacity: { type: 'number', required: false, description: 'Battery capacity in mAh' },
        }}
        responseExample={`{
  "success": true,
  "drone": {
    "id": "uuid-here",
    "registrationNumber": "DRN-001",
    "manufacturer": "Acme",
    "model": "SkyRunner X1",
    "status": "available"
  }
}`}
      />

      <EndpointDoc
        method="GET"
        path="/api/v1/integration/status"
        title="Get Status"
        description="Get a list of all drones associated with your API key and their current status."
        responseExample={`{
  "manufacturer": "Acme Drones",
  "totalDrones": 3,
  "drones": [
    {
      "id": "uuid-here",
      "registrationNumber": "DRN-001",
      "status": "active",
      "lastSeen": "2025-01-15T10:30:00.000Z"
    }
  ]
}`}
      />
    </div>
  );
}

// ============ Shared Components ============

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 px-2">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

interface FieldDoc {
  type: string;
  required: boolean;
  description: string;
}

function EndpointDoc({
  method,
  path,
  title,
  description,
  requestBody,
  responseExample,
}: {
  method: string;
  path: string;
  title: string;
  description: string;
  requestBody?: Record<string, FieldDoc>;
  responseExample: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span
            className={`rounded px-2 py-0.5 text-xs font-bold font-mono ${
              method === 'GET'
                ? 'bg-blue-500/10 text-blue-500'
                : 'bg-emerald-500/10 text-emerald-500'
            }`}
          >
            {method}
          </span>
          <code className="text-sm font-mono">{path}</code>
        </div>
        <CardTitle className="text-base mt-2">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>

        {requestBody && (
          <div>
            <h4 className="text-sm font-medium mb-2">Request Body</h4>
            <div className="rounded border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="px-3 py-2 text-left font-medium">Field</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Required</th>
                    <th className="px-3 py-2 text-left font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(requestBody).map(([field, doc]) => (
                    <tr key={field} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono">{field}</td>
                      <td className="px-3 py-2 text-muted-foreground">{doc.type}</td>
                      <td className="px-3 py-2">
                        {doc.required ? (
                          <span className="text-amber-500">Yes</span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{doc.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium mb-2">Response Example</h4>
          <pre className="rounded bg-muted/50 border p-3 text-xs font-mono overflow-x-auto whitespace-pre">
            {responseExample}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
