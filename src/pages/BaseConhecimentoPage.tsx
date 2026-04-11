import { useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Badge } from "../components/ui/badge";
import { FileText, Search, Sparkles, Edit3, Plus, Trash2, RefreshCcw } from "lucide-react";
import { Procedure } from "../data/troubleshootingData";
import { loadEditableProcedures, saveProceduresToLocalStorage, resetToDefaults } from "../utils/data-editor-utils";
import { cn } from "../lib/utils";
import { ProcedureEditorDialog } from "../components/ProcedureEditorDialog";
import { RatTemplate } from "../data/ratTemplatesData";
import { loadEditableTemplates } from "../utils/data-editor-utils";
import { Skeleton } from "../components/ui/skeleton";
import { usePageLoading } from "../hooks/use-page-loading";
import { Button } from "../components/ui/button";
import { toast } from "sonner";

const renderProcedureContent = (content: string) =>
  content.split("\n").map((line, index) => {
    const key = `${index}-${line.slice(0, 12)}`;
    if (line.startsWith("## ")) {
      return (
        <h3 key={key} className="text-lg font-semibold text-primary mt-4 first:mt-0">{line.replace("## ", "")}</h3>
      );
    }
    if (line.startsWith("* ")) {
      return (
        <p key={key} className="pl-4 text-sm text-foreground/90">• {line.replace("* ", "").trim()}</p>
      );
    }
    if (/^\d+\./.test(line)) {
      return (
        <p key={key} className="pl-4 text-sm font-medium text-foreground/90">{line}</p>
      );
    }
    if (line.startsWith("**IMPORTANTE**")) {
      return (
        <p key={key} className="bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 rounded-md px-3 py-2 text-xs font-semibold text-yellow-800 dark:text-yellow-200">{line.replace("**IMPORTANTE**:", "").trim()}</p>
      );
    }
    if (!line.trim()) return <span key={key} className="block h-3" />;
    return (
      <p key={key} className="text-sm text-foreground/90">{line}</p>
    );
  });

