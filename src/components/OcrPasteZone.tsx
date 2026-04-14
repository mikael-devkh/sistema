import { useRef, useState, useCallback } from 'react';
import { ScanLine, Upload, X, Hash, Cpu } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface Props {
  onResult: (serial: string | null, patrimonio: string | null) => void;
}

// ── Pixel helpers ─────────────────────────────────────────────────────────────

function toGrayscale(px: Uint8ClampedArray) {
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    px[i] = px[i + 1] = px[i + 2] = g;
  }
}

function invertPixels(px: Uint8ClampedArray) {
  for (let i = 0; i < px.length; i += 4) {
    px[i] = 255 - px[i];
    px[i + 1] = 255 - px[i + 1];
    px[i + 2] = 255 - px[i + 2];
  }
}

/**
 * Adaptive (local) threshold — compares each pixel to the mean of its
 * neighbourhood minus a constant C. Far superior to global threshold for
 * uneven lighting, dark-background labels (Bematech, Zebra, etc.).
 */
function adaptiveThreshold(
  px: Uint8ClampedArray,
  width: number,
  height: number,
  blockSize = 31,
  C = 8,
) {
  // Integral image for O(1) box-sum queries
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = px[(y * width + x) * 4]; // already grayscale
      integral[(y + 1) * (width + 1) + (x + 1)] =
        v +
        integral[y * (width + 1) + (x + 1)] +
        integral[(y + 1) * (width + 1) + x] -
        integral[y * (width + 1) + x];
    }
  }

  const half = Math.floor(blockSize / 2);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(width - 1, x + half);
      const y2 = Math.min(height - 1, y + half);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * (width + 1) + (x2 + 1)] -
        integral[y1 * (width + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (width + 1) + x1] +
        integral[y1 * (width + 1) + x1];
      const threshold = sum / area - C;
      const idx = (y * width + x) * 4;
      const v = px[idx] > threshold ? 255 : 0;
      px[idx] = px[idx + 1] = px[idx + 2] = v;
    }
  }
}

// ── Produce two preprocessed image variants ───────────────────────────────────
// v1 — adaptive on original grayscale  (light bg / dark text labels)
// v2 — adaptive on inverted grayscale  (dark bg / light text — Bematech etc.)

async function preprocessImage(source: File | Blob): Promise<Blob[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(source);
    img.onload = () => {
      URL.revokeObjectURL(url);

      // Scale: always at least 1.5×, target long side ≥ 2 400 px, cap at 4×
      const scale = Math.min(4, Math.max(1.5, 2400 / Math.max(img.width, img.height)));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const make = (transform: (px: Uint8ClampedArray, w: number, h: number) => void) =>
        new Promise<Blob>((res, rej) => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h);
          transform(data.data, w, h);
          ctx.putImageData(data, 0, 0);
          canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png');
        });

      Promise.all([
        // Variant 1: adaptive threshold (works for light background)
        make((px, w, h) => {
          toGrayscale(px);
          adaptiveThreshold(px, w, h);
        }),
        // Variant 2: invert first, then adaptive threshold (works for dark background — Bematech)
        make((px, w, h) => {
          toGrayscale(px);
          invertPixels(px);
          adaptiveThreshold(px, w, h);
        }),
      ])
        .then(resolve)
        .catch(reject);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── OCR — 4 passes: 2 image variants × 2 PSM modes ───────────────────────────

type OcrProgressCb = (pass: number, total: number) => void;

async function runOcr(blobs: Blob[], onProgress?: OcrProgressCb): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/worker.min.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    corePath:
      'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd-lstm.wasm.js',
  });

  const texts: string[] = [];
  const psms = ['11', '6'] as const; // PSM 11 = sparse text, PSM 6 = single block
  const total = blobs.length * psms.length;
  let pass = 0;

  try {
    for (const blob of blobs) {
      for (const psm of psms) {
        onProgress?.(++pass, total);
        await worker.setParameters({
          tessedit_pageseg_mode: psm as any,
          // Restrict alphabet to alphanumeric + common label chars — avoids garbage symbols
          tessedit_char_whitelist:
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/. \n',
        });
        const { data: { text } } = await worker.recognize(blob);
        if (text.trim()) texts.push(text);
      }
    }
  } finally {
    await worker.terminate();
  }

  return texts.join('\n');
}

// ── Extract candidates from merged OCR text ───────────────────────────────────

function extractCandidates(raw: string): string[] {
  const seen = new Set<string>();
  const push = (v: string) => {
    v = v.replace(/\s/g, '').toUpperCase();
    if (v.length >= 4 && !seen.has(v)) seen.add(v);
  };

  const text = raw.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ');

  // 1. LA + digits (patrimônio Americanas)
  for (const m of text.matchAll(/LA\s*\d{4,}/gi)) push(m[0]);

  // 2. After "SERIAL" / "S/N" keyword
  for (const m of text.matchAll(/(?:S\/N|SERIAL[\s\w]*?)[:\s]+([A-Z0-9]{6,})/gi)) push(m[1]);

  // 3. Pure digit sequences ≥ 6 digits
  for (const m of text.matchAll(/\b\d{6,}\b/g)) push(m[0]);

  // 4. Mixed alnum tokens ≥ 6 chars with at least 3 digits
  for (const m of text.matchAll(/\b[A-Z0-9]{6,}\b/gi)) {
    const v = m[0];
    if ((v.match(/\d/g)?.length ?? 0) >= 3 && !/^[A-Z]+$/.test(v)) push(v);
  }

  return [...seen];
}

