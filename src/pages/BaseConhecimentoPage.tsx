import { useMemo, useRef, useState } from "react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Badge } from "../components/ui/badge";
import { BookOpen, Search, Edit3, Plus, Trash2, RefreshCcw, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { ProcedureEditorDialog } from "../components/ProcedureEditorDialog";
import { useKnowledgeBase, type ProcedureWithVotes } from "../hooks/use-knowledge-base";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
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
  const { procedures, loading, addProcedure, updateProcedure, deleteProcedure, voteProcedure, resetToDefaults } = useKnowledgeBase();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renamingProc = useRef<ProcedureWithVotes | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const filteredProcedures = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return procedures;
    return procedures.filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q)),
    );
  }, [procedures, searchTerm]);

  const handleAddProcedure = async () => {
    if (!editingEnabled) { toast.info("Ative o modo de edição para adicionar."); return; }
    await addProcedure({
      title: "Novo procedimento",
      tags: ["geral"],
      content: "## Novo\n\nDescreva o procedimento aqui.",
    });
    toast.success("Procedimento criado.");
  };

  const handleRename = (proc: ProcedureWithVotes) => {
    if (!editingEnabled) { toast.info("Ative o modo de edição para renomear."); return; }
    renamingProc.current = proc;
    setRenameValue(proc.title);
    setRenameOpen(true);
    setTimeout(() => renameInputRef.current?.select(), 50);
  };

  const handleRenameConfirm = async () => {
    const proc = renamingProc.current;
    if (!proc || !renameValue.trim()) return;
    setRenameOpen(false);
    await updateProcedure({ ...proc, title: renameValue.trim() });
  };

  const handleDelete = async (proc: ProcedureWithVotes) => {
    if (!editingEnabled) { toast.info("Ative o modo de edição para excluir."); return; }
    if (!window.confirm(`Remover "${proc.title}"?`)) return;
    await deleteProcedure(proc.id);
    toast.success("Procedimento removido.");
  };

  const handleReset = async () => {
    if (!window.confirm("Restaurar a base de conhecimento para o padrão?")) return;
    await resetToDefaults();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-page-in">
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear procedimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <Label htmlFor="rename-input">Novo título</Label>
            <Input
              id="rename-input"
              ref={renameInputRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRenameConfirm()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancelar</Button>
            <Button onClick={handleRenameConfirm} disabled={!renameValue.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Header */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Base de Conhecimento</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Passo-a-passos e dicas validadas pelo time técnico WT. Pesquise por nome, sintoma ou equipamento.
            </p>
          </div>
        </div>
      </div>

      <Card className="p-4 sm:p-6 space-y-4">
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
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={editingEnabled} onChange={e => setEditingEnabled(e.target.checked)} />
            Modo de edição
          </label>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleAddProcedure}>
              <Plus className="h-4 w-4" />Adicionar
            </Button>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={handleReset}>
              <RefreshCcw className="h-4 w-4" />Restaurar padrões
            </Button>
          </div>
        </div>
        <p className={cn("text-xs text-muted-foreground", !filteredProcedures.length && "text-center")}>
          {loading
            ? "Carregando…"
            : filteredProcedures.length
              ? `Encontrados ${filteredProcedures.length} procedimentos disponíveis.`
              : "Nenhum procedimento corresponde à pesquisa atual."}
        </p>
        <ScrollArea className="h-[500px] rounded-md border bg-background p-3 sm:p-4">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <div className="space-y-3 w-full">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-5 w-64 mb-2" />
                    <Skeleton className="h-4 w-48 mb-4" />
                    <Skeleton className="h-20 w-full" />
                  </Card>
                ))}
              </div>
            </div>
          ) : filteredProcedures.length ? (
            <Accordion type="single" collapsible className="space-y-3">
              {filteredProcedures.map(procedure => (
                <AccordionItem key={procedure.id} value={procedure.id} className="border-border rounded-lg">
                  <AccordionTrigger className="text-left">
                    <div className="flex flex-col gap-2 w-full text-left">
                      <span className="text-base font-semibold text-foreground flex items-center gap-2">
                        {procedure.title}
                        {editingEnabled && (
                          <>
                            <button
                              type="button"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                              onClick={e => { e.stopPropagation(); handleRename(procedure); }}
                            >
                              <Edit3 className="h-3.5 w-3.5" />Renomear
                            </button>
                            <button
                              type="button"
                              className="text-xs text-destructive hover:underline inline-flex items-center gap-1"
                              onClick={e => { e.stopPropagation(); handleDelete(procedure); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />Excluir
                            </button>
                          </>
                        )}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {procedure.tags.slice(0, 6).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[11px] uppercase tracking-wide">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2 text-sm leading-relaxed text-foreground/90">
                    <div className="space-y-2">{renderProcedureContent(procedure.content)}</div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground" />
                      {editingEnabled && (
                        <ProcedureEditorDialog
                          procedure={procedure}
                          onSave={updated => {
                            updateProcedure({ ...procedure, ...updated });
                            toast.success("Conteúdo atualizado.");
                          }}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => voteProcedure(procedure.id, 'up')}
                      >
                        Útil ({procedure.votes?.up ?? 0})
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => voteProcedure(procedure.id, 'down')}
                      >
                        Não útil ({procedure.votes?.down ?? 0})
                      </Button>
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
