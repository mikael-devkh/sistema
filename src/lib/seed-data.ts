/**
 * seed-data.ts
 * Dados fictícios para testes de UI. Cria registros no Firestore
 * sem interação manual. Técnicos NÃO são gerados aqui — use o
 * formulário de cadastro com "Preencher exemplo" (ou cadastre via SeedPage
 * após implementar seed de técnicos).
 */

import {
  collection, addDoc, getDocs, query, where, serverTimestamp, writeBatch, doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { ChamadoStatus } from '../types/chamado';

// ─── Dados estáticos ──────────────────────────────────────────────────────────

export const SEED_CLIENTES = [
  { nome: 'Banco do Brasil', ativo: true },
  { nome: 'Itaú Unibanco', ativo: true },
  { nome: 'Bradesco', ativo: true },
];

export const SEED_SERVICOS = [
  {
    nome: 'Manutenção Preventiva PDV',
    valorReceita: 350, valorAdicionalReceita: 180, valorHoraAdicionalReceita: 45,
    valorCustoTecnico: 150, valorAdicionalCusto: 80, valorHoraAdicionalCusto: 25,
    exigePeca: false, pagaTecnico: true, pagamentoIntegral: false, isRetorno: false, horasFranquia: 2,
  },
  {
    nome: 'Troca de Impressora Fiscal',
    valorReceita: 420, valorAdicionalReceita: 210, valorHoraAdicionalReceita: 55,
    valorCustoTecnico: 180, valorAdicionalCusto: 90, valorHoraAdicionalCusto: 30,
    exigePeca: true, pagaTecnico: true, pagamentoIntegral: false, isRetorno: false, horasFranquia: 2,
  },
  {
    nome: 'Instalação de Terminal POS',
    valorReceita: 280, valorAdicionalReceita: 140, valorHoraAdicionalReceita: 40,
    valorCustoTecnico: 120, valorAdicionalCusto: 60, valorHoraAdicionalCusto: 20,
    exigePeca: false, pagaTecnico: true, pagamentoIntegral: false, isRetorno: false, horasFranquia: 2,
  },
  {
    nome: 'Retorno / Revisão (SPARE)',
    valorReceita: 200, valorAdicionalReceita: 0, valorHoraAdicionalReceita: 0,
    valorCustoTecnico: 80, valorAdicionalCusto: 0, valorHoraAdicionalCusto: 0,
    exigePeca: false, pagaTecnico: true, pagamentoIntegral: true, isRetorno: true, horasFranquia: 1,
  },
  {
    nome: 'Visita de Falha (Sem Repasse)',
    valorReceita: 150, valorAdicionalReceita: 0, valorHoraAdicionalReceita: 0,
    valorCustoTecnico: 0, valorAdicionalCusto: 0, valorHoraAdicionalCusto: 0,
    exigePeca: false, pagaTecnico: false, pagamentoIntegral: false, isRetorno: false, horasFranquia: 2,
  },
];

export const SEED_ESTOQUE = [
  { nome: 'Cabo HDMI 1.5m', descricao: 'Cabo HDMI para monitor PDV', unidade: 'un', quantidadeMinima: 5 },
  { nome: 'Fonte ATX 500W', descricao: 'Fonte de alimentação para desktop', unidade: 'un', quantidadeMinima: 3 },
  { nome: 'SSD 480GB SATA', descricao: 'SSD para substituição em PDVs', unidade: 'un', quantidadeMinima: 4 },
  { nome: 'Memória RAM DDR4 8GB', descricao: 'Módulo RAM para upgrade', unidade: 'un', quantidadeMinima: 6 },
  { nome: 'Teclado USB', descricao: 'Teclado padrão ABNT2', unidade: 'un', quantidadeMinima: 5 },
  { nome: 'Mouse Óptico USB', descricao: 'Mouse sem fio para substituição', unidade: 'un', quantidadeMinima: 5 },
  { nome: 'Cabo de Rede Cat6 3m', descricao: 'Patch cord para rack', unidade: 'un', quantidadeMinima: 10 },
  { nome: 'Papel Térmico 80x40mm', descricao: 'Rolo de papel para impressora fiscal', unidade: 'cx', quantidadeMinima: 8 },
  { nome: 'Pasta Térmica', descricao: 'Pasta condutora para CPU', unidade: 'un', quantidadeMinima: 10 },
  { nome: 'Fita Isolante', descricao: 'Rolo de fita isolante preta 19mm', unidade: 'un', quantidadeMinima: 15 },
];

// FSAs e lojas para chamados fictícios
const FSAS = [
  'FSA-2024-001', 'FSA-2024-002', 'FSA-2024-003', 'FSA-2024-004', 'FSA-2024-005',
  'FSA-2024-006', 'FSA-2024-007', 'FSA-2024-008', 'FSA-2024-009', 'FSA-2024-010',
  'FSA-2025-001', 'FSA-2025-002', 'FSA-2025-003',
];
const LOJAS = ['1001', '1002', '1003', '1004', '1005', '2001', '2002', '3001', '3002', '3003'];
const STATUS_DIST: ChamadoStatus[] = [
  'submetido', 'submetido',
  'validado_operador',
  'rejeitado',
  'validado_financeiro', 'validado_financeiro',
  'pago',
  'rascunho',
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function dateOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// ─── Função principal ─────────────────────────────────────────────────────────

export interface SeedResult {
  clientes: number;
  servicos: number;
  estoqueItens: number;
  chamados: number;
  estoqueEntradas: number;
  warnings: string[];
}

export async function seedTestData(
  adminUid: string,
  adminNome: string,
): Promise<SeedResult> {
  const result: SeedResult = { clientes: 0, servicos: 0, estoqueItens: 0, chamados: 0, estoqueEntradas: 0, warnings: [] };
  const batch = writeBatch(db);

  // ── 1. Clientes ───────────────────────────────────────────────────────────
  const clienteIds: string[] = [];
  const clienteNomes: string[] = [];

  for (const c of SEED_CLIENTES) {
    const ref = doc(collection(db, 'clientes'));
    batch.set(ref, { ...c, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() });
    clienteIds.push(ref.id);
    clienteNomes.push(c.nome);
    result.clientes++;
  }

  // ── 2. Catálogo de serviços ───────────────────────────────────────────────
  const servicoRefs: Array<{ id: string; nome: string; clienteNome: string }> = [];

  for (let i = 0; i < SEED_SERVICOS.length; i++) {
    const s = SEED_SERVICOS[i];
    const cidx = i % clienteIds.length;
    const ref = doc(collection(db, 'catalogoServicos'));
    batch.set(ref, {
      ...s,
      clienteId: clienteIds[cidx],
      clienteNome: clienteNomes[cidx],
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    servicoRefs.push({ id: ref.id, nome: s.nome, clienteNome: clienteNomes[cidx] });
    result.servicos++;
  }

  // ── 3. Estoque ────────────────────────────────────────────────────────────
  const estoqueIds: string[] = [];

  for (const item of SEED_ESTOQUE) {
    const ref = doc(collection(db, 'estoqueItens'));
    const qty = randInt(item.quantidadeMinima, item.quantidadeMinima * 4);
    batch.set(ref, {
      ...item,
      quantidadeAtual: qty,
      criadoPor: adminUid,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    estoqueIds.push(ref.id);
    result.estoqueItens++;
  }

  await batch.commit();

  // ── 4. Movimentos de estoque (entradas iniciais) ───────────────────────────
  // (feito separado pois usa runTransaction no módulo original — aqui usamos batch simples)
  const movBatch = writeBatch(db);
  for (let i = 0; i < estoqueIds.length; i++) {
    const item = SEED_ESTOQUE[i];
    const qty = randInt(item.quantidadeMinima, item.quantidadeMinima * 4);
    const ref = doc(collection(db, 'movimentosEstoque'));
    movBatch.set(ref, {
      itemId: estoqueIds[i],
      itemNome: item.nome,
      tipo: 'entrada',
      quantidade: qty,
      saldoApos: qty,
      observacao: 'Estoque inicial (seed)',
      registradoPor: adminUid,
      registradoPorNome: adminNome,
      registradoEm: serverTimestamp(),
    });
    result.estoqueEntradas++;
  }
  await movBatch.commit();

  // ── 5. Chamados ───────────────────────────────────────────────────────────
  // Busca técnicos existentes para referenciar
  const tecSnap = await getDocs(query(collection(db, 'technicians'), where('status', '==', 'ativo')));
  const tecnicos = tecSnap.docs.map(d => ({
    uid: d.id,
    nome: (d.data().nome as string) ?? 'Técnico',
    codigo: (d.data().codigoTecnico as string) ?? '',
  }));

  if (tecnicos.length === 0) {
    result.warnings.push('Nenhum técnico ativo encontrado. Chamados criados com técnico placeholder.');
    tecnicos.push({ uid: 'seed-tecnico', nome: 'Técnico Teste', codigo: 'TEC-000' });
  }

  const chamBatch = writeBatch(db);
  for (let i = 0; i < FSAS.length; i++) {
    const fsa = FSAS[i];
    const status = pick(STATUS_DIST);
    const tec = pick(tecnicos);
    const servico = pick(servicoRefs);
    const dataAtendimento = dateOffset(randInt(1, 60));
    const horaInicio = `${String(randInt(7, 16)).padStart(2, '0')}:00`;
    const durMin = pick([60, 90, 120, 150, 180, 240]);
    const [hh, mm] = horaInicio.split(':').map(Number);
    const endTotalMin = hh * 60 + mm + durMin;
    const horaFim = `${String(Math.floor(endTotalMin / 60)).padStart(2, '0')}:${String(endTotalMin % 60).padStart(2, '0')}`;

    const historico: any[] = [
      { status: 'rascunho', por: adminUid, porNome: adminNome, em: Date.now() - 86400000 * randInt(3, 60), observacao: 'Rascunho criado' },
    ];
    if (status !== 'rascunho') {
      historico.push({ status: 'submetido', por: adminUid, porNome: adminNome, em: Date.now() - 86400000 * randInt(1, 3), observacao: 'Submetido para validação' });
    }
    if (status === 'validado_operador' || status === 'validado_financeiro' || status === 'pago') {
      historico.push({ status: 'validado_operador', por: adminUid, porNome: adminNome, em: Date.now() - 3600000 * randInt(2, 24), observacao: 'Upload validado' });
    }
    if (status === 'validado_financeiro' || status === 'pago') {
      historico.push({ status: 'validado_financeiro', por: adminUid, porNome: adminNome, em: Date.now() - 3600000 * randInt(1, 12), observacao: 'Valores validados' });
    }
    if (status === 'pago') {
      historico.push({ status: 'pago', por: adminUid, porNome: adminNome, em: Date.now() - 3600000, observacao: 'Pagamento confirmado' });
    }
    if (status === 'rejeitado') {
      historico.push({ status: 'rejeitado', por: adminUid, porNome: adminNome, em: Date.now() - 3600000 * 2, observacao: 'Upload não encontrado na plataforma do cliente' });
    }

    const ref = doc(collection(db, 'chamados'));
    chamBatch.set(ref, {
      fsa: fsa.replace('FSA-', ''),
      codigoLoja: pick(LOJAS),
      tecnicoId: tec.uid,
      tecnicoNome: tec.nome,
      tecnicoCodigo: tec.codigo,
      catalogoServicoId: servico.id,
      catalogoServicoNome: servico.nome,
      dataAtendimento,
      horaInicio,
      horaFim,
      durationMinutes: durMin,
      status,
      historico,
      motivoRejeicao: status === 'rejeitado' ? 'Upload não encontrado na plataforma do cliente' : null,
      pagamentoId: null,
      registradoPor: adminUid,
      registradoPorNome: adminNome,
      registradoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    result.chamados++;
  }
  await chamBatch.commit();

  return result;
}

// ─── Dados de exemplo para formulários individuais ────────────────────────────

export const TECNICOS_EXEMPLO = [
  { nome: 'Carlos', nomeCompleto: 'Carlos Eduardo Mendes', telefone: '(11) 98765-4321', cpf: '123.456.789-00', cidade: 'São Paulo', uf: 'SP', cargo: 'tecnico', especialidades: ['PDVs', 'Field Service'], atendeArredores: true, raioKm: '50', banco: 'Bradesco', agencia: '1234', conta: '56789-0', tipoConta: 'corrente', pix: '11987654321' },
  { nome: 'Rafael', nomeCompleto: 'Rafael Oliveira Costa', telefone: '(21) 97654-3210', cpf: '987.654.321-00', cidade: 'Rio de Janeiro', uf: 'RJ', cargo: 'tecnico', especialidades: ['Impressora Zebra', 'Desktops'], atendeArredores: false, raioKm: '', banco: 'Itaú', agencia: '0001', conta: '12345-6', tipoConta: 'corrente', pix: '21976543210' },
  { nome: 'Fernanda', nomeCompleto: 'Fernanda Lima Souza', telefone: '(31) 96543-2109', cpf: '456.789.123-00', cidade: 'Belo Horizonte', uf: 'MG', cargo: 'supervisor', especialidades: ['PDVs', 'Infraestrutura', 'Field Service'], atendeArredores: true, raioKm: '80', banco: 'Banco do Brasil', agencia: '5678', conta: '99876-5', tipoConta: 'poupanca', pix: '31965432109' },
  { nome: 'Lucas', nomeCompleto: 'Lucas Pereira Alves', telefone: '(41) 95432-1098', cpf: '789.123.456-00', cidade: 'Curitiba', uf: 'PR', cargo: 'tecnico', especialidades: ['PDVs', 'Desktops'], atendeArredores: true, raioKm: '60', banco: 'Nubank', agencia: '0001', conta: '45678-9', tipoConta: 'corrente', pix: '41954321098' },
  { nome: 'Patrícia', nomeCompleto: 'Patrícia Santos Ribeiro', telefone: '(51) 94321-0987', cpf: '321.654.987-00', cidade: 'Porto Alegre', uf: 'RS', cargo: 'tecnico', especialidades: ['Impressora Zebra', 'PDVs'], atendeArredores: false, raioKm: '', banco: 'Caixa', agencia: '2345', conta: '34567-8', tipoConta: 'corrente', pix: '51943210987' },
];

export const CHAMADOS_EXEMPLO = [
  { fsa: '2025-100', codigoLoja: '1001', dataAtendimento: new Date().toISOString().slice(0, 10), horaInicio: '09:00', horaFim: '11:30', observacoes: 'PDV com falha na leitora de cartão. Troca de hardware realizada.' },
  { fsa: '2025-101', codigoLoja: '2003', dataAtendimento: new Date().toISOString().slice(0, 10), horaInicio: '13:00', horaFim: '15:00', observacoes: 'Impressora fiscal com erro de comunicação. Reset e reconfiguração.' },
  { fsa: '2025-102', codigoLoja: '3007', dataAtendimento: new Date().toISOString().slice(0, 10), horaInicio: '08:30', horaFim: '10:00', observacoes: 'Instalação de novo terminal POS conforme abertura de loja.' },
  { fsa: '2025-103', codigoLoja: '1005', dataAtendimento: new Date().toISOString().slice(0, 10), horaInicio: '14:00', horaFim: '16:30', observacoes: 'Substituição de fonte queimada. Equipamento em uso crítico.' },
  { fsa: '2025-104', codigoLoja: '2011', dataAtendimento: new Date().toISOString().slice(0, 10), horaInicio: '10:00', horaFim: '12:00', observacoes: 'Preventiva mensal: limpeza, atualização de drivers e teste de periféricos.' },
];

export const ESTOQUE_EXEMPLO = [
  { nome: 'Cabo HDMI 1.5m', descricao: 'Cabo HDMI para monitor PDV', unidade: 'un', quantidadeMinima: '5' },
  { nome: 'Fonte ATX 500W', descricao: 'Fonte de alimentação para desktop', unidade: 'un', quantidadeMinima: '3' },
  { nome: 'SSD 480GB SATA', descricao: 'SSD para substituição em PDVs', unidade: 'un', quantidadeMinima: '4' },
  { nome: 'Memória RAM DDR4 8GB', descricao: 'Módulo RAM para upgrade', unidade: 'un', quantidadeMinima: '6' },
  { nome: 'Teclado USB ABNT2', descricao: 'Teclado padrão para substituição', unidade: 'un', quantidadeMinima: '5' },
  { nome: 'Papel Térmico 80x40mm', descricao: 'Rolo para impressora fiscal', unidade: 'cx', quantidadeMinima: '8' },
  { nome: 'Patch Cord Cat6 3m', descricao: 'Cabo de rede para rack', unidade: 'un', quantidadeMinima: '10' },
  { nome: 'Pasta Térmica Implastec', descricao: 'Pasta condutora para CPU', unidade: 'un', quantidadeMinima: '10' },
];
