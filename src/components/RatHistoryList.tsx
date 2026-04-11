import { useMemo, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { FileText, History } from "lucide-react";
import { RatFormData } from "../types/rat";

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

  const filteredHistory = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) {
      return history;
    }

    return history.filter((entry) => entry.fsa?.toLowerCase().includes(normalized));
  }, [history, searchTerm]);

  const hasHistory = history.length > 0;
  const hasFilteredResults = filteredHistory.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <History className="h-4 w-4" />
          Histórico de RATs
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={onClear}
          disabled={!hasHistory}
        >
          Limpar Histórico
        </Button>
      </div>

      <Input
        placeholder="Pesquisar por FSA"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        disabled={!hasHistory}
        className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
      />

      {!hasHistory ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma RAT registrada ainda.</p>
        </div>
      ) : hasFilteredResults ? (
        filteredHistory.map((entry) => (
          <Card
            key={entry.id}
            className="p-3 bg-secondary border-border cursor-pointer hover:bg-secondary/80 transition-colors sm:p-4"
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
                      ? `${entry.defeitoProblema.slice(0, 117)}...`
                      : entry.defeitoProblema}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground sm:text-right">
                {new Date(entry.timestamp).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </Card>
        ))
      ) : (
        <div className="text-center py-6 text-muted-foreground border border-dashed border-border rounded-md">
          Nenhuma RAT encontrada para o FSA informado.
        </div>
      )}
    </div>
  );
};
