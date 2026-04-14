import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './ui/command';
import {
  FileText,
  Search,
  BarChart3,
  Network,
  NotebookPen,
  BookOpen,
  Store,
  History,
  Settings,
  LayoutDashboard,
  Wrench,
} from 'lucide-react';
import { searchFsaByNumber } from '../lib/fsa';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import type { RatTemplate } from '../data/ratTemplatesData';
import { getStoreData } from '../data/storesData';
import { useKnowledgeBase } from '../hooks/use-knowledge-base';

// ─── Rotas ────────────────────────────────────────────────────────────────────

const ROUTES = [
  { path: '/',                   label: 'Dashboard',          icon: LayoutDashboard },
  { path: '/rat',                label: 'Nova RAT',           icon: FileText        },
  { path: '/agendamento',        label: 'Agendamentos',       icon: NotebookPen     },
  { path: '/gerador-ip',         label: 'Gerador de IP',      icon: Network         },
  { path: '/base-conhecimento',  label: 'Base de Conhecimento', icon: BookOpen      },
  { path: '/templates-rat',      label: 'Templates de RAT',   icon: FileText        },
  { path: '/centro-suporte',     label: 'Centro de Suporte',  icon: Wrench          },
  { path: '/configuracoes',      label: 'Configurações',      icon: Settings        },
];

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ResultType = 'route' | 'fsa' | 'template' | 'store' | 'kb' | 'history';

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  type: ResultType;
  action: () => void;
  icon: React.ComponentType<{ className?: string }>;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function GlobalSearch() {
  const [open, setOpen]           = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [templates, setTemplates] = useState<RatTemplate[]>([]);
  const [recentFsas, setRecentFsas] = useState<{ fsa: string; loja?: string; ts: number }[]>([]);
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const { procedures } = useKnowledgeBase();

  // ── Ctrl/Cmd+K ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // ── Reset search when closed ──
  useEffect(() => {
    if (!open) setSearchTerm('');
  }, [open]);

  // ── Load user templates from Firestore once ──
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'ratTemplates'), where('userId', '==', user.uid));
    getDocs(q)
      .then(snap => setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as RatTemplate))))
      .catch(() => {});
  }, [user]);

  // ── Load recent FSAs from Firestore (last 10 generated RATs) ──
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'serviceReports'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(10),
    );
    getDocs(q)
      .then(snap => {
        const seen = new Set<string>();
        const items: { fsa: string; loja?: string; ts: number }[] = [];
        snap.docs.forEach(d => {
          const data = d.data();
          const fsa = data.fsa as string | undefined;
          if (fsa && !seen.has(fsa)) {
            seen.add(fsa);
            items.push({ fsa, loja: data.codigoLoja, ts: data.timestamp });
          }
        });
        setRecentFsas(items);
      })
      .catch(() => {});
  }, [user]);

  // ── Build grouped results ──
  const { routeResults, storeResult, templateResults, kbResults, historyResults, fsaSearchResult } =
    useMemo(() => {
      const q = searchTerm.trim().toLowerCase();

      if (!q) return {
        routeResults: [],
        storeResult: null,
        templateResults: [],
        kbResults: [],
        historyResults: [],
        fsaSearchResult: null,
      };

      // Pages
      const routeResults: SearchResult[] = ROUTES
        .filter(r => r.label.toLowerCase().includes(q))
        .map(r => ({
          id: r.path,
          title: r.label,
          type: 'route' as ResultType,
          action: () => { navigate(r.path); setOpen(false); },
          icon: r.icon,
        }));

      // Store by number (1–10000)
      let storeResult: SearchResult | null = null;
      const numQ = parseInt(searchTerm.trim(), 10);
      if (!isNaN(numQ) && numQ >= 1 && numQ <= 10000) {
        const store = getStoreData(numQ);
        if (store) {
          storeResult = {
            id: `store-${numQ}`,
            title: `Loja ${numQ}`,
            description: store.nomeLoja,
            type: 'store',
            action: () => { navigate(`/loja/${numQ}`); setOpen(false); },
            icon: Store,
          };
        }
      }

      // Recent FSAs
      const historyResults: SearchResult[] = recentFsas
        .filter(h => h.fsa.toLowerCase().includes(q) || h.loja?.includes(q))
        .slice(0, 5)
        .map(h => ({
          id: `hist-${h.fsa}`,
          title: h.fsa,
          description: h.loja ? `Loja ${h.loja}` : 'RAT recente',
          type: 'history' as ResultType,
          action: () => { navigate('/rat', { state: { fsa: h.fsa } }); setOpen(false); },
          icon: History,
        }));

      // RAT templates
      const templateResults: SearchResult[] = templates
        .filter(t =>
          t.title.toLowerCase().includes(q) ||
          t.defeito?.toLowerCase().includes(q),
        )
        .slice(0, 5)
        .map(t => ({
          id: `tpl-${t.id}`,
          title: t.title,
          description: 'Template RAT',
          type: 'template' as ResultType,
          action: () => { navigate('/rat', { state: { templateId: t.id } }); setOpen(false); },
          icon: FileText,
        }));

      // Knowledge Base procedures
      const kbResults: SearchResult[] = procedures
        .filter(p =>
          p.title.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q)) ||
          p.content.toLowerCase().includes(q),
        )
        .slice(0, 4)
        .map(p => ({
          id: `kb-${p.id}`,
          title: p.title,
          description: p.tags.slice(0, 3).join(' • '),
          type: 'kb' as ResultType,
          action: () => { navigate('/base-conhecimento'); setOpen(false); },
          icon: BookOpen,
        }));

      // FSA Jira lookup (when term looks like FSA-NNNNN or a 4-8 digit number)
      let fsaSearchResult: SearchResult | null = null;
      if (/^(fsa-?)?\d{4,8}$/i.test(searchTerm.trim())) {
        fsaSearchResult = {
          id: 'fsa-jira',
          title: `Buscar "${searchTerm.trim()}" no Jira`,
          description: 'Busca ao vivo',
          type: 'fsa',
          action: async () => {
            setOpen(false);
            try {
              const issue = await searchFsaByNumber(searchTerm.trim());
              navigate('/rat', { state: { fsa: issue.key } });
            } catch { /* issue not found */ }
          },
          icon: Search,
        };
      }

      return { routeResults, storeResult, templateResults, kbResults, historyResults, fsaSearchResult };
    }, [searchTerm, templates, procedures, recentFsas, navigate]);

  const hasResults =
    routeResults.length > 0 ||
    storeResult !== null ||
    templateResults.length > 0 ||
    kbResults.length > 0 ||
    historyResults.length > 0 ||
    fsaSearchResult !== null;

  const ResultItem = ({ r }: { r: SearchResult }) => {
    const Icon = r.icon;
    return (
      <CommandItem onSelect={r.action} className="flex items-center gap-3 cursor-pointer">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-col min-w-0">
          <span className="truncate">{r.title}</span>
          {r.description && (
            <span className="text-xs text-muted-foreground truncate">{r.description}</span>
          )}
        </div>
      </CommandItem>
    );
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar páginas, lojas, FSAs, templates… (Ctrl+K)"
        value={searchTerm}
        onValueChange={setSearchTerm}
      />
      <CommandList>
        {!hasResults && searchTerm && <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>}

        {!searchTerm && (
          <CommandGroup heading="Acesso rápido">
            {ROUTES.slice(0, 5).map(r => {
              const Icon = r.icon;
              return (
                <CommandItem
                  key={r.path}
                  onSelect={() => { navigate(r.path); setOpen(false); }}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{r.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {routeResults.length > 0 && (
          <CommandGroup heading="Páginas">
            {routeResults.map(r => <ResultItem key={r.id} r={r} />)}
          </CommandGroup>
        )}

        {storeResult && (
          <>
            {routeResults.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Loja">
              <ResultItem r={storeResult} />
            </CommandGroup>
          </>
        )}

        {historyResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="FSAs recentes">
              {historyResults.map(r => <ResultItem key={r.id} r={r} />)}
            </CommandGroup>
          </>
        )}

        {fsaSearchResult && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Jira">
              <ResultItem r={fsaSearchResult} />
            </CommandGroup>
          </>
        )}

        {templateResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Templates RAT">
              {templateResults.map(r => <ResultItem key={r.id} r={r} />)}
            </CommandGroup>
          </>
        )}

        {kbResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Base de Conhecimento">
              {kbResults.map(r => <ResultItem key={r.id} r={r} />)}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
