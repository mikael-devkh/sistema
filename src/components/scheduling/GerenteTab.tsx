import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { searchIssuesFields, gerarMensagemGerente } from '../../lib/jiraScheduling';
import { JQL, CONTACT_FIELDS, CF } from '../../lib/schedulingConstants';
import type { LojaGroup, ManagerContact } from '../../types/scheduling';

// ─── Manager contacts fetcher ─────────────────────────────────────────────────

async function fetchContacts(lojas: string[]): Promise<ManagerContact[]> {
  if (!lojas.length) return [];
  const contacts: ManagerContact[] = [];
  const seenLojas = new Set<string>();

  for (let i = 0; i < lojas.length; i += 30) {
    const chunk = lojas.slice(i, i + 30);
    try {
      const issues = await searchIssuesFields(JQL.CONTATOS(chunk), CONTACT_FIELDS, 100);
      for (const raw of issues) {
        const f = raw.fields || {};
        const lojaRaw = f[CF.LOJA];
        const loja = (typeof lojaRaw === 'object' ? lojaRaw?.value : lojaRaw) || '';
        if (!loja || seenLojas.has(loja)) continue;

        const nomeRaw = f[CF.NOME_GERENTE];
        const telRaw = f[CF.TEL_GERENTE];
        const nome = (typeof nomeRaw === 'object' ? nomeRaw?.value || nomeRaw?.name : nomeRaw) || '';
        const tel = (typeof telRaw === 'object' ? telRaw?.value || telRaw?.name : telRaw) || '';

        if (tel && tel !== '--') {
          contacts.push({ loja, nome: String(nome), telefone: String(tel) });
          seenLojas.add(loja);
        }
      }
    } catch { /* ignore chunk errors */ }
  }
  return contacts;
}

// ─── Single loja card ─────────────────────────────────────────────────────────

function GerenteCard({ group, contact, isProjeto }: { group: LojaGroup; contact?: ManagerContact; isProjeto: boolean }) {
  const [open, setOpen] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedContact, setCopiedContact] = useState(false);

  const msg = gerarMensagemGerente(group.loja, group.issues, isProjeto);
  const contactStr = contact ? `${contact.nome} - ${contact.telefone}` : 'Não informado';

  const copy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/60 transition text-left border border-border/50">
          <span className="flex items-center gap-2">
            {group.isCritical && <span className="text-destructive">🔴</span>}
            <span className="font-medium text-sm">{group.loja}</span>
            {group.cidade && <span className="text-xs text-muted-foreground">{group.cidade} – {group.uf}</span>}
            <Badge variant="secondary" className="text-xs">{group.qtd} chamado(s)</Badge>
          </span>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 border border-border/40 rounded-md p-3 grid md:grid-cols-2 gap-4">
          {/* Message */}
          <div className="relative">
            <button
              className="absolute top-1 right-1 p-1 rounded hover:bg-muted transition"
              onClick={() => copy(msg, setCopiedMsg)}
              title="Copiar mensagem"
            >
              {copiedMsg ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </button>
            <p className="text-xs font-semibold mb-1 text-muted-foreground">Mensagem Padronizada:</p>
            <pre className="text-xs bg-muted/50 rounded p-3 pr-8 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-72">{msg}</pre>
          </div>

          {/* Contact */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Dados do Gerente:</p>
            <div className="bg-muted/50 rounded p-3 space-y-1 text-sm">
              <div><span className="font-medium">Nome:</span> {contact?.nome || 'Não informado'}</div>
              <div><span className="font-medium">Telefone:</span> {contact?.telefone || 'Não informado'}</div>
            </div>
            {contact && (
              <div className="relative">
                <button
                  className="absolute top-1 right-1 p-1 rounded hover:bg-muted transition"
                  onClick={() => copy(contactStr, setCopiedContact)}
                  title="Copiar contato"
                >
                  {copiedContact ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </button>
                <pre className="text-xs bg-muted/50 rounded p-2 pr-8 font-mono">{contactStr}</pre>
              </div>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { allLojaGroups: LojaGroup[] }

export function GerenteTab({ allLojaGroups }: Props) {
  const [filter, setFilter] = useState('');

  const lojaNames = allLojaGroups.map(g => g.loja);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['gerente-contacts', lojaNames.sort().join(',')],
    queryFn: () => fetchContacts(lojaNames),
    staleTime: 30 * 60 * 1000,
    enabled: lojaNames.length > 0,
  });

  const contactMap = new Map(contacts.map(c => [c.loja, c]));

  const manutencao = allLojaGroups.filter(g =>
    !g.issues.some(i => i.problema.includes('Projeto Terminal de Consulta') || i.ativo === '--')
  );
  const projeto = allLojaGroups.filter(g =>
    g.issues.some(i => i.problema.includes('Projeto Terminal de Consulta') || i.ativo === '--')
  );

  const filterFn = (g: LojaGroup) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return g.loja.toLowerCase().includes(q) || g.cidade.toLowerCase().includes(q);
  };

  const renderList = (groups: LojaGroup[], isProjeto: boolean) => (
    <div className="space-y-1 mt-2">
      {groups.filter(filterFn).map(g => (
        <GerenteCard key={g.loja} group={g} contact={contactMap.get(g.loja)} isProjeto={isProjeto} />
      ))}
      {groups.filter(filterFn).length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma loja encontrada.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Mensagens padronizadas para contato com gerente de loja. {isLoading && 'Carregando contatos…'}
      </p>

      <Input
        placeholder="🔎 Filtrar por loja ou cidade…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        className="max-w-sm h-8"
      />

      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold mb-1">🔧 Manutenção Regular ({manutencao.length})</p>
          {renderList(manutencao, false)}
        </div>
        <div>
          <p className="text-sm font-semibold mb-1">🖥️ Projeto Terminal ({projeto.length})</p>
          {renderList(projeto, true)}
        </div>
      </div>
    </div>
  );
}
