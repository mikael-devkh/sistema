import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle, RotateCcw, XCircle, ChevronLeft } from "lucide-react";
import { ChecklistStep } from "@/data/troubleshootingData";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface GuidedChecklistProps {
  flowData: ChecklistStep[];
}

const findStep = (id: string, data: ChecklistStep[]) => data.find((step) => step.id === id);

export const GuidedChecklist = ({ flowData }: GuidedChecklistProps) => {
  const [currentStepId, setCurrentStepId] = useState("start");
  const [history, setHistory] = useState<string[]>([]);
  const currentStep = findStep(currentStepId, flowData);
  const isFinalStep = currentStep?.isFinal;

  const handleNextStep = (targetId: string) => {
    setHistory((prev) => [...prev, currentStepId]);
    setCurrentStepId(targetId);
  };

  const handleGoBack = () => {
    if (history.length > 0) {
      const prevStepId = history[history.length - 1];
      setHistory((prev) => prev.slice(0, -1));
      setCurrentStepId(prevStepId);
    }
  };

  const handleRestart = () => {
    setCurrentStepId("start");
    setHistory([]);
  };

  if (!currentStep) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Erro no Fluxo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            O passo atual não foi encontrado. Por favor, reinicie o checklist.
          </p>
          <Button onClick={handleRestart} className="mt-4">
            <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const Icon = isFinalStep
    ? currentStep.resolution?.includes("Resolvido")
      ? CheckCircle
      : XCircle
    : ArrowRight;

  const getAlertColor = () => {
    if (currentStep.resolution?.includes("Resolvido")) return "text-primary border-primary/50";
    if (currentStep.resolution?.includes("Troca")) return "text-destructive border-destructive/50";
    if (
      currentStep.resolution?.includes("Nível 2") ||
      currentStep.resolution?.includes("Delfia")
    )
      return "text-yellow-600 border-yellow-600/50 dark:text-yellow-400 dark:border-yellow-400/50";
    return "";
  };

  return (
    <Card
      className={cn("bg-secondary/50 border-primary shadow-lg", isFinalStep && "shadow-none border-dashed")}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Icon className={cn("h-5 w-5", getAlertColor())} />
          {isFinalStep ? "Resultado do Diagnóstico" : `Passo ${history.length + 1}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isFinalStep ? (
          <Alert className={getAlertColor()}>
            <AlertTitle className="text-base font-bold">
              {currentStep.resolution?.split("**")[0]?.replace(":", "")}
            </AlertTitle>
            <AlertDescription className="text-sm font-medium whitespace-pre-wrap">
              {currentStep.resolution?.split("**")[1]?.replace("Anotar:", "").trim() || currentStep.resolution}
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <p className="text-lg font-medium text-foreground">{currentStep.question}</p>
            <div className="grid gap-2">
              {currentStep.options?.map((option, index) => (
                <Button
                  key={index}
                  variant={option.isResolution ? "default" : "outline"}
                  onClick={() => handleNextStep(option.targetId)}
                  className="justify-start h-auto py-3 whitespace-normal shadow-sm"
                >
                  <ArrowRight className="mr-2 h-4 w-4 shrink-0" />
                  {option.label}
                </Button>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-between pt-2">
          <Button onClick={handleGoBack} disabled={history.length === 0 || isFinalStep} variant="ghost" size="sm">
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
          <Button onClick={handleRestart} variant="outline" size="sm">
            <RotateCcw className="mr-1 h-4 w-4" /> Reiniciar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
