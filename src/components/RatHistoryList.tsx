import { useMemo, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { FileText, History, Download, Loader2, PackageOpen } from "lucide-react";
import { RatFormData } from "../types/rat";
import { toast } from "sonner";

export interface RatHistoryEntry {
  id: string;
  timestamp: number;
  fsa?: string;
  codigoLoja?: string;
  pdv?: string;
  defeitoProblema?: string;
  formData: RatFormData;
}

interface RatHistoryListProps {
  history: RatHistoryEntry[];
  onSelect: (entry: RatHistoryEntry) => void;
  onClear: () => void;
}

export const RatHistoryList = ({ history, onSelect, onClear }: RatHistoryListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const filteredHistory = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return history;
    return history.filter(e =>
      e.fsa?.toLowerCase().includes(q) ||
      e.codigoLoja?.toLowerCase().includes(q) ||
      e.defeitoProblema?.toLowerCase().includes(q),
    );
  }, [history, searchTerm]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredHistory.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredHistory.map(e => e.id)));
    }
  };

  const handleBatchExport = async () => {
    const entries = history.filter(e => selected.has(e.id));
    if (entries.length === 0) return;

    setExporting(true);
    try {
      const JSZip = (await import("jszip")).default;
      const { generateRatPDF } = await import("../utils/ratPdfGenerator");
      const zip = new JSZip();

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        toast.loading(`Gerando PDF ${i + 1}/${entries.length}…`, { id: "batch-export" });
        try {
          const result = await generateRatPDF(entry.formData, { skipDownload: true });
          if (result.bytes) {
            const fsaNum = entry.fsa?.trim();
            const fileName = fsaNum ? `FSA-${fsaNum}.pdf` : `RAT-${entry.id}.pdf`;
            zip.file(fileName, result.bytes);
          }
        } catch {
          toast.warning(`Falha ao gerar RAT ${entry.fsa || entry.id}`);
        }
      }

      toast.loading("Compactando ZIP…", { id: "batch-export" });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RATs_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${entries.length} RAT(s) exportadas com sucesso!`, { id: "batch-export" });
      setSelected(new Set());
    } catch (e) {
      toast.error("Erro ao exportar RATs.", { id: "batch-export" });
    } finally {
      setExporting(false);
    }
  };

  const hasHistory = history.length > 0;
  const allSelected = filteredHistory.length > 0 && selected.size === filteredHistory.length;
  const someSelected = selected.size > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <History className="h-4 w-4" />
          Histórico de RATs
        </h3>
        <div className="flex items-center gap-2">
          {someSelected && (
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={handleBatchExport}
              disabled={exporting}
            >
              {exporting
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Exportando…</>
                : <><Download className="h-3.5 w-3.5" /> Exportar ZIP ({selected.size})</>}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClear}
            disabled={!hasHistory}
          >
            Limpar Histórico
          </Button>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="Pesquisar por FSA, loja ou problema…"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        disabled={!hasHistory}
        className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
      />

      {/* Select all row */}
      {filteredHistory.length > 1 && (
        <div className="flex items-center gap-2 px-1">
          <Checkbox
            id="select-all"
            checked={allSelected}
            onCheckedChange={toggleAll}
          />
          <label
            htmlFor="select-all"
            className="text-xs text-muted-foreground cursor-pointer select-none"
          >
            {allSelected ? "Desmarcar todos" : `Selecionar todos (${filteredHistory.length})`}
          </label>
        </div>
      )}

      {/* List */}
      {!hasHistory ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma RAT registrada ainda.</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border border-dashed border-border rounded-md">
          Nenhuma RAT encontrada para a busca informada.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredHistory.map(entry => (
            <div key={entry.id} className="flex items-start gap-2">
              <Checkbox
                checked={selected.has(entry.id)}
                onCheckedChange={() => toggleSelect(entry.id)}
                className="mt-3.5 shrink-0"
              />
              <Card
                className="flex-1 p-3 bg-secondary border-border cursor-pointer hover:bg-secondary/80 transition-colors sm:p-4"
                onClick={() => onSelect(entry)}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      {entry.fsa ? `FSA ${entry.fsa}` : "FSA não informado"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Loja {entry.codigoLoja || "N/D"}
                      {entry.pdv ? ` • PDV ${entry.pdv}` : ""}
                    </p>
                    {entry.defeitoProblema && (
                      <p className="text-xs text-muted-foreground">
                        {entry.defeitoProblema.length > 120
                          ? `${entry.defeitoProblema.slice(0, 117)}…`
                          : entry.defeitoProblema}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground sm:text-right shrink-0">
                    {new Date(entry.timestamp).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {someSelected && (
        <p className="text-xs text-muted-foreground text-center">
          <PackageOpen className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
          {selected.size} selecionada{selected.size !== 1 ? "s" : ""} — clique em "Exportar ZIP" para baixar os PDFs
        </p>
      )}
    </div>
  );
};
