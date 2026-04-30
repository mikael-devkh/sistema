import { useRef, useState } from 'react';
import { CalendarClock, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { formatSeasonalDate, parseSeasonalHoursFile } from '../../lib/seasonal-hours';
import { useSeasonalHours } from '../../hooks/use-seasonal-hours';

interface Props {
  className?: string;
}

export function SeasonalHoursPanel({ className }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fallbackDate, setFallbackDate] = useState(new Date().toISOString().slice(0, 10));
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { items, dates, saveMany, removeDate, isLoading } = useSeasonalHours();

  const selectedCount = items.filter(item => item.date === fallbackDate).length;

  const handleFile = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      const result = await parseSeasonalHoursFile(file, fallbackDate);
      if (!result.entries.length) {
        toast.error('Nenhum horário válido encontrado na planilha.');
        return;
      }
      await saveMany(result.entries, file.name);
      toast.success(`${result.entries.length} horário(s) sazonal(is) importado(s).`);
      if (result.skipped > 0) {
        toast.warning(`${result.skipped} linha(s) ignorada(s) por falta de loja, data ou horário.`);
      }
    } catch (e: unknown) {
      toast.error('Erro ao importar planilha: ' + ((e as Error)?.message ?? 'falha desconhecida'));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemoveDate = async () => {
    if (!fallbackDate || selectedCount === 0) return;
    setRemoving(true);
    try {
      const removed = await removeDate(fallbackDate);
      toast.success(`${removed} registro(s) removido(s) de ${formatSeasonalDate(fallbackDate)}.`);
    } catch (e: unknown) {
      toast.error('Erro ao remover data: ' + ((e as Error)?.message ?? 'falha desconhecida'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card/70 px-3 py-2.5 flex flex-wrap items-center gap-2',
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0 mr-1">
        <CalendarClock className="w-4 h-4 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground leading-none">Horários sazonais</p>
          <p className="text-[10px] text-muted-foreground tabular-nums mt-1">
            {isLoading ? 'carregando...' : `${items.length} registro(s) · ${dates.length} data(s)`}
          </p>
        </div>
      </div>

      <Input
        type="date"
        value={fallbackDate}
        onChange={e => setFallbackDate(e.target.value)}
        className="h-8 w-[145px] text-xs bg-background"
        title="Data usada quando a planilha não tiver uma coluna de data"
      />

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv,.ods"
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 text-xs"
        onClick={() => fileRef.current?.click()}
        disabled={importing}
      >
        {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        Importar
      </Button>

      {selectedCount > 0 && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
          onClick={handleRemoveDate}
          disabled={removing}
          title={`Remover registros de ${formatSeasonalDate(fallbackDate)}`}
        >
          {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          {selectedCount}
        </Button>
      )}
    </div>
  );
}
