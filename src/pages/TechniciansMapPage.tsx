import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Card } from '../components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  MapPin, Search, Crosshair, Users, Radius, ArrowLeft, Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { listTechnicians, findTechniciansForLocation } from '../lib/technician-firestore';
import { listKnownCities, getCityCoords } from '../lib/brazilCityCoords';
import type { TechnicianProfile } from '../types/technician';
import { cn } from '../lib/utils';

// ─── Projeção Simples ────────────────────────────────────────────────────────
// Bounding box do Brasil — usado para converter lng/lat em x/y no SVG.
const BBOX = {
  minLng: -74.5,
  maxLng: -33.5,
  minLat: -34.5,
  maxLat: 6.0,
};

const SVG_W = 760;
const SVG_H = 760;

function project(lng: number, lat: number): [number, number] {
  const x = ((lng - BBOX.minLng) / (BBOX.maxLng - BBOX.minLng)) * SVG_W;
  const y = (1 - (lat - BBOX.minLat) / (BBOX.maxLat - BBOX.minLat)) * SVG_H;
  return [x, y];
}

/** Converte raio em km para raio em pixels (aproximação na latitude média do Brasil). */
function kmToPixels(km: number): number {
  const kmPerDeg = 111; // 1° latitude ~= 111km
  const degrees = km / kmPerDeg;
  return (degrees / (BBOX.maxLat - BBOX.minLat)) * SVG_H;
}

// ─── UF reference dots (capitais) ───────────────────────────────────────────
const CAPITAIS: { nome: string; uf: string; lng: number; lat: number }[] = [
  { nome: 'SP', uf: 'SP', lng: -46.6333, lat: -23.5505 },
  { nome: 'RJ', uf: 'RJ', lng: -43.1729, lat: -22.9068 },
  { nome: 'MG', uf: 'MG', lng: -43.9378, lat: -19.9191 },
  { nome: 'BA', uf: 'BA', lng: -38.5108, lat: -12.9714 },
  { nome: 'DF', uf: 'DF', lng: -47.9292, lat: -15.7801 },
  { nome: 'PR', uf: 'PR', lng: -49.2731, lat: -25.4284 },
  { nome: 'RS', uf: 'RS', lng: -51.2177, lat: -30.0346 },
  { nome: 'SC', uf: 'SC', lng: -48.5482, lat: -27.5954 },
  { nome: 'GO', uf: 'GO', lng: -49.2539, lat: -16.6864 },
  { nome: 'PE', uf: 'PE', lng: -34.8811, lat: -8.0539 },
  { nome: 'CE', uf: 'CE', lng: -38.5434, lat: -3.7172 },
  { nome: 'ES', uf: 'ES', lng: -40.3377, lat: -20.3155 },
  { nome: 'MT', uf: 'MT', lng: -56.0975, lat: -15.5961 },
  { nome: 'MS', uf: 'MS', lng: -54.6464, lat: -20.4697 },
  { nome: 'PA', uf: 'PA', lng: -48.5044, lat: -1.4558 },
  { nome: 'AM', uf: 'AM', lng: -60.0217, lat: -3.1019 },
  { nome: 'MA', uf: 'MA', lng: -44.3068, lat: -2.5307 },
  { nome: 'PI', uf: 'PI', lng: -42.8016, lat: -5.0919 },
  { nome: 'RN', uf: 'RN', lng: -35.2094, lat: -5.7945 },
  { nome: 'PB', uf: 'PB', lng: -34.8641, lat: -7.1195 },
  { nome: 'AL', uf: 'AL', lng: -35.7353, lat: -9.6498 },
  { nome: 'SE', uf: 'SE', lng: -37.0731, lat: -10.9472 },
  { nome: 'TO', uf: 'TO', lng: -48.3336, lat: -10.2428 },
  { nome: 'RO', uf: 'RO', lng: -63.9004, lat: -8.7612 },
  { nome: 'AC', uf: 'AC', lng: -67.8090, lat: -9.9754 },
  { nome: 'RR', uf: 'RR', lng: -60.6733, lat: 2.8235 },
  { nome: 'AP', uf: 'AP', lng: -51.0669, lat: 0.0355 },
];

// ─── Página ──────────────────────────────────────────────────────────────────

