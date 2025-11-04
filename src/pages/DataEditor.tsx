import { useMemo, useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileEdit, Save, RotateCcw, Copy } from "lucide-react";
import { toast } from "sonner";
import { loadEditableData, resetToDefaults, saveFlowToLocalStorage, saveProceduresToLocalStorage } from "@/utils/data-editor-utils";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const DataEditor = () => {
  const initialData = useMemo(() => loadEditableData(), []);

  const [proceduresText, setProceduresText] = useState(JSON.stringify(initialData.procedures, null, 2));
  const [flowText, setFlowText] = useState(JSON.stringify(initialData.flow, null, 2));
  const [activeTab, setActiveTab] = useState<"procedures" | "flow">("procedures");

  const handleSave = () => {
    let success = true;

    try {
      const parsedProcedures = JSON.parse(proceduresText);
      saveProceduresToLocalStorage(parsedProcedures);
    } catch (error) {
      toast.error("Erro ao salvar Procedimentos: Verifique a sintaxe JSON.");
      console.error("Erro no JSON de Procedimentos:", error);
      success = false;
    }

    try {
      const parsedFlow = JSON.parse(flowText);
      saveFlowToLocalStorage(parsedFlow);
    } catch (error) {
      toast.error("Erro ao salvar Checklist Flow: Verifique a sintaxe JSON.");
      console.error("Erro no JSON de Flow:", error);
      success = false;
    }

    if (success) {
      window.location.reload();
    }
  };

  const handleReset = () => {
    if (window.confirm("Tem certeza que deseja apagar os dados salvos no Local Storage e retornar aos valores mockados (hardcoded)?")) {
      const defaults = resetToDefaults();
      setProceduresText(JSON.stringify(defaults.procedures, null, 2));
      setFlowText(JSON.stringify(defaults.flow, null, 2));
      window.location.reload();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeTab === "procedures" ? proceduresText : flowText);
    toast.success(`Conteúdo da aba ${activeTab === "procedures" ? "Procedimentos" : "Checklist"} copiado para a área de transferência!`);
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-primary px-4 py-8 pt-24">
        <div className="max-w-7xl mx-auto space-y-8">
          <header className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-3 bg-secondary rounded-2xl shadow-glow">
                <FileEdit className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Editor de Dados (Desenvolvimento)</h1>
            <p className="text-muted-foreground">
              Edite a base de conhecimento e o fluxo de troubleshooting em JSON. <strong>Atenção à sintaxe JSON!</strong>
            </p>
          </header>

          <Card className="p-6 space-y-4 shadow-lg bg-card">
            <div className="flex space-x-2 border-b border-border">
              <Button
                variant={activeTab === "procedures" ? "default" : "ghost"}
                onClick={() => setActiveTab("procedures")}
                className={cn("py-2 h-auto text-sm", activeTab === "procedures" ? "" : "text-muted-foreground")}
              >
                Procedimentos (KB)
              </Button>
              <Button
                variant={activeTab === "flow" ? "default" : "ghost"}
                onClick={() => setActiveTab("flow")}
                className={cn("py-2 h-auto text-sm", activeTab === "flow" ? "" : "text-muted-foreground")}
              >
                Checklist Flow
              </Button>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex justify-end space-x-2">
                <Button onClick={handleCopy} variant="outline" size="sm">
                  <Copy className="mr-2 h-4 w-4" /> Copiar Tudo
                </Button>
                <Button onClick={handleReset} variant="destructive" size="sm">
                  <RotateCcw className="mr-2 h-4 w-4" /> Resetar para Default
                </Button>
              </div>

              <p className="text-xs text-destructive-foreground bg-destructive/10 p-3 rounded-md">
                <strong>Atenção:</strong> Mantenha as aspas e vírgulas corretamente no JSON para evitar erros. O campo "content" nos procedimentos suporta quebras de linha (\n) para formatação.
              </p>

              {activeTab === "procedures" ? (
                <Textarea
                  value={proceduresText}
                  onChange={(event) => setProceduresText(event.target.value)}
                  rows={25}
                  className="font-mono text-xs bg-background min-h-[500px]"
                />
              ) : (
                <Textarea
                  value={flowText}
                  onChange={(event) => setFlowText(event.target.value)}
                  rows={25}
                  className="font-mono text-xs bg-background min-h-[500px]"
                  placeholder="A estrutura do Flow é uma lista de objetos com 'id', 'question' e 'options'. Os 'targetId' devem corresponder a um 'id' existente."
                />
              )}

              <div className="flex justify-center">
                <Button onClick={handleSave} size="lg" className="gap-2">
                  <Save className="h-5 w-5" />
                  Salvar Edições no Local Storage
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
};

export default DataEditor;
