import { useState, useEffect } from "react";
import { SearchForm } from "../components/SearchForm";
import { ResultCard } from "../components/ResultCard";
import { HistoryList, HistoryItem } from "../components/HistoryList";
import { Network, History, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { calcularIP, IPConfig } from "../utils/ipCalculator";
import { getStoreData } from "../data/storesData";
import { cn } from "../lib/utils";

interface ResultData extends IPConfig {
  tipo: string;
  numeroPDV?: string;
  lojaNum?: string;
}

const GeradorIPPage = () => {
  const [result, setResult] = useState<ResultData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("searchHistory");
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSearch = (lojaDigitada: string, tipo: string, numeroPDV?: string) => {
    try {
      const lojaFormatada = String(parseInt(lojaDigitada.replace(/^0+/, ""), 10));
      const lojaEncontrada = getStoreData(lojaFormatada);

      if (!lojaEncontrada) {
        toast.error("Loja não encontrada. Verifique o código e tente novamente.");
        setResult(null);
        return;
      }

      const ipBase = tipo === "PDV" ? lojaEncontrada.ipPDV : lojaEncontrada.ipDesktop;
      const config = calcularIP(ipBase, tipo, numeroPDV);
      const resultData: ResultData = { ...config, nomeLoja: lojaEncontrada.nomeLoja, tipo, numeroPDV, lojaNum: lojaFormatada };
      setResult(resultData);

      const newHistory = [{ ...resultData, timestamp: Date.now() }, ...history.slice(0, 9)];
      setHistory(newHistory);
      try { localStorage.setItem("searchHistory", JSON.stringify(newHistory)); } catch {}
      toast.success("Configuração de IP gerada com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar IP.");
      setResult(null);
    }
  };

  const handleHistorySelect = (item: HistoryItem) => setResult(item);

  const handleHistoryClear = () => {
    setHistory([]);
    try { localStorage.removeItem("searchHistory"); } catch {}
    toast.info("Histórico limpo.");
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-10 animate-page-in">

      {/* ── Cabeçalho ── */}
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-500/50 via-primary to-cyan-500/30" />
        <div className="flex items-center gap-4 p-5">
          <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
            <Network className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Gerador de IP</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure IPs para PDVs, impressoras e desktops
            </p>
          </div>
        </div>
      </div>

      {/* ── Formulário de busca ── */}
      <div className="rounded-xl border border-border bg-card shadow-card p-5 space-y-1">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Consultar loja</h2>
        </div>
        <SearchForm onSearch={handleSearch} />
      </div>

      {/* ── Resultado ── */}
      {result && (
        <div className={cn("transition-all", result ? "animate-slide-up" : "")}>
          <ResultCard
            nomeLoja={result.nomeLoja}
            lojaNum={result.lojaNum}
            tipo={result.tipo}
            numeroPDV={result.numeroPDV}
            ip={result.ip}
            mascara={result.mascara}
            gateway={result.gateway}
            broadcast={result.broadcast}
            dns1={result.dns1}
            dns2={result.dns2}
          />
        </div>
      )}

      {/* ── Histórico ── */}
      {history.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Histórico recente</h2>
          </div>
          <HistoryList
            history={history}
            onSelect={handleHistorySelect}
            onClear={handleHistoryClear}
          />
        </div>
      )}
    </div>
  );
};

export default GeradorIPPage;
