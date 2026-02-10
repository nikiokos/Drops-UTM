// Fix Leaflet default icon issue in Next.js SSR environment
// This file should be imported BEFORE react-leaflet

export function fixLeafletIcon(): void {
  if (typeof window === 'undefined') return;

  // Import Leaflet and apply the fix
  // Using require for synchronous loading
  const L = require('leaflet') as typeof import('leaflet');

  // Delete the _getIconUrl method to prevent auto-detection issues
  type IconPrototype = { _getIconUrl?: unknown };
  delete (L.Icon.Default.prototype as IconPrototype)._getIconUrl;

  // Set explicit icon paths using local files
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    iconUrl: '/leaflet/marker-icon.png',
    shadowUrl: '/leaflet/marker-shadow.png',
  });
}

// Auto-run the fix on client side
if (typeof window !== 'undefined') {
  fixLeafletIcon();
}
