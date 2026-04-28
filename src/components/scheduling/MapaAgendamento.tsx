import { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/lib/assets/MarkerCluster.css';
import 'react-leaflet-cluster/lib/assets/MarkerCluster.Default.css';
import { getCityCoords } from '../../lib/brazilCityCoords';
import type { LojaGroup } from '../../types/scheduling';
import {
  ExternalLink,
  Layers,
  ListFilter,
  MapPinned,
  Maximize2,
  Navigation,
  PanelRightClose,
  PanelRightOpen,
  Search,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

// Fix Leaflet default icon paths in Vite/webpack builds
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type SlaStatus = 'ok' | 'warning' | 'critical';

const SLA_COLORS: Record<SlaStatus, string> = {
  ok: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
};

const SLA_LABELS: Record<SlaStatus, string> = {
  ok: 'SLA OK',
  warning: 'Alerta SLA',
  critical: 'SLA Crítico',
};

const STATUS_FILTERS: { value: SlaStatus | 'all'; label: string; color?: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'critical', label: 'Crítico', color: 'bg-red-500' },
  { value: 'warning', label: 'Alerta', color: 'bg-amber-500' },
  { value: 'ok', label: 'OK', color: 'bg-green-500' },
];

const TILE_STYLES = {
  streets: {
    label: 'Ruas',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  light: {
    label: 'Claro',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors',
  },
} as const;

type TileStyle = keyof typeof TILE_STYLES;

function pinIcon(status: SlaStatus, count: number): L.DivIcon {
  const color = SLA_COLORS[status];
  const label = count > 99 ? '99+' : String(count);
  const fs = label.length > 2 ? 7 : 10;
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 46" width="36" height="46">
      <path d="M18 1C8.6 1 1 8.6 1 18c0 11.5 17 27 17 27S35 29.5 35 18C35 8.6 27.4 1 18 1z"
        fill="${color}" stroke="rgba(255,255,255,0.9)" stroke-width="2.5"/>
      <circle cx="18" cy="18" r="9.5" fill="white" fill-opacity="0.93"/>
      <text x="18" y="22" font-family="system-ui,Arial,sans-serif" font-size="${fs}"
        font-weight="700" fill="${color}" text-anchor="middle">${label}</text>
    </svg>`,
    className: '',
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -48],
  });
}

function searchPinIcon(): L.DivIcon {
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 30" width="24" height="30">
      <path d="M12 1C6.5 1 2 5.5 2 11c0 7.5 10 19 10 19S22 18.5 22 11C22 5.5 17.5 1 12 1z"
        fill="#6366f1" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="11" r="4" fill="white"/>
    </svg>`,
    className: '',
    iconSize: [24, 30],
    iconAnchor: [12, 30],
    popupAnchor: [0, -32],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any): L.DivIcon {
  const count = cluster.getChildCount() as number;
  const size = count >= 100 ? 48 : count >= 20 ? 42 : 36;
  const bg = count >= 20 ? '#ef4444' : count >= 10 ? '#f59e0b' : '#3b82f6';
  const fs = count >= 100 ? 11 : 13;
  return L.divIcon({
    html: `<div style="
      background:${bg};width:${size}px;height:${size}px;border-radius:50%;
      border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.35);
      display:flex;align-items:center;justify-content:center;
      color:white;font-size:${fs}px;font-weight:700;font-family:system-ui,sans-serif;
    ">${count}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface MappedLoja extends LojaGroup {
  lat: number;
  lng: number;
  geocodeSource: 'address' | 'cep' | 'city';
}

interface CachedCoord {
  lat: number;
  lng: number;
  source: 'address' | 'cep';
  savedAt: number;
}

const GEOCODE_CACHE_KEY = 'schedulingAddressCoords:v1';
const GEOCODE_CACHE_TTL = 1000 * 60 * 60 * 24 * 90;

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizedKey(value: unknown): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

function coordCacheKey(g: LojaGroup): string {
  return [
    g.loja,
    g.cep?.replace(/\D/g, ''),
    normalizedKey(g.endereco),
    normalizedKey(g.cidade),
    g.uf?.toUpperCase(),
  ].filter(Boolean).join('|');
}

function readCoordCache(): Record<string, CachedCoord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(GEOCODE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CachedCoord>;
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => (
        Number.isFinite(value.lat) &&
        Number.isFinite(value.lng) &&
        now - value.savedAt < GEOCODE_CACHE_TTL
      )),
    );
  } catch {
    return {};
  }
}

function writeCoordCache(cache: Record<string, CachedCoord>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Cache é otimização; se o navegador negar, o mapa continua funcionando.
  }
}

function isBrazilCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -35 && lat <= 6 &&
    lng >= -75 && lng <= -32;
}

function buildAddressQuery(g: LojaGroup): string {
  return [g.endereco, g.cidade, g.uf, g.cep, 'Brasil']
    .filter(Boolean)
    .join(', ');
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function geocodeByCep(cep: string): Promise<CachedCoord | null> {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  const data = await fetchJsonWithTimeout(`https://brasilapi.com.br/api/cep/v2/${clean}`);
  const coords = (data as { location?: { coordinates?: { latitude?: string; longitude?: string } } } | null)
    ?.location?.coordinates;
  const lat = Number(coords?.latitude);
  const lng = Number(coords?.longitude);
  if (!isBrazilCoord(lat, lng)) return null;
  return { lat, lng, source: 'cep', savedAt: Date.now() };
}

async function geocodeByAddress(g: LojaGroup): Promise<CachedCoord | null> {
  const query = encodeURIComponent(buildAddressQuery(g));
  const data = await fetchJsonWithTimeout(
    `https://nominatim.openstreetmap.org/search?q=${query}&countrycodes=br&format=json&limit=1`,
    10000,
  );
  const first = Array.isArray(data) ? data[0] : null;
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);
  if (!isBrazilCoord(lat, lng)) return null;
  return { lat, lng, source: 'address', savedAt: Date.now() };
}

function matchesQuery(g: MappedLoja, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const searchable = [
    g.loja,
    g.cidade,
    g.uf,
    g.cep,
    g.endereco,
    ...g.issues.flatMap(issue => [
      issue.key,
      issue.pdv,
      issue.ativo,
      issue.problema,
      issue.tecnico,
      issue.req,
      issue.status,
    ]),
  ].map(normalizeText).join(' ');
  return searchable.includes(q);
}

function mapsUrl(g: MappedLoja): string {
  const q = encodeURIComponent(`${g.endereco || `Loja ${g.loja}`} ${g.cidade} ${g.uf} ${g.cep}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

// Must live inside <MapContainer> — controls map view via useMap()
function MapEffects({
  target,
  fitTrigger,
  allMarkers,
}: {
  target: { lat: number; lng: number; zoom?: number } | null;
  fitTrigger: number;
  allMarkers: MappedLoja[];
}) {
  const map = useMap();
  const prevTarget = useRef<typeof target>(null);
  const prevFit = useRef(0);

  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const timer = window.setTimeout(invalidate, 120);
    const container = map.getContainer();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(invalidate)
      : null;
    observer?.observe(container);

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [map]);

  useEffect(() => {
    if (target && target !== prevTarget.current) {
      map.flyTo([target.lat, target.lng], target.zoom ?? 13, { duration: 1.2 });
      prevTarget.current = target;
    }
  }, [map, target]);

  useEffect(() => {
    if (fitTrigger > 0 && fitTrigger !== prevFit.current && allMarkers.length) {
      const bounds = L.latLngBounds(allMarkers.map(m => [m.lat, m.lng] as [number, number]));
      map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 10, duration: 1.5 });
      prevFit.current = fitTrigger;
    }
  }, [map, fitTrigger, allMarkers]);

  return null;
}

// Flies to a specific loja and opens its popup after the animation
function FocusEffect({
  focusLoja,
  onFocusConsumed,
  markerRefs,
}: {
  focusLoja: string | null;
  onFocusConsumed?: () => void;
  markerRefs: React.MutableRefObject<Map<string, L.Marker>>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusLoja) return;
    const marker = markerRefs.current.get(focusLoja);
    if (!marker) {
      toast.warning(`Loja ${focusLoja} não está plotada no mapa`);
      onFocusConsumed?.();
      return;
    }

    map.flyTo(marker.getLatLng(), 15, { duration: 1.2 });
    const timer = setTimeout(() => {
      marker.openPopup();
      onFocusConsumed?.();
    }, 1500);
    return () => clearTimeout(timer);
  // focusLoja é a única dep que importa aqui; as demais são estáveis
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLoja]);

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  groups: LojaGroup[];
  onUfClick?: (uf: string | null) => void;
  selectedUf?: string | null;
  focusLoja?: string | null;
  onFocusConsumed?: () => void;
}

export function MapaAgendamento({ groups, onUfClick, selectedUf, focusLoja, onFocusConsumed }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [mapTarget, setMapTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [searchMarker, setSearchMarker] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [slaFilter, setSlaFilter] = useState<SlaStatus | 'all'>('all');
  const [tileStyle, setTileStyle] = useState<TileStyle>('streets');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [coordCache, setCoordCache] = useState<Record<string, CachedCoord>>(() => readCoordCache());
  const [geocoding, setGeocoding] = useState(false);

  const markerRefs = useRef<Map<string, L.Marker>>(new Map());
  const coordCacheRef = useRef(coordCache);

  useEffect(() => {
    coordCacheRef.current = coordCache;
  }, [coordCache]);

  const uniqueGroups = useMemo(() => {
    const seen = new Map<string, LojaGroup>();
    for (const g of groups) {
      seen.set(coordCacheKey(g), g);
    }
    return [...seen.values()];
  }, [groups]);

  useEffect(() => {
    let cancelled = false;
    const missing = uniqueGroups.filter(g => !coordCacheRef.current[coordCacheKey(g)]);
    if (!missing.length) return;

    async function run() {
      setGeocoding(true);
      const nextCache = { ...readCoordCache(), ...coordCacheRef.current };
      let changed = false;
      let pendingFlush = 0;

      const flush = () => {
        coordCacheRef.current = { ...nextCache };
        setCoordCache(coordCacheRef.current);
        writeCoordCache(nextCache);
        pendingFlush = 0;
      };

      for (const g of missing) {
        if (cancelled) break;
        const key = coordCacheKey(g);
        if (nextCache[key]) continue;

        try {
          const byAddress = g.endereco?.trim() ? await geocodeByAddress(g) : null;
          const coord = byAddress ?? await geocodeByCep(g.cep);
          if (coord) {
            nextCache[key] = coord;
            changed = true;
            pendingFlush += 1;
            if (pendingFlush >= 8) flush();
          }
        } catch {
          // Falhas individuais de geocoding não devem travar o mapa.
        }
      }

      if (!cancelled) {
        if (changed) flush();
        setGeocoding(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [uniqueGroups]);

  // Plot every store immediately. Exact address/CEP coordinates replace the city fallback as they resolve.
  const mappedGroups = useMemo<MappedLoja[]>(() => {
    return groups.flatMap(g => {
      const coord = coordCache[coordCacheKey(g)];
      if (coord) return [{ ...g, lat: coord.lat, lng: coord.lng, geocodeSource: coord.source }];

      const city = getCityCoords(g.cidade, g.uf);
      if (!city) return [];
      return [{ ...g, lat: city[1], lng: city[0], geocodeSource: 'city' }];
    });
  }, [coordCache, groups]);

  const markersBeforeUf = useMemo(
    () => mappedGroups.filter(g => (
      (slaFilter === 'all' || g.slaGroupStatus === slaFilter) &&
      matchesQuery(g, searchQuery)
    )),
    [mappedGroups, searchQuery, slaFilter],
  );

  const visibleMarkers = useMemo(
    () => selectedUf ? markersBeforeUf.filter(m => m.uf.toUpperCase() === selectedUf) : markersBeforeUf,
    [markersBeforeUf, selectedUf],
  );

  const byUf = useMemo(() => {
    const m = new Map<string, { count: number; critical: number }>();
    for (const g of markersBeforeUf) {
      const uf = g.uf?.toUpperCase() ?? '';
      if (!uf) continue;
      const prev = m.get(uf) ?? { count: 0, critical: 0 };
      m.set(uf, { count: prev.count + g.qtd, critical: prev.critical + (g.isCritical ? 1 : 0) });
    }
    return m;
  }, [markersBeforeUf]);

  const maxCount      = useMemo(() => Math.max(...[...byUf.values()].map(v => v.count), 1), [byUf]);
  const totalIssues   = useMemo(() => groups.reduce((s, g) => s + g.qtd, 0), [groups]);
  const visibleIssues = useMemo(() => visibleMarkers.reduce((s, g) => s + g.qtd, 0), [visibleMarkers]);
  const criticalCount = useMemo(() => visibleMarkers.filter(g => g.isCritical).length, [visibleMarkers]);
  const unmappedCount = groups.length - mappedGroups.length;
  const addressCount = useMemo(() => mappedGroups.filter(g => g.geocodeSource === 'address').length, [mappedGroups]);
  const cepCount = useMemo(() => mappedGroups.filter(g => g.geocodeSource === 'cep').length, [mappedGroups]);
  const cityCount = mappedGroups.length - addressCount - cepCount;

  const rankedVisibleMarkers = useMemo(
    () => [...visibleMarkers].sort((a, b) => {
      const statusDiff =
        (b.slaGroupStatus === 'critical' ? 2 : b.slaGroupStatus === 'warning' ? 1 : 0) -
        (a.slaGroupStatus === 'critical' ? 2 : a.slaGroupStatus === 'warning' ? 1 : 0);
      if (statusDiff) return statusDiff;
      return b.qtd - a.qtd;
    }),
    [visibleMarkers],
  );

  const hasMapFilters = Boolean(searchQuery.trim()) || slaFilter !== 'all' || Boolean(selectedUf) || Boolean(searchMarker);

  const clearMapFilters = () => {
    setSearchQuery('');
    setSlaFilter('all');
    setSearchMarker(null);
    onUfClick?.(null);
  };

  // Busca por CEP ou nome de cidade via Nominatim (OpenStreetMap gratuito)
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    const cepClean = q.replace(/\D/g, '');
    const isCep = cepClean.length === 8;
    setSearching(true);
    try {
      const url = isCep
        ? `https://nominatim.openstreetmap.org/search?postalcode=${cepClean}&country=brazil&format=json&limit=1`
        : `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', Brasil')}&format=json&limit=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } });
      const data = await res.json();
      if (!data.length) { toast.error('Localização não encontrada'); return; }
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      setSearchMarker({ lat, lng, label: data[0].display_name });
      setMapTarget({ lat, lng, zoom: isCep ? 15 : 12 });
    } catch {
      toast.error('Erro ao buscar localização');
    } finally {
      setSearching(false);
    }
  };

  const handleUfClick = (uf: string) => {
    const lojas = markersBeforeUf.filter(m => m.uf.toUpperCase() === uf);
    if (lojas.length) {
      if (lojas.length === 1) {
        setMapTarget({ lat: lojas[0].lat, lng: lojas[0].lng, zoom: 11 });
      } else {
        const bounds = L.latLngBounds(lojas.map(m => [m.lat, m.lng] as [number, number]));
        const c = bounds.getCenter();
        setMapTarget({ lat: c.lat, lng: c.lng, zoom: 8 });
      }
    }
    onUfClick?.(selectedUf === uf ? null : uf);
  };

  const focusMarker = (loja: MappedLoja, zoom = 14) => {
    setMapTarget({ lat: loja.lat, lng: loja.lng, zoom });
    const marker = markerRefs.current.get(loja.loja);
    if (marker) {
      window.setTimeout(() => marker.openPopup(), 500);
    }
  };

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {([
          { label: 'Chamados visíveis', value: visibleIssues,         sub: `${totalIssues} no total`, color: 'text-primary' },
          { label: 'Estados visíveis',  value: byUf.size,             sub: selectedUf ? `Filtro ${selectedUf}` : 'com chamados', color: '' },
          { label: 'Lojas críticas',    value: criticalCount,         sub: 'na visão atual', color: 'text-red-500' },
          { label: 'Lojas plotadas',    value: visibleMarkers.length, sub: `${addressCount + cepCount} exatas · ${cityCount} por cidade`, color: 'text-green-600' },
        ] as const).map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
            <span className={cn('text-2xl font-bold', color)}>{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-[10px] text-muted-foreground/80">{sub}</span>
          </div>
        ))}
      </div>

      {(geocoding || cityCount > 0 || unmappedCount > 0) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <MapPinned className={cn('h-3.5 w-3.5', geocoding && 'animate-pulse')} />
          <span>
            {geocoding ? 'Mostrando todas as lojas e refinando endereços em segundo plano.' : 'Todas as lojas possíveis estão no mapa.'}
            {' '}
            <strong>{mappedGroups.length}</strong> lojas plotadas
            {cityCount > 0 && <> · <strong>{cityCount}</strong> ainda aproximada{cityCount !== 1 ? 's' : ''} pela cidade</>}
            {unmappedCount > 0 && <> · <strong>{unmappedCount}</strong> sem cidade/endereço reconhecido</>}.
          </span>
        </div>
      )}

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
        <div className="relative min-w-[240px] flex-1 lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Filtrar loja, FSA, cidade, UF, CEP…"
            className="pl-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
          <ListFilter className="mx-1 h-3.5 w-3.5 text-muted-foreground" />
          {STATUS_FILTERS.map(filter => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setSlaFilter(filter.value)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
                slaFilter === filter.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {filter.color && <span className={cn('h-2 w-2 rounded-full', filter.color)} />}
              {filter.label}
            </button>
          ))}
        </div>

        <Button size="sm" variant="outline" onClick={handleSearch} disabled={searching || !searchQuery.trim()} className="gap-1.5">
          {searching ? <span className="animate-spin inline-block">⟳</span> : <MapPinned className="w-3.5 h-3.5" />}
          Localizar
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setFitTrigger(t => t + 1)}
          disabled={visibleMarkers.length === 0}
          className="gap-1.5"
        >
          <Maximize2 className="w-3.5 h-3.5" /> Enquadrar
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setTileStyle(v => v === 'streets' ? 'light' : 'streets')}
          className="gap-1.5"
        >
          <Layers className="w-3.5 h-3.5" /> {TILE_STYLES[tileStyle].label}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSidebarOpen(v => !v)}
          className="ml-auto gap-1.5"
        >
          {sidebarOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
          Lista
        </Button>

        {hasMapFilters && (
          <Button size="sm" variant="ghost" onClick={clearMapFilters} className="gap-1.5 text-muted-foreground">
            <X className="w-3.5 h-3.5" /> Limpar
          </Button>
        )}
      </div>

      {/* Mapa + Sidebar */}
      <div
        className="flex min-h-[520px] flex-col gap-0 overflow-hidden rounded-xl border border-border shadow-sm lg:min-h-[580px] lg:flex-row"
        style={{ height: 'clamp(520px, calc(100vh - 300px), 720px)' }}
      >
        {/* Leaflet Map */}
        <div className="relative min-h-[380px] flex-1" style={{ minWidth: 0 }}>
          <MapContainer
            center={[-14.235, -51.925]}
            zoom={4}
            style={{ height: '100%', width: '100%' }}
            zoomControl
          >
            <TileLayer
              attribution={TILE_STYLES[tileStyle].attribution}
              url={TILE_STYLES[tileStyle].url}
              maxZoom={19}
            />

            <MapEffects
              target={mapTarget}
              fitTrigger={fitTrigger}
              allMarkers={visibleMarkers}
            />

            <FocusEffect
              focusLoja={focusLoja ?? null}
              onFocusConsumed={onFocusConsumed}
              markerRefs={markerRefs}
            />

            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={createClusterIcon}
              showCoverageOnHover={false}
              spiderfyOnMaxZoom
            >
              {visibleMarkers.map(m => (
                <Marker
                  key={m.loja}
                  position={[m.lat, m.lng]}
                  icon={pinIcon(m.slaGroupStatus, m.qtd)}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ref={(marker: any) => {
                    if (marker) markerRefs.current.set(m.loja, marker as L.Marker);
                    else markerRefs.current.delete(m.loja);
                  }}
                >
                  <Popup maxWidth={310} minWidth={260}>
                    <div style={{ fontFamily: 'system-ui,Arial,sans-serif', fontSize: 13, lineHeight: 1.5 }}>
                      {/* Cabeçalho */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <strong style={{ fontSize: 15, flex: 1 }}>{m.loja}</strong>
                        <span style={{
                          background: SLA_COLORS[m.slaGroupStatus],
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}>
                          {m.qtd} chamado{m.qtd !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Localização */}
                      <p style={{ color: '#6b7280', fontSize: 12, margin: '0 0 2px' }}>
                        📍 {m.cidade} – {m.uf}
                        {m.cep ? ` · CEP ${m.cep}` : ''}
                      </p>
                      {m.endereco && (
                        <p style={{ color: '#9ca3af', fontSize: 11, margin: '0 0 6px' }}>{m.endereco}</p>
                      )}
                      {m.isCritical && (
                        <p style={{ color: '#ef4444', fontSize: 11, fontWeight: 700, margin: '0 0 6px' }}>
                          ⚠️ Loja crítica
                        </p>
                      )}

                      {/* Lista de issues */}
                      {m.issues.length > 0 && (
                        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 6, maxHeight: 160, overflowY: 'auto' }}>
                          {m.issues.slice(0, 8).map(issue => (
                            <div key={issue.key} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '3px 0',
                              borderBottom: '1px solid #f9fafb',
                              gap: 6,
                              fontSize: 11,
                            }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', minWidth: 72 }}>
                                {issue.key}
                              </span>
                              <span style={{ color: '#6b7280', flex: 1, textAlign: 'center', fontSize: 10 }}>
                                {issue.dataAgenda ? `📅 ${issue.dataAgenda}` : issue.status}
                              </span>
                              <span style={{ fontSize: 12 }}>{issue.slaBadge}</span>
                            </div>
                          ))}
                          {m.issues.length > 8 && (
                            <p style={{ color: '#9ca3af', fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                              +{m.issues.length - 8} mais
                            </p>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <a
                          href={mapsUrl(m)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            color: '#2563eb',
                            fontSize: 11,
                            fontWeight: 700,
                            textDecoration: 'none',
                          }}
                        >
                          <ExternalLink style={{ width: 12, height: 12 }} />
                          Abrir no Google Maps
                        </a>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>

            {/* Marcador de resultado de busca */}
            {searchMarker && (
              <Marker position={[searchMarker.lat, searchMarker.lng]} icon={searchPinIcon()}>
                <Popup maxWidth={260}>
                  <p style={{ fontSize: 12 }}>{searchMarker.label}</p>
                </Popup>
              </Marker>
            )}
          </MapContainer>
          {visibleMarkers.length === 0 && !searchMarker && (
            <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center bg-background/55 backdrop-blur-[1px]">
              <div className="pointer-events-auto rounded-lg border border-border bg-card px-4 py-3 text-center shadow-lg">
                <p className="text-sm font-semibold">Nenhuma loja para os filtros atuais</p>
                <button
                  type="button"
                  onClick={clearMapFilters}
                  className="mt-1 text-xs font-medium text-primary underline underline-offset-2"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar de ranking por estado */}
        {sidebarOpen && (
        <div
          className="flex shrink-0 flex-col border-t border-border bg-card lg:w-[320px] lg:border-l lg:border-t-0"
          style={{ minHeight: 0 }}
        >
          <div style={{
            padding: '10px 12px',
            background: 'hsl(var(--muted) / 0.5)',
            borderBottom: '1px solid hsl(var(--border))',
          }}>
            <div className="flex items-center justify-between gap-2">
              <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Estados
              </p>
              {selectedUf && (
                <button
                  type="button"
                  onClick={() => onUfClick?.(null)}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  remover {selectedUf}
                </button>
              )}
            </div>
          </div>
          <div className="max-h-36 overflow-y-auto border-b border-border">
            {[...byUf.entries()]
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([uf, data]) => {
                const ratio = data.count / maxCount;
                const barColor = data.critical > 0 ? '#ef4444' : ratio >= 0.65 ? '#f59e0b' : '#3b82f6';
                const isSel = selectedUf === uf;
                return (
                  <button
                    key={uf}
                    onClick={() => handleUfClick(uf)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderBottom: '1px solid hsl(var(--border))',
                      background: isSel ? 'hsl(var(--primary) / 0.06)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      border: 'none',
                      borderBottomWidth: 1,
                      borderBottomStyle: 'solid',
                      borderBottomColor: 'hsl(var(--border))',
                      outline: 'none',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, width: 26, color: '#3b82f6', fontSize: 12, flexShrink: 0 }}>
                      {uf}
                    </span>
                    <div style={{ flex: 1, height: 4, background: 'hsl(var(--border))', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${ratio * 100}%`, background: barColor, borderRadius: 2 }} />
                    </div>
                    {data.critical > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>
                        🚨{data.critical}
                      </span>
                    )}
                    <span style={{ fontSize: 12, fontWeight: 700, color: barColor, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                      {data.count}
                    </span>
                  </button>
                );
              })}
          </div>

          <div className="flex items-center justify-between border-b border-border bg-muted/25 px-3 py-2">
            <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Lojas visíveis
            </p>
            <span className="text-[11px] font-semibold tabular-nums text-foreground">
              {visibleMarkers.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {rankedVisibleMarkers.slice(0, 80).map(loja => {
              const color = SLA_COLORS[loja.slaGroupStatus];
              return (
                <button
                  key={loja.loja}
                  type="button"
                  onClick={() => focusMarker(loja)}
                  className="flex w-full items-start gap-2 border-b border-border px-3 py-2 text-left transition-colors hover:bg-secondary/60"
                >
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-foreground">Loja {loja.loja}</span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                        {loja.qtd}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {loja.cidade} - {loja.uf}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {loja.issues.slice(0, 3).map(issue => (
                        <span key={issue.key} className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[9px] text-primary">
                          {issue.key}
                        </span>
                      ))}
                      {loja.issues.length > 3 && (
                        <span className="px-1 py-0.5 text-[9px] text-muted-foreground">+{loja.issues.length - 3}</span>
                      )}
                    </span>
                  </span>
                  <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
            {rankedVisibleMarkers.length > 80 && (
              <div className="px-3 py-2 text-center text-[11px] text-muted-foreground">
                Mostrando 80 de {rankedVisibleMarkers.length} lojas. Use a busca para refinar.
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground">
        {(Object.entries(SLA_COLORS) as [SlaStatus, string][]).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
            {SLA_LABELS[status]}
          </span>
        ))}
        {cityCount > 0 && (
          <span className="text-amber-600">
            ⚠️ {cityCount} loja{cityCount !== 1 ? 's' : ''} por cidade até resolver endereço
          </span>
        )}
        {unmappedCount > 0 && (
          <span className="text-red-500">
            {unmappedCount} loja{unmappedCount !== 1 ? 's' : ''} sem coordenada
          </span>
        )}
        <span className="w-full text-[11px] sm:ml-auto sm:w-auto">
          Clique no estado → zoom · Clique no pin → detalhes · Scroll → zoom
        </span>
      </div>
    </div>
  );
}