export default function TechniciansMapPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([]);
  const [selected, setSelected] = useState<TechnicianProfile | null>(null);
  const [search, setSearch] = useState('');
  const [ufFilter, setUfFilter] = useState<string>('todos');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Busca por localidade
  const [searchCidade, setSearchCidade] = useState('');
  const [searchUf, setSearchUf] = useState('');
  const [matches, setMatches] =
    useState<Array<TechnicianProfile & { distanceKm: number | null; matchReason: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [searchPoint, setSearchPoint] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listTechnicians()
      .then(list => {
        if (!mounted) return;
        setTechnicians(list);
      })
      .catch(err => {
        console.error(err);
        toast.error('Erro ao carregar técnicos');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  // Técnicos com coordenadas resolvidas (area.coordenadas ou cidade/uf)
  const withCoords = useMemo(() => {
    return technicians
      .map(t => {
        const coords = t.areaAtendimento?.coordenadas
          ?? (t.cidade && t.uf ? (() => {
            const c = getCityCoords(t.cidade, t.uf);
            return c ? { lat: c[1], lng: c[0] } : null;
          })() : null);
        return coords ? { tech: t, coords } : null;
      })
      .filter((x): x is { tech: TechnicianProfile; coords: { lat: number; lng: number } } => !!x);
  }, [technicians]);

  // Filtros do painel lateral
  const filteredList = useMemo(() => {
    return withCoords.filter(({ tech }) => {
      if (search) {
        const q = search.toLowerCase();
        const hit =
          tech.nome.toLowerCase().includes(q) ||
          tech.codigoTecnico.toLowerCase().includes(q) ||
          tech.cidade?.toLowerCase().includes(q) ||
          tech.uf?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (ufFilter !== 'todos' && tech.uf !== ufFilter) return false;
      if (onlyAvailable && (!tech.disponivel || tech.status !== 'ativo')) return false;
      return true;
    });
  }, [withCoords, search, ufFilter, onlyAvailable]);

  const ufsUnicas = useMemo(
    () => Array.from(new Set(technicians.map(t => t.uf).filter(Boolean) as string[])).sort(),
    [technicians]
  );

  const knownCities = useMemo(() => listKnownCities(), []);

  const handleFindByLocation = async () => {
    if (!searchCidade || !searchUf) {
      toast.error('Informe cidade e UF para buscar');
      return;
    }
    setSearching(true);
    try {
      const coords = getCityCoords(searchCidade, searchUf);
      if (coords) setSearchPoint({ lat: coords[1], lng: coords[0] });

      const result = await findTechniciansForLocation(searchCidade, searchUf, {
        onlyActive: true,
      });
      setMatches(result);
      if (result.length === 0) {
        toast.info('Nenhum técnico encontrado para esta localidade');
      } else {
        toast.success(`${result.length} técnico(s) cobrem esta localidade`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao buscar técnicos');
    } finally {
      setSearching(false);
    }
  };

  const clearLocationSearch = () => {
    setSearchCidade('');
    setSearchUf('');
    setMatches([]);
    setSearchPoint(null);
  };

  return (
    <div className="space-y-5 pb-8 animate-page-in">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
        <div className="flex items-center gap-4 px-6 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/tecnicos')}
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Mapa de Técnicos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Visualize cobertura geográfica e encontre técnicos por localidade
            </p>
          </div>
        </div>
      </div>

      {/* Busca por localidade */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Crosshair className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Buscar técnicos para uma localidade</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr,120px,auto,auto] gap-3">
          <div className="space-y-1">
            <Label htmlFor="map-search-cidade">Cidade</Label>
            <Input
              id="map-search-cidade"
              list="map-cidades-datalist"
              placeholder="Ex: Campinas"
              value={searchCidade}
              onChange={e => setSearchCidade(e.target.value)}
            />
            <datalist id="map-cidades-datalist">
              {knownCities.map(c => (
                <option key={`${c.cidade}-${c.uf}`} value={c.cidade}>
                  {c.cidade} - {c.uf}
                </option>
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label htmlFor="map-search-uf">UF</Label>
            <Input
              id="map-search-uf"
              placeholder="SP"
              maxLength={2}
              value={searchUf}
              onChange={e => setSearchUf(e.target.value.toUpperCase())}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleFindByLocation} disabled={searching} className="w-full md:w-auto">
              <Search className="w-4 h-4 mr-1.5" />
              Buscar
            </Button>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={clearLocationSearch} className="w-full md:w-auto">
              Limpar
            </Button>
          </div>
        </div>
        {matches.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              Técnicos que cobrem {searchCidade}/{searchUf}
            </p>
            <div className="flex flex-wrap gap-2">
              {matches.map(m => (
                <button
                  key={m.uid}
                  onClick={() => setSelected(m)}
                  className={cn(
                    'text-left rounded-md border p-2 hover:border-primary transition-colors',
                    selected?.uid === m.uid && 'border-primary bg-primary/5'
                  )}
                >
                  <p className="text-xs font-semibold">{m.codigoTecnico} — {m.nome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {m.distanceKm !== null ? `${m.distanceKm.toFixed(0)} km` : '—'} · {m.matchReason}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Mapa + lista lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-4">
        {/* Mapa SVG */}
        <Card className="p-4 overflow-hidden">
          <div className="w-full overflow-auto">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full max-w-full h-auto bg-muted/30 rounded-md"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Moldura */}
              <rect
                x={0}
                y={0}
                width={SVG_W}
                height={SVG_H}
                fill="transparent"
                stroke="hsl(var(--border))"
                strokeWidth={1}
              />

              {/* Grade lng/lat */}
              <g opacity={0.25}>
                {[-70, -60, -50, -40].map(lng => {
                  const [x] = project(lng, 0);
                  return (
                    <line
                      key={`lng-${lng}`}
                      x1={x} y1={0} x2={x} y2={SVG_H}
                      stroke="hsl(var(--border))" strokeDasharray="4 6"
                    />
                  );
                })}
                {[0, -10, -20, -30].map(lat => {
                  const [, y] = project(0, lat);
                  return (
                    <line
                      key={`lat-${lat}`}
                      x1={0} y1={y} x2={SVG_W} y2={y}
                      stroke="hsl(var(--border))" strokeDasharray="4 6"
                    />
                  );
                })}
              </g>

              {/* Capitais (referência) */}
              <g>
                {CAPITAIS.map(cap => {
                  const [x, y] = project(cap.lng, cap.lat);
                  return (
                    <g key={cap.uf}>
                      <circle cx={x} cy={y} r={2} fill="hsl(var(--muted-foreground))" opacity={0.5} />
                      <text
                        x={x + 5}
                        y={y + 3}
                        fontSize={9}
                        fill="hsl(var(--muted-foreground))"
                        opacity={0.7}
                      >
                        {cap.uf}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* Ponto de busca (destino) */}
              {searchPoint && (() => {
                const [x, y] = project(searchPoint.lng, searchPoint.lat);
                return (
                  <g>
                    <circle
                      cx={x} cy={y} r={12}
                      fill="hsl(var(--primary))"
                      opacity={0.15}
                    >
                      <animate
                        attributeName="r"
                        from="12"
                        to="24"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        from="0.4"
                        to="0"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle cx={x} cy={y} r={5} fill="hsl(var(--primary))" stroke="white" strokeWidth={2} />
                  </g>
                );
              })()}

              {/* Raios dos técnicos que atendem arredores */}
              <g>
                {filteredList
                  .filter(({ tech }) => tech.areaAtendimento?.atendeArredores && tech.areaAtendimento.raioKm)
                  .map(({ tech, coords }) => {
                    const [x, y] = project(coords.lng, coords.lat);
                    const r = kmToPixels(tech.areaAtendimento!.raioKm!);
                    const isSelected = selected?.uid === tech.uid;
                    return (
                      <circle
                        key={`radius-${tech.uid}`}
                        cx={x} cy={y} r={r}
                        fill={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--primary))'}
                        fillOpacity={isSelected ? 0.15 : 0.05}
                        stroke="hsl(var(--primary))"
                        strokeOpacity={isSelected ? 0.6 : 0.25}
                        strokeDasharray="3 4"
                      />
                    );
                  })}
              </g>

              {/* Marcadores dos técnicos */}
              <g>
                {filteredList.map(({ tech, coords }) => {
                  const [x, y] = project(coords.lng, coords.lat);
                  const isSelected = selected?.uid === tech.uid;
                  const isMatch = matches.some(m => m.uid === tech.uid);
                  const color = tech.disponivel && tech.status === 'ativo'
                    ? 'rgb(16 185 129)' // emerald-500
                    : tech.status === 'ativo'
                      ? 'rgb(245 158 11)' // amber-500
                      : 'rgb(148 163 184)'; // slate-400
                  return (
                    <g
                      key={tech.uid}
                      onClick={() => setSelected(tech)}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle
                        cx={x} cy={y} r={isSelected || isMatch ? 7 : 5}
                        fill={color}
                        stroke="white"
                        strokeWidth={2}
                      />
                      {(isSelected || isMatch) && (
                        <text
                          x={x + 8}
                          y={y - 6}
                          fontSize={10}
                          fontWeight={600}
                          fill="hsl(var(--foreground))"
                        >
                          {tech.codigoTecnico}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Ativo e disponível
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Ativo / indisponível
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Outros status
            </div>
            <div className="flex items-center gap-1.5">
              <Radius className="w-3 h-3" /> Círculo tracejado = raio de atendimento
            </div>
          </div>
        </Card>

        {/* Painel lateral */}
        <div className="space-y-3">
          {/* Filtros */}
          <Card className="p-3 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Filter className="w-3.5 h-3.5" /> Filtros
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Nome, código, cidade…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={ufFilter} onValueChange={setUfFilter}>
              <SelectTrigger>
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as UFs</SelectItem>
                {ufsUnicas.map(uf => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={e => setOnlyAvailable(e.target.checked)}
                className="rounded border-border"
              />
              Só ativos e disponíveis
            </label>
          </Card>

          {/* Lista de técnicos */}
          <Card className="p-3 max-h-[500px] overflow-y-auto">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              <Users className="w-3.5 h-3.5" />
              {loading ? 'Carregando…' : `${filteredList.length} técnico(s)`}
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : filteredList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhum técnico corresponde aos filtros
              </p>
            ) : (
              <div className="space-y-1">
                {filteredList.map(({ tech }) => {
                  const isSelected = selected?.uid === tech.uid;
                  return (
                    <button
                      key={tech.uid}
                      onClick={() => setSelected(tech)}
                      className={cn(
                        'w-full text-left rounded-md p-2 border transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:bg-muted/50',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {tech.codigoTecnico} — {tech.nome}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {tech.cidade ?? '—'}{tech.uf ? `, ${tech.uf}` : ''}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            tech.disponivel && tech.status === 'ativo'
                              ? 'bg-emerald-500'
                              : tech.status === 'ativo' ? 'bg-amber-500' : 'bg-slate-400',
                          )}
                        />
                      </div>
                      {tech.areaAtendimento?.atendeArredores && tech.areaAtendimento.raioKm && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          raio {tech.areaAtendimento.raioKm}km
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Detalhes do selecionado */}
          {selected && (
            <Card className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">{selected.codigoTecnico}</p>
                <Badge variant={selected.disponivel ? 'default' : 'secondary'}>
                  {selected.disponivel ? 'Disponível' : 'Indisponível'}
                </Badge>
              </div>
              <p className="text-sm">{selected.nome}</p>
              <p className="text-xs text-muted-foreground mb-2">{selected.email}</p>
              <div className="space-y-1 text-xs">
                {selected.cidade && selected.uf && (
                  <p><span className="text-muted-foreground">Base: </span>{selected.cidade}, {selected.uf}</p>
                )}
                {selected.telefone && (
                  <p><span className="text-muted-foreground">Tel: </span>{selected.telefone}</p>
                )}
                {selected.areaAtendimento?.atendeArredores && selected.areaAtendimento.raioKm && (
                  <p><span className="text-muted-foreground">Atende em raio de </span>{selected.areaAtendimento.raioKm}km</p>
                )}
                {selected.tecnicoPaiCodigo && (
                  <p><span className="text-muted-foreground">Pai: </span>{selected.tecnicoPaiCodigo} — {selected.tecnicoPaiNome}</p>
                )}
                {selected.especialidades && selected.especialidades.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {selected.especialidades.map(e => (
                      <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
