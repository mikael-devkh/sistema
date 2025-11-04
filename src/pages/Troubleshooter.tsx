import { useState, useMemo, useCallback } from "react";
import { Navigation } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  HelpCircle,
  Search,
  Zap,
  ChevronLeft,
  Trash2,
  RotateCcw,
} from "lucide-react";
import {
  Procedure,
  ChecklistStep,
  getProcedures,
  getTroubleshootingFlow,
  mockProcedures,
  mockTroubleshootingFlow,
} from "@/data/troubleshootingData";
import { GuidedChecklist } from "@/components/GuidedChecklist";
import { cn } from "@/lib/utils";
import { EditableText } from "@/components/EditableText";
import { ProcedureEditorDialog } from "@/components/ProcedureEditorDialog";
import {
  saveProceduresToLocalStorage,
  saveFlowToLocalStorage,
  resetToDefaults,
} from "@/utils/data-editor-utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";

const EditableProcedureCard = ({
  procedure,
  onSelect,
  onUpdate,
  onDelete,
}: {
  procedure: Procedure;
  onSelect: (p: Procedure) => void;
  onUpdate: (updated: Procedure) => void;
  onDelete: (id: string) => void;
}) => {
  const handleTitleSave = useCallback(
    (newTitle: string) => {
      onUpdate({ ...procedure, title: newTitle });
    },
    [procedure, onUpdate]
  );

  const handleTagsSave = useCallback(
    (newTags: string) => {
      const tagsArray = newTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      onUpdate({ ...procedure, tags: tagsArray });
    },
    [procedure, onUpdate]
  );

  return (
    <Card className="p-4 bg-background/50 border-border shadow-md transition-colors space-y-2 group">
      <div className="flex justify-between items-start">
        <div className="flex-1 space-y-1">
          <EditableText
            initialValue={procedure.title}
            onSave={handleTitleSave}
            className="text-lg font-semibold text-foreground cursor-text"
            placeholder="Título do Procedimento"
          />
          <EditableText
            initialValue={procedure.tags.join(", ")}
            onSave={handleTagsSave}
            className="text-xs text-muted-foreground italic cursor-text"
            placeholder="Tags (separadas por vírgula)"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(procedure.id)}
          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remover Procedimento"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex justify-between items-end pt-2 border-t border-dashed border-border/70">
        <Button variant="link" size="sm" onClick={() => onSelect(procedure)} className="p-0 h-auto">
          Visualizar Detalhes
        </Button>
        <ProcedureEditorDialog procedure={procedure} onSave={onUpdate} />
      </div>
    </Card>
  );
};

