import { useState } from 'react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Download, AlertTriangle } from 'lucide-react';
import type { LojaGroup } from '../../types/scheduling';

interface Props {
  lojaGroups: LojaGroup[];
  threshold?: number;
}

export function StoreHighlights({ lojaGroups, threshold = 2 }: Props) {
  const [minQtd, setMinQtd] = useState(threshold);
  const [filterUf, setFilterUf] = useState('');
  const [filterQ, setFilterQ] = useState('');

  let filtered = lojaGroups.filter(g => g.qtd >= minQtd);
  if (filterUf) filtered = filtered.filter(g => g.uf.toUpperCase() === filterUf.toUpperCase().trim());
  if (filterQ) {
    const q = filterQ.toLowerCase();
    filtered = filtered.filter(g => g.loja.toLowerCase().includes(q) || g.cidade.toLowerCase().includes(q));
  }
  filtered = [...filtered].sort((a, b) => b.qtd - a.qtd || a.loja.localeCompare(b.loja));

  const downloadCsv = () => {
    const header = 'Loja,Cidade,UF,Chamados,Crítica\n';
    const rows = filtered
      .map(g => `"${g.loja}","${g.cidade}","${g.uf}",${g.qtd},${g.isCritical ? 'Sim' : 'Não'}`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lojas_destaque_${minQtd}+.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Mín. chamados</label>
          <Input
            type="number"
            min={1}
            value={minQtd}
            onChange={e => setMinQtd(Number(e.target.value))}
            className="w-20 h-8"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">UF</label>
          <Input
            placeholder="SP"
            value={filterUf}
            onChange={e => setFilterUf(e.target.value)}
            className="w-16 h-8 uppercase"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Loja / Cidade</label>
          <Input
            placeholder="Buscar…"
            value={filterQ}
            onChange={e => setFilterQ(e.target.value)}
            className="w-44 h-8"
          />
        </div>
        <Button size="sm" variant="outline" onClick={downloadCsv} className="h-8 gap-1.5 self-end">
          <Download className="w-3.5 h-3.5" /> CSV
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} loja(s) com {minQtd}+ chamado(s)
      </p>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-secondary/30">
              <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Loja</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cidade</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">UF</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chamados</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((g, i) => (
              <tr
                key={g.loja}
                className={`border-b border-border/30 hover:bg-secondary/20 transition-colors ${i % 2 === 0 ? '' : 'bg-secondary/10'}`}
              >
                <td className="py-2 px-3 font-medium text-sm">{g.loja}</td>
                <td className="py-2 px-3 text-muted-foreground text-xs">{g.cidade}</td>
                <td className="py-2 px-3 text-muted-foreground text-xs">{g.uf}</td>
                <td className="py-2 px-3">
                  <span className="font-bold tabular-nums">{g.qtd}</span>
                </td>
                <td className="py-2 px-3">
                  {g.isCritical && (
                    <Badge className="text-[10px] bg-rose-500/15 text-rose-400 border border-rose-500/30 gap-1">
                      <AlertTriangle className="w-3 h-3" /> Crítica
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                  Nenhuma loja encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
