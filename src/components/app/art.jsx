// Illustrations and faint background patterns. Everything is inline SVG / CSS drawn from theme tokens,
// so it follows light and dark mode and needs no network (no stock photos to fail on venue wifi).
import { Check, CookingPot, MapPinned, Users, Zap } from 'lucide-react';
import { Ring } from '@/components/app/bits';
import { Icon } from '@/lib/icons';
import { cn } from '@/lib/utils';

// A decorative pattern layer. Colour it with a text-* class at low opacity, e.g. "text-primary/15".
export function Pattern({ kind = 'dots', className }) {
  return <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0', `pattern-${kind}`, className)} />;
}

// ---------- Role scenes ----------
// Small flat illustrations, one per role, each telling that role's part of the story. Drawn on a
// 300 x 128 canvas (ground line at y = 112) from theme tokens only, so they follow light/dark mode.
const INK = 'var(--foreground)';
const PAPER = 'var(--card)';
const soft = (c, pct = 18) => `color-mix(in oklab, ${c} ${pct}%, var(--card))`;

const Ground = ({ c }) => <path d="M8 112.5 H292" stroke={c} strokeOpacity=".28" strokeWidth="1.5" strokeLinecap="round" />;
const Route = ({ d, c, dash = '4 5', w = 1.6, o = 0.6 }) => <path d={d} fill="none" stroke={c} strokeWidth={w} strokeDasharray={dash} strokeLinecap="round" opacity={o} />;

// Person: rounded body + head, standing on the ground line.
const Person = ({ x, h = 34, fill, head = INK, ho = 0.8 }) => (
  <g>
    <path d={`M${x - 8} 112 V${112 - h + 18} a8 8 0 0 1 16 0 V112 Z`} fill={fill} />
    <circle cx={x} cy={112 - h + 4} r={h > 28 ? 6 : 5} fill={head} opacity={ho} />
  </g>
);

// Volunteer on a scooter with an insulated delivery box. Native span x 204-278, y 50-112.
function Scooter({ c, transform }) {
  return (
    <g transform={transform}>
      <g className="scene-ride">
        <rect x="250" y="64" width="26" height="24" rx="4" fill={c} />
        <path d="M263 70 v12 M257 76 h12" stroke={PAPER} strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
        <path d="M212 104 H232 L242 88 L264 104" fill="none" stroke={INK} strokeOpacity=".72" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M242 88 L237 70 M231 70 H243" fill="none" stroke={INK} strokeOpacity=".72" strokeWidth="3" strokeLinecap="round" />
        <path d="M247 66 L251 86" stroke={c} strokeWidth="8" strokeLinecap="round" />
        <path d="M251 86 L243 99" stroke={INK} strokeOpacity=".65" strokeWidth="5" strokeLinecap="round" />
        <path d="M248 71 L239 74" stroke={c} strokeWidth="4" strokeLinecap="round" />
        <circle cx="246" cy="58" r="6.5" fill={INK} opacity=".8" />
        <path d="M239.5 57 a6.5 6.5 0 0 1 13 0 Z" fill={c} />
      </g>
      <circle cx="212" cy="104" r="8" fill={PAPER} stroke={INK} strokeOpacity=".72" strokeWidth="3" />
      <circle cx="264" cy="104" r="8" fill={PAPER} stroke={INK} strokeOpacity=".72" strokeWidth="3" />
    </g>
  );
}

// Safe-time countdown ring, the food-safety motif used across the app.
function SafeRing({ x, y, label, pct = 0.68 }) {
  const r = 12;
  const len = 2 * Math.PI * r;
  return (
    <g>
      <circle cx={x} cy={y} r={r + 3} fill={PAPER} />
      <circle cx={x} cy={y} r={r} fill="none" stroke="var(--muted)" strokeWidth="3" />
      <circle cx={x} cy={y} r={r} fill="none" stroke="var(--ok)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${len * pct} ${len}`} transform={`rotate(-90 ${x} ${y})`} />
      <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill={INK} style={{ fontFamily: 'var(--font-mono)' }}>{label}</text>
    </g>
  );
}

const Pill = ({ x, y, w, children, stroke }) => (
  <g>
    <rect x={x} y={y} width={w} height="18" rx="9" fill={PAPER} stroke={stroke} strokeOpacity=".35" />
    {children}
  </g>
);
const Tick = ({ cx, cy, r = 6 }) => (
  <g><circle cx={cx} cy={cy} r={r} fill="var(--ok)" /><path d={`M${cx - 2.6} ${cy} l1.9 1.9 l3.4 -3.6`} fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></g>
);

