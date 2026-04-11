import { useEffect, useRef, useState } from "react";
import { Card } from "./ui/card";
import { Check, Copy } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";

interface ResultCardProps {
  nomeLoja: string;
  tipo: string;
  numeroPDV?: string;
  ip: string;
  mascara: string;
  gateway: string;
  broadcast: string;
  dns1: string;
  dns2: string;
}

export const ResultCard = ({
  nomeLoja,
  tipo,
  numeroPDV,
  ip,
  mascara,
  gateway,
  broadcast,
  dns1,
  dns2
}: ResultCardProps) => {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const copyTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => {
      Object.values(copyTimeouts.current).forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, []);

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado!`);
    setCopiedStates((prev) => ({ ...prev, [label]: true }));

    if (copyTimeouts.current[label]) {
      clearTimeout(copyTimeouts.current[label]);
    }

    copyTimeouts.current[label] = setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [label]: false }));
      delete copyTimeouts.current[label];
    }, 2000);
  };

  const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col gap-2 py-2 border-b border-border last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 justify-between sm:justify-end">
        <span className="font-mono text-foreground font-medium break-all">{value}</span>
        <Button
          onClick={() => handleCopy(value, label)}
          size="icon"
          variant="ghost"
          className="h-10 w-10 hover:bg-secondary"
        >
          {copiedStates[label] ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="p-4 bg-gradient-card border-border sm:p-6">
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Loja</p>
          <p className="text-xl font-bold text-foreground">{nomeLoja}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1 bg-primary/20 rounded-md">
            <span className="text-sm font-medium text-primary">{tipo}</span>
          </div>
          {numeroPDV && (
            <div className="px-3 py-1 bg-secondary rounded-md">
              <span className="text-sm font-medium text-foreground">PDV {numeroPDV}</span>
            </div>
          )}
        </div>

        <div className="h-px bg-border" />

        <div className="space-y-1">
          <InfoRow label="IP" value={ip} />
          <InfoRow label="Máscara" value={mascara} />
          <InfoRow label="Gateway" value={gateway} />
          {broadcast !== "N/A" && <InfoRow label="Broadcast" value={broadcast} />}
          <InfoRow label="DNS Primário" value={dns1} />
          <InfoRow label="DNS Secundário" value={dns2} />
        </div>
      </div>
    </Card>
  );
};
