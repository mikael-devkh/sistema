import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { AssetType, RatTemplate, TemplateStatus } from "../data/ratTemplatesData";
import { EditableText } from "./EditableText";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { useRatAutofill } from "../context/RatAutofillContext";
import { Layers, Plus, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { useIsMobile } from "../hooks/use-mobile";
import { Switch } from "./ui/switch";
import { Skeleton } from "./ui/skeleton";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { ratTemplates } from "../data/ratTemplatesData";

const assetLabels: Record<AssetType, string> = {
  CPU: "CPU",
  MONITOR: "Monitor",
  IMPRESSORA_PDV: "Impressora PDV",
  IMPRESSORA_ETIQUETA: "Impressora Etiqueta",
  TECLADO: "Teclado",
  GAVETA: "Gaveta",
  THIN_CLIENT: "Thin Client",
  SISTEMA: "Sistema",
};

const statusLabels: Record<TemplateStatus, string> = {
  OPERACIONAL: "Operacional",
  TROCA_PECA: "Necessário trocar peça",
  TROCA_COMPLETA: "Necessário trocar ativo completo",
  REPARO_LIMPEZA: "Reparo/Limpeza",
  CONFIG_REDE: "Configuração de Rede",
  REPARO_SOFTWARE: "Reparo de Software",
  FALHA_PERSISTENTE: "Falha persistente / Escalar",
};

const isAssetType = (value: unknown): value is AssetType =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(assetLabels, value);

const isTemplateStatus = (value: unknown): value is TemplateStatus =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(statusLabels, value);

interface RatTemplatesBrowserProps {
  resetSignal?: number;
  onRequestGlobalReset?: () => void;
}

interface TemplateEditorCardProps {
  template: RatTemplate;
  isActive: boolean;
  onSelect: (id: string) => void;
  onUpdate: (template: RatTemplate) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  editingEnabled: boolean;
}

const TemplateEditorCard = ({
  template,
  isActive,
  onSelect,
  onUpdate,
  onDelete,
  editingEnabled,
}: TemplateEditorCardProps) => {
  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(template.id);
    }
  };

  const handleTitleSave = useCallback(
    (newTitle: string) => {
      onUpdate({ ...template, title: newTitle });
    },
    [template, onUpdate],
  );

  const handleAssetChange = (value: AssetType) => {
    onUpdate({ ...template, asset: value });
  };

  const handleStatusChange = (value: TemplateStatus) => {
    onUpdate({ ...template, status: value });
  };

  if (!editingEnabled) {
    return (
      <Card
        role="button"
        tabIndex={0}
        onClick={() => onSelect(template.id)}
        onKeyDown={handleCardKeyDown}
        aria-pressed={isActive}
        className={cn(
          "cursor-pointer space-y-2 border-border bg-background/60 p-3 text-left transition hover:border-primary/70 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-4",
          isActive && "border-primary shadow-md",
        )}
      >
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{template.title}</p>
          <p className="text-xs text-muted-foreground">
            {assetLabels[template.asset]} • {statusLabels[template.status]}
          </p>
        </div>
        <p className="text-xs text-muted-foreground italic">Toque para visualizar e aplicar o laudo.</p>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "group p-3 bg-background/50 border-border shadow-sm transition-colors space-y-3 sm:p-4",
        isActive && "border-primary shadow-lg",
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <EditableText
          initialValue={template.title}
          onSave={handleTitleSave}
          className="text-base font-semibold text-foreground cursor-text"
          placeholder="Título do Laudo"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(template.id)}
          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remover Template"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ativo</Label>
          <Select value={template.asset} onValueChange={(value) => handleAssetChange(value as AssetType)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Ativo" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(assetLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={template.status} onValueChange={(value) => handleStatusChange(value as TemplateStatus)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-dashed border-border/70">
        <span className="text-xs text-muted-foreground">ID: {template.id}</span>
        <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => onSelect(template.id)}>
          Editar Conteúdo
        </Button>
      </div>
    </Card>
  );
};

