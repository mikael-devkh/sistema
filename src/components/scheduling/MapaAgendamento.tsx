import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '../../lib/utils';
import type { LojaGroup } from '../../types/scheduling';
import { getCityCoords } from '../../lib/brazilCityCoords';

// ── Fix Leaflet default icon paths broken by Vite ────────────────────────────
import L from 'leaflet';
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Recenter map helper ───────────────────────────────────────────────────────

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const prev = useRef('');
  useEffect(() => {
    if (points.length === 0) return;
    const key = points.map(p => p.join(',')).join('|');
    if (key === prev.current) return;
    prev.current = key;
    if (points.length === 1) {
      map.setView([points[0][0], points[0][1]], 10);
    } else {
      map.fitBounds(points.map(p => [p[0], p[1]] as [number, number]), { padding: [40, 40] });
    }
  }, [map, points]);
  return null;
}

// ── Marker colour ─────────────────────────────────────────────────────────────

function markerColor(g: LojaGroup): string {
  if (g.slaGroupStatus === 'critical' || g.isCritical) return '#ef4444';
  if (g.slaGroupStatus === 'warning') return '#f59e0b';
  return '#3b82f6';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  groups: LojaGroup[];
  onUfClick?: (uf: string | null) => void;
  selectedUf?: string | null;
}

export function MapaAgendamento({ groups, onUfClick, selectedUf }: Props) {
  // Resolve coords (instant – local lookup)
  const markers = useMemo(() => {
    return groups
      .map(g => {
        const c = getCityCoords(g.cidade, g.uf);
        return c ? { group: g, lat: c[1], lng: c[0] } : null;
      })
      .filter(Boolean) as Array<{ group: LojaGroup; lat: number; lng: number }>;
  }, [groups]);

  const points = useMemo<[number, number][]>(
    () => markers.map(m => [m.lat, m.lng]),
    [markers],
  );

  // State-level totals for ranking table
  const byUf = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of groups) {
      const uf = g.uf?.toUpperCase() || '';
      if (uf) m.set(uf, (m.get(uf) ?? 0) + g.qtd);
    }
    return m;
  }, [groups]);

  const maxCount = useMemo(() => Math.max(...byUf.values(), 1), [byUf]);
  const totalIssues   = useMemo(() => groups.reduce((s, g) => s + g.qtd, 0), [groups]);
  const criticalCount = useMemo(() => groups.filter(g => g.isCritical).length, [groups]);

  return (
    <div className="space-y-3">

      {/* KPIs */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
          <span className="text-2xl font-bold text-primary">{totalIssues}</span>
          <span className="text-xs text-muted-foreground">Chamados abertos</span>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
          <span className="text-2xl font-bold">{byUf.size}</span>
          <span className="text-xs text-muted-foreground">Estados afetados</span>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
          <span className="text-2xl font-bold text-red-600 dark:text-red-400">{criticalCount}</span>
          <span className="text-xs text-muted-foreground">Lojas críticas</span>
        </div>
        {selectedUf && (
          <button onClick={() => onUfClick?.(null)} className="ml-auto self-center text-xs text-primary underline">
            Limpar filtro ({selectedUf})
          </button>
        )}
      </div>

      {/* Leaflet map */}
      <div className="rounded-xl border border-border overflow-hidden" style={{ height: 500 }}>
        <MapContainer
          center={[-15.7801, -47.9292]}
          zoom={4}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds points={points} />

          {markers.map(({ group: g, lat, lng }) => {
            const color = markerColor(g);
            const r     = Math.max(8, Math.min(22, 6 + g.qtd * 2));
            return (
              <CircleMarker
                key={`${g.loja}-${g.issues[0]?.key ?? g.cidade}`}
                center={[lat, lng]}
                radius={r}
                pathOptions={{
                  color: '#fff',
                  weight: 2,
                  fillColor: color,
                  fillOpacity: 0.88,
                }}
                eventHandlers={{
                  click: () => onUfClick?.(selectedUf === g.uf ? null : g.uf),
                }}
              >
                <Tooltip direction="top" offset={[0, -r]} opacity={1}>
                  <div className="text-sm">
                    <p className="font-semibold">{g.loja}</p>
                    <p className="text-muted-foreground text-xs">{g.cidade} · {g.uf}</p>
                    <p className="font-bold" style={{ color }}>
                      {g.qtd} chamado{g.qtd !== 1 ? 's' : ''}{g.isCritical ? ' 🚨' : ''}
                    </p>
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Normal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Alerta SLA
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Crítico
        </span>
        <span className="ml-auto text-[11px]">Tamanho do círculo = nº de chamados · Clique para filtrar</span>
      </div>

      {/* State ranking */}
      {byUf.size > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ranking por estado</p>
          </div>
          <div className="divide-y divide-border max-h-48 overflow-auto">
            {[...byUf.entries()].sort(([, a], [, b]) => b - a).map(([uf, count]) => {
              const critical = groups.filter(g => g.uf === uf && g.isCritical).length;
              const cidades  = [...new Set(groups.filter(g => g.uf === uf).map(g => g.cidade))];
              return (
                <button
                  key={uf}
                  onClick={() => onUfClick?.(selectedUf === uf ? null : uf)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/60 transition-colors text-left',
                    selectedUf === uf && 'bg-primary/5',
                  )}
                >
                  <span className="font-mono font-bold w-8 text-primary">{uf}</span>
                  <span className="flex-1 min-w-0 text-muted-foreground text-xs truncate">
                    {cidades.slice(0, 3).join(', ')}{cidades.length > 3 ? ` +${cidades.length - 3}` : ''}
                  </span>
                  {critical > 0 && (
                    <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">🚨 {critical}</span>
                  )}
                  <span className={cn('shrink-0 font-bold tabular-nums',
                    count >= maxCount * 0.7 ? 'text-red-600 dark:text-red-400' :
                    count >= maxCount * 0.4 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
                  )}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
