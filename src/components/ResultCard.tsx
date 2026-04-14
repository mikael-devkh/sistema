import { useEffect, useRef, useState } from "react";
import { Card } from "./ui/card";
import { Check, Copy, ChevronDown, Monitor } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { cn } from "../lib/utils";

interface ResultCardProps {
  nomeLoja: string;
  lojaNum?: string;
  tipo: string;
  numeroPDV?: string;
  ip: string;
  mascara: string;
  gateway: string;
  broadcast: string;
  dns1: string;
  dns2: string;
}

const DNS_AME_1 = "10.122.70.20";
const DNS_AME_2 = "10.123.28.4";
const DOMAIN    = "lasa.lojasamericanas.com.br";

export const ResultCard = ({
  nomeLoja,
  lojaNum,
  tipo,
  numeroPDV,
  ip,
  mascara,
  gateway,
  broadcast,
  dns1,
  dns2,
}: ResultCardProps) => {
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const copyTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const isDesktop = tipo === "Desktop";

  useEffect(() => {
    return () => {
      Object.values(copyTimeouts.current).forEach(clearTimeout);
    };
  }, []);

  const handleCopy = (value: string, key: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado!`);
    setCopiedStates(prev => ({ ...prev, [key]: true }));
    if (copyTimeouts.current[key]) clearTimeout(copyTimeouts.current[key]);
    copyTimeouts.current[key] = setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [key]: false }));
      delete copyTimeouts.current[key];
    }, 2000);
  };

  // Build the "copy all" text block in the requested order
  const buildCopyAll = (d1: string, d2: string) => {
    const lines = [
      `IP: ${ip}`,
      `Máscara: ${mascara}`,
      ...(broadcast !== "N/A" ? [`Broadcast: ${broadcast}`] : []),
      `DNS Primário: ${d1}`,
      `DNS Secundário: ${d2}`,
      `Gateway: ${gateway}`,
    ];
    return lines.join("\n");
  };

  const handleCopyAll = (d1 = dns1, d2 = dns2, suffix = "") => {
    navigator.clipboard.writeText(buildCopyAll(d1, d2));
    const key = `all${suffix}`;
    toast.success("Todos os IPs copiados!");
    setCopiedStates(prev => ({ ...prev, [key]: true }));
    if (copyTimeouts.current[key]) clearTimeout(copyTimeouts.current[key]);
    copyTimeouts.current[key] = setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [key]: false }));
      delete copyTimeouts.current[key];
    }, 2000);
  };

  // Hostname pattern for desktop
  const lojaFormatted = lojaNum ? lojaNum.padStart(5, "0") : "xxxxx";
  const hostname = `LJ${lojaFormatted}DK`;

  const InfoRow = ({
    label,
    value,
    copyKey,
  }: {
    label: string;
    value: string;
    copyKey: string;
  }) => (
    <div className="flex flex-col gap-2 py-2 border-b border-border last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 justify-between sm:justify-end">
        <span className="font-mono text-foreground font-medium break-all">{value}</span>
        <Button
          onClick={() => handleCopy(value, copyKey, label)}
          size="icon"
          variant="ghost"
          className="h-10 w-10 hover:bg-secondary shrink-0"
        >
          {copiedStates[copyKey]
            ? <Check className="h-4 w-4 text-primary" />
            : <Copy className="h-4 w-4 text-muted-foreground" />}
        </Button>
      </div>
    </div>
  );

  // Main IP rows: IP → Máscara → Broadcast → DNS1 → DNS2 → Gateway
  const MainRows = ({ d1, d2, suffix = "" }: { d1: string; d2: string; suffix?: string }) => (
    <>
      <InfoRow label="IP"             value={ip}       copyKey={`ip${suffix}`} />
      <InfoRow label="Máscara"        value={mascara}  copyKey={`mask${suffix}`} />
      {broadcast !== "N/A" && (
        <InfoRow label="Broadcast"    value={broadcast} copyKey={`bc${suffix}`} />
      )}
      <InfoRow label="DNS Primário"   value={d1}       copyKey={`dns1${suffix}`} />
      <InfoRow label="DNS Secundário" value={d2}       copyKey={`dns2${suffix}`} />
      <InfoRow label="Gateway"        value={gateway}  copyKey={`gw${suffix}`} />
    </>
  );

  return (
    <Card className="p-4 bg-gradient-card border-border sm:p-6">
      <div className="space-y-4">
        {/* Header */}
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

        {/* IP rows */}
        <div className="space-y-1">
          <MainRows d1={dns1} d2={dns2} />
        </div>

        {/* Copy all button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => handleCopyAll(dns1, dns2)}
        >
          {copiedStates["all"]
            ? <Check className="h-4 w-4 text-primary" />
            : <Copy className="h-4 w-4" />}
          Copiar todos os IPs
        </Button>

        {/* Desktop — expandable AME DNS section */}
        {isDesktop && (
          <div className="rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setDesktopExpanded(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-secondary/50 hover:bg-secondary/80 transition-colors text-sm font-medium"
            >
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary" />
                <span>Configuração Desktop — DNS AME</span>
              </div>
              <ChevronDown
                className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", desktopExpanded && "rotate-180")}
              />
            </button>

            {desktopExpanded && (
              <div className="px-4 pb-4 pt-2 space-y-4 bg-card">
                {/* AME IP rows */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">IPs com DNS AME</p>
                  <MainRows d1={DNS_AME_1} d2={DNS_AME_2} suffix="-ame" />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => handleCopyAll(DNS_AME_1, DNS_AME_2, "-ame")}
                >
                  {copiedStates["all-ame"]
                    ? <Check className="h-4 w-4 text-primary" />
                    : <Copy className="h-4 w-4" />}
                  Copiar IPs com DNS AME
                </Button>

                <div className="h-px bg-border" />

                {/* Hostname pattern */}
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Identificação da Máquina</p>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-1">
                    <div className="space-y-0.5">
                      <span className="text-sm text-muted-foreground">Nome do computador</span>
                      <p className="text-xs text-muted-foreground/70">
                        Substitua <span className="font-mono text-amber-500">yyyyy</span> pelo nº de patrimônio
                      </p>
                    </div>
                    <div className="flex items-center gap-2 justify-between sm:justify-end">
                      <span className="font-mono text-foreground font-medium">
                        <span className="text-primary">{hostname}</span>
                        <span className="text-amber-500">yyyyy</span>
                      </span>
                      <Button
                        onClick={() => handleCopy(`${hostname}yyyyy`, "hostname", "Hostname")}
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 hover:bg-secondary shrink-0"
                      >
                        {copiedStates["hostname"]
                          ? <Check className="h-4 w-4 text-primary" />
                          : <Copy className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-1 border-t border-border">
                    <span className="text-sm text-muted-foreground">Domínio</span>
                    <div className="flex items-center gap-2 justify-between sm:justify-end">
                      <span className="font-mono text-foreground font-medium">{DOMAIN}</span>
                      <Button
                        onClick={() => handleCopy(DOMAIN, "domain", "Domínio")}
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 hover:bg-secondary shrink-0"
                      >
                        {copiedStates["domain"]
                          ? <Check className="h-4 w-4 text-primary" />
                          : <Copy className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
