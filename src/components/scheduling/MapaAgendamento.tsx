import { useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { cn } from '../../lib/utils';
import type { LojaGroup } from '../../types/scheduling';

// GeoJSON público dos estados brasileiros (naturalearth via cdn)
const BR_TOPO = 'https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson';

// Mapeamento UF sigla → nome do estado no GeoJSON (campo "sigla")
interface StateFeature {
  properties: {
    sigla: string;
    name: string;
    [key: string]: unknown;
  };
}

interface Props {
  groups: LojaGroup[];
  onUfClick?: (uf: string | null) => void;
  selectedUf?: string | null;
}

function getColor(count: number, maxCount: number): string {
  if (count === 0) return 'hsl(var(--muted))';
  const intensity = Math.min(count / Math.max(maxCount, 1), 1);
  // interpolate: low=amber, high=red
  if (intensity < 0.33) return `hsl(45 90% ${70 - intensity * 30}%)`;
  if (intensity < 0.66) return `hsl(30 90% ${65 - intensity * 25}%)`;
  return `hsl(0 80% ${60 - intensity * 20}%)`;
}

export function MapaAgendamento({ groups, onUfClick, selectedUf }: Props) {
  const [tooltip, setTooltip] = useState<{ uf: string; name: string; count: number; cidades: string[] } | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Agrupar por UF
  const byUf = useMemo(() => {
    const map = new Map<string, { count: number; cidades: Set<string>; critical: number }>();
    for (const g of groups) {
      const uf = g.uf?.toUpperCase() || '';
      if (!uf) continue;
      const cur = map.get(uf) ?? { count: 0, cidades: new Set(), critical: 0 };
      cur.count += g.qtd;
      cur.cidades.add(g.cidade);
      if (g.isCritical) cur.critical++;
      map.set(uf, cur);
    }
    return map;
  }, [groups]);

  const maxCount = useMemo(
    () => Math.max(...Array.from(byUf.values()).map(v => v.count), 1),
    [byUf],
  );

  // Summary stats
  const totalIssues  = useMemo(() => Array.from(byUf.values()).reduce((s, v) => s + v.count, 0), [byUf]);
  const totalUfs     = byUf.size;
  const criticalUfs  = useMemo(() => Array.from(byUf.entries()).filter(([, v]) => v.critical > 0).length, [byUf]);

  const handleMouseMove = (e: React.MouseEvent) => {
    setPos({ x: e.clientX + 14, y: e.clientY - 10 });
  };

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Chamados abertos', value: totalIssues, color: 'text-primary' },
          { label: 'Estados afetados', value: totalUfs, color: 'text-foreground' },
          { label: 'Estados críticos',  value: criticalUfs, color: 'text-red-600 dark:text-red-400' },
        ].map(k => (
          <div key={k.label} className="rounded-lg border border-border bg-card px-4 py-2 flex flex-col">
            <span className={cn('text-2xl font-bold', k.color)}>{k.value}</span>
            <span className="text-xs text-muted-foreground">{k.label}</span>
          </div>
        ))}
        {selectedUf && (
          <button
            onClick={() => onUfClick?.(null)}
            className="ml-auto self-center text-xs text-primary underline"
          >
            Limpar filtro ({selectedUf})
          </button>
        )}
      </div>

      {/* Mapa */}
      <div
        className="relative rounded-xl border border-border bg-card overflow-hidden"
        style={{ height: 480 }}
        onMouseMove={handleMouseMove}
      >
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 700, center: [-54, -15] }}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={8}>
            <Geographies geography={BR_TOPO}>
              {({ geographies }) =>
                geographies.map((geo: StateFeature & { rsmKey: string }) => {
                  const sigla = geo.properties.sigla?.toUpperCase() || '';
                  const data  = byUf.get(sigla);
                  const count = data?.count ?? 0;
                  const isSelected = selectedUf === sigla;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={isSelected ? 'hsl(var(--primary))' : getColor(count, maxCount)}
                      stroke="hsl(var(--background))"
                      strokeWidth={0.5}
                      style={{
                        default:  { outline: 'none', cursor: count > 0 ? 'pointer' : 'default', transition: 'fill 0.2s' },
                        hover:    { outline: 'none', filter: 'brightness(1.15)', cursor: count > 0 ? 'pointer' : 'default' },
                        pressed:  { outline: 'none' },
                      }}
                      onMouseEnter={() => {
                        if (count > 0 || true) {
                          setTooltip({
                            uf: sigla,
                            name: geo.properties.name as string,
                            count,
                            cidades: data ? [...data.cidades].slice(0, 5) : [],
                          });
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => {
                        if (count > 0) onUfClick?.(isSelected ? null : sigla);
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none rounded-lg border border-border bg-popover shadow-lg px-3 py-2 text-sm min-w-[160px]"
            style={{ left: pos.x, top: pos.y }}
          >
            <p className="font-semibold text-foreground">{tooltip.name} ({tooltip.uf})</p>
            {tooltip.count > 0 ? (
              <>
                <p className="text-primary font-bold">{tooltip.count} chamado{tooltip.count !== 1 ? 's' : ''}</p>
                {tooltip.cidades.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tooltip.cidades.join(', ')}
                    {(byUf.get(tooltip.uf)?.cidades.size ?? 0) > 5 ? ` +${(byUf.get(tooltip.uf)?.cidades.size ?? 0) - 5}` : ''}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-xs">Sem chamados</p>
            )}
          </div>
        )}

        {/* Legenda */}
        <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2 text-[11px] space-y-1">
          <p className="font-semibold text-muted-foreground uppercase tracking-wide">Chamados</p>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: 'hsl(var(--muted))' }} />
            <span className="text-muted-foreground">Nenhum</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: 'hsl(45 90% 60%)' }} />
            <span className="text-muted-foreground">Poucos</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: 'hsl(0 80% 45%)' }} />
            <span className="text-muted-foreground">Muitos</span>
          </div>
          <p className="text-muted-foreground/60 mt-1">Scroll para zoom · Drag para mover</p>
        </div>
      </div>

      {/* Tabela UF */}
      {byUf.size > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ranking por estado</p>
          </div>
          <div className="divide-y divide-border max-h-56 overflow-auto">
            {[...byUf.entries()]
              .sort((a, b) => b[1].count - a[1].count)
              .map(([uf, { count, cidades, critical }]) => (
                <button
                  key={uf}
                  onClick={() => onUfClick?.(selectedUf === uf ? null : uf)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/60 transition-colors text-left',
                    selectedUf === uf && 'bg-primary/5',
                  )}
                >
                  <span className="font-mono font-bold w-8 text-primary">{uf}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-muted-foreground text-xs truncate">
                      {[...cidades].slice(0, 3).join(', ')}
                      {cidades.size > 3 ? ` +${cidades.size - 3}` : ''}
                    </span>
                  </div>
                  {critical > 0 && (
                    <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 shrink-0">
                      🚨 {critical} crítico{critical > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className={cn(
                    'shrink-0 font-bold tabular-nums',
                    count >= maxCount * 0.7 ? 'text-red-600 dark:text-red-400' :
                    count >= maxCount * 0.4 ? 'text-amber-600 dark:text-amber-400' :
                    'text-foreground',
                  )}>
                    {count}
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
