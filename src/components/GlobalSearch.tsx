import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import { FileText, Search, User, BarChart3, Network, NotebookPen } from 'lucide-react';
import { searchFsaByNumber } from '../lib/fsa';
import { loadEditableTemplates } from '../utils/data-editor-utils';

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  type: 'route' | 'fsa' | 'template';
  action: () => void;
  icon: React.ComponentType<{ className?: string }>;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    const searchResults: SearchResult[] = [];

    // Rotas principais
    const routes = [
      { path: '/rat', label: 'RAT', icon: FileText },
      { path: '/support', label: 'KB/RAT Pré-pronta', icon: NotebookPen },
      { path: '/service-manager', label: 'Chamados/Mídia', icon: User },
      { path: '/reports', label: 'Relatórios', icon: BarChart3 },
      { path: '/gerador-ip', label: 'Gerador de IP', icon: Network },
    ];

    routes.forEach(route => {
      if (route.label.toLowerCase().includes(searchTerm.toLowerCase())) {
        searchResults.push({
          id: route.path,
          title: route.label,
          type: 'route',
          action: () => {
            navigate(route.path);
            setOpen(false);
          },
          icon: route.icon,
        });
      }
    });

    // Buscar FSA se parecer um número
    if (/^\d{4,6}$/.test(searchTerm.trim())) {
      searchResults.push({
        id: 'fsa-search',
        title: `Buscar FSA ${searchTerm}`,
        description: 'Buscar no Jira',
        type: 'fsa',
        action: async () => {
          try {
            const issue = await searchFsaByNumber(searchTerm);
            navigate('/rat', { state: { fsa: issue.key } });
            setOpen(false);
          } catch (error) {
            console.error('Erro ao buscar FSA:', error);
          }
        },
        icon: Search,
      });
    }

    // Buscar templates
    try {
      const templates = loadEditableTemplates();
      templates.forEach(template => {
        if (
          template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          template.defeito?.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          searchResults.push({
            id: `template-${template.id}`,
            title: template.title,
            description: 'Template RAT',
            type: 'template',
            action: () => {
              navigate('/rat', { state: { templateId: template.id } });
              setOpen(false);
            },
            icon: FileText,
          });
        }
      });
    } catch {}

    setResults(searchResults);
  }, [searchTerm, navigate]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Buscar páginas, FSAs, templates... (Cmd/Ctrl+K)" 
        value={searchTerm}
        onValueChange={setSearchTerm}
      />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Resultados">
            {results.map((result) => {
              const Icon = result.icon;
              return (
                <CommandItem
                  key={result.id}
                  onSelect={result.action}
                  className="flex items-center gap-3"
                >
                  <Icon className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{result.title}</span>
                    {result.description && (
                      <span className="text-xs text-muted-foreground">
                        {result.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
