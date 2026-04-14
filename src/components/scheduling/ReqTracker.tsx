import { useState, useEffect, useRef } from 'react';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, Search, X, CloudOff } from 'lucide-react';
import { searchIssues, parseIssue } from '../../lib/jiraScheduling';
import { CF } from '../../lib/schedulingConstants';
import type { SchedulingIssue } from '../../types/scheduling';
import { db } from '../../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const FS_COL = 'sharedData';
const FS_ID  = 'reqTracker';

interface Match {
  req: string;
  key: string;
  loja: string;
  status: string;
}

/** Extract only digit-only tokens that look like REQ numbers (5–15 digits) */
function extractReqs(text: string): string[] {
  return [...new Set((text.match(/\b\d{5,15}\b/g) || []))];
}

export function ReqTracker({ allIssues }: { allIssues: SchedulingIssue[] }) {
  const [text, setText] = useState<string>('');
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [notFound, setNotFound] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);
  const [syncError, setSyncError] = useState(false);

  // Tracks whether we have a pending debounced write (so onSnapshot echo doesn't overwrite)
  const pendingWrite = useRef(false);
  const debounceRef = useRef<number | null>(null);

  // ── Firestore sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    const ref = doc(db, FS_COL, FS_ID);
    const unsub = onSnapshot(
      ref,
      snap => {
        // Don't overwrite user's active typing with our own echo
        if (!pendingWrite.current) {
          setText(snap.data()?.text ?? '');
        }
        setSyncError(false);
      },
      () => setSyncError(true),
    );
    return unsub;
  }, []);

  const handleTextChange = (newText: string) => {
    setText(newText);
    setSearched(false);
    pendingWrite.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        await setDoc(doc(db, FS_COL, FS_ID), { text: newText }, { merge: true });
      } catch {
        setSyncError(true);
      } finally {
        pendingWrite.current = false;
      }
    }, 1500);
  };

  const reqs = extractReqs(text);

  const search = async () => {
    if (!reqs.length) return;
    setSearching(true);
    setMatches([]);
    setNotFound([]);

    const found: Match[] = [];

    // ── 1. Check in-memory issues (already loaded, instant) ───────────────────
    for (const issue of allIssues) {
      if (issue.req && reqs.includes(issue.req)) {
        found.push({ req: issue.req, key: issue.key, loja: issue.loja, status: issue.status });
      }
    }

    // ── 2. For REQs not yet found, query Jira using the correct field + wildcard
    const foundReqs = new Set(found.map(m => m.req));
    const missing = reqs.filter(r => !foundReqs.has(r));

    if (missing.length) {
      const jqlParts = missing.map(r => `"${CF.REQ}" ~ "${r}*"`).join(' OR ');
      const jql = `project = FSA AND (${jqlParts})`;
      try {
        const extras = await searchIssues(jql, 100);
        for (const raw of extras) {
          const issue = parseIssue(raw);
          if (issue.req && missing.includes(issue.req) && !found.find(m => m.key === issue.key)) {
            found.push({ req: issue.req, key: issue.key, loja: issue.loja, status: issue.status });
            foundReqs.add(issue.req);
            continue;
          }
          const rawStr = JSON.stringify(raw.fields?.[CF.REQ] ?? raw);
          const matchedReq = missing.find(r => rawStr.includes(r));
          if (matchedReq && !foundReqs.has(matchedReq) && !found.find(m => m.key === issue.key)) {
            found.push({ req: matchedReq, key: issue.key, loja: issue.loja, status: issue.status });
            foundReqs.add(matchedReq);
          }
        }
      } catch {
        // Jira unavailable — show only in-memory hits
      }
    }

    setMatches(found);
    setNotFound(reqs.filter(r => !found.find(m => m.req === r)));
    setSearched(true);
    setSearching(false);
  };

  const clearFound = () => {
    const foundSet = new Set(matches.map(m => m.req));
    handleTextChange(reqs.filter(r => !foundSet.has(r)).join('\n'));
    setMatches([]);
    setNotFound([]);
    setSearched(false);
  };

  const statusColor = (s: string) => {
    const l = s.toLowerCase();
    if (l.includes('campo')) return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    if (l.includes('agendado')) return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
    if (l.includes('agendamento')) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    if (l.includes('resolv') || l.includes('encerr') || l.includes('done')) return 'bg-green-500/15 text-green-300 border-green-500/30';
    return 'bg-secondary text-muted-foreground border-border';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Cole qualquer texto contendo números de REQ. O sistema detecta os números (5–15 dígitos) e
          busca no campo <span className="font-mono text-xs bg-secondary px-1 rounded">customfield_14886</span> do Jira.
        </p>
        {syncError && (
          <span className="flex items-center gap-1 text-xs text-destructive shrink-0">
            <CloudOff className="w-3.5 h-3.5" /> Sem sincronismo
          </span>
        )}
      </div>

      <Textarea
        rows={5}
        placeholder="Cole mensagens do WhatsApp, e-mails, planilhas… ex: REQ 3179834, 3180001"
        value={text}
        onChange={e => handleTextChange(e.target.value)}
        className="font-mono text-sm"
      />

      {reqs.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">{reqs.length}</strong> REQ(s) detectada(s):{' '}
          <span className="font-mono">{reqs.join(', ')}</span>
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button onClick={search} disabled={searching || !reqs.length} size="sm" className="gap-1.5">
          {searching
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando…</>
            : <><Search className="w-3.5 h-3.5" /> Verificar no Jira</>}
        </Button>
        {matches.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={clearFound}>
            <X className="w-3.5 h-3.5" /> Remover encontradas
          </Button>
        )}
        {text && (
          <Button variant="ghost" size="sm" onClick={() => {
            handleTextChange('');
            setMatches([]);
            setNotFound([]);
            setSearched(false);
          }}>
            Limpar tudo
          </Button>
        )}
      </div>

      {searched && (
        <div className="space-y-3">
          {matches.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-green-400">
                ✓ {matches.length} REQ(s) encontrada(s) no Jira
              </p>
              {matches.map(m => (
                <div
                  key={`${m.req}-${m.key}`}
                  className="flex flex-wrap items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/25 rounded-lg text-sm"
                >
                  <span className="font-mono font-semibold text-green-300 text-xs">{m.req}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-semibold">{m.key}</span>
                  <span className="text-muted-foreground text-xs truncate max-w-[160px]">{m.loja}</span>
                  <Badge className={`text-[10px] border ml-auto ${statusColor(m.status)}`}>
                    {m.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {notFound.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-amber-400">
                ⏳ {notFound.length} REQ(s) ainda não encontrada(s) no Jira
              </p>
              {notFound.map(r => (
                <div
                  key={r}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/25 rounded-lg"
                >
                  <span className="font-mono text-xs text-amber-300">{r}</span>
                  <span className="text-xs text-muted-foreground">Aguardando criação de chamado…</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