// Donor: surplus leaves the kitchen inside its safe time.
function DonorScene({ c }) {
  return (
    <>
      <Ground c={c} />
      {/* steam */}
      <g fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" opacity=".5">
        <path className="scene-steam" d="M42 46 c-4 -5 4 -8 0 -14" />
        <path className="scene-steam [animation-delay:-.8s]" d="M53 42 c-4 -5 4 -8 0 -14" />
        <path className="scene-steam [animation-delay:-1.6s]" d="M64 46 c-4 -5 4 -8 0 -14" />
      </g>
      {/* counter */}
      <rect x="18" y="84" width="126" height="28" rx="3" fill={PAPER} stroke={c} strokeOpacity=".45" />
      <rect x="14" y="80" width="134" height="6" rx="3" fill={c} opacity=".45" />
      <path d="M58 92 v12 M100 92 v12" stroke={c} strokeOpacity=".3" strokeLinecap="round" />
      {/* pot */}
      <rect x="21" y="61" width="9" height="4" rx="2" fill={c} />
      <rect x="74" y="61" width="9" height="4" rx="2" fill={c} />
      <rect x="30" y="56" width="44" height="24" rx="6" fill={PAPER} stroke={c} strokeWidth="1.6" />
      <path d="M30 66 H74" stroke={c} strokeOpacity=".35" strokeWidth="1.5" />
      <rect x="27" y="51" width="50" height="5" rx="2.5" fill={c} />
      <circle cx="52" cy="48.5" r="3" fill={c} />
      {/* tiffin stack */}
      <path d="M91 52 C 91 43, 109 43, 109 52" fill="none" stroke={c} strokeWidth="1.8" />
      {[52, 61, 70].map((y) => <rect key={y} x="88" y={y} width="24" height="9" rx="3" fill={soft(c, 26)} stroke={c} strokeWidth="1.2" />)}
      {/* bread */}
      <ellipse cx="129" cy="75" rx="11" ry="5.5" fill={c} opacity=".6" />
      <path d="M123 73 l3 3 M128 72 l3 3 M133 73 l3 3" stroke={PAPER} strokeOpacity=".8" strokeWidth="1.2" strokeLinecap="round" />
      {/* posted tag + safe-time ring */}
      <Pill x={92} y={18} w={60} stroke={c}><Tick cx={102} cy={27} /><text x="112" y="30.5" fontSize="9" fontWeight="700" fill={INK}>60 meals</text></Pill>
      <SafeRing x={176} y={30} label="90m" />
      {/* handover route to the rider */}
      <Route d="M148 97 C 168 97, 176 86, 200 90" c={c} />
      <Scooter c={c} />
    </>
  );
}

const Drop = ({ x, y, c }) => <path d={`M${x} ${y - 5} c3 4 4.5 6 4.5 8 a4.5 4.5 0 0 1 -9 0 c0 -2 1.5 -4 4.5 -8 Z`} fill={c} />;
const Flame = ({ x, y, c }) => <path d={`M${x} ${y + 5.5} a5 5 0 0 1 -5 -5 c0 -3 2.5 -4.5 3 -7.5 c1.5 1.5 2 2.5 2 3.5 c1 -1 2 -2 2 -3.5 c2 2 3 4 3 7.5 a5 5 0 0 1 -5 5 Z`} fill={c} />;
const Snow = ({ x, y, c }) => <path d={`M${x} ${y - 6} v12 M${x - 5.2} ${y - 3} l10.4 6 M${x - 5.2} ${y + 3} l10.4 -6`} stroke={c} strokeWidth="1.8" strokeLinecap="round" />;

