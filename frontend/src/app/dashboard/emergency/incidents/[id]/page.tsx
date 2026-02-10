'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useEmergencyStore } from '@/store/emergency.store';
import { MapView } from '@/components/shared/map-view';
import { RootCause } from '@/lib/api';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  AlertTriangle,
  ShieldAlert,
  AlertOctagon,
  CheckCircle2,
  Clock,
  MapPin,
  Battery,
  Wifi,
  Navigation,
  Gauge,
  FileText,
  Save,
} from 'lucide-react';
import { format } from 'date-fns';

const SEVERITY_CONFIG = {
  warning: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: AlertTriangle, label: 'Warning' },
  critical: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: ShieldAlert, label: 'Critical' },
  emergency: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertOctagon, label: 'Emergency' },
};

const STATUS_CONFIG = {
  active: { color: 'bg-red-500/20 text-red-400', label: 'Active' },
  pending_confirmation: { color: 'bg-amber-500/20 text-amber-400', label: 'Awaiting Confirmation' },
  executing: { color: 'bg-blue-500/20 text-blue-400', label: 'Executing' },
  resolved: { color: 'bg-emerald-500/20 text-emerald-400', label: 'Resolved' },
  escalated: { color: 'bg-purple-500/20 text-purple-400', label: 'Escalated' },
};

