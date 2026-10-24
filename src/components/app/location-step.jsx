// Pickup location picker: Leaflet + OpenStreetMap tiles. Ported from the Nexus prototype's
// "Set a place on the map" step. The GPS position and the chosen pin are separate: a donor can
// capture GPS, then drag the pin to the bakery down the road.
import { useEffect, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Callout } from '@/components/app/bits';
import { cn } from '@/lib/utils';
import { GRID_KM, inGrid, toGrid } from '@/geo.js';

// Pune city centre, same default as the Nexus prototype.
export const DEFAULT_PICKUP = { lat: 18.5204, lng: 73.8567, label: '', contact: '' };

// Riders only cover the 10 km x 10 km service grid around the city centre; a pin outside it is refused.
export const inServiceArea = (point) => inGrid(toGrid(point));
export const OUT_OF_AREA = `This pin is outside the ${GRID_KM} km × ${GRID_KM} km area our riders cover around Pune city centre. Move it inside the area to post.`;

const pin = L.divIcon({ className: 'nexus-marker', html: '<span>📍</span>', iconSize: [34, 34], iconAnchor: [17, 17] });
const round = (n) => Number(n.toFixed(6));

function PinPicker({ point, onPick }) {
  useMapEvents({ click(e) { onPick({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }); } });
  return (
    <Marker position={[point.lat, point.lng]} icon={pin}>
      <Popup>Pickup location<br />{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</Popup>
    </Marker>
  );
}

function Recenter({ point }) {
  const map = useMap();
  useEffect(() => { map.setView([point.lat, point.lng], Math.max(map.getZoom(), 14)); }, [point.lat, point.lng, map]);
  return null;
}

// Rings that pulse outward from the pickup pin, only while the batch is genuinely waiting for a match.
const ripple = L.divIcon({ className: 'nexus-ripple', html: '<span></span><span></span><span></span>', iconSize: [240, 240], iconAnchor: [120, 120] });
const dot = (cls) => L.divIcon({ className: `nexus-dot ${cls}`, html: '<span></span>', iconSize: [16, 16], iconAnchor: [8, 8] });
const SITE_DOT = dot('nexus-dot-site');
const RIDER_DOT = dot('nexus-dot-rider');

// Keep every route in view as riders are matched; with none, stay centred on the pin.
function FitRoutes({ point, routes, riders }) {
  const map = useMap();
  const key = routes.map((r) => r.id).join('|');
  useEffect(() => {
    if (!routes.length) { map.setView([point.lat, point.lng], 14); return; }
    map.fitBounds([[point.lat, point.lng], ...routes.map((r) => r.to), ...riders.map((r) => r.at)], { padding: [36, 36], maxZoom: 15 });
  }, [key, point.lat, point.lng, map]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// Read-only map for the confirm step: the chosen pin and, once the engine has matched it, the route from
// the pin to each receiving site and where each rider is now. status: the pill text, or null for none.
export function PickupPreview({ point, routes = [], riders = [], searching = false, status = null, className }) {
  return (
    <div className={cn('relative isolate overflow-hidden rounded-lg border', className)}>
      <MapContainer key={`${point.lat},${point.lng}`} center={[point.lat, point.lng]} zoom={14} className="nexus-map z-0 h-full min-h-[260px] w-full"
        dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} boxZoom={false} keyboard={false} zoomControl={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitRoutes point={point} routes={routes} riders={riders} />
        {routes.map((r) => (
          <Polyline key={r.id} positions={[[point.lat, point.lng], r.to]} pathOptions={{ color: 'var(--primary)', weight: 3.5 }} interactive={false} />
        ))}
        {routes.map((r) => (
          <Marker key={`site-${r.id}`} position={r.to} icon={SITE_DOT} interactive={false}>
            <Tooltip permanent direction="bottom" offset={[0, 8]} className="cm-lbl">{r.name}</Tooltip>
          </Marker>
        ))}
        {riders.map((r) => (
          <Marker key={`rider-${r.id}`} position={r.at} icon={RIDER_DOT} interactive={false}>
            <Tooltip permanent direction="right" offset={[8, 0]} className="cm-lbl cm-rider-lbl">{r.name}</Tooltip>
          </Marker>
        ))}
        {searching && <Marker position={[point.lat, point.lng]} icon={ripple} interactive={false} />}
        <Marker position={[point.lat, point.lng]} icon={pin} interactive={false} />
      </MapContainer>
      {status && (
        <div role="status" className="pointer-events-none absolute top-3 left-3 z-[400] flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border bg-card/90 py-1.5 pr-3.5 pl-2.5 text-[12.5px] font-semibold shadow-sm backdrop-blur">
          <span className="relative flex size-2.5 shrink-0">
            {searching && <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />}
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
          {status}
        </div>
      )}
    </div>
  );
}

export function LocationStep({ value, onChange }) {
  const [gps, setGps] = useState(null);
  const [msg, setMsg] = useState(null);
  const set = (patch) => onChange({ ...value, ...patch });

  const useGPS = () => {
    if (!navigator.geolocation) { setMsg(['warn', 'This browser does not support location access. Click the map or type a landmark instead.']); return; }
    setMsg(['info', 'Requesting location permission…']);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = { lat: round(p.coords.latitude), lng: round(p.coords.longitude) };
        setGps(next);
        set(next);
        setMsg(['ok', 'Current location captured. You can still click the map to move the pickup pin somewhere else.']);
      },
      () => setMsg(['warn', 'Location permission was denied or unavailable. You can still click the map or enter a landmark.']),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
      <div className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="pickup-label">Place or landmark name</Label>
          <Input id="pickup-label" value={value.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Sunrise Bakery, hostel mess, back gate" />
          <p className="font-prose text-xs text-muted-foreground">
            Landmark search is not connected to a geocoding service yet, so the name is saved as text. Click the map to set the exact pin.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={useGPS}><LocateFixed /> Use my current GPS location</Button>
        {msg && <Callout tone={msg[0]} icon={msg[0] === 'ok' ? 'check' : 'map'}>{msg[1]}</Callout>}
        {!inServiceArea(value) && <Callout tone="bad" icon="alert" title="Outside the delivery area">{OUT_OF_AREA}</Callout>}
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3.5">
          <MapPin className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 text-sm">
            <b className="block font-semibold">Selected pickup pin</b>
            <span className="block font-mono text-xs text-muted-foreground tabular">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}</span>
            <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{value.label.trim() || 'Click on the map to choose a place'}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pickup-contact">Pickup contact <span className="font-normal text-muted-foreground">optional</span></Label>
          <Input id="pickup-contact" type="tel" inputMode="tel" value={value.contact} onChange={(e) => set({ contact: e.target.value })} placeholder="Phone number for the rider" />
        </div>
      </div>

      <div className="min-w-0 rounded-xl border p-3">
        <div className="flex items-center justify-between px-1 pb-2.5">
          <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
            <span className="size-2 rounded-full bg-ok" /> Interactive map
          </span>
          <Button type="button" variant="outline" size="icon" title="Recenter to GPS" aria-label="Recenter to GPS"
            onClick={() => (gps ? set(gps) : useGPS())}><Navigation /></Button>
        </div>
        <MapContainer center={[value.lat, value.lng]} zoom={13} scrollWheelZoom className="nexus-map z-0 h-[300px] w-full rounded-lg sm:h-[350px]">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Recenter point={value} />
          <PinPicker point={value} onPick={set} />
        </MapContainer>
        <p className="px-1 pt-2.5 font-prose text-xs text-muted-foreground">
          Click anywhere on the map to set the pickup point. GPS and the chosen pin are independent after capture.
        </p>
      </div>
    </div>
  );
}