export default function BaseConhecimentoPage() {
  const [kbData, setKbData] = useState<Procedure[]>(() => loadEditableProcedures());
  const [templates] = useState<RatTemplate[]>(() => loadEditableTemplates());
  const [searchTerm, setSearchTerm] = useState("");
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [votes, setVotes] = useState<Record<string, { up: number; down: number }>>(() => {
    try {
      const raw = localStorage.getItem("kb_votes");
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const filteredProcedures = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return kbData;
    return kbData.filter(
      (procedure) =>
        procedure.title.toLowerCase().includes(normalizedSearch) ||
        procedure.content.toLowerCase().includes(normalizedSearch) ||
        procedure.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch))
    );
  }, [kbData, searchTerm]);
  const loading = usePageLoading(500, [searchTerm, kbData]);

  const handleAddProcedure = () => {
    if (!editingEnabled) { toast.info("Ative o modo de edição para adicionar."); return; }
    const id = `kb-${Date.now()}`;
    const next: Procedure = { id, title: "Novo procedimento", tags: ["geral"], content: "## Novo\n\nDescreva o procedimento aqui." };
    setKbData(prev => {
      const data = [next, ...prev];
      saveProceduresToLocalStorage(data);
      return data;
    });
    toast.success("Procedimento criado.");
  };

  const handleRename = (proc: Procedure) => {
    if (!editingEnabled) { toast.info("Ative o modo de edição para renomear."); return; }
    const name = typeof window !== "undefined" ? window.prompt("Novo título", proc.title) : null;
    if (!name) return;
    setKbData(prev => {
      const data = prev.map(p => p.id === proc.id ? { ...p, title: name } : p);
      saveProceduresToLocalStorage(data);
      return data;
    });
  };

  const handleDelete = (proc: Procedure) => {
    if (!editingEnabled) { toast.info("Ative o modo de edição para excluir."); return; }
    if (typeof window !== "undefined" && !window.confirm(`Remover "${proc.title}"?`)) return;
    setKbData(prev => {
      const data = prev.filter(p => p.id !== proc.id);
      saveProceduresToLocalStorage(data);
      return data;
    });
    toast.success("Procedimento removido.");
  };

  const handleReset = () => {
    if (typeof window !== "undefined" && !window.confirm("Restaurar a base de conhecimento para o padrão?")) return;
    const snap = resetToDefaults();
    setKbData(snap.procedures);
    toast.success("Base restaurada para os padrões.");
  };
  return (
    <div className="max-w-4xl mx-auto space-y-8 pt-4 pb-10">
      <div className="rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center gap-4 p-4 mb-2">
        <Sparkles className="w-7 h-7" />
        <div>
          <div className="font-bold text-base">Bem-vindo à Base de Conhecimento!</div>
          <div className="text-sm text-primary/90">Procure passo-a-passos e dicas validadas pelo time técnico WT. Pesquise por nome, sintoma, equipamento ou código.</div>
        </div>
      </div>
      <Card className="p-4 sm:p-6 space-y-4 shadow-lg">
        <div className="space-y-2 text-center lg:text-left">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2 justify-center lg:justify-start sm:text-xl">
            <FileText className="h-5 w-5 text-primary" /> Base de Conhecimento Técnico
          </h2>
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por título, palavra-chave ou tag"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={editingEnabled} onChange={e => setEditingEnabled(e.target.checked)} />
              Modo de edição
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleAddProcedure}><Plus className="h-4 w-4" />Adicionar</Button>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={handleReset}><RefreshCcw className="h-4 w-4" />Restaurar padrões</Button>
          </div>
        </div>
        <p className={cn("text-xs text-muted-foreground", !filteredProcedures.length && "text-center")}> 
          {filteredProcedures.length
            ? `Encontrados ${filteredProcedures.length} procedimentos disponíveis.`
            : "Nenhum procedimento corresponde à pesquisa atual."}
        </p>
        <ScrollArea className="h-[500px] rounded-md border bg-background p-3 sm:p-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-5 w-64 mb-2" />
                  <Skeleton className="h-4 w-48 mb-4" />
                  <Skeleton className="h-20 w-full" />
                </Card>
              ))}
            </div>
          ) : filteredProcedures.length ? (
            <Accordion type="single" collapsible className="space-y-3">
              {filteredProcedures.map((procedure) => (
                <AccordionItem key={procedure.id} value={procedure.id} className="border-border rounded-lg">
                  <AccordionTrigger className="text-left">
                    <div className="flex flex-col gap-2 w-full text-left">
                      <span className="text-base font-semibold text-foreground flex items-center gap-2">
                        {procedure.title}
                        {editingEnabled && (
                          <>
                            <button type="button" className="text-xs text-primary hover:underline inline-flex items-center gap-1" onClick={(e) => { e.stopPropagation(); handleRename(procedure); }}><Edit3 className="h-3.5 w-3.5" />Renomear</button>
                            <button type="button" className="text-xs text-destructive hover:underline inline-flex items-center gap-1" onClick={(e) => { e.stopPropagation(); handleDelete(procedure); }}><Trash2 className="h-3.5 w-3.5" />Excluir</button>
                          </>
                        )}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {procedure.tags.slice(0, 6).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[11px] uppercase tracking-wide">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2 text-sm leading-relaxed text-foreground/90">
                    <div className="space-y-2">{renderProcedureContent(procedure.content)}</div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground">
                        {(() => {
                          const related = templates.filter(t => procedure.tags.some(tag => t.title.toLowerCase().includes(tag) || t.defeito.toLowerCase().includes(tag) || t.diagnostico.toLowerCase().includes(tag) || t.solucao.toLowerCase().includes(tag)) ).slice(0, 3);
                          if (!related.length) return null;
                          return (
                            <span>Relacionados: {related.map(r => r.title).join(" • ")}</span>
                          );
                        })()}
                      </div>
                      {editingEnabled && (
                        <ProcedureEditorDialog
                          procedure={procedure}
                          onSave={(updated) => {
                            setKbData(prev => {
                              const next = prev.map(p => p.id === updated.id ? updated : p);
                              saveProceduresToLocalStorage(next);
                              return next;
                            });
                            toast.success("Conteúdo atualizado.");
                          }}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <Button type="button" variant="outline" size="sm" onClick={() => {
                        setVotes(prev => {
                          const next = { ...prev, [procedure.id]: { up: (prev[procedure.id]?.up || 0) + 1, down: prev[procedure.id]?.down || 0 } };
                          localStorage.setItem("kb_votes", JSON.stringify(next));
                          return next;
                        });
                      }}>Útil ({votes[procedure.id]?.up || 0})</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => {
                        setVotes(prev => {
                          const next = { ...prev, [procedure.id]: { up: prev[procedure.id]?.up || 0, down: (prev[procedure.id]?.down || 0) + 1 } };
                          localStorage.setItem("kb_votes", JSON.stringify(next));
                          return next;
                        });
                      }}>Não útil ({votes[procedure.id]?.down || 0})</Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center">
              Ajuste os filtros para visualizar os procedimentos.
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
}