// Shelter / needy: an open, checked-in site with people waiting and the facilities that decide what it can take.
function ShelterScene({ c }) {
  return (
    <>
      <Ground c={c} />
      {/* facility chips: clean water, cooking fuel, cold storage */}
      {[[26, Drop, 'var(--info)'], [50, Flame, 'var(--donor)'], [74, Snow, 'var(--info)']].map(([x, Glyph, col]) => (
        <g key={x}><circle cx={x} cy="24" r="10" fill={PAPER} stroke={c} strokeOpacity=".3" /><Glyph x={x} y={24} c={col} /></g>
      ))}
      {/* building */}
      <rect x="116" y="58" width="80" height="54" fill={PAPER} stroke={c} strokeWidth="1.6" />
      <path d="M106 61 L156 24 L206 61 Z" fill={c} />
      <path d="M156 34 L194 61 H118 Z" fill={PAPER} opacity=".12" />
      {[124, 172].map((x) => (
        <g key={x}>
          <rect x={x} y="67" width="16" height="14" rx="2" fill="var(--warn)" fillOpacity=".55" stroke={c} strokeWidth="1.2" />
          <path d={`M${x + 8} 67 v14 M${x} 74 h16`} stroke={PAPER} strokeOpacity=".8" strokeWidth="1.2" />
        </g>
      ))}
      <path d="M146 112 V94 a10 10 0 0 1 20 0 V112" fill={soft(c, 30)} stroke={c} strokeWidth="1.4" />
      <circle cx="161" cy="102" r="1.3" fill={c} />
      {/* checked in */}
      <Pill x={202} y={20} w={58} stroke="var(--ok)"><Tick cx={212} cy={29} /><text x="222" y="32.5" fontSize="9" fontWeight="700" fill={INK}>Open</text></Pill>
      {/* people waiting */}
      <path d="M248 50 c-2.6 -3.6 -8 -1.6 -6.4 2.6 c1 2.4 6.4 6 6.4 6 s5.4 -3.6 6.4 -6 c1.6 -4.2 -3.8 -6.2 -6.4 -2.6 Z" fill="var(--bad)" opacity=".8" />
      <Person x={226} h={36} fill={c} />
      <Person x={247} h={26} fill={soft(c, 55)} />
      <Person x={268} h={38} fill={INK} ho={0.6} />
      {/* a rider arriving */}
      <Route d="M76 100 C 100 100, 118 104, 144 104" c={c} />
      <Scooter c={c} transform="translate(20 112) scale(.72) translate(-204 -112)" />
    </>
  );
}