const ChecklistStepEditor = ({
  step,
  onUpdate,
}: {
  step: ChecklistStep;
  onUpdate: (updated: ChecklistStep) => void;
}) => {
  const handleQuestionSave = (newQuestion: string) => {
    onUpdate({ ...step, question: newQuestion });
  };

  const handleOptionSave = (index: number, newValue: string, isTargetId: boolean) => {
    const options = [...(step.options || [])];
    const option = options[index];
    if (!option) return;

    options[index] = {
      ...option,
      ...(isTargetId ? { targetId: newValue } : { label: newValue }),
    };

    onUpdate({ ...step, options });
  };

  const handleResolutionSave = (newResolution: string) => {
    onUpdate({ ...step, resolution: newResolution });
  };

  return (
    <Card className={cn("p-4 bg-secondary/50 border-primary shadow-sm space-y-3", step.isFinal && "border-destructive")}> 
      <div className="flex items-center justify-between">
        <span className="text-base font-bold">
          {step.isFinal ? "RESOLUÇÃO FINAL" : `Passo ID: ${step.id}`}
        </span>
        {step.isFinal && <Zap className="h-4 w-4 text-destructive" />}
      </div>
      <Separator />
      {step.isFinal ? (
        <div className="space-y-2">
          <Label className="text-foreground">Texto de Resolução (RAT)</Label>
          <EditableText
            initialValue={step.resolution || ""}
            onSave={handleResolutionSave}
            isTextarea
            placeholder="Ex: Problema Resolvido: Falha de Cabo. Anotar: Troca de Cabo VGA..."
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-foreground">Pergunta do Passo</Label>
          <EditableText
            initialValue={step.question}
            onSave={handleQuestionSave}
            isTextarea
            placeholder="Ex: A CPU está ligando e o LED está aceso?"
          />
          <Label className="text-foreground pt-4 block">Opções/Caminhos</Label>
          <div className="space-y-2">
            {step.options?.map((option, index) => (
              <Card key={index} className="p-3 bg-background border-dashed space-y-1">
                <Label className="text-xs text-muted-foreground">Label da Opção</Label>
                <EditableText
                  initialValue={option.label}
                  onSave={(value) => handleOptionSave(index, value, false)}
                  className="text-sm"
                  placeholder={`Opção ${index + 1}`}
                />
                <Label className="text-xs text-muted-foreground pt-2 block">ID do Próximo Passo</Label>
                <EditableText
                  initialValue={option.targetId}
                  onSave={(value) => handleOptionSave(index, value, true)}
                  className="text-sm font-mono bg-accent/20"
                  placeholder="ID do passo (ex: step_cpu_2 ou final_success_1)"
                />
              </Card>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

const Troubleshooter = () => {
  const isMobile = useIsMobile();
  const [kbData, setKbData] = useState<Procedure[]>(getProcedures);
  const [flowData, setFlowData] = useState<ChecklistStep[]>(getTroubleshootingFlow);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [activeTab, setActiveTab] = useState<"kb" | "flow">("kb");
  const [activeMobileTab, setActiveMobileTab] = useState<"checklist" | "procedures">("checklist");

  const filteredProcedures = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return kbData;
    }

    return kbData.filter(
      (procedure) =>
        procedure.title.toLowerCase().includes(normalizedSearch) ||
        procedure.content.toLowerCase().includes(normalizedSearch) ||
        procedure.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch))
    );
  }, [searchTerm, kbData]);

  const handleProcedureUpdate = useCallback(
    (updated: Procedure) => {
      setKbData((prev) => {
        const index = prev.findIndex((proc) => proc.id === updated.id);
        if (index === -1) return prev;
        const next = [...prev];
        next[index] = updated;
        saveProceduresToLocalStorage(next);
        if (selectedProcedure && selectedProcedure.id === updated.id) {
          setSelectedProcedure(updated);
        }
        toast.success("Procedimento atualizado.");
        return next;
      });
    },
    [selectedProcedure]
  );

  const handleDeleteProcedure = useCallback(
    (id: string) => {
      if (!window.confirm("Tem certeza que deseja remover este procedimento?")) {
        return;
      }
      setKbData((prev) => {
        const next = prev.filter((proc) => proc.id !== id);
        saveProceduresToLocalStorage(next);
        if (selectedProcedure && selectedProcedure.id === id) {
          setSelectedProcedure(null);
        }
        toast.success("Procedimento removido da base.");
        return next;
      });
    },
    [selectedProcedure]
  );

  const handleAddNewProcedure = () => {
    const newProc: Procedure = {
      id: `new-proc-${Date.now()}`,
      title: "Novo Procedimento (Clique para editar)",
      tags: ["novo", "rascunho"],
      content:
        "## Novo Conteúdo\n\n1. Primeiro passo.\n2. Segundo passo. \n\n**IMPORTANTE**: Preencha o corpo do procedimento com detalhes úteis.",
    };

    setKbData((prev) => {
      const next = [newProc, ...prev];
      saveProceduresToLocalStorage(next);
      toast.success("Novo procedimento criado! Edite os detalhes.");
      return next;
    });
  };

  const handleFlowStepUpdate = useCallback((updated: ChecklistStep) => {
    setFlowData((prev) => {
      const index = prev.findIndex((step) => step.id === updated.id);
      if (index === -1) return prev;
      const next = [...prev];
      next[index] = updated;
      saveFlowToLocalStorage(next);
      toast.success(`Passo ${updated.id} atualizado.`);
      return next;
    });
  }, []);

  const handleResetData = () => {
    if (
      !window.confirm(
        "ATENÇÃO! Tem certeza que deseja APAGAR as alterações salvas no navegador e retornar aos dados originais (mockados)?"
      )
    ) {
      return;
    }

    resetToDefaults();
    setKbData(mockProcedures);
    setFlowData(mockTroubleshootingFlow);
    setSelectedProcedure(null);
    toast.info("Base de conhecimento e Checklist resetados para o padrão inicial.");
  };

  const renderContent = (content: string) => {
    return content.split("\n").map((line, index) => {
      const key = `${selectedProcedure?.id}-${index}`;
      if (line.startsWith("## "))
        return (
          <h2 key={key} className="text-xl font-bold mt-4 mb-2 text-primary">
            {line.replace("## ", "")}
          </h2>
        );
      if (line.startsWith("* "))
        return (
          <li key={key} className="pl-4 ml-4 list-disc text-foreground/90">
            {line.replace("* ", "").trim()}
          </li>
        );
      if (/^\d+\./.test(line))
        return (
          <p key={key} className="pl-4 font-semibold text-foreground/90">
            {line}
          </p>
        );
      if (line.startsWith("**IMPORTANTE**:"))
        return (
          <p
            key={key}
            className="bg-yellow-100 dark:bg-yellow-900/50 p-3 rounded-md border border-yellow-300 dark:border-yellow-700 text-sm font-medium text-yellow-800 dark:text-yellow-200 mt-2"
          >
            {line.replace("**IMPORTANTE**:", "").trim()}
          </p>
        );
      return (
        <p key={key} className="text-sm text-foreground/90">
          {line}
        </p>
      );
    });
  };

  const checklistSection = (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-primary" />
        Checklist de Troubleshooting
      </h2>
      <GuidedChecklist flowData={flowData} />
    </div>
  );

  const proceduresSection = (
    <Card className="lg:col-span-2 p-6 space-y-4 shadow-lg">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Base de Conhecimento (Offline)
        </h2>
        <div className="flex space-x-2">
          <Button onClick={handleResetData} variant="destructive" size="sm" className="gap-2">
            <RotateCcw className="h-4 w-4" /> Resetar Edições
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "kb" | "flow")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="kb">Base de Conhecimento (KB)</TabsTrigger>
          <TabsTrigger value="flow">Editor de Fluxo</TabsTrigger>
        </TabsList>

        <TabsContent value="kb" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar ou clique para editar o título e tags"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setSelectedProcedure(null);
                }}
                className="w-full pl-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button
              onClick={handleAddNewProcedure}
              variant="secondary"
              size="sm"
              className="gap-2 shrink-0"
            >
              + Novo Proc.
            </Button>
          </div>

          {selectedProcedure ? (
            <ScrollArea className="h-[500px] rounded-md border p-4 bg-background">
              <div className="space-y-4">
                <div className="flex items-start justify-between border-b pb-3">
                  <h3 className="text-2xl font-bold text-primary">{selectedProcedure.title}</h3>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedProcedure(null)}
                    className="shrink-0 gap-1.5"
                  >
                    <ChevronLeft className="h-4 w-4" /> Voltar
                  </Button>
                </div>
                <h4 className="text-lg font-semibold text-foreground">Conteúdo Detalhado (Leia/Edite)</h4>
                <div className="prose dark:prose-invert max-w-none space-y-2 text-foreground">
                  {renderContent(selectedProcedure.content)}
                </div>
                <div className="flex justify-end pt-4">
                  <ProcedureEditorDialog procedure={selectedProcedure} onSave={handleProcedureUpdate} />
                </div>
              </div>
            </ScrollArea>
          ) : (
            <>
              <p
                className={cn(
                  "text-sm text-muted-foreground",
                  !filteredProcedures.length && "text-center"
                )}
              >
                {filteredProcedures.length > 0
                  ? `Encontrados ${filteredProcedures.length} procedimentos (clique no título ou tags para editar):`
                  : "Nenhum procedimento encontrado. Use o botão '+ Novo Proc.' para adicionar."}
              </p>
              <ScrollArea className="h-[500px] rounded-md border p-4 bg-background">
                <div className="space-y-3">
                  {filteredProcedures.map((procedure) => (
                    <EditableProcedureCard
                      key={procedure.id}
                      procedure={procedure}
                      onSelect={setSelectedProcedure}
                      onUpdate={handleProcedureUpdate}
                      onDelete={handleDeleteProcedure}
                    />
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </TabsContent>

        <TabsContent value="flow" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Edite as perguntas, opções e resoluções de cada passo do fluxo de troubleshooting. O ID de cada passo é
            crucial para a navegação do checklist.
          </p>
          <ScrollArea className="h-[500px] rounded-md border p-4 bg-background">
            <div className="space-y-4">
              {flowData.map((step) => (
                <ChecklistStepEditor key={step.id} step={step} onUpdate={handleFlowStepUpdate} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Card>
  );

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-primary px-4 py-8 pt-24">
        <div className="max-w-7xl mx-auto space-y-8">
          <header className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-3 bg-secondary rounded-2xl shadow-glow">
                <Zap className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Diagnóstico Rápido e Procedimentos</h1>
            <p className="text-muted-foreground">
              Utilize o checklist guiado ou pesquise procedimentos técnicos offline.
            </p>
          </header>

          {isMobile ? (
            <Tabs
              value={activeMobileTab}
              onValueChange={(value) => setActiveMobileTab(value as "checklist" | "procedures")}
              className="space-y-4"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="checklist">Checklist</TabsTrigger>
                <TabsTrigger value="procedures">Procedimentos</TabsTrigger>
              </TabsList>
              <TabsContent value="checklist">{checklistSection}</TabsContent>
              <TabsContent value="procedures">{proceduresSection}</TabsContent>
            </Tabs>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-1">{checklistSection}</div>
              {proceduresSection}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Troubleshooter;
