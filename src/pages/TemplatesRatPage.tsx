import { Card } from "../components/ui/card";
import { RatTemplatesBrowser } from "../components/RatTemplatesBrowser";
import { Layers } from "lucide-react";
import { usePageLoading } from "../hooks/use-page-loading";
import { Skeleton } from "../components/ui/skeleton";

export default function TemplatesRatPage() {
  const loading = usePageLoading(400, []);
  return (
    <div className="max-w-5xl mx-auto pt-4 pb-10 space-y-6">
      <Card className="p-6 mb-4 bg-background/90 flex flex-col gap-4 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Layers className="text-primary w-7 h-7" />
          <h2 className="text-xl sm:text-2xl font-bold">Templates de RAT</h2>
        </div>
        <div className="text-muted-foreground text-sm mb-2">Crie, edite e duplique modelos de laudo para agilizar seus registros técnicos e padronizar os atendimentos mais comuns no seu time.</div>
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
