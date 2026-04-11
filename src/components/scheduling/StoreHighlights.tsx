import { useState } from 'react';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
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
    const rows = filtered.map(g => `"${g.loja}","${g.cidade}","${g.uf}",${g.qtd},${g.isCritical ? 'Sim' : 'Não'}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `lojas_destaque_${minQtd}+.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Mín. chamados</label>
          <Input type="number" min={1} value={minQtd} onChange={e => setMinQtd(Number(e.target.value))} className="w-20 h-8" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">UF</label>
          <Input placeholder="SP" value={filterUf} onChange={e => setFilterUf(e.target.value)} className="w-16 h-8" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Loja / Cidade</label>
          <Input placeholder="Buscar…" value={filterQ} onChange={e => setFilterQ(e.target.value)} className="w-40 h-8" />
        </div>
        <Button size="sm" variant="outline" onClick={downloadCsv} className="h-8">⬇ CSV</Button>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} loja(s) encontrada(s)</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground text-xs">
              <th className="py-1 pr-3">Loja</th>
              <th className="py-1 pr-3">Cidade</th>
              <th className="py-1 pr-3">UF</th>
              <th className="py-1 pr-3">Chamados</th>
              <th className="py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(g => (
              <tr key={g.loja} className="border-b hover:bg-muted/40 transition">
                <td className="py-1 pr-3 font-medium">{g.loja}</td>
                <td className="py-1 pr-3 text-muted-foreground">{g.cidade}</td>
                <td className="py-1 pr-3 text-muted-foreground">{g.uf}</td>
                <td className="py-1 pr-3 font-bold">{g.qtd}</td>
                <td className="py-1">
                  {g.isCritical && <Badge variant="destructive" className="text-[10px]">🔴 Crítica</Badge>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-muted-foreground text-xs">Nenhuma loja encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
