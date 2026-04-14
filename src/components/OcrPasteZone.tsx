import { useRef, useState, useCallback } from 'react';
import { ScanLine, Upload, X, Hash, Cpu } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface Props {
  onResult: (serial: string | null, patrimonio: string | null) => void;
}

// ── Extract all candidate tokens from OCR text ────────────────────────────────
// Returns every alphanumeric token that looks like a serial or patrimônio

function extractCandidates(raw: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  // 1. "LA" + digits (patrimônio padrão Americanas)
  for (const m of raw.matchAll(/LA\s*\d{4,}/gi)) {
    const v = m[0].replace(/\s/g, '').toUpperCase();
    if (!seen.has(v)) { seen.add(v); results.push(v); }
  }

  // 2. Linhas com "SERIAL" ou "S/N" → capturar o valor na mesma linha
  for (const m of raw.matchAll(/(?:S\/N|SERIAL\s*N[UÚ]MERO?|N[UÚ]MERO?\s*S[ÉE]RIE)[:\s]+([A-Z0-9]{6,})/gi)) {
    const v = m[1].replace(/\s/g, '').toUpperCase();
    if (!seen.has(v)) { seen.add(v); results.push(v); }
  }

  // 3. Sequências puras de dígitos ≥ 8 caracteres
  for (const m of raw.matchAll(/\b\d{8,}\b/g)) {
    const v = m[0];
    if (!seen.has(v)) { seen.add(v); results.push(v); }
  }

  // 4. Tokens alfanuméricos ≥ 6 chars com pelo menos 4 dígitos (ex: MP3000, R1234567)
  for (const m of raw.matchAll(/\b[A-Z0-9]{6,}\b/g)) {
    const v = m[0];
    if (!/^[A-Z]+$/.test(v) && !seen.has(v)) { seen.add(v); results.push(v); }
  }

  return results;
}

// ── OCR runner ────────────────────────────────────────────────────────────────

async function runOcr(file: File | Blob): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  // PSM 11 = sparse text (melhor para etiquetas com texto espalhado)
  const worker = await createWorker('por+eng', 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/worker.min.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd-lstm.wasm.js',
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '11' as any });
    const { data: { text } } = await worker.recognize(file);
    return text;
  } finally {
    await worker.terminate();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

type AssignMode = 'serial' | 'patrimonio' | null;

export function OcrPasteZone({ onResult }: Props) {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [rawText, setRawText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [assignMode, setAssignMode] = useState<AssignMode>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File | Blob) => {
    setLoading(true);
    setCandidates([]);
    setRawText('');
    setAssignMode(null);
    try {
      const text = await runOcr(file);
      const found = extractCandidates(text);
      setRawText(text.trim());
      setCandidates(found);
      if (found.length === 0) {
        toast.warning('Nenhum número detectado. Tente uma foto mais nítida e de frente.');
      }
    } catch {
      toast.error('Erro ao ler imagem. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    for (const item of Array.from(e.clipboardData?.items ?? [])) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { e.preventDefault(); processFile(file); return; }
      }
    }
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) processFile(file);
  }, [processFile]);

  const pickCandidate = (value: string) => {
    if (!assignMode) return;
    onResult(
      assignMode === 'serial' ? value : null,
      assignMode === 'patrimonio' ? value : null,
    );
    toast.success(`${assignMode === 'serial' ? 'Serial' : 'Patrimônio'} preenchido: ${value}`);
    setCandidates(prev => prev.filter(c => c !== value));
    setAssignMode(null);
  };

  const reset = () => { setCandidates([]); setRawText(''); setAssignMode(null); };

  const hasResults = candidates.length > 0;

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        tabIndex={0}
        onPaste={handlePaste}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        aria-label="Colar, arrastar ou abrir imagem da etiqueta"
        className={cn(
          'flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-2.5 text-sm transition-colors cursor-pointer select-none outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary',
          dragging ? 'border-primary bg-primary/10 text-primary'
            : 'border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground',
          loading && 'pointer-events-none opacity-60',
        )}
      >
        {loading
          ? <><span className="animate-spin text-primary">⏳</span><span className="text-sm">Lendo etiqueta…</span></>
          : <><ScanLine className="w-4 h-4 shrink-0" />
              <span>
                <kbd className="font-mono text-[11px] bg-secondary px-1 rounded">Ctrl+V</kbd>
                {' '}cole, arraste ou clique para ler etiqueta por OCR
              </span>
              <Upload className="w-3.5 h-3.5 shrink-0 ml-auto opacity-50" />
            </>
        }
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} />
      </div>

      {/* Results */}
      {hasResults && (
        <div className="rounded-lg border border-border/60 bg-card p-3 space-y-3 animate-fade-in text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {candidates.length} número(s) detectado(s)
            </span>
            <button onClick={reset} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mode selector */}
          <div className="flex gap-2">
            <Button
              size="sm" type="button"
              variant={assignMode === 'serial' ? 'default' : 'outline'}
              className="h-7 text-xs gap-1.5 flex-1"
              onClick={() => setAssignMode(m => m === 'serial' ? null : 'serial')}
            >
              <Cpu className="w-3 h-3" />
              {assignMode === 'serial' ? '← Clique no serial' : 'Definir Serial'}
            </Button>
            <Button
              size="sm" type="button"
              variant={assignMode === 'patrimonio' ? 'default' : 'outline'}
              className="h-7 text-xs gap-1.5 flex-1"
              onClick={() => setAssignMode(m => m === 'patrimonio' ? null : 'patrimonio')}
            >
              <Hash className="w-3 h-3" />
              {assignMode === 'patrimonio' ? '← Clique no patrimônio' : 'Definir Patrimônio'}
            </Button>
          </div>

          {/* Candidate chips */}
          <div className="flex flex-wrap gap-1.5">
            {candidates.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => pickCandidate(c)}
                className={cn(
                  'font-mono text-xs px-2.5 py-1 rounded-md border transition-all',
                  assignMode
                    ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer scale-100 hover:scale-105'
                    : 'border-border/60 bg-secondary/50 text-foreground/70 cursor-default',
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {!assignMode && (
            <p className="text-[11px] text-muted-foreground">
              Clique em "Definir Serial" ou "Definir Patrimônio" e depois toque no número correto.
            </p>
          )}
        </div>
      )}

      {/* No candidates but has raw text */}
      {!hasResults && rawText && !loading && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            OCR leu a imagem mas não encontrou padrões numéricos. Texto bruto:
          </p>
          <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono max-h-20 overflow-auto">
            {rawText.slice(0, 300)}
          </pre>
          <p className="text-[10px] text-muted-foreground">
            Tente uma foto de frente, bem iluminada e sem inclinação.
          </p>
        </div>
      )}
    </div>
  );
}
