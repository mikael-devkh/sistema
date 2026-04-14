import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import {
  Network, FileText, ArrowLeft, Store,
  Calendar, Wrench, Clock, ExternalLink, MapPin,
} from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import { getStoreData } from "../data/storesData";
import { db } from "../firebase";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { RatFormData } from "../types/rat";

interface RatEntry {
  id: string;
  timestamp: number;
  fsa?: string;
  codigoLoja?: string;
  pdv?: string;
  defeitoProblema?: string;
  formData?: RatFormData;
}

export default function Loja360() {
  const { lojaId } = useParams<{ lojaId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rats, setRats] = useState<RatEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const storeNum = lojaId ? parseInt(lojaId, 10) : NaN;
  const store = isNaN(storeNum) ? undefined : getStoreData(storeNum);

  useEffect(() => {
    if (!user || !lojaId) { setLoading(false); return; }

    const q = query(
      collection(db, "serviceReports"),
      where("userId", "==", user.uid),
      where("codigoLoja", "==", lojaId),
      orderBy("timestamp", "desc"),
      limit(20),
    );

    getDocs(q)
      .then(snap => setRats(snap.docs.map(d => ({ id: d.id, ...d.data() } as RatEntry))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, lojaId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-10 animate-page-in">
        <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="max-w-3xl mx-auto pt-10 space-y-4 text-center animate-page-in">
        <Store className="w-12 h-12 mx-auto text-muted-foreground opacity-40" />
        <h2 className="text-xl font-bold">Loja {lojaId} não encontrada</h2>
        <p className="text-sm text-muted-foreground">Verifique o código e tente novamente.</p>
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10 animate-page-in">

      {/* Header */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
        <div className="p-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0">
                <Store className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{store.nomeLoja}</h1>
                <p className="text-sm text-muted-foreground">Código {lojaId}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => navigate("/gerador-ip", { state: { loja: lojaId } })}
              >
                <Network className="w-3.5 h-3.5" /> Gerar IP
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                asChild
              >
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=Lojas+Americanas+${lojaId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin className="w-3.5 h-3.5" /> Maps
                </a>
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => navigate("/rat", { state: { codigoLoja: lojaId } })}
              >
                <FileText className="w-3.5 h-3.5" /> Nova RAT
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* Informações de rede */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Network className="w-4 h-4 text-primary" /> Configuração de Rede
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="text-muted-foreground">IP Base Desktop</span>
              <span className="font-mono font-medium">{store.ipDesktop.replace('.xx', '.45')}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="text-muted-foreground">IP Base PDV</span>
              <span className="font-mono font-medium">{store.ipPDV.replace('.xx', '.100+')}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border">
              <span className="text-muted-foreground">Gateway Desktop</span>
              <span className="font-mono font-medium">
                {store.ipDesktop.replace(/\.\d+$/, '.126')}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Gateway PDV</span>
              <span className="font-mono font-medium">
                {store.ipPDV.replace(/\.\d+$/, '.254')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Resumo RATs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="w-4 h-4 text-primary" /> Resumo de Atendimentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loading ? (
              <>
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
              </>
            ) : (
              <>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Total de RATs geradas</span>
                  <span className="font-semibold">{rats.length}</span>
                </div>
                {rats.length > 0 && (
                  <div className="flex justify-between py-1.5 border-b border-border">
                    <span className="text-muted-foreground">Último atendimento</span>
                    <span className="font-medium">
                      {format(new Date(rats[0].timestamp), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}
                {rats.length > 0 && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">PDVs atendidos</span>
                    <span className="font-medium">
                      {[...new Set(rats.map(r => r.pdv).filter(Boolean))].join(", ") || "—"}
                    </span>
                  </div>
                )}
                {rats.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhuma RAT registrada para esta loja.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Histórico de RATs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-primary" /> Histórico de RATs
            {rats.length > 0 && (
              <Badge variant="secondary" className="ml-auto font-normal">
                {rats.length} registro{rats.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : rats.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <FileText className="w-8 h-8 opacity-30" />
              <p className="text-sm">Nenhuma RAT registrada para esta loja ainda.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 gap-1.5"
                onClick={() => navigate("/rat", { state: { codigoLoja: lojaId } })}
              >
                <FileText className="w-3.5 h-3.5" /> Gerar primeira RAT
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {rats.map(rat => (
                <div
                  key={rat.id}
                  className="flex flex-wrap items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors cursor-pointer"
                  onClick={() => navigate("/rat", { state: { fsa: rat.fsa } })}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {rat.fsa && (
                        <span className="font-mono text-sm font-semibold text-primary">
                          {rat.fsa}
                        </span>
                      )}
                      {rat.pdv && (
                        <Badge variant="outline" className="text-[11px]">PDV {rat.pdv}</Badge>
                      )}
                    </div>
                    {rat.defeitoProblema && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {rat.defeitoProblema}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(rat.timestamp), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    <ExternalLink className="w-3 h-3 ml-1 opacity-40" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
