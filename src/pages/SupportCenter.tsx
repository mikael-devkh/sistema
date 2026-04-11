import { useMemo, useState } from "react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Badge } from "../components/ui/badge";
import { FileText, Layers, Search } from "lucide-react";
import { Procedure } from "../data/troubleshootingData";
import { loadEditableProcedures, resetToDefaults } from "../utils/data-editor-utils";
import { RatTemplatesBrowser } from "../components/RatTemplatesBrowser";
import { useIsMobile } from "../hooks/use-mobile";
import { cn } from "../lib/utils";
import { toast } from "sonner";

const renderProcedureContent = (content: string) =>
  content.split("\n").map((line, index) => {
    const key = `${index}-${line.slice(0, 12)}`;
    if (line.startsWith("## ")) {
      return (
        <h3 key={key} className="text-lg font-semibold text-primary mt-4 first:mt-0">
          {line.replace("## ", "")}
        </h3>
      );
    }
    if (line.startsWith("* ")) {
      return (
        <p key={key} className="pl-4 text-sm text-foreground/90">
          • {line.replace("* ", "").trim()}
        </p>
      );
    }
    if (/^\d+\./.test(line)) {
      return (
        <p key={key} className="pl-4 text-sm font-medium text-foreground/90">
          {line}
        </p>
      );
    }
    if (line.startsWith("**IMPORTANTE**")) {
      return (
        <p
          key={key}
          className="bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 rounded-md px-3 py-2 text-xs font-semibold text-yellow-800 dark:text-yellow-200"
        >
          {line.replace("**IMPORTANTE**:", "").trim()}
        </p>
      );
    }
    if (!line.trim()) {
      return <span key={key} className="block h-3" />;
    }
    return (
      <p key={key} className="text-sm text-foreground/90">
        {line}
      </p>
    );
  });

const SupportCenter = () => {
  const isMobile = useIsMobile();
  const [kbData, setKbData] = useState<Procedure[]>(() => loadEditableProcedures());
  const [searchTerm, setSearchTerm] = useState("");
  const [templatesResetSignal, setTemplatesResetSignal] = useState(0);
  const [activeDesktopTab, setActiveDesktopTab] = useState<"kb" | "templates">("kb");
  const [activeMobileTab, setActiveMobileTab] = useState<"kb" | "templates">("kb");

  const filteredProcedures = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return kbData;
    }

    return kbData.filter(
      (procedure) =>
        procedure.title.toLowerCase().includes(normalizedSearch) ||
        procedure.content.toLowerCase().includes(normalizedSearch) ||
        procedure.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch)),
    );
  }, [kbData, searchTerm]);

  const handleTemplatesReset = () => {
    const snapshot = resetToDefaults();
    setKbData(snapshot.procedures);
    setTemplatesResetSignal((signal) => signal + 1);
    toast.info("Biblioteca restaurada para os padrões iniciais.");
  };

  const proceduresPanel = (
    <Card className="p-4 sm:p-6 space-y-4 shadow-lg">
      <div className="space-y-2 text-center lg:text-left">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 justify-center lg:justify-start sm:text-xl">
          <FileText className="h-5 w-5 text-primary" />
          Base de Conhecimento (Offline)
        </h2>
        <p className="text-sm text-muted-foreground">
          Consulte procedimentos técnicos validados. Este conteúdo é somente leitura para os técnicos em campo.
        </p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por título, palavra-chave ou tag"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full pl-10"
        />
      </div>
      <p className={cn("text-xs text-muted-foreground", !filteredProcedures.length && "text-center")}> 
        {filteredProcedures.length
          ? `Encontrados ${filteredProcedures.length} procedimentos disponíveis.`
          : "Nenhum procedimento corresponde à pesquisa atual."}
      </p>
      <ScrollArea className="h-[520px] rounded-md border bg-background p-3 sm:p-4">
        {filteredProcedures.length ? (
          <Accordion type="single" collapsible className="space-y-3">
            {filteredProcedures.map((procedure) => (
              <AccordionItem key={procedure.id} value={procedure.id} className="border-border rounded-lg">
                <AccordionTrigger className="text-left">
                  <div className="flex flex-col gap-2 w-full text-left">
                    <span className="text-base font-semibold text-foreground">{procedure.title}</span>
                    <div className="flex flex-wrap gap-1">
                      {procedure.tags.slice(0, 6).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[11px] uppercase tracking-wide">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2 text-sm leading-relaxed text-foreground/90">
                  <div className="space-y-2">{renderProcedureContent(procedure.content)}</div>
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
  );

  const templatesPanel = (
    <RatTemplatesBrowser
      resetSignal={templatesResetSignal}
      onRequestGlobalReset={handleTemplatesReset}
    />
  );

  const renderTabsContent = () => {
    if (isMobile) {
      return (
        <Tabs
          value={activeMobileTab}
          onValueChange={(value) => setActiveMobileTab(value as "kb" | "templates")}
          className="space-y-4"
        >
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="kb">Base de Conhecimento</TabsTrigger>
            <TabsTrigger value="templates">Templates RAT</TabsTrigger>
          </TabsList>
          <TabsContent value="kb" className="space-y-4">
            {proceduresPanel}
          </TabsContent>
          <TabsContent value="templates" className="space-y-4">
            {templatesPanel}
          </TabsContent>
        </Tabs>
      );
    }

    return (
      <Tabs
        value={activeDesktopTab}
        onValueChange={(value) => setActiveDesktopTab(value as "kb" | "templates")}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="kb">Base de Conhecimento</TabsTrigger>
          <TabsTrigger value="templates">Templates RAT</TabsTrigger>
        </TabsList>
        <TabsContent value="kb" className="space-y-4">
          {proceduresPanel}
        </TabsContent>
        <TabsContent value="templates" className="space-y-4">
          {templatesPanel}
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-primary px-4 py-8 pt-24">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="p-3 bg-secondary rounded-2xl shadow-glow">
              <Layers className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Centro de Suporte e Biblioteca Técnica</h1>
          <p className="text-muted-foreground">
            Consulte a base de conhecimento validada em campo e, quando necessário, utilize os templates de RAT para acelerar o registro técnico.
          </p>
        </header>
        {renderTabsContent()}
      </div>
    </div>
  );
};

export default SupportCenter;