// Coordinator: one live map of the city, with riders, routes, a reroute and an alert.
function CoordinatorScene({ c }) {
  return (
    <>
      {/* map card */}
      <rect x="44" y="8" width="216" height="110" rx="10" fill={PAPER} stroke={c} strokeOpacity=".3" />
      <path d="M44 24 H260" stroke={c} strokeOpacity=".18" />
      {['var(--bad)', 'var(--warn)', 'var(--ok)'].map((col, i) => <circle key={col} cx={56 + i * 9} cy="16" r="2.6" fill={col} opacity=".7" />)}
      <rect x="222" y="11" width="30" height="10" rx="5" fill="var(--ok)" opacity=".15" />
      <circle cx="229" cy="16" r="2" fill="var(--ok)" className="scene-blink" />
      <text x="234" y="19" fontSize="6.5" fontWeight="800" fill="var(--ok)">LIVE</text>
      <clipPath id="scene-map-clip"><rect x="45" y="25" width="214" height="92" rx="9" /></clipPath>
      <g clipPath="url(#scene-map-clip)">
        {[70, 100, 130, 160, 190, 220, 250].map((x) => <path key={x} d={`M${x} 25 V118`} stroke={INK} strokeOpacity=".05" />)}
        {[45, 70, 95].map((y) => <path key={y} d={`M44 ${y} H260`} stroke={INK} strokeOpacity=".05" />)}
        <path d="M40 104 C 90 86, 120 116, 170 100 S 240 76, 270 86" fill="none" stroke="var(--info)" strokeOpacity=".14" strokeWidth="10" strokeLinecap="round" />
        <rect x="112" y="32" width="34" height="20" rx="4" fill="var(--ok)" opacity=".1" />
        {/* delivery route, rider leg, reroute */}
        <path d="M80 50 C 120 50, 140 76, 176 74 S 214 88, 222 94" fill="none" stroke="var(--primary)" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M176 74 C 196 62, 210 50, 230 46" fill="none" stroke="var(--rider)" strokeWidth="1.8" strokeDasharray="4 4" strokeLinecap="round" />
        <path d="M128 64 C 132 82, 140 92, 150 98" fill="none" stroke="var(--warn)" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
        {/* pins: donor, shelters, station */}
        <rect x="73" y="43" width="14" height="14" rx="3.5" fill="var(--donor)" stroke={PAPER} strokeWidth="2" />
        <circle cx="222" cy="94" r="7" fill="var(--shelter)" stroke={PAPER} strokeWidth="2" />
        <circle cx="230" cy="46" r="6" fill="none" stroke="var(--warn)" strokeWidth="2" strokeDasharray="3 2.5" />
        <rect x="145" y="93" width="11" height="11" transform="rotate(45 150.5 98.5)" fill="var(--station)" stroke={PAPER} strokeWidth="2" />
        {/* riders */}
        {[[128, 64], [176, 74]].map(([x, y], i) => (
          <g key={x}>
            <circle cx={x} cy={y} r="5" fill="var(--rider)" className={cn('scene-ping', i && '[animation-delay:-1.1s]')} />
            <circle cx={x} cy={y} r="4.5" fill="var(--rider)" stroke={PAPER} strokeWidth="2" />
          </g>
        ))}
      </g>
      {/* volunteer phone with the heartbeat button */}
      <g className="animate-float">
        <rect x="14" y="44" width="40" height="70" rx="8" fill={INK} opacity=".88" />
        <rect x="17.5" y="49" width="33" height="61" rx="5" fill={PAPER} />
        <circle cx="34" cy="64" r="7" fill="none" stroke="var(--ok)" strokeWidth="2.4" strokeDasharray="30 44" transform="rotate(-90 34 64)" />
        <path d="M23 78 h22 M23 84 h15" stroke={INK} strokeOpacity=".25" strokeWidth="2" strokeLinecap="round" />
        <rect x="21" y="92" width="26" height="12" rx="4" fill="var(--primary)" />
        <path d="M34 101 c-1.3 -1 -3.4 -2.4 -3.4 -4 a1.8 1.8 0 0 1 3.4 -.8 a1.8 1.8 0 0 1 3.4 .8 c0 1.6 -2.1 3 -3.4 4 Z" fill="#fff" />
      </g>
      {/* alert card */}
      <g className="animate-float-slow">
        <rect x="232" y="58" width="60" height="30" rx="7" fill={PAPER} stroke="var(--warn)" strokeOpacity=".5" />
        <path d="M244 65 l6 11 h-12 Z" fill="var(--warn)" />
        <path d="M244 69.5 v3" stroke={PAPER} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M256 68 h28 M256 75 h20" stroke={INK} strokeOpacity=".3" strokeWidth="2.2" strokeLinecap="round" />
      </g>
    </>
  );
}

// Public food station: a free stall stocked with donated food, a helpline, and someone walking up.
function StationScene({ c }) {
  return (
    <>
      <Ground c={c} />
      {/* sign */}
      <rect x="122" y="8" width="56" height="16" rx="4" fill={PAPER} stroke={c} strokeWidth="1.4" />
      <text x="150" y="19.5" textAnchor="middle" fontSize="8" fontWeight="800" letterSpacing=".06em" fill={c}>FREE FOOD</text>
      <path d="M134 24 v6 M166 24 v6" stroke={c} strokeWidth="1.4" />
      {/* stall */}
      <rect x="98" y="46" width="104" height="66" fill={PAPER} stroke={c} strokeWidth="1.6" />
      <rect x="92" y="30" width="116" height="16" fill={c} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => i % 2 === 1 && <rect key={i} x={92 + i * 14.5} y="30" width="14.5" height="16" fill={PAPER} opacity=".75" />)}
      <path d={`M92 46 ${Array.from({ length: 8 }, () => 'a7.25 5 0 0 0 14.5 0').join(' ')}`} fill={c} />
      {/* shelves */}
      <path d="M102 74 H198 M102 96 H198" stroke={c} strokeOpacity=".45" strokeWidth="1.6" />
      {[106, 117, 128].map((x) => <rect key={x} x={x} y="61" width="9" height="13" rx="1.5" fill={soft(c, 45)} stroke={c} strokeWidth="1" />)}
      <ellipse cx="152" cy="69" rx="10" ry="5" fill="var(--donor)" opacity=".65" />
      <ellipse cx="174" cy="69" rx="8" ry="5" fill="var(--donor)" opacity=".45" />
      {[108, 124].map((x) => <rect key={x} x={x} y="83" width="12" height="13" rx="2" fill="var(--ok)" opacity=".5" />)}
      <rect x="146" y="80" width="18" height="16" rx="2" fill={soft(c, 30)} stroke={c} strokeWidth="1" />
      <circle cx="182" cy="90" r="6" fill="var(--bad)" opacity=".55" />
      <rect x="98" y="100" width="104" height="12" fill={c} opacity=".18" />
      {/* helpline */}
      <g className="animate-float">
        <path d="M244 46 l-6 8 2 -10 Z" fill={PAPER} stroke={c} strokeOpacity=".35" />
        <circle cx="250" cy="32" r="15" fill={PAPER} stroke={c} strokeOpacity=".35" />
        <path d="M244.5 26 h3 l1.5 3.8 -2 1.2 a8 8 0 0 0 4.4 4.4 l1.2 -2 3.8 1.5 v3 a1.6 1.6 0 0 1 -1.6 1.6 a13 13 0 0 1 -11.9 -11.9 a1.6 1.6 0 0 1 1.6 -1.6 Z" fill={c} />
      </g>
      {/* people */}
      <Person x={232} h={38} fill={c} />
      <rect x="240" y="86" width="12" height="12" rx="2" fill={soft(c, 40)} stroke={c} />
      <Person x={64} h={36} fill={INK} ho={0.6} />
      <Person x={46} h={24} fill={soft(c, 55)} />
      <Route d="M76 104 C 84 104, 88 104, 96 104" c={c} />
    </>
  );
}

