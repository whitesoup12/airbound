/**
 * Open-Source & Keyless Basemap Layer Presets for Leaflet
 * 100% free and open-source for public desktop usage without requiring API keys.
 */
export const BASEMAP_PRESETS = {
  dark: {
    id: 'dark',
    name: 'Cockpit Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  },
  osm: {
    id: 'osm',
    name: 'OpenStreetMap (VFR)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    subdomains: 'abc',
    maxZoom: 19
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite Terrain',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>, Earthstar Geographics',
    subdomains: 'a',
    maxZoom: 18
  }
};

export function getStoredBasemap() {
  const stored = localStorage.getItem('airbound_basemap');
  return BASEMAP_PRESETS[stored] ? stored : 'dark';
}

export function setStoredBasemap(presetId) {
  if (BASEMAP_PRESETS[presetId]) {
    localStorage.setItem('airbound_basemap', presetId);
  }
}