// ── Component ─────────────────────────────────────────────────────────────────

type AssignMode = 'serial' | 'patrimonio' | null;

export function OcrPasteZone({ onResult }: Props) {
  const [status, setStatus] = useState<'idle' | 'preprocessing' | 'ocr'>('idle');
  const [ocrPass, setOcrPass] = useState(0);
  const [ocrTotal, setOcrTotal] = useState(4);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [rawText, setRawText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [assignMode, setAssignMode] = useState<AssignMode>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File | Blob) => {
      setCandidates([]);
      setRawText('');
      setAssignMode(null);
      setOcrPass(0);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));

      try {
        setStatus('preprocessing');
        const blobs = await preprocessImage(file);

        setStatus('ocr');
        const text = await runOcr(blobs, (pass, total) => {
          setOcrPass(pass);
          setOcrTotal(total);
        });
        const found = extractCandidates(text);
        setRawText(text.trim());
        setCandidates(found);

        if (found.length === 0) {
          toast.warning(
            'Nenhum número encontrado. Tente uma foto mais de frente e bem iluminada.',
          );
        }
      } catch {
        toast.error('Erro ao processar imagem.');
      } finally {
        setStatus('idle');
      }
    },
    [previewUrl],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            processFile(f);
            return;
          }
        }
      }
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f?.type.startsWith('image/')) processFile(f);
    },
    [processFile],
  );

  const pickCandidate = (value: string) => {
    if (!assignMode) return;
    onResult(
      assignMode === 'serial' ? value : null,
      assignMode === 'patrimonio' ? value : null,
    );
    toast.success(
      `${assignMode === 'serial' ? 'Serial' : 'Patrimônio'} preenchido: ${value}`,
    );
    setCandidates(prev => prev.filter(c => c !== value));
    setAssignMode(null);
  };

  const reset = () => {
    setCandidates([]);
    setRawText('');
    setAssignMode(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const loading = status !== 'idle';
  const statusLabel =
    status === 'preprocessing'
      ? 'Processando imagem…'
      : `Lendo texto… (${ocrPass}/${ocrTotal})`;

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        tabIndex={0}
        onPaste={handlePaste}
        onDragOver={e => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !loading && fileRef.current?.click()}
        role="button"
        className={cn(
          'flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-2.5 text-sm transition-colors cursor-pointer select-none outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary',
          dragging
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground',
          loading && 'pointer-events-none opacity-60',
        )}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            <span>{statusLabel}</span>
          </>
        ) : (
          <>
            <ScanLine className="w-4 h-4 shrink-0" />
            <span>
              <kbd className="font-mono text-[11px] bg-secondary px-1 rounded">Ctrl+V</kbd>
              {' '}cole, arraste ou clique para ler etiqueta por OCR
            </span>
            <Upload className="w-3.5 h-3.5 shrink-0 ml-auto opacity-50" />
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) processFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {/* Results */}
      {candidates.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card p-3 space-y-3 animate-fade-in text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {candidates.length} número(s) detectado(s) — selecione qual é qual
            </span>
            <button onClick={reset} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              type="button"
              variant={assignMode === 'serial' ? 'default' : 'outline'}
              className="h-7 text-xs gap-1.5 flex-1"
              onClick={() => setAssignMode(m => (m === 'serial' ? null : 'serial'))}
            >
              <Cpu className="w-3 h-3" />
              {assignMode === 'serial' ? '← clique no número' : 'É o Serial'}
            </Button>
            <Button
              size="sm"
              type="button"
              variant={assignMode === 'patrimonio' ? 'default' : 'outline'}
              className="h-7 text-xs gap-1.5 flex-1"
              onClick={() => setAssignMode(m => (m === 'patrimonio' ? null : 'patrimonio'))}
            >
              <Hash className="w-3 h-3" />
              {assignMode === 'patrimonio' ? '← clique no número' : 'É o Patrimônio'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {candidates.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => pickCandidate(c)}
                className={cn(
                  'font-mono text-xs px-2.5 py-1 rounded-md border transition-all',
                  assignMode
                    ? 'border-primary bg-primary/10 text-primary hover:bg-primary/25 cursor-pointer hover:scale-105'
                    : 'border-border/60 bg-secondary/50 text-foreground/80 cursor-default',
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {!assignMode && (
            <p className="text-[11px] text-muted-foreground">
              Selecione "É o Serial" ou "É o Patrimônio" e depois clique no número correto acima.
            </p>
          )}
        </div>
      )}

      {/* OCR got text but no candidate numbers */}
      {candidates.length === 0 && rawText && !loading && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            OCR leu a imagem mas não identificou padrões numéricos. Texto bruto:
          </p>
          <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono max-h-24 overflow-auto bg-secondary/50 rounded p-2">
            {rawText.slice(0, 600)}
          </pre>
          <p className="text-[11px] text-muted-foreground">
            💡 Dica: foto de frente, boa iluminação, enquadre apenas a etiqueta.
          </p>
          <button onClick={reset} className="text-[11px] text-primary underline">
            Tentar outra imagem
          </button>
        </div>
      )}
    </div>
  );
}