const SCENES = {
  donor: { Scene: DonorScene, color: 'var(--donor)' },
  shelter: { Scene: ShelterScene, color: 'var(--shelter)' },
  coordinator: { Scene: CoordinatorScene, color: 'var(--info)' },
  station: { Scene: StationScene, color: 'var(--station)' },
};

// Banner art for a role: a tinted contour field with that role's illustrated scene on top.
export function RoleScene({ role, className }) {
  const { Scene, color } = SCENES[role];
  return (
    <div aria-hidden="true" className={cn('grain relative h-32 overflow-hidden', className)}
      style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${color} 20%, transparent), color-mix(in oklab, ${color} 4%, transparent))` }}>
      <div className="pattern-topo absolute inset-0 opacity-[0.16]" style={{ color }} />
      <svg viewBox="0 0 300 128" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
        <Scene c={color} />
      </svg>
    </div>
  );
}

// Empty states: the icon at the centre of faint concentric rings over a dot field.
export function EmptyArt({ icon }) {
  return (
    <div aria-hidden="true" className="relative mb-2 grid size-28 place-items-center">
      <Pattern kind="dots" className="fade-radial text-foreground/[0.12]" />
      <span className="absolute size-24 rounded-full border border-dashed border-foreground/10" />
      <span className="absolute size-[72px] rounded-full border border-foreground/[0.07] bg-card/60" />
      <span className="relative grid size-12 place-items-center rounded-2xl bg-card text-primary shadow-sm ring-1 ring-border">
        <Icon name={icon} className="size-[22px]" strokeWidth={1.75} />
      </span>
    </div>
  );
}

// Login hero: a small "product preview" collage. Decorative; the numbers are illustrative.
export function HeroPreview() {
  const pin = (x, y, color, r = 7) => <g><circle cx={x} cy={y} r={r + 5} fill={color} opacity=".14" /><circle cx={x} cy={y} r={r} fill={color} stroke="var(--card)" strokeWidth="2.5" /></g>;
  return (
    <div aria-hidden="true" className="relative mx-auto aspect-[5/4] w-full max-w-[520px] select-none">
      <div className="absolute -inset-8 rounded-full bg-primary/10 blur-3xl" />
      {/* Base card: the live city */}
      <div className="grain absolute inset-x-6 top-6 bottom-10 overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-primary/10">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <span className="flex gap-1.5"><i className="size-2.5 rounded-full bg-bad/60" /><i className="size-2.5 rounded-full bg-warn/60" /><i className="size-2.5 rounded-full bg-ok/60" /></span>
          <span className="ml-2 text-[11px] font-semibold text-muted-foreground">Live Ops · tonight</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-ok/10 px-2 py-0.5 text-[10px] font-bold text-ok"><i className="size-1.5 animate-pulse-dot rounded-full bg-current" />LIVE</span>
        </div>
        <div className="relative h-full bg-map">
          <Pattern kind="grid" className="text-foreground/[0.05]" />
          <svg viewBox="0 0 400 260" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
            <path d="M-10 200 C 80 170, 120 230, 200 205 S 330 150, 420 175" fill="none" stroke="var(--info)" strokeOpacity=".14" strokeWidth="18" strokeLinecap="round" />
            <rect x="250" y="30" width="80" height="54" rx="10" fill="var(--ok)" opacity=".1" />
            <rect x="40" y="40" width="54" height="40" rx="10" fill="var(--ok)" opacity=".08" />
            <path d="M70 70 C 120 70, 150 120, 205 120" fill="none" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M205 120 C 260 120, 270 75, 310 62" fill="none" stroke="var(--rider)" strokeWidth="2.5" strokeDasharray="5 6" strokeLinecap="round" />
            <path d="M205 120 C 230 160, 280 170, 330 190" fill="none" stroke="var(--warn)" strokeWidth="2.5" strokeDasharray="7 5" strokeLinecap="round" />
            <rect x="60" y="60" width="20" height="20" rx="5" fill="var(--donor)" stroke="var(--card)" strokeWidth="2.5" />
            <rect x="300" y="52" width="20" height="20" rx="5" fill="var(--donor)" stroke="var(--card)" strokeWidth="2.5" />
            {pin(330, 190, 'var(--shelter)', 9)}
            <rect x="140" y="178" width="18" height="18" transform="rotate(45 149 187)" fill="var(--station)" stroke="var(--card)" strokeWidth="2.5" />
            {pin(205, 120, 'var(--rider)')}
          </svg>
        </div>
      </div>
      {/* Floating: spoilage countdown */}
      <div className="animate-float absolute top-[22%] -left-2 flex items-center gap-3 rounded-xl border bg-card/95 p-3 pr-4 shadow-xl backdrop-blur">
        <Ring left={42.3} total={90} size={48} />
        <div className="leading-tight"><b className="block text-[13px]">60 cooked meals</b><span className="text-[11px] text-muted-foreground">Banquet Hall · safe time left</span></div>
      </div>
      {/* Floating: reroute */}
      <div className="animate-float-slow absolute right-0 bottom-16 flex max-w-[230px] items-start gap-2.5 rounded-xl border bg-card/95 p-3 shadow-xl backdrop-blur">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warn/12 text-warn"><Zap className="size-4" /></span>
        <div className="leading-tight"><b className="block text-[12.5px]">Rerouted mid-trip</b><span className="font-prose text-[11.5px] text-muted-foreground">Shelter A filled up. Asha now heads to Relief Camp B.</span></div>
      </div>
      {/* Floating: delivered */}
      <div className="animate-float absolute bottom-0 left-10 flex items-center gap-2 rounded-full border bg-card/95 py-1.5 pr-3.5 pl-1.5 shadow-lg backdrop-blur">
        <span className="grid size-6 place-items-center rounded-full bg-ok text-white"><Check className="size-3.5" strokeWidth={3} /></span>
        <span className="text-[12px] font-semibold">180 meals delivered safe</span>
      </div>
    </div>
  );
}

const STEPS = [
  { icon: CookingPot, color: 'var(--donor)', title: 'Donor posts surplus', text: 'Pick the food type; safe time fills in. Takes under a minute.' },
  { icon: MapPinned, color: 'var(--info)', title: 'Riders are dispatched', text: 'Batches split by capacity, routed to sites that can safely take them.' },
  { icon: Users, color: 'var(--shelter)', title: 'People are fed', text: 'Handed over inside its safe time, or held back. Never unsafe.' },
];

// "How it works" strip for the landing page.
export function HowItWorks() {
  return (
    <ol className="relative grid gap-6 md:grid-cols-3 md:gap-4">
      <span aria-hidden="true" className="absolute top-6 right-[16%] left-[16%] hidden border-t-2 border-dashed border-border md:block" />
      {STEPS.map((s, i) => (
        <li key={s.title} className="relative flex gap-4 md:flex-col md:items-center md:text-center">
          <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-card shadow-md ring-1 ring-border" style={{ color: s.color }}>
            <s.icon className="size-[22px]" strokeWidth={1.75} />
            <b className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-foreground font-mono text-[10px] text-background">{i + 1}</b>
          </span>
          <span>
            <b className="block text-sm font-semibold">{s.title}</b>
            <span className="block max-w-64 font-prose text-[13.5px] text-muted-foreground">{s.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
