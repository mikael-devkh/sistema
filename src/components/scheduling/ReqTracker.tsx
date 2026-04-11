import { useState, useEffect } from 'react';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { searchIssues, parseIssue } from '../../lib/jiraScheduling';
import { SCHED_FIELDS } from '../../lib/schedulingConstants';
import type { SchedulingIssue } from '../../types/scheduling';

const LS_KEY = 'wt_req_tracker_v1';

interface Match {
  req: string;
  key: string;
  loja: string;
  status: string;
}

export function ReqTracker({ allIssues }: { allIssues: SchedulingIssue[] }) {
  const [text, setText] = useState<string>(() => localStorage.getItem(LS_KEY) || '');
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => { localStorage.setItem(LS_KEY, text); }, [text]);

  const reqs = [...new Set((text.match(/\d{5,15}/g) || []))];

  const search = async () => {
    if (!reqs.length) return;
    setSearching(true);

    const found: Match[] = [];

    // First check in-memory allIssues (already loaded)
    for (const issue of allIssues) {
      if (reqs.includes(issue.req) && issue.req) {
        found.push({ req: issue.req, key: issue.key, loja: issue.loja, status: issue.status });
      }
    }

    // For not-yet-found REQs, do a Jira text search
    const foundReqs = new Set(found.map(m => m.req));
    const missing = reqs.filter(r => !foundReqs.has(r));
    if (missing.length) {
      try {
        const jqlParts = missing.map(r => `text ~ "${r}"`).join(' OR ');
        const extras = await searchIssues(`project = FSA AND (${jqlParts})`, 50);
        for (const raw of extras) {
          const issue = parseIssue(raw);
          const rawStr = JSON.stringify(raw);
          const matchedReq = missing.find(r => rawStr.includes(r));
          if (matchedReq && !found.find(m => m.key === issue.key)) {
            found.push({ req: matchedReq, key: issue.key, loja: issue.loja, status: issue.status });
          }
        }
      } catch { /* ignore */ }
    }

    setMatches(found);
    setSearched(true);
    setSearching(false);
  };

  const clearFound = () => {
    const foundReqs = new Set(matches.map(m => m.req));
    const remaining = reqs.filter(r => !foundReqs.has(r));
    setText(remaining.join('\n'));
    setMatches([]);
    setSearched(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground mb-2">
          Cole qualquer texto com números de REQ. O sistema detecta automaticamente os números e verifica se já integraram no Jira.
        </p>
        <Textarea
          rows={5}
          placeholder="Cole mensagens do WhatsApp, e-mails, etc. contendo os números de REQ…"
          value={text}
          onChange={e => { setText(e.target.value); setSearched(false); }}
          className="font-mono text-sm"
        />
      </div>

      {reqs.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Detectadas <strong>{reqs.length}</strong> possível(is) REQ(s): {reqs.join(', ')}
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={search} disabled={searching || !reqs.length} size="sm">
          {searching ? 'Buscando…' : '🔍 Verificar REQs no Jira'}
        </Button>
        {matches.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearFound}>Limpar REQs encontradas</Button>
        )}
      </div>

      {searched && (
        <div className="space-y-2">
          {matches.length > 0 ? (
            <>
              <p className="text-sm font-semibold text-green-600">🎉 {matches.length} REQ(s) já integraram no Jira!</p>
              {matches.map(m => (
                <div key={m.key} className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded text-sm">
                  <Badge variant="outline" className="font-mono text-xs">{m.req}</Badge>
                  <span>→</span>
                  <span className="font-semibold">{m.key}</span>
                  <span className="text-muted-foreground">| {m.loja}</span>
                  <Badge variant="secondary" className="text-[10px]">{m.status}</Badge>
                </div>
              ))}
            </>
          ) : (
            <p className="text-sm text-yellow-600">⏳ Monitorando {reqs.length} REQ(s)… Ainda não foram criadas no Jira.</p>
          )}
        </div>
      )}
    </div>
  );
}
