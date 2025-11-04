import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Clock } from "lucide-react";
import { IPConfig } from "../utils/ipCalculator";

export interface HistoryItem extends IPConfig {
  tipo: string;
  numeroPDV?: string;
  timestamp: number;
  fsa?: string;
}

interface HistoryListProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

export const HistoryList = ({ history, onSelect, onClear }: HistoryListProps) => {
  const hasHistory = history.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Consultas Recentes
        </h3>
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

      {!hasHistory ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma consulta recente</p>
        </div>
      ) : (
        history.map((item, index) => (
          <Card
            key={`${item.timestamp}-${index}`}
            onClick={() => onSelect(item)}
            className="p-3 bg-secondary border-border cursor-pointer hover:bg-secondary/80 transition-colors sm:p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {item.nomeLoja} - {item.tipo} {item.numeroPDV ? `#${item.numeroPDV}` : ""}
                </p>
                <p className="text-sm text-primary">{item.ip}</p>
              </div>
              <p className="text-xs text-muted-foreground sm:text-right">
                {new Date(item.timestamp).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};