const ROOT_CAUSE_OPTIONS: { value: RootCause; label: string }[] = [
  { value: 'equipment', label: 'Equipment Failure' },
  { value: 'weather', label: 'Weather Conditions' },
  { value: 'pilot_error', label: 'Pilot Error' },
  { value: 'software', label: 'Software Issue' },
  { value: 'external', label: 'External Factor' },
  { value: 'unknown', label: 'Unknown' },
];

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [rootCause, setRootCause] = useState<RootCause | ''>('');
  const [notes, setNotes] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [saving, setSaving] = useState(false);
  const playbackRef = useRef<NodeJS.Timeout | null>(null);

  const {
    selectedIncident: incident,
    blackboxData,
    loading,
    fetchIncident,
    fetchBlackbox,
    updateRootCause,
  } = useEmergencyStore();

  useEffect(() => {
    fetchIncident(id);
    fetchBlackbox(id);
  }, [id, fetchIncident, fetchBlackbox]);

  useEffect(() => {
    if (incident) {
      setRootCause(incident.rootCause || '');
      setNotes(incident.rootCauseNotes || '');
      setLessonsLearned(incident.lessonsLearned || '');
    }
  }, [incident]);

  // Playback logic
  useEffect(() => {
    if (isPlaying && blackboxData.length > 0) {
      playbackRef.current = setInterval(() => {
        setPlaybackIndex((prev) => {
          if (prev >= blackboxData.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }

    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, blackboxData.length]);

  const handleSaveRootCause = async () => {
    if (!rootCause || !incident) return;
    setSaving(true);
    try {
      await updateRootCause(incident.id, rootCause, notes, lessonsLearned);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !incident) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const severityConfig = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.warning;
  const statusConfig = STATUS_CONFIG[incident.status] || STATUS_CONFIG.active;
  const SeverityIcon = severityConfig.icon;

  const currentBlackbox = blackboxData[playbackIndex];
  const dronePosition: [number, number] | null = currentBlackbox
    ? [currentBlackbox.latitude, currentBlackbox.longitude]
    : incident.latitude && incident.longitude
      ? [incident.latitude, incident.longitude]
      : null;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${severityConfig.color}`}>
              <SeverityIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{incident.message}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Incident #{incident.id.slice(0, 8)}
              </p>
            </div>
          </div>
        </div>
        <Badge className={severityConfig.color}>{severityConfig.label}</Badge>
        <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Detected</p>
                <p className="font-medium">{format(new Date(incident.detectedAt), 'PPp')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Navigation className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Drone</p>
                <p className="font-medium">{incident.drone?.registrationNumber || incident.droneId}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Gauge className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Response</p>
                <p className="font-medium">{incident.responseAction || 'None'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              {incident.actionSuccess ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              )}
              <div>
                <p className="text-xs text-muted-foreground">Outcome</p>
                <p className="font-medium">
                  {incident.actionSuccess === true
                    ? 'Successful'
                    : incident.actionSuccess === false
                      ? 'Failed'
                      : 'Pending'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Map + Replay */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Incident Replay
                </CardTitle>
                {blackboxData.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {playbackIndex + 1} / {blackboxData.length} frames
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {dronePosition ? (
                <MapView
                  center={dronePosition}
                  zoom={14}
                  markers={[
                    {
                      id: 'incident-location',
                      position: dronePosition,
                      label: 'Incident Location',
                      color: '#ef4444',
                    },
                  ]}
                  droneMarkers={
                    currentBlackbox
                      ? [
                          {
                            id: incident.droneId,
                            position: [currentBlackbox.latitude, currentBlackbox.longitude],
                            heading: currentBlackbox.heading,
                            flightNumber: incident.flight?.flightNumber || 'Unknown',
                            altitude: currentBlackbox.altitudeMsl,
                            groundSpeed: currentBlackbox.groundSpeed,
                            batteryLevel: currentBlackbox.batteryLevel,
                          },
                        ]
                      : []
                  }
                  className="h-[350px] rounded-lg overflow-hidden"
                />
              ) : (
                <div className="h-[350px] flex items-center justify-center bg-muted rounded-lg">
                  <p className="text-muted-foreground">No location data available</p>
                </div>
              )}

              {/* Playback Controls */}
              {blackboxData.length > 0 && (
                <div className="mt-4 space-y-3">
                  {/* Progress bar */}
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-primary transition-all"
                      style={{ width: `${(playbackIndex / (blackboxData.length - 1)) * 100}%` }}
                    />
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setPlaybackIndex(0)}
                      >
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setIsPlaying(!isPlaying)}
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setPlaybackIndex(blackboxData.length - 1)}
                      >
                        <SkipForward className="h-4 w-4" />
                      </Button>
                    </div>

                    <Select
                      value={playbackSpeed.toString()}
                      onValueChange={(v) => setPlaybackSpeed(parseFloat(v))}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.25">0.25x</SelectItem>
                        <SelectItem value="0.5">0.5x</SelectItem>
                        <SelectItem value="1">1x</SelectItem>
                        <SelectItem value="2">2x</SelectItem>
                        <SelectItem value="4">4x</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Telemetry at current frame */}
          {currentBlackbox && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Battery className={`h-4 w-4 ${currentBlackbox.batteryLevel < 20 ? 'text-red-400' : 'text-muted-foreground'}`} />
                    <span className="text-xs text-muted-foreground">Battery</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{Math.round(currentBlackbox.batteryLevel)}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Wifi className={`h-4 w-4 ${currentBlackbox.signalStrength < 30 ? 'text-red-400' : 'text-muted-foreground'}`} />
                    <span className="text-xs text-muted-foreground">Signal</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{Math.round(currentBlackbox.signalStrength)}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Altitude</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{Math.round(currentBlackbox.altitudeMsl)}m</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Speed</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{Math.round(currentBlackbox.groundSpeed)} km/h</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Right: Timeline + Investigation */}
        <div className="space-y-4">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Event Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(incident.timeline || []).map((event, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      {i < (incident.timeline?.length || 0) - 1 && (
                        <div className="w-0.5 h-full bg-border" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium capitalize">
                        {event.event.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.timestamp), 'HH:mm:ss')}
                      </p>
                      {event.data && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {Object.entries(event.data)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Root Cause Investigation */}
          {incident.status === 'resolved' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Investigation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Root Cause</label>
                  <Select
                    value={rootCause}
                    onValueChange={(v) => setRootCause(v as RootCause)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select root cause" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROOT_CAUSE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    className="mt-1"
                    placeholder="Additional notes about the incident..."
                    value={notes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Lessons Learned</label>
                  <Textarea
                    className="mt-1"
                    placeholder="What can be improved to prevent this..."
                    value={lessonsLearned}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLessonsLearned(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleSaveRootCause}
                  disabled={!rootCause || saving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Investigation'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
