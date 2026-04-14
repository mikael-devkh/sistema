import { useRef, useState, useCallback } from 'react';
import { ScanLine, Upload, X, Check, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface OcrResult {
  serial: string | null;
  patrimonio: string | null;
  raw: string;
}

interface Props {
  onResult: (serial: string | null, patrimonio: string | null) => void;
}

// ── Pattern detection ─────────────────────────────────────────────────────────

function extractFromText(text: string): OcrResult {
  const clean = text.replace(/\s+/g, ' ').trim();

  // Patrimônio: "LA" seguido de dígitos (padrão Americanas), ou label explícita
  const patrimonioPatterns = [
    /LA\s*(\d{5,})/i,
    /patrim[oô]nio[:\s]+([A-Z]{0,3}\d{5,})/i,
    /\bLA(\d{5,})\b/i,
  ];
  let patrimonio: string | null = null;
  for (const p of patrimonioPatterns) {
    const m = clean.match(p);
    if (m) { patrimonio = m[1] ? `LA${m[1]}` : m[0].replace(/\s/g, ''); break; }
  }

  // Serial: sequência de 8–20 dígitos (ou alfanum) que não seja o patrimônio
  const serialPatterns = [
    /S[\/\-]?N[:\s]+([A-Z0-9]{8,20})/i,
    /serial[:\s]+([A-Z0-9]{8,20})/i,
    /\b(\d{10,20})\b/,        // número longo puro (ex: 863673300064)
    /\b([A-Z]{2}\d{8,16})\b/, // alfanum como CN1234567890
  ];
  let serial: string | null = null;
  for (const p of serialPatterns) {
    const m = clean.match(p);
    if (m) {
      const candidate = m[1] || m[0];
      // Evitar capturar o patrimônio de novo
      if (!patrimonio || !candidate.includes(patrimonio.replace('LA', ''))) {
        serial = candidate.replace(/\s/g, '');
        break;
      }
    }
  }

  return { serial, patrimonio, raw: clean };
}

// ── OCR runner (lazy-loads tesseract.js) ──────────────────────────────────────

async function runOcr(file: File | Blob): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('por+eng', 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/worker.min.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd-lstm.wasm.js',
  });
  try {
    const { data: { text } } = await worker.recognize(file);
    return text;
  } finally {
    await worker.terminate();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OcrPasteZone({ onResult }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  const processFile = useCallback(async (file: File | Blob) => {
    setLoading(true);
    setResult(null);
    try {
      const text = await runOcr(file);
      const extracted = extractFromText(text);
      setResult(extracted);
      if (!extracted.serial && !extracted.patrimonio) {
        toast.warning('Nenhum serial ou patrimônio detectado. Tente uma foto mais nítida.');
      }
    } catch {
      toast.error('Erro ao ler a imagem. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Ctrl+V paste on this zone
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { e.preventDefault(); processFile(file); }
      }
    }
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) processFile(file);
  }, [processFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const applyField = (field: 'serial' | 'patrimonio', value: string) => {
    onResult(
      field === 'serial' ? value : null,
      field === 'patrimonio' ? value : null,
    );
    toast.success(`${field === 'serial' ? 'Serial' : 'Patrimônio'} preenchido!`);
    setResult(prev => prev ? { ...prev, [field]: null } : null);
  };

  const applyAll = () => {
    if (!result) return;
    onResult(result.serial, result.patrimonio);
    toast.success('Serial e Patrimônio preenchidos!');
    setResult(null);
  };

  const close = () => setResult(null);

  return (
    <div className="space-y-2">
      {/* Drop / paste zone */}
      <div
        ref={zoneRef}
        tabIndex={0}
        onPaste={handlePaste}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 text-sm transition-colors cursor-pointer select-none outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
          dragging
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground',
          loading && 'pointer-events-none opacity-60',
        )}
        onClick={() => fileRef.current?.click()}
        role="button"
        aria-label="Colar ou soltar imagem da etiqueta"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin shrink-0 text-primary" /><span>Lendo imagem…</span></>
          : <><ScanLine className="w-4 h-4 shrink-0" /><span>Cole (<kbd className="font-mono text-xs bg-secondary px-1 rounded">Ctrl+V</kbd>), arraste ou clique para ler etiqueta</span><Upload className="w-3.5 h-3.5 shrink-0 ml-auto" /></>
        }
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Results */}
      {result && (result.serial || result.patrimonio) && (
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">Detectado na imagem</span>
            <button onClick={close} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>

          <div className="flex flex-wrap gap-2">
            {result.serial && (
              <button
                onClick={() => applyField('serial', result.serial!)}
                className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-card px-2.5 py-1.5 text-xs font-mono hover:bg-primary/10 transition-colors"
              >
                <span className="text-muted-foreground">Serial:</span>
                <span className="font-semibold">{result.serial}</span>
                <Check className="w-3 h-3 text-primary ml-0.5" />
              </button>
            )}
            {result.patrimonio && (
              <button
                onClick={() => applyField('patrimonio', result.patrimonio!)}
                className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-card px-2.5 py-1.5 text-xs font-mono hover:bg-primary/10 transition-colors"
              >
                <span className="text-muted-foreground">Patrimônio:</span>
                <span className="font-semibold">{result.patrimonio}</span>
                <Check className="w-3 h-3 text-primary ml-0.5" />
              </button>
            )}
          </div>

          {result.serial && result.patrimonio && (
            <Button size="sm" variant="default" className="w-full gap-1.5 h-7 text-xs" onClick={applyAll}>
              <Check className="w-3.5 h-3.5" /> Usar os dois
            </Button>
          )}

          <p className="text-[10px] text-muted-foreground">Toque para preencher o campo. Se errado, edite manualmente.</p>
        </div>
      )}

      {result && !result.serial && !result.patrimonio && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <span className="text-xs text-amber-600 dark:text-amber-300">Texto extraído mas sem padrão reconhecido.</span>
          <Badge variant="outline" className="text-[10px] font-mono max-w-[180px] truncate">{result.raw.slice(0, 60)}</Badge>
          <button onClick={close} className="ml-auto text-muted-foreground"><X className="w-3 h-3" /></button>
        </div>
      )}
    </div>
  );
}
