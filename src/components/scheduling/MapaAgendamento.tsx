import { useMemo, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import { cn } from '../../lib/utils';
import type { LojaGroup } from '../../types/scheduling';
import { getCityCoords } from '../../lib/brazilCityCoords';

const BR_TOPO =
  'https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson';

type Coords = [number, number]; // [lng, lat]

// ── Colour helpers ────────────────────────────────────────────────────────────

function stateColor(count: number, max: number): string {
  if (count === 0) return 'hsl(var(--muted))';
  const t = Math.min(count / Math.max(max, 1), 1);
  if (t < 0.33) return `hsl(45 85% ${68 - t * 28}%)`;
  if (t < 0.66) return `hsl(28 88% ${62 - t * 20}%)`;
  return `hsl(0 75% ${58 - t * 18}%)`;
}

function markerFill(group: LojaGroup): string {
  if (group.slaGroupStatus === 'critical' || group.isCritical) return '#ef4444';
  if (group.slaGroupStatus === 'warning') return '#f59e0b';
  return '#3b82f6';
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  groups: LojaGroup[];
  onUfClick?: (uf: string | null) => void;
  selectedUf?: string | null;
}

interface PinTooltip {
  loja: string;
  cidade: string;
  uf: string;
  qtd: number;
  isCritical: boolean;
}

export function MapaAgendamento({ groups, onUfClick, selectedUf }: Props) {
  const [pinTooltip, setPinTooltip]     = useState<PinTooltip | null>(null);
  const [stateTooltip, setStateTooltip] = useState<{ name: string; uf: string; count: number } | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // State-level counts
  const byUf = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of groups) {
      const uf = g.uf?.toUpperCase() || '';
      if (uf) m.set(uf, (m.get(uf) ?? 0) + g.qtd);
    }
    return m;
  }, [groups]);

  const maxUfCount = useMemo(
    () => Math.max(...Array.from(byUf.values()), 1),
    [byUf],
  );

  // Resolve coords for every group (instant — local lookup table)
  const groupsWithCoords = useMemo<Array<{ group: LojaGroup; coords: Coords }>>(() => {
    const seen = new Map<string, Coords>();
    const result: Array<{ group: LojaGroup; coords: Coords }> = [];
    for (const g of groups) {
      if (!g.cidade || !g.uf) continue;
      const key = `${g.cidade}|${g.uf}`;
      if (!seen.has(key)) {
        const c = getCityCoords(g.cidade, g.uf);
        if (c) seen.set(key, c);
      }
      const c = seen.get(key);
      if (c) result.push({ group: g, coords: c });
    }
    return result;
  }, [groups]);

  // Summary
  const totalIssues   = useMemo(() => groups.reduce((s, g) => s + g.qtd, 0), [groups]);
  const criticalCount = useMemo(() => groups.filter(g => g.isCritical).length, [groups]);

  const handleMouseMove = (e: React.MouseEvent) =>
    setPos({ x: e.clientX + 14, y: e.clientY - 10 });

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
          <span className="text-2xl font-bold text-primary">{totalIssues}</span>
          <span className="text-xs text-muted-foreground">Chamados abertos</span>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
          <span className="text-2xl font-bold text-foreground">{byUf.size}</span>
          <span className="text-xs text-muted-foreground">Estados afetados</span>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
          <span className="text-2xl font-bold text-red-600 dark:text-red-400">{criticalCount}</span>
          <span className="text-xs text-muted-foreground">Lojas críticas</span>
        </div>
        {selectedUf && (
          <button
            onClick={() => onUfClick?.(null)}
            className="ml-auto text-xs text-primary underline"
          >
            Limpar filtro ({selectedUf})
          </button>
        )}
      </div>

      {/* Map */}
      <div
        className="relative rounded-xl border border-border bg-card overflow-hidden"
        style={{ height: 520 }}
        onMouseMove={handleMouseMove}
      >
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 700, center: [-54, -15] }}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={12}>

            {/* ── State choropleth ── */}
            <Geographies geography={BR_TOPO}>
              {({ geographies }: { geographies: any[] }) =>
                geographies.map((geo: any) => {
                  const sigla = (geo.properties.sigla as string)?.toUpperCase() || '';
                  const count = byUf.get(sigla) ?? 0;
                  const isSelected = selectedUf === sigla;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={isSelected
                        ? 'hsl(var(--primary) / 0.4)'
                        : stateColor(count, maxUfCount)}
                      stroke="hsl(var(--background))"
                      strokeWidth={0.6}
                      style={{
                        default: { outline: 'none', cursor: count > 0 ? 'pointer' : 'default', transition: 'fill 0.2s' },
                        hover:   { outline: 'none', filter: 'brightness(1.12)' },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={() =>
                        setStateTooltip({ name: geo.properties.name as string, uf: sigla, count })
                      }
                      onMouseLeave={() => setStateTooltip(null)}
                      onClick={() => count > 0 && onUfClick?.(isSelected ? null : sigla)}
                    />
                  );
                })
              }
            </Geographies>

            {/* ── City pins ── */}
            {groupsWithCoords.map(({ group: g, coords }) => {
              const fill  = markerFill(g);
              const r     = Math.max(5, Math.min(14, 4 + g.qtd * 1.8));
              return (
                <Marker
                  key={`${g.loja}-${g.issues[0]?.key ?? g.cidade}`}
                  coordinates={coords}
                >
                  <circle
                    r={r}
                    fill={fill}
                    fillOpacity={0.88}
                    stroke="#fff"
                    strokeWidth={1.5}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() =>
                      setPinTooltip({
                        loja: g.loja,
                        cidade: g.cidade,
                        uf: g.uf,
                        qtd: g.qtd,
                        isCritical: g.isCritical,
                      })
                    }
                    onMouseLeave={() => setPinTooltip(null)}
                    onClick={() => onUfClick?.(selectedUf === g.uf ? null : g.uf)}
                  />
                  {g.qtd > 1 && (
                    <text
                      textAnchor="middle"
                      dy="0.35em"
                      fontSize={r < 9 ? 7 : 9}
                      fill="#fff"
                      fontWeight="700"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {g.qtd}
                    </text>
                  )}
                </Marker>
              );
            })}

          </ZoomableGroup>
        </ComposableMap>

        {/* Pin tooltip */}
        {pinTooltip && (
          <div
            className="fixed z-50 pointer-events-none rounded-lg border border-border bg-popover shadow-lg px-3 py-2 text-sm min-w-[160px]"
            style={{ left: pos.x, top: pos.y }}
          >
            <p className="font-semibold text-foreground">{pinTooltip.loja}</p>
            <p className="text-xs text-muted-foreground">
              {pinTooltip.cidade} · {pinTooltip.uf}
            </p>
            <p className={cn(
              'font-bold text-sm mt-0.5',
              pinTooltip.isCritical ? 'text-red-600 dark:text-red-400' : 'text-primary',
            )}>
              {pinTooltip.qtd} chamado{pinTooltip.qtd !== 1 ? 's' : ''}
              {pinTooltip.isCritical ? ' 🚨' : ''}
            </p>
          </div>
        )}

        {/* State tooltip (only when no pin tooltip) */}
        {stateTooltip && !pinTooltip && (
          <div
            className="fixed z-50 pointer-events-none rounded-lg border border-border bg-popover shadow-lg px-3 py-2 text-sm"
            style={{ left: pos.x, top: pos.y }}
          >
            <p className="font-semibold">{stateTooltip.name} ({stateTooltip.uf})</p>
            {stateTooltip.count > 0
              ? <p className="text-primary font-bold">{stateTooltip.count} chamado{stateTooltip.count !== 1 ? 's' : ''}</p>
              : <p className="text-muted-foreground text-xs">Sem chamados</p>
            }
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2 text-[11px] space-y-1.5 select-none">
          <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Pins</p>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0 bg-blue-500" />
            <span className="text-muted-foreground">Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0 bg-amber-500" />
            <span className="text-muted-foreground">Alerta SLA</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0 bg-red-500" />
            <span className="text-muted-foreground">Crítico</span>
          </div>
          <p className="text-muted-foreground/60 mt-1 text-[10px]">Scroll=zoom · Drag=mover</p>
        </div>
      </div>

      {/* State ranking */}
      {byUf.size > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ranking por estado
            </p>
          </div>
          <div className="divide-y divide-border max-h-56 overflow-auto">
            {[...byUf.entries()]
              .sort(([, a], [, b]) => b - a)
              .map(([uf, count]) => {
                const critical = groups.filter(g => g.uf === uf && g.isCritical).length;
                const cidades = [...new Set(groups.filter(g => g.uf === uf).map(g => g.cidade))];
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
                      {cidades.slice(0, 3).join(', ')}
                      {cidades.length > 3 ? ` +${cidades.length - 3}` : ''}
                    </span>
                    {critical > 0 && (
                      <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 shrink-0">
                        🚨 {critical}
                      </span>
                    )}
                    <span className={cn(
                      'shrink-0 font-bold tabular-nums',
                      count >= maxUfCount * 0.7 ? 'text-red-600 dark:text-red-400' :
                      count >= maxUfCount * 0.4 ? 'text-amber-600 dark:text-amber-400' :
                      'text-foreground',
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
