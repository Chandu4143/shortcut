import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLng, Place, RoutePair } from '../lib/routing';

const startIcon = L.divIcon({
  className: 'short-cut-marker',
  html: '<span class="marker-dot marker-start"></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});
const endIcon = L.divIcon({
  className: 'short-cut-marker',
  html: '<span class="marker-dot marker-end"></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

interface MapCanvasProps {
  origin: Place | null;
  destination: Place | null;
  routes: RoutePair | null;
  pickMode: 'origin' | 'destination' | null;
  onMapPick: (point: Place) => void;
}

function MapActions({
  origin,
  destination,
  routes,
  pickMode,
  onMapPick,
}: MapCanvasProps) {
  const map = useMap();
  useMapEvents({
    click(event) {
      if (pickMode) {
        onMapPick({ lat: event.latlng.lat, lon: event.latlng.lng, label: 'Map pin' });
      }
    },
  });

  useEffect(() => {
    const points = routes?.shortest.coordinates ?? [
      ...(origin ? [[origin.lat, origin.lon] as LatLng] : []),
      ...(destination ? [[destination.lat, destination.lon] as LatLng] : []),
    ];
    if (points.length > 1) {
      map.fitBounds(points.map((point) => [point[0], point[1]]), { padding: [70, 70], maxZoom: 16 });
    } else if (points.length === 1) {
      map.flyTo(points[0], 15, { duration: 0.65 });
    }
  }, [destination, map, origin, routes]);

  return null;
}

export default function MapCanvas(props: MapCanvasProps) {
  const { origin, destination, routes, pickMode } = props;
  return (
    <MapContainer
      center={[17.385, 78.4867]}
      zoom={13}
      zoomControl={false}
      scrollWheelZoom
      className={`map-canvas${pickMode ? ' map-picking' : ''}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {routes && !sameRoute(routes.shortest.coordinates, routes.fastest.coordinates) && (
        <Polyline positions={routes.fastest.coordinates} pathOptions={{ color: '#657d87', weight: 5, opacity: 0.85, dashArray: '7 9' }} />
      )}
      {routes && <Polyline positions={routes.shortest.coordinates} pathOptions={{ color: '#e45537', weight: 7, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} />}
      {origin && <Marker position={[origin.lat, origin.lon]} icon={startIcon} keyboard title="Starting point" />}
      {destination && <Marker position={[destination.lat, destination.lon]} icon={endIcon} keyboard title="Destination" />}
      <MapActions {...props} />
    </MapContainer>
  );
}

function sameRoute(a: LatLng[], b: LatLng[]) {
  if (a.length !== b.length) return false;
  return a.every((point, index) => point[0] === b[index][0] && point[1] === b[index][1]);
}
