// Coordinator's live city map on Leaflet + OpenStreetMap. The engine still plans on its 10 km x 10 km
// grid (x east, y south, in km); this lays that grid over Pune so every site and rider has a real spot.
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { activeTasks, isCarrying, site } from '@/engine.js';
import { byId, ago } from '@/ui/kit.js';
import { checkInState } from '@/ui/derive.js';

// North-west corner of the grid: 5 km north and west of Pune city centre (18.5204, 73.8567).
const NW = { lat: 18.5204 + 5 / 110.6, lng: 73.8567 - 5 / 104.9 };
export const toLatLng = ({ x, y }) => [NW.lat - y / 110.6, NW.lng + x / 104.9]; // km per degree at this latitude
const BOUNDS = [toLatLng({ x: -0.4, y: -0.4 }), toLatLng({ x: 10.4, y: 10.4 })];

// Lucide glyphs (house, bike, truck, package), inlined because Leaflet markers take plain HTML.
const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const GLYPH = {
  house: svg('<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  bike: svg('<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>'),
  tempo: svg('<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'),
  box: svg('<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="M3.29 7 12 12l8.71-5"/>'),
};
// Autos are the city's tempos; scooters and cycles both read as a bike at this size.
const VEHICLE_GLYPH = { auto: 'tempo', scooter: 'bike', cycle: 'bike' };

// Cache icons by look so a marker keeps its DOM node between ticks and riders glide instead of blinking.
const icons = new Map();
function icon(kind, glyph, color, mods = '') {
  const key = `${kind}|${glyph}|${color}|${mods}`;
  if (!icons.has(key)) {
    const size = kind === 'rider' ? 26 : 30;
    icons.set(key, L.divIcon({
      className: `cm-icon cm-${kind} ${mods}`,
      html: `<span style="--c:${color}">${glyph ? GLYPH[glyph] : ''}</span>`,
      iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    }));
  }
  return icons.get(key);
}

const ROUTE = {
  pickup: { color: 'var(--rider)', weight: 2.5, dashArray: '4 6' },
  carry: { color: 'var(--rider)', weight: 3.5 },
  reroute: { color: 'var(--warn)', weight: 3.5, dashArray: '8 6' },
};

export function CityMap({ s, selected, onSelect }) {
  return (
    <MapContainer bounds={BOUNDS} scrollWheelZoom={false} className="nexus-map z-0 aspect-square w-full rounded-lg border sm:aspect-[5/4]"
      aria-label="City map with donors, receiving sites, food stations and riders">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {activeTasks(s).filter((t) => t.phase !== 'queued').map((t) => {
        const r = byId(s.riders, t.riderId);
        const d = byId(s.donors, byId(s.batches, t.batchId).donorId);
        const sh = site(s, t.shelterId);
        return t.phase === 'to_pickup'
          ? <Polyline key={t.id} positions={[toLatLng(r), toLatLng(d), toLatLng(sh)]} pathOptions={ROUTE.pickup} />
          : <Polyline key={t.id} positions={[toLatLng(r), toLatLng(sh)]} pathOptions={t.rerouted ? ROUTE.reroute : ROUTE.carry} />;
      })}

      {s.donors.map((d) => {
        const left = s.batches.filter((b) => b.donorId === d.id && b.remaining > 0 && b.status !== 'expired').reduce((a, b) => a + b.remaining, 0);
        return (
          <Marker key={d.id} position={toLatLng(d)} icon={icon('donor', 'box', 'var(--donor)')}>
            <Tooltip permanent direction="top" offset={[0, -14]} className="cm-lbl">{d.name}{left > 0 && <small>{left} waiting</small>}</Tooltip>
          </Marker>
        );
      })}

      {s.shelters.map((sh) => {
        const ci = checkInState(s, sh);
        const color = !sh.open ? 'var(--bad)' : ci.key === 'ghost' ? 'var(--warn)' : 'var(--shelter)';
        const mods = [!sh.verified && 'cm-hollow', ci.key === 'ghost' && 'cm-ghost'].filter(Boolean).join(' ');
        return (
          <Marker key={sh.id} position={toLatLng(sh)} icon={icon('site', 'house', color, mods)}>
            <Tooltip permanent direction="bottom" offset={[0, 14]} className="cm-lbl">
              {sh.name}
              <small>{!sh.open ? 'CLOSED' : ci.key === 'ghost' ? `last seen ${ago(ci.since)}` : !sh.verified ? 'unverified · via station' : `${sh.headcount} people`}</small>
            </Tooltip>
          </Marker>
        );
      })}

      {s.stations.map((st) => (
        <Marker key={st.id} position={toLatLng(st)} icon={icon('station', null, st.open ? 'var(--station)' : 'var(--bad)')}>
          <Tooltip permanent direction="bottom" offset={[0, 12]} className="cm-lbl">{st.name}</Tooltip>
        </Marker>
      ))}

      {s.riders.map((r) => {
        const t = r.taskId && byId(s.tasks, r.taskId);
        const color = r.silent ? 'var(--bad)' : r.traffic ? 'var(--warn)' : 'var(--rider)';
        return (
          <Marker key={r.id} position={toLatLng(r)} zIndexOffset={1000}
            icon={icon('rider', VEHICLE_GLYPH[r.vehicle] ?? 'bike', color, r.id === selected ? 'cm-selected' : '')}
            title={`${r.name}: click to preview their phone`} eventHandlers={{ click: () => onSelect(r.id) }}>
            <Tooltip permanent direction="right" offset={[12, 0]} className="cm-lbl cm-rider-lbl">
              <span style={{ color }}>{r.name}{t && isCarrying(t) ? ` · ${t.qty}` : ''}{r.silent ? ' ⚠' : ''}</span>
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
