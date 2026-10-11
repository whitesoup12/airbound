/**
 * Keyless Basemap Layer Presets for Leaflet
 * 100% free and open-source for public desktop usage without requiring API keys.
 */
export const BASEMAP_PRESETS = {
  topo: {
    id: 'topo',
    name: 'VFR Topographic',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>, DeLorme, NAVTEQ',
    maxZoom: 18
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite Terrain',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>, Earthstar Geographics',
    maxZoom: 18
  },
  dark: {
    id: 'dark',
    name: 'Cockpit Dark',
    url: 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>, DeLorme, NAVTEQ',
    maxZoom: 16
  },
  streets: {
    id: 'streets',
    name: 'World Street Map',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/" target="_blank" rel="noreferrer">Esri</a>, DeLorme, NAVTEQ',
    maxZoom: 18
  }
};

export function getStoredBasemap() {
  const stored = localStorage.getItem('airbound_basemap');
  return BASEMAP_PRESETS[stored] ? stored : 'topo';
}

export function setStoredBasemap(presetId) {
  if (BASEMAP_PRESETS[presetId]) {
    localStorage.setItem('airbound_basemap', presetId);
  }
}
