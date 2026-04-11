import { useParams } from "react-router-dom";
import { Card } from "../components/ui/card";

export default function Loja360() {
  const { fsaId } = useParams();
  return (
    <div className="max-w-6xl mx-auto pt-4 pb-10 space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold">Loja/FSA {fsaId}</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">Chamados abertos (em breve)</Card>
        <Card className="p-4">Últimas RATs (em breve)</Card>
        <Card className="p-4 md:col-span-2">Tempo gasto no mês, peças recorrentes (em breve)</Card>
      </div>
    </div>
  );
}


