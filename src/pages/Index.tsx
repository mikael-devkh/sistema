import { useState } from "react";
import { Card } from "../components/ui/card";
import { FileText, Layers, User, PlusCircle, Settings } from "lucide-react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const usuarioNome = "João"; // Substitua por nome real, se houver contexto

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <Card className="w-full bg-gradient-to-br from-primary/10 to-secondary/30 rounded-xl shadow-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-2">{getGreeting()}, {usuarioNome}!</h2>
        <p className="text-slate-500 mb-3">Veja rapidamente o status dos principais atendimentos:</p>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Card className="p-4 flex flex-col items-center gap-2 hover:shadow-xl transition">
            <FileText size={32} className="text-primary" />
            <span className="font-bold text-lg">12 RATs Emitidas</span>
            <small className="text-muted-foreground">Este mês</small>
          </Card>
          <Card className="p-4 flex flex-col items-center gap-2 hover:shadow-xl transition">
            <Layers size={32} className="text-green-500" />
            <span className="font-bold text-lg">3 Pendentes</span>
            <small className="text-muted-foreground">Precisam de atenção</small>
          </Card>
          <Card className="p-4 flex flex-col items-center gap-2 hover:shadow-xl transition">
            <User size={32} className="text-sky-500" />
            <span className="font-bold text-lg">Seu Perfil</span>
            <small className="text-muted-foreground">Gerencie dados e segurança</small>
          </Card>
          <Card className="p-4 flex flex-col items-center gap-2 hover:shadow-xl transition">
            <Settings size={32} className="text-zinc-500" />
            <span className="font-bold text-lg">Configurações</span>
            <small className="text-muted-foreground">Preferências e acesso</small>
          </Card>
        </div>
        <div className="flex flex-wrap gap-3 mt-8">
          <a href="/rat" className="bg-primary text-white font-semibold px-6 py-3 rounded-lg flex items-center gap-2 shadow transition hover:bg-primary/80">
            <PlusCircle className="w-5 h-5" /> Nova RAT
          </a>
          <a href="/historico" className="bg-secondary font-semibold px-6 py-3 rounded-lg flex items-center gap-2 border border-primary/10 shadow hover:bg-primary/10 transition">
            <Layers className="w-5 h-5" /> Histórico
          </a>
          <a href="/configuracoes" className="bg-secondary font-semibold px-6 py-3 rounded-lg flex items-center gap-2 border border-primary/10 shadow hover:bg-primary/10 transition">
            <Settings className="w-5 h-5" /> Configurações
          </a>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
