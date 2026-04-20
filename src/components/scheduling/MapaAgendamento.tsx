import { useState, useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/lib/assets/MarkerCluster.css';
import 'react-leaflet-cluster/lib/assets/MarkerCluster.Default.css';
import { getCityCoords } from '../../lib/brazilCityCoords';
import type { LojaGroup } from '../../types/scheduling';
import { Search, Maximize2 } from 'lucide-react';
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
    if (!marker) return;

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

  const markerRefs = useRef<Map<string, L.Marker>>(new Map());

  // Geocode every LojaGroup using city+UF lookup
  const mappedGroups = useMemo<MappedLoja[]>(() => {
    const seen = new Map<string, number>();
    return groups.flatMap(g => {
      const coords = getCityCoords(g.cidade, g.uf);
      if (!coords) return [];
      // brazilCityCoords returns [lng, lat]; Leaflet wants [lat, lng]
      const key = `${g.cidade}|${g.uf}`;
      const idx = seen.get(key) ?? 0;
      seen.set(key, idx + 1);
      // Tiny jitter so overlapping pins in same city are clickable
      const jit = idx * 0.0025;
      return [{ ...g, lat: coords[1] + jit, lng: coords[0] + jit }];
    });
  }, [groups]);

  const byUf = useMemo(() => {
    const m = new Map<string, { count: number; critical: number }>();
    for (const g of groups) {
      const uf = g.uf?.toUpperCase() ?? '';
      if (!uf) continue;
      const prev = m.get(uf) ?? { count: 0, critical: 0 };
      m.set(uf, { count: prev.count + g.qtd, critical: prev.critical + (g.isCritical ? 1 : 0) });
    }
    return m;
  }, [groups]);

  const maxCount      = useMemo(() => Math.max(...[...byUf.values()].map(v => v.count), 1), [byUf]);
  const totalIssues   = useMemo(() => groups.reduce((s, g) => s + g.qtd, 0), [groups]);
  const criticalCount = useMemo(() => groups.filter(g => g.isCritical).length, [groups]);
  const unmappedCount = groups.length - mappedGroups.length;

  const visibleMarkers = useMemo(
    () => selectedUf ? mappedGroups.filter(m => m.uf.toUpperCase() === selectedUf) : mappedGroups,
    [mappedGroups, selectedUf],
  );

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
    const lojas = mappedGroups.filter(m => m.uf.toUpperCase() === uf);
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

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="flex flex-wrap gap-3">
        {([
          { label: 'Chamados abertos',  value: totalIssues,         color: 'text-primary'    },
          { label: 'Estados afetados',  value: byUf.size,           color: ''                },
          { label: 'Lojas críticas',    value: criticalCount,       color: 'text-red-500'    },
          { label: 'Plotadas no mapa',  value: mappedGroups.length, color: 'text-green-600'  },
        ] as const).map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
            <span className={cn('text-2xl font-bold', color)}>{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
        {selectedUf && (
          <button
            onClick={() => onUfClick?.(null)}
            className="ml-auto self-center text-xs text-primary underline underline-offset-2"
          >
            Limpar filtro ({selectedUf})
          </button>
        )}
      </div>

      {/* Barra de busca */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar CEP (01310-100) ou cidade…"
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
          {searching ? <span className="animate-spin inline-block">⟳</span> : <><Search className="w-3.5 h-3.5 mr-1" />Buscar</>}
        </Button>
        {searchMarker && (
          <Button size="sm" variant="outline" onClick={() => setSearchMarker(null)}>
            ✕ Limpar
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setFitTrigger(t => t + 1)}
          className="ml-auto gap-1.5"
        >
          <Maximize2 className="w-3.5 h-3.5" /> Ver todos
        </Button>
      </div>

      {/* Mapa + Sidebar */}
      <div className="flex gap-0 rounded-xl overflow-hidden border border-border shadow-sm" style={{ height: 580 }}>
        {/* Leaflet Map */}
        <div className="flex-1" style={{ minWidth: 0 }}>
          <MapContainer
            center={[-14.235, -51.925]}
            zoom={4}
            style={{ height: '100%', width: '100%' }}
            zoomControl
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />

            <MapEffects
              target={mapTarget}
              fitTrigger={fitTrigger}
              allMarkers={mappedGroups}
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
        </div>

        {/* Sidebar de ranking por estado */}
        <div style={{
          width: 200,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          background: 'hsl(var(--card))',
          borderLeft: '1px solid hsl(var(--border))',
        }}>
          <div style={{
            padding: '8px 12px',
            background: 'hsl(var(--muted) / 0.5)',
            borderBottom: '1px solid hsl(var(--border))',
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
              Por estado
            </p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
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
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1">
        {(Object.entries(SLA_COLORS) as [SlaStatus, string][]).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
            {SLA_LABELS[status]}
          </span>
        ))}
        {unmappedCount > 0 && (
          <span className="text-amber-600">
            ⚠️ {unmappedCount} loja{unmappedCount !== 1 ? 's' : ''} sem coordenadas no cadastro
          </span>
        )}
        <span className="ml-auto text-[11px]">
          Clique no estado → zoom · Clique no pin → detalhes · Scroll → zoom
        </span>
      </div>
    </div>
  );
}
