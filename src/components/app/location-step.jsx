// Pickup location picker: Leaflet + OpenStreetMap tiles. Ported from the Nexus prototype's
// "Set a place on the map" step. The GPS position and the chosen pin are separate: a donor can
// capture GPS, then drag the pin to the bakery down the road.
import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Callout } from '@/components/app/bits';

// Pune city centre, same default as the Nexus prototype.
export const DEFAULT_PICKUP = { lat: 18.5204, lng: 73.8567, label: '', contact: '' };

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