export const RatTemplatesBrowser = ({
  resetSignal = 0,
  onRequestGlobalReset,
}: RatTemplatesBrowserProps) => {
  const { setAutofillData } = useRatAutofill();
  const navigate = useNavigate();
  const { user, loadingAuth } = useAuth();
  const [templates, setTemplates] = useState<RatTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templateFilter, setTemplateFilter] = useState<AssetType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<TemplateStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState({
    defeito: "",
    diagnostico: "",
    solucao: "",
  });
  const isMobile = useIsMobile();
  const [activeMobileTab, setActiveMobileTab] = useState<"list" | "detail">("list");
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);
  const editSwitchId = "templates-edit-mode";

  useEffect(() => {
    setSelectedTemplateId(null);
    setTemplateDraft({ defeito: "", diagnostico: "", solucao: "" });
    setActiveMobileTab("list");
  }, [resetSignal]);

  useEffect(() => {
    if (!editingEnabled) {
      return;
    }
    if (!user) {
      setEditingEnabled(false);
      toast.info("Faça login para editar seus templates de RAT.");
    }
  }, [editingEnabled, user]);

  useEffect(() => {
    if (loadingAuth) {
      setLoadingTemplates(true);
      return;
    }

    if (!user) {
      setTemplates([]);
      setLoadingTemplates(false);
      setSelectedTemplateId(null);
      setTemplateDraft({ defeito: "", diagnostico: "", solucao: "" });
      setTemplatesError(null);
      return;
    }

    setLoadingTemplates(true);
    setTemplatesError(null);
    const templatesCollection = collection(db, "ratTemplates");
    const templatesQuery = query(templatesCollection, where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(
      templatesQuery,
      (querySnapshot) => {
        const userTemplates: RatTemplate[] = querySnapshot.docs.map((templateDoc) => {
          const data = templateDoc.data();

          const title = typeof data.title === "string" && data.title.trim().length
            ? data.title
            : "Template sem título";
          const asset = isAssetType(data.asset) ? data.asset : "CPU";
          const status = isTemplateStatus(data.status) ? data.status : "OPERACIONAL";
          const defeito = typeof data.defeito === "string" ? data.defeito : "";
          const diagnostico = typeof data.diagnostico === "string" ? data.diagnostico : "";
          const solucao = typeof data.solucao === "string" ? data.solucao : "";

          return {
            id: templateDoc.id,
            title,
            asset,
            status,
            defeito,
            diagnostico,
            solucao,
          } satisfies RatTemplate;
        });

        setTemplates(userTemplates);
        setLoadingTemplates(false);
        setTemplatesError(null);
      },
      (error) => {
        console.error("Erro ao carregar templates de RAT:", error);
        toast.error("Não foi possível carregar seus templates de RAT.");
        setLoadingTemplates(false);
        setTemplatesError("Não foi possível carregar seus templates. Verifique sua conexão e tente novamente.");
      },
    );

    return () => unsubscribe();
  }, [loadingAuth, user, retryCounter]);

  const filteredTemplates = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return templates.filter((template) => {
      const byAsset = templateFilter === "all" || template.asset === templateFilter;
      const byStatus = statusFilter === "all" || template.status === statusFilter;
      const byTerm = !term || template.title.toLowerCase().includes(term) || template.defeito.toLowerCase().includes(term) || template.diagnostico.toLowerCase().includes(term) || template.solucao.toLowerCase().includes(term);
      return byAsset && byStatus && byTerm;
    });
  }, [templateFilter, statusFilter, searchTerm, templates]);

  const [visibleCount, setVisibleCount] = useState(20);
  const limitedTemplates = useMemo(() => filteredTemplates.slice(0, visibleCount), [filteredTemplates, visibleCount]);
  const hasMoreTemplates = filteredTemplates.length > visibleCount;

  useEffect(() => {
    if (!selectedTemplateId) {
      return;
    }
    if (!templates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(null);
      setTemplateDraft({ defeito: "", diagnostico: "", solucao: "" });
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (!isMobile) {
      return;
    }
    setActiveMobileTab(selectedTemplateId ? "detail" : "list");
  }, [isMobile, selectedTemplateId]);

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) {
      return null;
    }
    return templates.find((template) => template.id === selectedTemplateId) ?? null;
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateDraft({ defeito: "", diagnostico: "", solucao: "" });
      return;
    }
    setTemplateDraft({
      defeito: selectedTemplate.defeito,
      diagnostico: selectedTemplate.diagnostico,
      solucao: selectedTemplate.solucao,
    });
  }, [selectedTemplate]);

  useEffect(() => {
    if (!editingEnabled && selectedTemplate) {
      setTemplateDraft({
        defeito: selectedTemplate.defeito,
        diagnostico: selectedTemplate.diagnostico,
        solucao: selectedTemplate.solucao,
      });
    }
  }, [editingEnabled, selectedTemplate]);

  const handleTemplateUpdate = useCallback(
    async (updated: RatTemplate) => {
      if (!editingEnabled) {
        toast.info("Ative o modo de edição para alterar os laudos.");
        return;
      }

      if (!user) {
        toast.error("Faça login para editar os templates.");
        return;
      }

      try {
        const templateRef = doc(db, "ratTemplates", updated.id);
        const { id, ...dataToUpdate } = updated;
        await setDoc(templateRef, { ...dataToUpdate, userId: user.uid }, { merge: true });
        toast.success("Laudo atualizado.");
      } catch (error) {
        console.error("Erro ao atualizar template de RAT:", error);
        toast.error("Não foi possível atualizar este laudo.");
      }
    },
    [editingEnabled, user],
  );

  const handleAddTemplate = useCallback(async () => {
    if (!editingEnabled) {
      toast.info("Ative o modo de edição para adicionar novos laudos.");
      return;
    }

    if (!user) {
      toast.error("Faça login para adicionar novos templates.");
      return;
    }

    try {
      const newTemplateData = {
        title: "Novo Laudo Técnico",
        asset: "CPU" as AssetType,
        status: "OPERACIONAL" as TemplateStatus,
        defeito: "Descreva o defeito identificado.",
        diagnostico: "Descreva os testes realizados.",
        solucao: "Descreva a solução aplicada ou recomendada.",
        userId: user.uid,
      };

      const docRef = await addDoc(collection(db, "ratTemplates"), newTemplateData);
      setSelectedTemplateId(docRef.id);
      setTemplateDraft({
        defeito: newTemplateData.defeito,
        diagnostico: newTemplateData.diagnostico,
        solucao: newTemplateData.solucao,
      });
      if (isMobile) {
        setActiveMobileTab("detail");
      }
      toast.success("Novo laudo adicionado à biblioteca.");
    } catch (error) {
      console.error("Erro ao criar novo template de RAT:", error);
      toast.error("Não foi possível adicionar um novo laudo.");
    }
  }, [editingEnabled, isMobile, user]);

  const handleTemplateDelete = useCallback(
    async (id: string) => {
      if (!editingEnabled) {
        toast.info("Ative o modo de edição para remover laudos.");
        return;
      }

      if (!user) {
        toast.error("Faça login para remover templates.");
        return;
      }

      if (typeof window !== "undefined" && !window.confirm("Remover este template permanentemente?")) {
        return;
      }

      try {
        await deleteDoc(doc(db, "ratTemplates", id));
        if (selectedTemplateId === id) {
          setSelectedTemplateId(null);
          setTemplateDraft({ defeito: "", diagnostico: "", solucao: "" });
        }
        toast.success("Template removido.");
      } catch (error) {
        console.error("Erro ao remover template de RAT:", error);
        toast.error("Não foi possível remover este laudo.");
      }
    },
    [editingEnabled, selectedTemplateId, user],
  );

  const handleTemplateDraftSave = useCallback(async () => {
    if (!editingEnabled) {
      toast.info("Ative o modo de edição para salvar alterações.");
      return;
    }

    if (!selectedTemplateId) {
      toast.error("Selecione um template para salvar as alterações.");
      return;
    }

    if (!selectedTemplate) {
      toast.error("Template selecionado não encontrado.");
      return;
    }

    if (!user) {
      toast.error("Faça login para atualizar os templates.");
      return;
    }

    try {
      const templateRef = doc(db, "ratTemplates", selectedTemplateId);
      await setDoc(
        templateRef,
        {
          title: selectedTemplate.title,
          asset: selectedTemplate.asset,
          status: selectedTemplate.status,
          defeito: templateDraft.defeito,
          diagnostico: templateDraft.diagnostico,
          solucao: templateDraft.solucao,
          userId: user.uid,
        },
        { merge: true },
      );
      toast.success("Laudo atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao salvar alterações do template:", error);
      toast.error("Não foi possível salvar as alterações deste laudo.");
    }
  }, [editingEnabled, selectedTemplate, selectedTemplateId, templateDraft, user]);

  const handleApplyTemplate = () => {
    if (!selectedTemplateId) {
      toast.error("Selecione um template para aplicar na RAT.");
      return;
    }
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) {
      toast.error("Template não encontrado.");
      return;
    }
    setAutofillData({
      title: template.title,
      defeito: templateDraft.defeito,
      diagnostico: templateDraft.diagnostico,
      solucao: templateDraft.solucao,
    });
    toast.success("Laudo aplicado. Abrindo formulário de RAT...");
    navigate("/rat");
  };

  const handleResetTemplates = useCallback(async () => {
    if (!editingEnabled) {
      toast.info("Ative o modo de edição para restaurar os padrões.");
      return;
    }

    if (!user) {
      toast.error("Faça login para restaurar os templates.");
      return;
    }

    if (typeof window !== "undefined" && !window.confirm("Restaurar todos os templates para o padrão?")) {
      return;
    }

    try {
      setLoadingTemplates(true);

      if (templates.length) {
        const batch = writeBatch(db);
        templates.forEach((template) => {
          batch.delete(doc(db, "ratTemplates", template.id));
        });
        await batch.commit();
      }

      const templatesCollection = collection(db, "ratTemplates");
      await Promise.all(
        ratTemplates.map((template) =>
          addDoc(templatesCollection, {
            title: template.title,
            asset: template.asset,
            status: template.status,
            defeito: template.defeito,
            diagnostico: template.diagnostico,
            solucao: template.solucao,
            userId: user.uid,
            templateKey: template.id,
          }),
        ),
      );

      setSelectedTemplateId(null);
      setTemplateDraft({ defeito: "", diagnostico: "", solucao: "" });
      setActiveMobileTab("list");
      toast.success("Templates restaurados para os padrões iniciais.");
      onRequestGlobalReset?.();
    } catch (error) {
      console.error("Erro ao restaurar templates padrão:", error);
      toast.error("Não foi possível restaurar os templates padrão.");
    } finally {
      setLoadingTemplates(false);
    }
  }, [editingEnabled, onRequestGlobalReset, templates, user]);

  if (loadingAuth || loadingTemplates) {
    return (
      <Card className="p-4 space-y-4 shadow-lg sm:p-6">
        <p className="text-sm text-muted-foreground">A carregar templates...</p>
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="p-6 text-center shadow-lg">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Templates RAT</h2>
          <p className="text-sm text-muted-foreground">
            Faça login para visualizar e personalizar seus laudos técnicos salvos no Firestore.
          </p>
        </div>
      </Card>
    );
  }

  const listPanel = (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="sm:col-span-1">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Título ou conteúdo"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Ativo</Label>
          <Select value={templateFilter} onValueChange={(value) => setTemplateFilter(value as AssetType | "all")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filtrar por ativo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os ativos</SelectItem>
              {Object.entries(assetLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TemplateStatus | "all") }>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Select value={templateFilter} onValueChange={(value) => setTemplateFilter(value as AssetType | "all")}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Filtrar por ativo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os ativos</SelectItem>
          {Object.entries(assetLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!editingEnabled && (
        <p className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Selecione um laudo para visualizar ou aplicar. Ative o modo de edição para alterar os textos.
        </p>
      )}
      <ScrollArea className="h-[500px] rounded-md border p-3 bg-background sm:p-4">
        <div className="space-y-3">
          {templatesError ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-12 text-center">
              <p className="text-sm text-destructive max-w-xs">
                {templatesError}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setRetryCounter((count) => count + 1);
                  setLoadingTemplates(true);
                }}
              >
                Tentar novamente
              </Button>
            </div>
          ) : filteredTemplates.length ? (
            limitedTemplates.map((template) => (
              <TemplateEditorCard
                key={template.id}
                template={template}
                isActive={template.id === selectedTemplateId}
                onSelect={setSelectedTemplateId}
                onUpdate={handleTemplateUpdate}
                onDelete={handleTemplateDelete}
                editingEnabled={editingEnabled}
              />
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum template com o filtro selecionado.
            </p>
          )}
          {hasMoreTemplates && (
            <div className="flex justify-center pt-2">
              <Button type="button" variant="outline" onClick={() => setVisibleCount((v) => v + 20)}>
                Carregar mais ({filteredTemplates.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  const detailPanel = selectedTemplate ? (
    <Card className="p-4 bg-background border-border space-y-4 sm:p-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-primary sm:text-xl">{selectedTemplate.title}</h3>
        <p className="text-xs text-muted-foreground">
          {assetLabels[selectedTemplate.asset]} • {statusLabels[selectedTemplate.status]}
        </p>
      </div>
      {!editingEnabled && (
        <p className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          Para alterar este laudo, habilite o modo de edição acima. Você ainda pode aplicá-lo diretamente na RAT.
        </p>
      )}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Defeito/Problema</Label>
          <Textarea
            value={templateDraft.defeito}
            onChange={(event) => {
              if (!editingEnabled) {
                return;
              }
              setTemplateDraft((draft) => ({ ...draft, defeito: event.target.value }));
            }}
            rows={5}
            readOnly={!editingEnabled}
            className={cn(
              "min-h-[140px]",
              !editingEnabled && "cursor-not-allowed bg-muted/40 text-muted-foreground",
            )}
          />
        </div>
        <div className="space-y-2">
          <Label>Diagnóstico/Testes</Label>
          <Textarea
            value={templateDraft.diagnostico}
            onChange={(event) => {
              if (!editingEnabled) {
                return;
              }
              setTemplateDraft((draft) => ({ ...draft, diagnostico: event.target.value }));
            }}
            rows={5}
            readOnly={!editingEnabled}
            className={cn(
              "min-h-[140px]",
              !editingEnabled && "cursor-not-allowed bg-muted/40 text-muted-foreground",
            )}
          />
        </div>
        <div className="space-y-2">
          <Label>Solução/Recomendação</Label>
          <Textarea
            value={templateDraft.solucao}
            onChange={(event) => {
              if (!editingEnabled) {
                return;
              }
              setTemplateDraft((draft) => ({ ...draft, solucao: event.target.value }));
            }}
            rows={5}
            readOnly={!editingEnabled}
            className={cn(
              "min-h-[140px]",
              !editingEnabled && "cursor-not-allowed bg-muted/40 text-muted-foreground",
            )}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        {isMobile && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 w-full justify-center sm:w-auto"
            onClick={() => setActiveMobileTab("list")}
          >
            Voltar
          </Button>
        )}
        <Button
          variant="outline"
          className="gap-2 w-full justify-center sm:w-auto"
          onClick={handleTemplateDraftSave}
          disabled={!editingEnabled}
        >
          Salvar Laudo
        </Button>
        <Button className="gap-2 w-full justify-center sm:w-auto" onClick={handleApplyTemplate}>
          <Wand2 className="h-4 w-4" /> Aplicar e abrir RAT
        </Button>
      </div>
    </Card>
  ) : (
    <div className="h-full rounded-md border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
      Selecione um template na lista {isMobile ? "para começar a editar." : "ao lado para editar o conteúdo e aplicar na RAT."}
    </div>
  );

  if (isMobile) {
    return (
      <Card className="p-4 space-y-4 shadow-lg sm:p-5">
        <div className="space-y-2 text-center">
          <h2 className="text-lg font-bold text-foreground flex items-center justify-center gap-2 sm:text-xl">
            <Layers className="h-5 w-5 text-primary" /> Templates RAT
          </h2>
          <p className="text-sm text-muted-foreground">
            Ajuste os textos padrões da RAT e envie o laudo diretamente para o formulário.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/70 px-4 py-2">
            <Switch
              id={`${editSwitchId}-mobile`}
              checked={editingEnabled}
              onCheckedChange={setEditingEnabled}
              aria-label="Alternar modo de edição"
            />
            <Label htmlFor={`${editSwitchId}-mobile`} className="text-sm font-medium">
              {editingEnabled ? "Modo edição ativo" : "Habilitar edição"}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Habilite a edição apenas quando precisar alterar os textos dos laudos.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            onClick={handleAddTemplate}
            variant="secondary"
            size="sm"
            className="gap-2 w-full sm:w-auto"
            disabled={!editingEnabled}
            title={!editingEnabled ? "Habilite a edição para adicionar novos laudos" : undefined}
          >
            <Plus className="h-4 w-4" /> Novo Laudo
          </Button>
          <Button
            onClick={handleResetTemplates}
            variant="outline"
            size="sm"
            className="gap-2 w-full sm:w-auto"
            disabled={!editingEnabled}
            title={!editingEnabled ? "Habilite a edição para restaurar os padrões" : undefined}
          >
            <RotateCcw className="h-4 w-4" /> Restaurar Padrões
          </Button>
        </div>
        <Tabs value={activeMobileTab} onValueChange={(value) => setActiveMobileTab(value as "list" | "detail")}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="list">Biblioteca</TabsTrigger>
            <TabsTrigger value="detail" disabled={!selectedTemplate}>
              {selectedTemplate ? "Laudo Selecionado" : "Selecione um Laudo"}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="space-y-3 pt-4">
            {listPanel}
          </TabsContent>
          <TabsContent value="detail" className="space-y-3 pt-4">
            {detailPanel}
          </TabsContent>
        </Tabs>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4 shadow-lg sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2 sm:text-xl">
            <Layers className="h-5 w-5 text-primary" /> Templates RAT
          </h2>
          <p className="text-sm text-muted-foreground">
            Selecione um laudo pronto ou ative a edição para personalizar o texto antes de aplicar na RAT.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2">
            <Switch
              id={editSwitchId}
              checked={editingEnabled}
              onCheckedChange={setEditingEnabled}
              aria-label="Alternar modo de edição"
            />
            <Label htmlFor={editSwitchId} className="text-sm font-medium">
              {editingEnabled ? "Modo edição ativo" : "Habilitar edição"}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleAddTemplate}
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={!editingEnabled}
              title={!editingEnabled ? "Habilite a edição para adicionar novos laudos" : undefined}
            >
              <Plus className="h-4 w-4" /> Novo Laudo
            </Button>
            <Button
              onClick={handleResetTemplates}
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!editingEnabled}
              title={!editingEnabled ? "Habilite a edição para restaurar os padrões" : undefined}
            >
              <RotateCcw className="h-4 w-4" /> Restaurar Padrões
            </Button>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr,1.5fr]">
        {listPanel}
        <div className="space-y-3">{detailPanel}</div>
      </div>
    </Card>
  );
};
