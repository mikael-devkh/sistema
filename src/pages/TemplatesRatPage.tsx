import { Card } from "../components/ui/card";
import { RatTemplatesBrowser } from "../components/RatTemplatesBrowser";
import { Layers } from "lucide-react";
import { usePageLoading } from "../hooks/use-page-loading";
import { Skeleton } from "../components/ui/skeleton";

export default function TemplatesRatPage() {
  const loading = usePageLoading(400, []);
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-page-in">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Templates de RAT</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Crie, edite e duplique modelos de laudo para agilizar e padronizar seus atendimentos.
            </p>
          </div>
        </div>
      </div>

      <Card className="p-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-64" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <RatTemplatesBrowser />
        )}
      </Card>
    </div>
  );
}
