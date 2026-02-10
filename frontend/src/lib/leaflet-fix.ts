// Fix Leaflet default icon issue in Next.js SSR environment
// This must be imported before any Leaflet components

import L from 'leaflet';

// Only run on client side
if (typeof window !== 'undefined') {
  // Delete the _getIconUrl method to prevent Leaflet from trying to load default icons
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;

  // Set up default icon paths (even though we use custom icons, this prevents errors)
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

export {};
