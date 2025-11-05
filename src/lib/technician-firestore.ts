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
  const dataToSave = {
    ...technician,
    dataAtualizacao: Date.now(),
  };
  
  console.log('💾 Salvando técnico no Firestore:', {
    uid: technician.uid,
    codigoTecnico: technician.codigoTecnico,
    nome: technician.nome,
    collection: 'technicians',
    documentId: technician.uid
  });
  
  await setDoc(
    technicianRef,
    dataToSave,
    { merge: true }
  );
  
  console.log('✅ Técnico salvo com sucesso no Firestore');
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
  
  // Se não há filtros, buscar todos diretamente sem orderBy (não precisa de índice)
  const hasFilters = filters && Object.keys(filters).length > 0;
  
  if (!hasFilters) {
    console.log('📋 Buscando todos os técnicos sem filtros (query simples)...');
    try {
      const snapshot = await getDocs(techniciansRef);
      const technicians = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          ...data,
        } as TechnicianProfile;
      });
      
      // Ordenar no cliente
      technicians.sort((a, b) => (b.dataCadastro || 0) - (a.dataCadastro || 0));
      
      console.log(`✅ listTechnicians (sem filtros): ${technicians.length} técnico(s) encontrado(s)`);
      console.log('📝 IDs encontrados:', technicians.map(t => t.uid));
      return technicians;
    } catch (error: any) {
      console.error('❌ Erro ao buscar técnicos (sem filtros):', error);
      throw error;
    }
  }
  
  // Se há filtros, tentar com orderBy primeiro
  try {
    const queryConstraints: any[] = [];
    
    if (filters?.status) {
      queryConstraints.push(where('status', '==', filters.status));
    }
    
    if (filters?.disponivel !== undefined) {
      queryConstraints.push(where('disponivel', '==', filters.disponivel));
    }
    
    if (filters?.cargo) {
      queryConstraints.push(where('cargo', '==', filters.cargo));
    }
    
    if (filters?.uf) {
      queryConstraints.push(where('uf', '==', filters.uf));
    }
    
    // Tentar adicionar orderBy (pode precisar de índice)
    queryConstraints.push(orderBy('dataCadastro', 'desc'));
    
    if (filters?.limitCount) {
      queryConstraints.push(limit(filters.limitCount));
    }
    
    const q = query(techniciansRef, ...queryConstraints);
    const snapshot = await getDocs(q);
    const technicians = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    })) as TechnicianProfile[];
    
    console.log(`✅ listTechnicians (com filtros): ${technicians.length} técnico(s) encontrado(s)`);
    return technicians;
  } catch (error: any) {
    console.error('❌ Erro ao listar técnicos:', error);
    
    // Fallback: buscar sem orderBy se houver erro de índice
    if (error.code === 'failed-precondition' || error.message?.includes('index')) {
      console.warn('⚠️ Tentando buscar sem orderBy devido a erro de índice...');
      try {
        const queryConstraints: any[] = [];
        
        if (filters?.status) {
          queryConstraints.push(where('status', '==', filters.status));
        }
        
        if (filters?.disponivel !== undefined) {
          queryConstraints.push(where('disponivel', '==', filters.disponivel));
        }
        
        if (filters?.cargo) {
          queryConstraints.push(where('cargo', '==', filters.cargo));
        }
        
        if (filters?.uf) {
          queryConstraints.push(where('uf', '==', filters.uf));
        }
        
        if (filters?.limitCount) {
          queryConstraints.push(limit(filters.limitCount));
        }
        
        const q = queryConstraints.length > 0 
          ? query(techniciansRef, ...queryConstraints)
          : query(techniciansRef);
        
        const snapshot = await getDocs(q);
        const technicians = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data(),
        })) as TechnicianProfile[];
        
        // Ordenar no cliente
        technicians.sort((a, b) => (b.dataCadastro || 0) - (a.dataCadastro || 0));
        
        console.log(`✅ listTechnicians (fallback): ${technicians.length} técnico(s) encontrado(s)`);
        return technicians;
      } catch (fallbackError) {
        console.error('❌ Erro no fallback:', fallbackError);
        throw error;
      }
    }
    
    throw error;
  }
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

/**
 * Soft delete: marca técnico como desligado (não remove do banco)
 */
export async function deleteTechnician(uid: string): Promise<void> {
  const technicianRef = doc(db, 'technicians', uid);
  await updateDoc(technicianRef, {
    status: 'desligado',
    disponivel: false,
    dataAtualizacao: Date.now(),
  });
}

