// The engine and alert selectors name icons with short strings; this maps them to lucide components.
import {
  Bell, Bike, Camera, Check, ChartLine, Clock, Droplet, FileText, Flame, Gift, Heart, House, Leaf, List, LogOut,
  Map, MapPin, Menu, Moon, Phone, Plus, ShieldCheck, Snowflake, Store, Sun, TriangleAlert, Users, X, Zap,
} from 'lucide-react';

export const ICONS = {
  home: House, plus: Plus, list: List, chart: ChartLine, check: Check, map: Map, users: Users, store: Store,
  bike: Bike, log: FileText, bell: Bell, phone: Phone, sun: Sun, moon: Moon, logout: LogOut, alert: TriangleAlert,
  heart: Heart, leaf: Leaf, clock: Clock, shield: ShieldCheck, droplet: Droplet, flame: Flame, snow: Snowflake,
  gift: Gift, menu: Menu, zap: Zap, pin: MapPin, camera: Camera, x: X,
};

export function Icon({ name, ...props }) {
  const C = ICONS[name] ?? Check;
  return <C aria-hidden="true" {...props} />;
}
