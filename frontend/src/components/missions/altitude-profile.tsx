'use client';

import { useMemo } from 'react';
import { Waypoint } from '@/store/missions.store';

interface AltitudeProfileProps {
  waypoints: Waypoint[];
  selectedWaypointId?: string | null;
  onWaypointClick?: (waypoint: Waypoint) => void;
  className?: string;
}

export function AltitudeProfile({
  waypoints,
  selectedWaypointId,
  onWaypointClick,
  className,
}: AltitudeProfileProps) {
  const sortedWaypoints = useMemo(
    () => [...waypoints].sort((a, b) => a.sequence - b.sequence),
    [waypoints]
  );

  const { minAlt, maxAlt, totalDistance, segments } = useMemo(() => {
    if (sortedWaypoints.length === 0) {
      return { minAlt: 0, maxAlt: 100, totalDistance: 0, segments: [] };
    }

    const altitudes = sortedWaypoints.map((wp) => wp.altitude);
    const min = Math.min(...altitudes);
    const max = Math.max(...altitudes);
    const padding = (max - min) * 0.1 || 10;

    // Calculate cumulative distances
    let cumDistance = 0;
    const segs = sortedWaypoints.map((wp, i) => {
      if (i > 0) {
        const prev = sortedWaypoints[i - 1];
        const dist = calculateDistance(
          prev.latitude,
          prev.longitude,
          wp.latitude,
          wp.longitude
        );
        cumDistance += dist;
      }
      return {
        waypoint: wp,
        distance: cumDistance,
      };
    });

    return {
      minAlt: min - padding,
      maxAlt: max + padding,
      totalDistance: cumDistance || 1,
      segments: segs,
    };
  }, [sortedWaypoints]);

  if (waypoints.length === 0) {
    return (
      <div className={`bg-card rounded-lg border p-4 ${className}`}>
        <div className="text-sm text-muted-foreground text-center py-8">
          Add waypoints to see altitude profile
        </div>
      </div>
    );
  }

  const chartWidth = 400;
  const chartHeight = 120;
  const chartPadding = { top: 20, right: 20, bottom: 25, left: 40 };
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;

  const getY = (altitude: number) => {
    const range = maxAlt - minAlt;
    if (range === 0) return chartPadding.top + plotHeight / 2;
    return chartPadding.top + ((maxAlt - altitude) / range) * plotHeight;
  };

  const getX = (distance: number) => {
    if (totalDistance === 0) return chartPadding.left;
    return chartPadding.left + (distance / totalDistance) * plotWidth;
  };

  // Create path for altitude line
  const pathD = segments
    .map((seg, i) => {
      const x = getX(seg.distance);
      const y = getY(seg.waypoint.altitude);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  // Create filled area path
  const baselineY = chartPadding.top + plotHeight;
  const areaD = pathD +
    ` L ${getX(totalDistance)} ${baselineY}` +
    ` L ${chartPadding.left} ${baselineY} Z`;

  return (
    <div className={`bg-card rounded-lg border overflow-hidden ${className}`}>
      <div className="px-3 py-2 border-b bg-muted/50">
        <span className="text-xs font-medium">Altitude Profile</span>
      </div>
      <div className="p-2">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-32"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const alt = minAlt + (maxAlt - minAlt) * (1 - ratio);
            const y = getY(alt);
            return (
              <g key={ratio}>
                <line
                  x1={chartPadding.left}
                  y1={y}
                  x2={chartWidth - chartPadding.right}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                  strokeWidth={1}
                />
                <text
                  x={chartPadding.left - 4}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={9}
                  fill="currentColor"
                  fillOpacity={0.5}
                >
                  {Math.round(alt)}m
                </text>
              </g>
            );
          })}

          {/* Filled area */}
          <path
            d={areaD}
            fill="url(#altitudeGradient)"
            fillOpacity={0.3}
          />

          {/* Altitude line */}
          <path
            d={pathD}
            fill="none"
            stroke="#6366f1"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Waypoint markers */}
          {segments.map((seg, i) => {
            const x = getX(seg.distance);
            const y = getY(seg.waypoint.altitude);
            const isSelected = seg.waypoint.id === selectedWaypointId;
            const isFirst = i === 0;
            const isLast = i === segments.length - 1;

            return (
              <g
                key={seg.waypoint.id}
                onClick={() => onWaypointClick?.(seg.waypoint)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 7 : 5}
                  fill={isFirst ? '#22c55e' : isLast ? '#ef4444' : '#6366f1'}
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  x={x}
                  y={y - 10}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={500}
                  fill="currentColor"
                  fillOpacity={0.7}
                >
                  {i + 1}
                </text>
              </g>
            );
          })}

          {/* X-axis label */}
          <text
            x={chartWidth / 2}
            y={chartHeight - 6}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.5}
          >
            Distance: {(totalDistance / 1000).toFixed(1)} km
          </text>

          {/* Gradient definition */}
          <defs>
            <linearGradient id="altitudeGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

// Haversine distance calculation
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
