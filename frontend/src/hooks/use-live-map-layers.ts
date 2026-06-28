'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adsbApi, dagrApi, openaipApi } from '@/lib/api';
import type { AircraftMarkerData, WmsLayerData, OverlayTileData } from '@/components/shared/map-view';

/**
 * Shared live-map data layers used across Dashboard / Control / Conflicts:
 * real ADS-B traffic, openAIP airspace tiles, and DAGR Greek drone-zone WMS,
 * each gated by a toggle. Returns the layer arrays ready to pass to <MapView>.
 */
export function useLiveMapLayers(opts?: { aircraftDefault?: boolean }) {
  const [showAircraft, setShowAircraft] = useState(opts?.aircraftDefault ?? true);
  const [showAirspace, setShowAirspace] = useState(false);
  const [showDroneZones, setShowDroneZones] = useState(false);

  const { data: adsbData } = useQuery({
    queryKey: ['adsb-aircraft'],
    queryFn: () => adsbApi.getAircraft().then((r) => r.data),
    refetchInterval: 5000,
    enabled: showAircraft,
  });

  const { data: dagrConfig } = useQuery({
    queryKey: ['dagr-config'],
    queryFn: () => dagrApi.getConfig().then((r) => r.data),
    staleTime: Infinity,
  });

  const aircraftMarkers: AircraftMarkerData[] = useMemo(
    () =>
      showAircraft
        ? (adsbData?.aircraft ?? [])
            .filter((a) => typeof a.lat === 'number' && typeof a.lon === 'number')
            .map((a) => ({
              id: a.hex,
              position: [a.lat, a.lon] as [number, number],
              callsign: a.callsign,
              altitude: a.altitude,
              groundSpeed: a.groundSpeed,
              track: a.track,
              type: a.type,
              registration: a.registration,
              onGround: a.onGround,
              emergency: a.emergency,
            }))
        : [],
    [showAircraft, adsbData],
  );

  const wmsLayers: WmsLayerData[] = useMemo(
    () =>
      showDroneZones && dagrConfig
        ? [
            {
              id: 'dagr-limitations',
              url: dagrConfig.wmsUrl,
              layers: dagrConfig.layers.limitations,
              version: dagrConfig.version,
              opacity: 0.55,
              attribution: dagrConfig.attribution,
            },
          ]
        : [],
    [showDroneZones, dagrConfig],
  );

  const overlayTiles: OverlayTileData[] = useMemo(
    () =>
      showAirspace
        ? [
            {
              id: 'openaip',
              url: openaipApi.tileUrl(),
              opacity: 0.9,
              attribution: 'Airspace © openAIP (CC BY-NC-SA)',
            },
          ]
        : [],
    [showAirspace],
  );

  return {
    showAircraft,
    setShowAircraft,
    showAirspace,
    setShowAirspace,
    showDroneZones,
    setShowDroneZones,
    aircraftMarkers,
    wmsLayers,
    overlayTiles,
    adsbData,
  };
}
