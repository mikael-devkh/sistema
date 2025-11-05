import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import type { TechnicianProfile } from '../types/technician';

/**
 * Cria ou atualiza um perfil de técnico
 */
export async function createOrUpdateTechnician(
  technician: TechnicianProfile
): Promise<void> {
  const technicianRef = doc(db, 'technicians', technician.uid);
  await setDoc(
    technicianRef,
    {
      ...technician,
      dataAtualizacao: Date.now(),
    },
    { merge: true }
  );
}

/**
 * Busca um técnico por UID
 */
export async function getTechnicianByUid(uid: string): Promise<TechnicianProfile | null> {
  const technicianRef = doc(db, 'technicians', uid);
  const snapshot = await getDoc(technicianRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return {
    uid: snapshot.id,
    ...snapshot.data(),
  } as TechnicianProfile;
}

/**
 * Busca um técnico por código
 */
export async function getTechnicianByCode(codigoTecnico: string): Promise<TechnicianProfile | null> {
  const techniciansRef = collection(db, 'technicians');
  const q = query(
    techniciansRef,
    where('codigoTecnico', '==', codigoTecnico),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  return {
    uid: doc.id,
    ...doc.data(),
  } as TechnicianProfile;
}

/**
 * Lista todos os técnicos com filtros opcionais
 */
export async function listTechnicians(filters?: {
  status?: TechnicianProfile['status'];
  cargo?: TechnicianProfile['cargo'];
  disponivel?: boolean;
  limitCount?: number;
  uf?: string;
}): Promise<TechnicianProfile[]> {
  const techniciansRef = collection(db, 'technicians');
  let q = query(techniciansRef, orderBy('dataCadastro', 'desc'));
  
  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }
  
  if (filters?.disponivel !== undefined) {
    q = query(q, where('disponivel', '==', filters.disponivel));
  }
  
  if (filters?.cargo) {
    q = query(q, where('cargo', '==', filters.cargo));
  }
  
  if (filters?.uf) {
    q = query(q, where('uf', '==', filters.uf));
  }
  
  if (filters?.limitCount) {
    q = query(q, limit(filters.limitCount));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    uid: doc.id,
    ...doc.data(),
  })) as TechnicianProfile[];
}

/**
 * Busca técnicos por especialidade
 */
export async function getTechniciansBySpecialty(
  especialidade: string
): Promise<TechnicianProfile[]> {
  // Nota: Firestore não suporta busca em arrays diretamente
  // Precisamos buscar todos e filtrar no cliente OU usar array-contains
  // Vou usar uma abordagem híbrida
  const techniciansRef = collection(db, 'technicians');
  const q = query(
    techniciansRef,
    where('status', '==', 'ativo'),
    where('disponivel', '==', true)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }))
    .filter(tech => tech.especialidades?.includes(especialidade)) as TechnicianProfile[];
}

/**
 * Atualiza status de disponibilidade do técnico
 */
export async function updateTechnicianAvailability(
  uid: string,
  disponivel: boolean
): Promise<void> {
  const technicianRef = doc(db, 'technicians', uid);
  await updateDoc(technicianRef, {
    disponivel,
    dataAtualizacao: Date.now(),
  });
}

/**
 * Atualiza localização do técnico
 */
export async function updateTechnicianLocation(
  uid: string,
  location: { lat: number; lng: number }
): Promise<void> {
  const technicianRef = doc(db, 'technicians', uid);
  await updateDoc(technicianRef, {
    ultimaLocalizacao: {
      ...location,
      timestamp: Date.now(),
    },
    dataAtualizacao: Date.now(),
  });
}

/**
 * Atualiza estatísticas do técnico
 */
export async function updateTechnicianStats(
  uid: string,
  stats: {
    totalChamados?: number;
    chamadosConcluidos?: number;
    chamadosEmAndamento?: number;
    mediaTempoAtendimento?: number;
    avaliacaoMedia?: number;
  }
): Promise<void> {
  const technicianRef = doc(db, 'technicians', uid);
  await updateDoc(technicianRef, {
    ...stats,
    dataAtualizacao: Date.now(),
  });
}

