import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { RatHistoryList, RatHistoryEntry } from "../components/RatHistoryList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ScrollArea } from "../components/ui/scroll-area";
import { Skeleton } from "../components/ui/skeleton";
import { Switch } from "../components/ui/switch";
import { FileText, History, Printer, RotateCcw, Wand2, Plus, X, Pin, PinOff, Copy, Edit3, Loader2, Search } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "../components/ui/context-menu";
import { toast } from "sonner";
import { generateRatPDF, generateRatPDFBlob } from "../utils/ratPdfGenerator";
import { jiraAttach } from "../lib/jira";
import { RatFormData } from "../types/rat";
import { searchFsasByStore } from "../lib/fsa";
import { storesData } from "../data/storesData";
import { CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import type { JiraIssue } from "../lib/jira";
import {
  cloneRatFormData,
  createEmptyRatFormData,
  origemEquipamentoOptions,
} from "../data/ratOptions";
import { useHapticFeedback } from "../hooks/use-haptic-feedback";
import { useRatAutofill } from "../context/RatAutofillContext";
import { useAuth } from "../context/AuthContext";
import { loadEditableTemplates } from "../utils/data-editor-utils";
import type { RatTemplate } from "../data/ratTemplatesData";
import { loadPreferences, savePreferences } from "../utils/settings";

const RAT_HISTORY_STORAGE_KEY = "ratHistory";
const RAT_DRAFT_STORAGE_KEY = "ratFormDraft";

// LISTAS PARA OS DROPDOWNS NOVOS
const equipamentosOptions = [
  { value: '06-PDV-CPU', label: '06-PDV-CPU' },
  { value: '07-Desktop-Gerente', label: '07-Desktop-Gerente' },
  { value: '08-Desktop-Agil', label: '08-Desktop-Agil' },
  { value: '09-Desktop-Monitor', label: '09-Desktop-Monitor' },
  { value: '10-Desktop-Tesouraria', label: '10-Desktop-Tesouraria' },
  { value: '03-PDV-Impressora', label: '03-PDV-Impressora' },
  { value: '04-PDV-Monitor', label: '04-PDV-Monitor' },
  { value: '05-PDV-Gaveta', label: '05-PDV-Gaveta' },
  { value: '02-PDV-Scanner', label: '02-PDV-Scanner' },
  { value: '01-PDV-Teclado', label: '01-PDV-Teclado' },
  { value: '11-Impressora Zebra/Printronix', label: '11-Impressora Zebra/Printronix' },
];

// Mapas de peças/cabos por equipamento
const desktopCpuParts = [
  { value: '03-CPU/Desktop - HD/SSD', label: '03-CPU/Desktop - HD/SSD' },
  { value: '14-CPU/Desktop - Memória', label: '14-CPU/Desktop - Memória' },
  { value: '15-CPU/Desktop - Fonte Interna', label: '15-CPU/Desktop - Fonte Interna' },
  { value: '16-CPU/Desktop - Fonte Externa', label: '16-CPU/Desktop - Fonte Externa' },
  { value: '17-CPU/Desktop - Mother Board', label: '17-CPU/Desktop - Mother Board' },
  { value: '18-CPU/Desktop - Botão Power', label: '18-CPU/Desktop - Botão Power' },
  { value: '19-CPU/Desktop – Gabinete', label: '19-CPU/Desktop – Gabinete' },
  { value: '20-CPU/Desktop – Teclado ABNT', label: '20-CPU/Desktop – Teclado ABNT' },
  { value: '21-CPU/Desktop - Bateria CMOS', label: '21-CPU/Desktop - Bateria CMOS' },
  { value: '37-Cabo-Sata', label: '37-Cabo-Sata' },
  { value: '36-Cabo-USB', label: '36-Cabo-USB' },
  { value: '34-Cabo-Força', label: '34-Cabo-Força' },
];

const pecasPorEquipamento: Record<string, { value: string; label: string }[]> = {
  '06-PDV-CPU': desktopCpuParts,
  '07-Desktop-Gerente': desktopCpuParts,
  '08-Desktop-Agil': desktopCpuParts,
  '09-Desktop-Monitor': desktopCpuParts,
  '10-Desktop-Tesouraria': desktopCpuParts,
  '03-PDV-Impressora': [
    { value: '22-Imp-PDV-Fonte', label: '22-Imp-PDV-Fonte' },
    { value: '23-Imp-PDV-Placa Lógica', label: '23-Imp-PDV-Placa Lógica' },
    { value: '24-Imp-PDV-Tampa', label: '24-Imp-PDV-Tampa' },
    { value: '36-Cabo-USB', label: '36-Cabo-USB' },
    { value: '34-Cabo-Força', label: '34-Cabo-Força' },
  ],
  '04-PDV-Monitor': [
    { value: '30-Monitor-Base', label: '30-Monitor-Base' },
    { value: '31-Monitor-Fonte', label: '31-Monitor-Fonte' },
    { value: '35-Cabo-VGA/HD', label: '35-Cabo-VGA/HD' },
    { value: '34-Cabo-Força', label: '34-Cabo-Força' },
  ],
  '05-PDV-Gaveta': [
    { value: '25-Gaveta-Miolo', label: '25-Gaveta-Miolo' },
    { value: '26-Gaveta-Solenoide', label: '26-Gaveta-Solenoide' },
    { value: '27-Gaveta-Miolo', label: '27-Gaveta-Miolo' },
    { value: '28-Gaveta-Chave', label: '28-Gaveta-Chave' },
    { value: '29-Gaveta-Cabo RJ', label: '29-Gaveta-Cabo RJ' },
  ],
  '02-PDV-Scanner': [
    { value: '32-Cabo-Scanner', label: '32-Cabo-Scanner' },
  ],
  '01-PDV-Teclado': [
    { value: '33-Cabo-Teclado', label: '33-Cabo-Teclado' },
  ],
};

const opcoesExtrasZebra = [
  { value: '39-Cabeça Imp.', label: '39-Cabeça Imp.' },
  { value: '40-Sup. Cabeça', label: '40-Sup. Cabeça' },
  { value: '41-Platen', label: '41-Platen' },
  { value: '42-Sensor Cabeça', label: '42-Sensor Cabeça' },
  { value: '43-Sensor Etiqueta', label: '43-Sensor Etiqueta' },
  { value: '44-Placa Lógica', label: '44-Placa Lógica' },
  { value: '45-Placa Fonte', label: '45-Placa Fonte' },
  { value: '46-Fonte Externa', label: '46-Fonte Externa' },
  { value: '47-Trava Cabeça', label: '47-Trava Cabeça' },
  { value: '48-Kit Engrenagens', label: '48-Kit Engrenagens' },
  { value: '49-Correia', label: '49-Correia' },
  { value: '50-Painel', label: '50-Painel' },
  { value: '51-Print Server', label: '51-Print Server' },
];

const SOLUCAO_MAX = 150;

type RatSession = {
  id: string;
  title: string;
  data: (RatFormData & { equipamentoSelecionado?: string; pecaSelecionada?: string; opcaoExtraZebra?: string; });
  baseline: (RatFormData & { equipamentoSelecionado?: string; pecaSelecionada?: string; opcaoExtraZebra?: string; });
  pinned?: boolean;
};

const RatForm = () => {
  const { profile } = useAuth();
  const getInitialFormData = useCallback(() => {
    const base = createEmptyRatFormData();
    if (profile?.nome) {
      base.prestadorNome = profile.nome;
    }
    if (profile?.matricula) {
      base.prestadorRgMatricula = profile.matricula;
    }
    return base;
  }, [profile]);

  const [formData, setFormData] = useState<RatFormData & {
    equipamentoSelecionado?: string;
    pecaSelecionada?: string;
    opcaoExtraZebra?: string;
  }>(() => getInitialFormData());
  const [sessions, setSessions] = useState<RatSession[]>(() => [{
    id: `rat-1`,
    title: "RAT 1",
    data: getInitialFormData(),
    baseline: getInitialFormData(),
  }]);
  const [activeSessionId, setActiveSessionId] = useState<string>("rat-1");
  const [templates, setTemplates] = useState<RatTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [applyDefeito, setApplyDefeito] = useState(true);
  const [applyDiag, setApplyDiag] = useState(true);
  const [applySolucao, setApplySolucao] = useState(true);
  const [ratHistory, setRatHistory] = useState<RatHistoryEntry[]>([]);
  const { trigger: triggerHaptic } = useHapticFeedback();
  const { autofillData, clearAutofillData } = useRatAutofill();
  const [draftAvailable, setDraftAvailable] = useState(false);
  const draftLoadedRef = useRef(false);
  const skipDraftSaveRef = useRef(false);
  const draftSaveTimeoutRef = useRef<number | null>(null);
  const [uiLoading, setUiLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [autoPreview, setAutoPreview] = useState(true);
  const autoPreviewTimeoutRef = useRef<number | null>(null);
  const [issueKeyToAttach, setIssueKeyToAttach] = useState("");
  const [creatingJiraIssue, setCreatingJiraIssue] = useState(false);
  const [createdIssueKey, setCreatedIssueKey] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [storeFsaList, setStoreFsaList] = useState<JiraIssue[]>([]);
  const [isStoreSearchLoading, setIsStoreSearchLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fsaLookupTimeoutRef = useRef<number | null>(null);
  const lastFsaQueriedRef = useRef<string>("");
  const lastStoreQueriedRef = useRef<string>("");
  const [pdfFontSize, setPdfFontSize] = useState<string>(() => {
    const prefs = loadPreferences();
    return prefs.pdfSolutionFont || "auto";
  });
  // Carrega templates locais/usuário (fallback localStorage -> defaults)
  useEffect(() => {
    try {
      const t = loadEditableTemplates();
      setTemplates(t);
    } catch (e) {
      setTemplates([]);
    }
  }, []);

  // Sincroniza mudanças do formulário na sessão ativa
  useEffect(() => {
    setSessions((prev) => prev.map((s) => (s.id === activeSessionId ? { ...s, data: formData } : s)));
  }, [formData, activeSessionId]);

  // Atualiza o título da aba com a FSA (ou fallback "RAT N")
  useEffect(() => {
    const fsaTitle = (formData.fsa || "").trim();
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === activeSessionId);
      if (idx === -1) return prev;
      const desired = fsaTitle || `RAT ${idx + 1}`;
      if (prev[idx].title === desired) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], title: desired };
      return next;
    });
  }, [formData.fsa, activeSessionId]);

  const addSession = () => {
    const idx = sessions.length + 1;
    const id = `rat-${idx}`;
    const data = getInitialFormData();
    setSessions((prev) => [...prev, { id, title: `RAT ${idx}`, data, baseline: data }]);
    setActiveSessionId(id);
    // aplica template padrão se existir preferência
    try {
      const prefs = loadPreferences();
      if (prefs.defaultTemplateKey && prefs.defaultTemplateKey !== "none" && templates.length) {
        const match = templates.find(t => {
          const key = prefs.defaultTemplateKey?.toLowerCase();
          if (key === "cpu") return t.asset === "CPU" || /cpu/i.test(t.title);
          if (key === "zebra") return /zebra|etiqueta|printronix/i.test(t.title) || t.asset === "IMPRESSORA_ETIQUETA";
          return false;
        });
        if (match) {
          setFormData({
            ...data,
            defeitoProblema: match.defeito || data.defeitoProblema,
            diagnosticoTestes: match.diagnostico || data.diagnosticoTestes,
            solucao: (match.solucao || data.solucao || "").slice(0, SOLUCAO_MAX),
          });
          return;
        }
      }
    } catch {}
    setFormData(data);
  };

  const closeSession = (id: string) => {
    if (sessions.length <= 1) return;
    const idx = sessions.findIndex((s) => s.id === id);
    const nextSessions = sessions.filter((s) => s.id !== id);
    setSessions(nextSessions);
    if (activeSessionId === id) {
      const next = nextSessions[Math.max(0, idx - 1)];
      setActiveSessionId(next.id);
      setFormData(next.data);
    }
  };

  const switchSession = (id: string) => {
    const target = sessions.find((s) => s.id === id);
    if (!target) return;
    setActiveSessionId(id);
    setFormData(target.data);
  };

  // Menu de contexto por aba
  const duplicateSession = (id: string) => {
    const original = sessions.find((s) => s.id === id);
    if (!original) return;
    const newId = `rat-${Date.now()}`;
    const copy = {
      ...original,
      id: newId,
      title: `${original.title} (cópia)`,
      data: { ...original.data },
      baseline: { ...original.baseline },
      pinned: false,
    } as RatSession;
    setSessions((prev) => {
      const insertIndex = prev.findIndex((s) => s.id === id) + 1;
      const next = [...prev.slice(0, insertIndex), copy, ...prev.slice(insertIndex)];
      return next;
    });
    setActiveSessionId(newId);
    setFormData(copy.data);
  };

  const renameSession = (id: string) => {
    const current = sessions.find((s) => s.id === id);
    const nextTitle = typeof window !== "undefined" ? window.prompt("Novo nome da aba:", current?.title || "") : null;
    if (!nextTitle) return;
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: nextTitle } : s)));
  };

  const togglePinSession = (id: string) => {
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s));
      // Pinned primeiro
      next.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
      return next;
    });
  };

  // Drag & drop para reordenar abas
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const onDragStart = (id: string) => setDraggingId(id);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    setSessions((prev) => {
      const items = [...prev];
      const from = items.findIndex((s) => s.id === draggingId);
      const to = items.findIndex((s) => s.id === targetId);
      if (from === -1 || to === -1) return prev;
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return items;
    });
    setDraggingId(null);
  };

  const applyTemplateToForm = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplateId(templateId);
    setFormData((previous) => ({
      ...previous,
      defeitoProblema: applyDefeito ? (tpl.defeito || previous.defeitoProblema) : previous.defeitoProblema,
      diagnosticoTestes: applyDiag ? (tpl.diagnostico || previous.diagnosticoTestes) : previous.diagnosticoTestes,
      solucao: applySolucao ? ((tpl.solucao || previous.solucao || "").slice(0, SOLUCAO_MAX)) : previous.solucao,
    }));
    toast.success("Template aplicado nesta aba.");
    if (autoPreview) {
      window.setTimeout(() => { void handleUpdatePreview(); }, 50);
    }
  };


  const handleHouveTrocaChange = (value: string) => {
    setFormData((previous) => {
      if (value === "sim") {
        return { ...previous, houveTroca: value };
      }

      return {
        ...previous,
        houveTroca: value,
        origemEquipamento: "",
        numeroSerieTroca: "",
        equipNovoRecond: "",
        marcaTroca: "",
        modeloTroca: "",
      };
    });
  };

  const loadDraftFromStorage = useCallback(
    (showToast: boolean) => {
      if (typeof window === "undefined") {
        return false;
      }

      try {
        const stored = window.localStorage.getItem(RAT_DRAFT_STORAGE_KEY);
        if (!stored) {
          setDraftAvailable(false);
          return false;
        }

        const parsed = JSON.parse(stored) as Partial<RatFormData>;
        skipDraftSaveRef.current = true;
        setFormData((previous) => ({ ...previous, ...parsed }));
        setDraftAvailable(true);
        if (showToast) {
          toast.info("Rascunho da RAT recuperado automaticamente.");
        }
        return true;
      } catch (error) {
        console.error("Não foi possível recuperar o rascunho da RAT:", error);
        return false;
      }
      return false;
    },
    [],
  );

  const handleApplyAutofill = () => {
    if (!autofillData.isAvailable) {
      return;
    }

    setFormData((previous) => ({
      ...previous,
      defeitoProblema: autofillData.defeito,
      diagnosticoTestes: autofillData.diagnostico,
      solucao: autofillData.solucao,
    }));
    toast.success(
      autofillData.title
        ? `Laudo "${autofillData.title}" aplicado ao formulário.`
        : "Laudo sugerido aplicado ao formulário.",
    );
    triggerHaptic(70);
    clearAutofillData();
    if (autoPreview) {
      window.setTimeout(() => { void handleUpdatePreview(); }, 50);
    }
  };

  const handleResetForm = () => {
    skipDraftSaveRef.current = true;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(RAT_DRAFT_STORAGE_KEY);
    }
    setDraftAvailable(false);
    setFormData(getInitialFormData());
    toast.info("Formulário limpo.");
    triggerHaptic(40);
  };

  useEffect(() => {
    if (!draftLoadedRef.current) {
      draftLoadedRef.current = true;
      loadDraftFromStorage(true);
    }
  }, [loadDraftFromStorage]);

  // Autofill FSA a partir da "Minha Fila"
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fsa = localStorage.getItem('rat_autofill_fsa');
    if (fsa) {
      setFormData(prev => ({ ...prev, fsa }));
      localStorage.removeItem('rat_autofill_fsa');
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setUiLoading(false), 500);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (profile) {
      setFormData((previous) => {
        const shouldUpdate =
          (!!profile.nome && !previous.prestadorNome) ||
          (!!profile.matricula && !previous.prestadorRgMatricula);
        if (!shouldUpdate) {
          return previous;
        }
        return {
          ...previous,
          prestadorNome: previous.prestadorNome || profile.nome || "",
          prestadorRgMatricula:
            previous.prestadorRgMatricula || profile.matricula || "",
        };
      });
    }
  }, [profile]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (skipDraftSaveRef.current) {
      skipDraftSaveRef.current = false;
      return;
    }

    if (draftSaveTimeoutRef.current) {
      window.clearTimeout(draftSaveTimeoutRef.current);
    }

    draftSaveTimeoutRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          RAT_DRAFT_STORAGE_KEY,
          JSON.stringify(formData),
        );
        setDraftAvailable(true);
      } catch (error) {
        console.error("Não foi possível salvar o rascunho da RAT:", error);
      }
    }, 600);

    return () => {
      if (draftSaveTimeoutRef.current) {
        window.clearTimeout(draftSaveTimeoutRef.current);
        draftSaveTimeoutRef.current = null;
      }
    };
  }, [formData]);

  // Auto-preencher endereço/cidade/UF a partir de FSA/loja (Jira/Firestore)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { fsa, codigoLoja } = formData;
    const key = `${(fsa||'').trim()}|${(codigoLoja||'').trim()}`;
    // evita lookups redundantes
    if (lastFsaQueriedRef.current === key) return;
    if (fsaLookupTimeoutRef.current) window.clearTimeout(fsaLookupTimeoutRef.current);
    fsaLookupTimeoutRef.current = window.setTimeout(async () => {
      lastFsaQueriedRef.current = key;
      try {
        const { fetchFsaDetails } = await import('../lib/fsa');
        const details = await fetchFsaDetails({ fsa, codigoLoja });
        if (details) {
          setFormData(prev => ({
            ...prev,
            codigoLoja: prev.codigoLoja || details.storeCode || prev.codigoLoja,
            endereco: details.endereco || prev.endereco,
            cidade: details.cidade || prev.cidade,
            uf: details.uf || prev.uf,
            pdv: prev.pdv || details.pdv || prev.pdv,
          }));
        }
      } catch (e) {
        console.warn('Falha ao buscar detalhes de FSA/loja', e);
      }
    }, 600);
    return () => {
      if (fsaLookupTimeoutRef.current) {
        window.clearTimeout(fsaLookupTimeoutRef.current);
        fsaLookupTimeoutRef.current = null;
      }
    };
  }, [formData.fsa, formData.codigoLoja]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = localStorage.getItem(RAT_HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed: RatHistoryEntry[] = JSON.parse(stored);
        setRatHistory(parsed);
      }
    } catch (error) {
      console.error("Não foi possível carregar o histórico de RAT:", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (ratHistory.length === 0) {
      localStorage.removeItem(RAT_HISTORY_STORAGE_KEY);
      return;
    }

    try {
      localStorage.setItem(RAT_HISTORY_STORAGE_KEY, JSON.stringify(ratHistory));
    } catch (error) {
      console.error("Não foi possível salvar o histórico de RAT:", error);
    }
  }, [ratHistory]);

  const handleGeneratePDF = async () => {
    try {
      await generateRatPDF(formData);
      setRatHistory((previous) => {
        const entry: RatHistoryEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          fsa: formData.fsa?.trim() || undefined,
          codigoLoja: formData.codigoLoja?.trim() || undefined,
          pdv: formData.pdv?.trim() || undefined,
          defeitoProblema: formData.defeitoProblema?.trim() || undefined,
          formData: cloneRatFormData(formData),
        };

        const nextHistory = [entry, ...previous];
        return nextHistory.slice(0, 30);
      });
      toast.success("PDF gerado com sucesso!");
      triggerHaptic(80);
      // Ao gerar, consideramos que está salvo: atualiza baseline da sessão ativa
      setSessions((prev) => prev.map((s) => s.id === activeSessionId ? { ...s, baseline: cloneRatFormData(formData) as any } : s));
      skipDraftSaveRef.current = true;
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(RAT_DRAFT_STORAGE_KEY);
      }
      setDraftAvailable(false);
    } catch (error) {
      toast.error("Erro ao gerar PDF");
      console.error(error);
    }
  };

  const handleRatHistorySelect = (entry: RatHistoryEntry) => {
    const restored = { ...createEmptyRatFormData(), ...cloneRatFormData(entry.formData) };
    setFormData(restored);
    toast.info("Dados da RAT carregados do histórico.");
    triggerHaptic(50);
  };

  const handleRatHistoryClear = () => {
    setRatHistory([]);
    toast.info("Histórico de RAT limpo.");
    triggerHaptic(50);
  };
  const handleUpdatePreview = async () => {
    try {
      setPreviewLoading(true);
      const { url } = await generateRatPDFBlob(formData);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      toast.success("Pré-visualização atualizada.");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar a pré-visualização.");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Atualização automática com debounce (900ms)
  useEffect(() => {
    if (!autoPreview) return;
    if (autoPreviewTimeoutRef.current) {
      window.clearTimeout(autoPreviewTimeoutRef.current);
    }
    autoPreviewTimeoutRef.current = window.setTimeout(() => {
      void handleUpdatePreview();
    }, 900);
    return () => {
      if (autoPreviewTimeoutRef.current) {
        window.clearTimeout(autoPreviewTimeoutRef.current);
        autoPreviewTimeoutRef.current = null;
      }
    };
  }, [autoPreview, formData]);

  // Limpa URL ao desmontar
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleRestoreDraft = () => {
    const restored = loadDraftFromStorage(false);
    if (restored) {
      toast.success("Rascunho recuperado.");
    } else {
      toast.info("Nenhum rascunho salvo disponível.");
    }
  };

  const handleSearchByStore = async () => {
    if (!selectedStore) {
      toast.error('Selecione uma loja primeiro');
      return;
    }
    setIsStoreSearchLoading(true);
    setStoreFsaList([]);
    try {
      const results = await searchFsasByStore(selectedStore);
      if (results.length === 0) {
        toast.info('Nenhuma FSA em aberto encontrada para esta loja.');
      } else {
        setStoreFsaList(results);
        setIsModalOpen(true); // Abre o modal com os resultados
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao buscar FSAs');
    } finally {
      setIsStoreSearchLoading(false);
    }
  };

  const handleSelectFsa = (issue: JiraIssue) => {
    // Preenche o formulário com os dados da FSA selecionada
    setFormData(prev => ({
      ...prev,
      fsa: issue.key || prev.fsa,
      codigoLoja: prev.codigoLoja, // Mantém o que já estava preenchido
      defeitoProblema: issue.fields?.summary || prev.defeitoProblema,
      diagnosticoTestes: typeof issue.fields?.description === 'string' ? issue.fields.description : prev.diagnosticoTestes,
    }));
    setIsModalOpen(false); // Fecha o modal
    setStoreFsaList([]); // Limpa a lista
    toast.success(`FSA ${issue.key} carregada!`);
  };

  return (
      <div className="min-h-screen bg-gradient-primary px-4 py-8 pt-24">
        <div className="max-w-6xl mx-auto space-y-6">
          <header className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-3 bg-secondary rounded-2xl shadow-glow">
                <FileText className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Relatório de Atendimento Técnico - RAT
            </h1>
            <p className="text-muted-foreground">
              Preencha os dados para gerar a RAT
            </p>
          </header>

          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <Card className="relative overflow-hidden p-4 sm:p-6 space-y-6">
              <div className="flex items-center justify-between gap-2">
                <Tabs value={activeSessionId} onValueChange={switchSession} className="w-full">
                  <div className="flex items-center gap-2">
                    <TabsList className="flex-1 overflow-x-auto rounded-full bg-secondary/60 p-1 shadow-sm">
                      {sessions.map((s) => {
                        const isDirty = JSON.stringify(s.data) !== JSON.stringify(s.baseline);
                        return (
                          <ContextMenu key={s.id}>
                            <ContextMenuTrigger asChild>
                              <div
                                draggable
                                onDragStart={() => onDragStart(s.id)}
                                onDragOver={onDragOver}
                                onDrop={() => onDrop(s.id)}
                                className="relative"
                              >
                                <TabsTrigger
                                  value={s.id}
                                  className="relative rounded-full px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm hover:bg-background/60 transition-colors select-none"
                                >
                                  <span className="pr-4 flex items-center gap-2">
                                    {s.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                                    <span>{s.title}</span>
                                    {isDirty && <span className="text-primary">•</span>}
                                  </span>
                                  {sessions.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); closeSession(s.id); }}
                                      className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                                      aria-label={`Fechar ${s.title}`}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </TabsTrigger>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-48">
                              <ContextMenuItem onClick={() => duplicateSession(s.id)} className="gap-2">
                                <Copy className="h-4 w-4" /> Duplicar
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => renameSession(s.id)} className="gap-2">
                                <Edit3 className="h-4 w-4" /> Renomear
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => togglePinSession(s.id)} className="gap-2">
                                {s.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                                {s.pinned ? "Desafixar" : "Fixar"}
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </TabsList>
                    <Button type="button" variant="outline" onClick={addSession} className="shrink-0 rounded-full" aria-label="Nova aba">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <TabsContent value={activeSessionId} className="mt-2" />
                </Tabs>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {autofillData.isAvailable && (
                  <Button type="button" variant="secondary" onClick={handleApplyAutofill}>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Aplicar Laudo Sugerido
                    {autofillData.title ? ` (${autofillData.title})` : ""}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRestoreDraft}
                  disabled={!draftAvailable}
                >
                  <History className="mr-2 h-4 w-4" /> Recuperar rascunho
                </Button>
                <Button type="button" variant="outline" onClick={handleResetForm}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Limpar formulário
                </Button>
              </div>

              {uiLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i} className="p-4">
                      <Skeleton className="h-6 w-40 mb-3" />
                      <Skeleton className="h-10 w-full mb-2" />
                      <Skeleton className="h-10 w-full" />
                    </Card>
                  ))}
                  <div className="flex justify-center pt-2">
                    <Skeleton className="h-11 w-56 rounded-md" />
                  </div>
                </div>
              ) : (
              <>
                {/* BUSCA POR LOJA */}
                <Card>
                  <CardHeader>
                    <CardTitle>Buscar por Loja</CardTitle>
                    <CardDescription>
                      Selecione uma loja para ver as FSAs em aberto e pré-preencher a RAT.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col sm:flex-row gap-2">
                    <Select value={selectedStore} onValueChange={setSelectedStore}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma loja..." />
                      </SelectTrigger>
                      <SelectContent>
                        <ScrollArea className="h-72">
                          {storesData.map((store) => (
                            <SelectItem key={store.numeroLoja} value={store.nomeLoja}>
                              {store.nomeLoja}
                            </SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleSearchByStore}
                      disabled={isStoreSearchLoading || !selectedStore}
                      className="w-full sm:w-auto"
                    >
                      {isStoreSearchLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="mr-2 h-4 w-4" />
                      )}
                      Buscar FSAs da Loja
                    </Button>
                  </CardContent>
                </Card>

                <Accordion
                  type="multiple"
                  defaultValue={["identificacao", "equipamento", "laudo", "contatos"]}
                  className="space-y-4"
                >
                  <AccordionItem value="identificacao">
                  <AccordionTrigger className="text-left text-lg font-semibold">
                    1. Identificação
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="codigoLoja">Código da Loja</Label>
                          <Input list="lojas-sugestoes"
                            id="codigoLoja"
                            value={formData.codigoLoja}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            onChange={(e) => setFormData({ ...formData, codigoLoja: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pdv">PDV</Label>
                          <Input list="pdvs-sugestoes"
                            id="pdv"
                            value={formData.pdv}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            onChange={(e) => setFormData({ ...formData, pdv: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fsa">FSA</Label>
                          <Input
                            id="fsa"
                            value={formData.fsa}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            onChange={(e) => setFormData({ ...formData, fsa: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                        <div className="space-y-2 md:col-span-1">
                          <Label htmlFor="endereco">Endereço</Label>
                          <Input
                            id="endereco"
                            value={formData.endereco}
                            onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cidade">Cidade</Label>
                          <Input
                            id="cidade"
                            value={formData.cidade}
                            onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="uf">UF</Label>
                          <Input
                            id="uf"
                            maxLength={2}
                            value={formData.uf}
                            onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="nomeSolicitante">Nome do Solicitante</Label>
                        <Input
                          id="nomeSolicitante"
                          value={formData.nomeSolicitante}
                          onChange={(e) => setFormData({ ...formData, nomeSolicitante: e.target.value })}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="equipamento">
                  <AccordionTrigger className="text-left text-lg font-semibold">
                    2. Dados do Equipamento
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-6 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="serial">Número Série ATIVO</Label>
                          <Input
                            id="serial"
                            value={formData.serial}
                            onChange={(e) => setFormData({ ...formData, serial: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="patrimonio">Patrimônio</Label>
                          <Input
                            id="patrimonio"
                            value={formData.patrimonio}
                            onChange={(e) => setFormData({ ...formData, patrimonio: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="marca">Marca</Label>
                          <Input
                            id="marca"
                            value={formData.marca}
                            onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="modelo">Modelo</Label>
                          <Input
                            id="modelo"
                            value={formData.modelo}
                            onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-4 rounded-lg border border-primary/30 bg-secondary/40 p-4 shadow-sm">
                        <h3 className="font-semibold text-base text-primary mb-2 flex items-center gap-2">
                          <span>Equipamentos e Peças Envolvidos</span>
                        </h3>
                        {/* Dropdown Equipamento/Periférico */}
                        <div className="space-y-1">
                          <Label htmlFor="equipamentoSelecionado">Equipamento/Periférico</Label>
                          <Select
                            value={formData.equipamentoSelecionado || undefined}
                            onValueChange={value => setFormData({ ...formData, equipamentoSelecionado: value, pecaSelecionada: undefined, opcaoExtraZebra: undefined })}
                          >
                            <SelectTrigger id="equipamentoSelecionado">
                              <SelectValue placeholder="Selecione o equipamento" />
                            </SelectTrigger>
                            <SelectContent>
                              {equipamentosOptions.map(op => (
                                <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {/* Dropdown Peças/Cabos (somente quando não for Zebra/Printronix) */}
                        {formData.equipamentoSelecionado && !String(formData.equipamentoSelecionado).startsWith('11-') && pecasPorEquipamento[formData.equipamentoSelecionado] && (
                          <div className="space-y-1">
                            <Label htmlFor="pecaSelecionada">Peças/Cabos</Label>
                            <Select
                              value={formData.pecaSelecionada || undefined}
                              onValueChange={value => setFormData({ ...formData, pecaSelecionada: value })}
                            >
                              <SelectTrigger id="pecaSelecionada">
                                <SelectValue placeholder="Selecione a peça/cabo" />
                              </SelectTrigger>
                              <SelectContent>
                                {pecasPorEquipamento[formData.equipamentoSelecionado].map(op => (
                                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {/* Dropdown especial Zebra (somente quando '11-') */}
                        {formData.equipamentoSelecionado && String(formData.equipamentoSelecionado).startsWith('11-') && (
                          <div className="space-y-1">
                            <Label htmlFor="opcaoExtraZebra">Peças Imp. Térmica – Zebra/Printronix/Outras</Label>
                            <Select
                              value={formData.opcaoExtraZebra || undefined}
                              onValueChange={value => setFormData({ ...formData, opcaoExtraZebra: value })}
                            >
                              <SelectTrigger id="opcaoExtraZebra">
                                <SelectValue placeholder="Selecione a peça" />
                              </SelectTrigger>
                              <SelectContent>
                                {opcoesExtrasZebra.map(op => (
                                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {/* Resumo das escolhas */}
                        {(formData.equipamentoSelecionado || formData.pecaSelecionada || formData.opcaoExtraZebra) && (
                          <div className="mt-2 rounded bg-primary/5 px-3 py-2 text-xs text-foreground/80">
                            <strong>Resumo:&nbsp;</strong>
                            {formData.equipamentoSelecionado && (<span>Equipamento: <span className="font-medium">{equipamentosOptions.find(op => op.value === formData.equipamentoSelecionado)?.label}</span>; </span>)}
                            {formData.pecaSelecionada && (<span>Peça: <span className="font-medium">{pecasPorEquipamento[formData.equipamentoSelecionado]?.find(op => op.value === formData.pecaSelecionada)?.label}</span>; </span>)}
                            {formData.opcaoExtraZebra && (<span>Opção especial: <span className="font-medium">{opcoesExtrasZebra.find(op => op.value === formData.opcaoExtraZebra)?.label}</span></span>)}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Houve troca de equipamento?</Label>
                        <RadioGroup
                          value={formData.houveTroca}
                          onValueChange={handleHouveTrocaChange}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="sim" id="houve-troca-sim" />
                              <Label htmlFor="houve-troca-sim" className="cursor-pointer">
                                Sim
                              </Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="nao" id="houve-troca-nao" />
                              <Label htmlFor="houve-troca-nao" className="cursor-pointer">
                                Não
                              </Label>
                            </div>
                          </div>
                        </RadioGroup>
                      </div>

                          {formData.houveTroca === "sim" && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="origemEquipamento">Origem do equipamento</Label>
                                <Select
                                  value={formData.origemEquipamento}
                                  onValueChange={(value) => setFormData({ ...formData, origemEquipamento: value })}
                                >
                                  <SelectTrigger id="origemEquipamento">
                                    <SelectValue placeholder="Selecione a origem" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {origemEquipamentoOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="numeroSerieTroca">Número de série (novo equipamento)</Label>
                                  <Input
                                    id="numeroSerieTroca"
                                    value={formData.numeroSerieTroca}
                                    onChange={(e) => setFormData({ ...formData, numeroSerieTroca: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="equipNovoRecond">Equipamento novo/recondicionado</Label>
                                  <Input
                                    id="equipNovoRecond"
                                    value={formData.equipNovoRecond}
                                    onChange={(e) => setFormData({ ...formData, equipNovoRecond: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="marcaTroca">Marca do novo equipamento</Label>
                                  <Input
                                    id="marcaTroca"
                                    value={formData.marcaTroca}
                                    onChange={(e) => setFormData({ ...formData, marcaTroca: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="modeloTroca">Modelo do novo equipamento</Label>
                                  <Input
                                    id="modeloTroca"
                                    value={formData.modeloTroca}
                                    onChange={(e) => setFormData({ ...formData, modeloTroca: e.target.value })}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label>Mau Uso?</Label>
                            <RadioGroup
                              value={formData.mauUso}
                              onValueChange={(value) => setFormData({ ...formData, mauUso: value })}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem value="sim" id="mau-uso-sim" />
                                  <Label htmlFor="mau-uso-sim" className="cursor-pointer">
                                    Sim
                                  </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem value="nao" id="mau-uso-nao" />
                                  <Label htmlFor="mau-uso-nao" className="cursor-pointer">
                                    Não
                                  </Label>
                                </div>
                              </div>
                            </RadioGroup>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="observacoesPecas">Observações</Label>
                            <Textarea
                              id="observacoesPecas"
                              value={formData.observacoesPecas}
                              onChange={(e) => setFormData({ ...formData, observacoesPecas: e.target.value })}
                              rows={3}
                            />
                          </div>
                        </div>
                        <datalist id="lojas-sugestoes">
                          {ratHistory.map((h, idx) => h.codigoLoja && (
                            <option key={`loja-${idx}-${h.codigoLoja}`} value={h.codigoLoja} />
                          ))}
                        </datalist>
                        <datalist id="pdvs-sugestoes">
                          {ratHistory.map((h, idx) => h.pdv && (
                            <option key={`pdv-${idx}-${h.pdv}`} value={h.pdv} />
                          ))}
                        </datalist>
                      </AccordionContent>
                    </AccordionItem>

                  <AccordionItem value="laudo">
                    <AccordionTrigger className="text-left text-lg font-semibold">
                      3. Considerações Gerais – Laudo Técnico
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-6 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="defeitoProblema">Defeito/Problema</Label>
                          <Textarea
                            id="defeitoProblema"
                            value={formData.defeitoProblema}
                            onChange={(e) => setFormData({ ...formData, defeitoProblema: e.target.value })}
                            rows={3}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="diagnosticoTestes">Diagnóstico/Testes realizados</Label>
                          <Textarea
                            id="diagnosticoTestes"
                            value={formData.diagnosticoTestes}
                            onChange={(e) => setFormData({ ...formData, diagnosticoTestes: e.target.value })}
                            rows={3}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="solucao">Solução</Label>
                          <Textarea
                            id="solucao"
                            value={formData.solucao.length > SOLUCAO_MAX ? formData.solucao.slice(0, SOLUCAO_MAX) : formData.solucao}
                            onChange={e => {
                              const v = e.target.value;
                              setFormData({ ...formData, solucao: v.slice(0, SOLUCAO_MAX) });
                            }}
                            rows={3}
                            maxLength={SOLUCAO_MAX}
                          />
                          <div className="flex items-center gap-2 text-xs mt-1">
                            <span>{formData.solucao.length}/{SOLUCAO_MAX} caracteres</span>
                            {formData.solucao.length >= SOLUCAO_MAX && (
                              <span className="text-destructive font-semibold">Limite atingido – O resto do texto não será incluído na RAT.</span>
                            )}
                          </div>
                        </div>

                          <div className="space-y-2">
                            <Label>Problema resolvido?</Label>
                            <RadioGroup
                              value={formData.problemaResolvido}
                              onValueChange={(value) => setFormData({ ...formData, problemaResolvido: value })}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem value="sim" id="problema-sim" />
                                  <Label htmlFor="problema-sim" className="cursor-pointer">
                                    Sim
                                  </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <RadioGroupItem value="nao" id="problema-nao" />
                                  <Label htmlFor="problema-nao" className="cursor-pointer">
                                    Não
                                </Label>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>

                        {formData.problemaResolvido === "nao" && (
                          <div className="space-y-2">
                            <Label htmlFor="motivoNaoResolvido">Caso não, descreva o motivo</Label>
                            <Textarea
                              id="motivoNaoResolvido"
                              value={formData.motivoNaoResolvido}
                              onChange={(e) => setFormData({ ...formData, motivoNaoResolvido: e.target.value })}
                              rows={2}
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>Haverá retorno?</Label>
                          <RadioGroup
                            value={formData.haveraRetorno}
                            onValueChange={(value) => setFormData({ ...formData, haveraRetorno: value })}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                              <div className="flex items-center gap-2">
                                <RadioGroupItem value="sim" id="retorno-sim" />
                                <Label htmlFor="retorno-sim" className="cursor-pointer">
                                  Sim
                                </Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <RadioGroupItem value="nao" id="retorno-nao" />
                                <Label htmlFor="retorno-nao" className="cursor-pointer">
                                  Não
                                </Label>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="horaInicio">Hora início</Label>
                            <Input
                              id="horaInicio"
                              type="time"
                              value={formData.horaInicio}
                              onChange={(e) => setFormData({ ...formData, horaInicio: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="horaTermino">Hora término</Label>
                            <Input
                              id="horaTermino"
                              type="time"
                              value={formData.horaTermino}
                              onChange={(e) => setFormData({ ...formData, horaTermino: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="data">Data</Label>
                            <Input
                              id="data"
                              type="date"
                              value={formData.data}
                              onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="contatos">
                    <AccordionTrigger className="text-left text-lg font-semibold">
                      4. Dados do Cliente e Prestador
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-6 pt-2">
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-foreground">Dados do Cliente</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="clienteNome">Nome Legível</Label>
                              <Input
                                id="clienteNome"
                                value={formData.clienteNome}
                                onChange={(e) => setFormData({ ...formData, clienteNome: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="clienteRgMatricula">RG ou Matrícula</Label>
                              <Input
                                id="clienteRgMatricula"
                                value={formData.clienteRgMatricula}
                                onChange={(e) =>
                                  setFormData({ ...formData, clienteRgMatricula: e.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="clienteTelefone">Telefone</Label>
                              <Input
                                id="clienteTelefone"
                                value={formData.clienteTelefone}
                                onChange={(e) =>
                                  setFormData({ ...formData, clienteTelefone: e.target.value })
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-foreground">Dados do Prestador</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="prestadorNome">Nome Legível</Label>
                              <Input
                                id="prestadorNome"
                                value={formData.prestadorNome}
                                onChange={(e) => setFormData({ ...formData, prestadorNome: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="prestadorRgMatricula">RG ou Matrícula</Label>
                              <Input
                                id="prestadorRgMatricula"
                                value={formData.prestadorRgMatricula}
                                onChange={(e) =>
                                  setFormData({ ...formData, prestadorRgMatricula: e.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="prestadorTelefone">Telefone</Label>
                              <Input
                                id="prestadorTelefone"
                                value={formData.prestadorTelefone}
                                onChange={(e) =>
                                  setFormData({ ...formData, prestadorTelefone: e.target.value })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* DIALOG (MODAL) DE RESULTADOS DA BUSCA POR LOJA */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                  <DialogContent className="sm:max-w-[625px]">
                    <DialogHeader>
                      <DialogTitle>Selecione a FSA para {selectedStore}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] pr-4">
                      <div className="flex flex-col gap-2">
                        {storeFsaList.map((issue) => (
                          <Button
                            key={issue.key}
                            variant="outline"
                            className="h-auto text-left justify-start"
                            onClick={() => handleSelectFsa(issue)}
                          >
                            <div>
                              <div className="font-bold">{issue.key}</div>
                              <div className="text-muted-foreground text-sm whitespace-normal">
                                {issue.fields.summary}
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
                </>
              )}

                <div className="flex justify-center pt-2">
                  <Button onClick={handleGeneratePDF} size="lg" className="gap-2">
                    <Printer className="h-5 w-5" />
                    Gerar e Imprimir RAT
                  </Button>
                </div>
              </Card>
              <Card className="p-0 h-fit sticky top-24 overflow-hidden">
                <Tabs defaultValue="preview">
                  <TabsList className="m-3">
                    <TabsTrigger value="preview">Pré-visualização</TabsTrigger>
                    <TabsTrigger value="tools">Ferramentas</TabsTrigger>
                  </TabsList>
                  <TabsContent value="preview" className="px-4 pb-4">
                    <div className="flex flex-col gap-2 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <Switch id="auto-preview" checked={autoPreview} onCheckedChange={setAutoPreview} />
                          <label htmlFor="auto-preview" className="cursor-pointer">Auto-atualizar</label>
                        </div>
                        {previewLoading && (
                          <span className="text-xs text-muted-foreground">Atualizando…</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Label className="text-xs font-semibold">Tamanho da Fonte:</Label>
                        <Select 
                          value={pdfFontSize} 
                          onValueChange={(value) => {
                            setPdfFontSize(value);
                            savePreferences({ pdfSolutionFont: value as any });
                          }}
                        >
                          <SelectTrigger className="h-7 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Automático</SelectItem>
                            <SelectItem value="10">10pt</SelectItem>
                            <SelectItem value="9">9pt</SelectItem>
                            <SelectItem value="8">8pt</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="border rounded-md overflow-hidden bg-background">
                      {previewUrl ? (
                        <iframe title="Pré-visualização RAT" src={previewUrl} className="w-full h-[520px]" />
                      ) : (
                        <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">Nenhuma pré-visualização gerada ainda.</div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="tools">
                <Accordion type="single" collapsible defaultValue="template">
                  <AccordionItem value="template">
                    <AccordionTrigger className="px-4">Template de RAT</AccordionTrigger>
                    <AccordionContent>
                      <div className="p-4 space-y-2">
                        <Select value={selectedTemplateId || undefined} onValueChange={setSelectedTemplateId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar template para esta aba" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
                        <label className="flex items-center gap-1"><input type="checkbox" checked={applyDefeito} onChange={e => setApplyDefeito(e.target.checked)} /> Defeito</label>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={applyDiag} onChange={e => setApplyDiag(e.target.checked)} /> Diagnóstico</label>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={applySolucao} onChange={e => setApplySolucao(e.target.checked)} /> Solução</label>
                      </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            onClick={() => selectedTemplateId && applyTemplateToForm(selectedTemplateId)}
                            disabled={!selectedTemplateId}
                            className="mt-2"
                          >
                            Aplicar ao formulário
                          </Button>
                        </div>
                        {selectedTemplateId && (
                          <div className="rounded-md border bg-background/60">
                            <ScrollArea className="max-h-56 p-3 text-xs">
                              {(() => {
                                const t = templates.find(tt => tt.id === selectedTemplateId);
                                if (!t) return null;
                                return (
                                  <div className="space-y-2">
                                    <div>
                                      <div className="font-semibold">Defeito/Problema</div>
                                      <div className="text-muted-foreground whitespace-pre-wrap">{t.defeito || "—"}</div>
                                    </div>
                                    <div>
                                      <div className="font-semibold">Diagnóstico/Testes</div>
                                      <div className="text-muted-foreground whitespace-pre-wrap">{t.diagnostico || "—"}</div>
                                    </div>
                                    <div>
                                      <div className="font-semibold">Solução</div>
                                      <div className="text-muted-foreground whitespace-pre-wrap">{t.solucao || "—"}</div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </ScrollArea>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">Aplica defeito, diagnóstico e solução do template na aba ativa.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="history">
                    <AccordionTrigger className="px-4">Histórico</AccordionTrigger>
                    <AccordionContent>
                      <div className="p-4">
                        <RatHistoryList
                          history={ratHistory}
                          onSelect={handleRatHistorySelect}
                          onClear={handleRatHistoryClear}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="jira">
                    <AccordionTrigger className="px-4">Integração com Jira</AccordionTrigger>
                    <AccordionContent>
                      <div className="p-4 space-y-4">
                        {/* Criar Issue no Jira */}
                        <div className="space-y-3">
                          <div className="text-sm font-medium">Criar Chamado no Jira</div>
                          <div className="text-xs text-muted-foreground">
                            Cria uma nova issue no Jira com os dados do RAT atual.
                          </div>
                          {createdIssueKey && (
                            <div className="p-2 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-600 dark:text-green-400">
                              Issue criada: <strong>{createdIssueKey}</strong>
                            </div>
                          )}
                          <Button 
                            type="button" 
                            onClick={async ()=>{
                              setCreatingJiraIssue(true);
                              setCreatedIssueKey(null);
                              try {
                                const response = await fetch('/api/gerar-rat', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify(formData)
                                });

                                const result = await response.json();

                                if (!response.ok) {
                                  throw new Error(result.error || 'Falha ao criar issue no Jira');
                                }

                                setCreatedIssueKey(result.issueKey);
                                toast.success(`Issue ${result.issueKey} criada no Jira com sucesso!`);
                                triggerHaptic(80);
                                
                                // Atualiza o campo de anexar automaticamente
                                if (result.issueKey) {
                                  setIssueKeyToAttach(result.issueKey);
                                }
                              } catch (e: any) {
                                console.error('Erro ao criar issue no Jira:', e);
                                toast.error(e.message || 'Falha ao criar issue no Jira');
                              } finally {
                                setCreatingJiraIssue(false);
                              }
                            }} 
                            disabled={creatingJiraIssue}
                            className="w-full"
                          >
                            {creatingJiraIssue ? 'Criando...' : 'Criar Issue no Jira'}
                          </Button>
                        </div>

                        <div className="border-t pt-4 space-y-3">
                          {/* Anexar PDF em Issue Existente */}
                          <div className="text-sm font-medium">Anexar PDF em Issue Existente</div>
                          <div className="text-xs text-muted-foreground">
                            Informe a issue (ex.: PROJ-123) e anexaremos o PDF atual da pré-visualização.
                          </div>
                          <div className="flex gap-2">
                            <Input 
                              placeholder="PROJ-123" 
                              value={issueKeyToAttach} 
                              onChange={(e)=>setIssueKeyToAttach(e.target.value)} 
                            />
                            <Button 
                              type="button" 
                              onClick={async ()=>{
                                try {
                                  const { blob } = await generateRatPDFBlob(formData);
                                  await jiraAttach(issueKeyToAttach.trim(), `RAT-${formData.fsa || 'sem-fsa'}.pdf`, blob);
                                  toast.success('Anexado no Jira');
                                  triggerHaptic(80);
                                } catch (e) {
                                  console.error(e);
                                  toast.error('Falha ao anexar no Jira');
                                }
                              }} 
                              disabled={!issueKeyToAttach.trim()}
                            >
                              Anexar
                            </Button>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          Requer variáveis de ambiente configuradas na Vercel (JIRA_USER_EMAIL, JIRA_API_TOKEN, JIRA_CLOUD_ID).
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                  </TabsContent>
                </Tabs>
              </Card>
            </div>
          </div>
      </div>
  );
};

export default RatForm;
