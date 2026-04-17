import { db } from '../firebase';
import {
  collection,
  doc,
  addDoc,
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
import { haversineKm, getCityCoords } from './brazilCityCoords';

/** Remove undefined values recursively — Firestore rejects them with invalid-argument. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [
        k,
        v !== null && typeof v === 'object' && !Array.isArray(v)
          ? stripUndefined(v as object)
          : v,
      ])
  ) as Partial<T>;
}

/**
 * Cria um novo técnico como documento Firestore (sem Firebase Auth).
 * Retorna o UID gerado pelo Firestore (document ID).
 */
export async function createTechnician(
  technician: Omit<TechnicianProfile, 'uid'>,
): Promise<string> {
  const dataToSave = stripUndefined({
    ...technician,
    dataAtualizacao: Date.now(),
  });

  const ref = await addDoc(collection(db, 'technicians'), dataToSave);
  console.log('✅ Técnico criado no Firestore com ID:', ref.id);
  return ref.id;
}

/**
 * Atualiza um perfil de técnico existente (por UID/document ID).
 */
export async function createOrUpdateTechnician(
  technician: TechnicianProfile
): Promise<void> {
  const technicianRef = doc(db, 'technicians', technician.uid);
  const dataToSave = stripUndefined({
    ...technician,
    dataAtualizacao: Date.now(),
  });
  
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
    console.log('🔍 Collection path:', techniciansRef.path);
    console.log('🔍 Firestore instance:', db.app.name);
    try {
      const snapshot = await getDocs(techniciansRef);
      console.log('📊 Snapshot obtido:', {
        size: snapshot.size,
        empty: snapshot.empty,
        docs: snapshot.docs.length
      });
      
      if (snapshot.empty) {
        console.warn('⚠️ Collection "technicians" está vazia!');
        console.warn('💡 Verifique no Firebase Console:');
        console.warn('   1. Vá em Firestore Database');
        console.warn('   2. Procure pela collection "technicians"');
        console.warn('   3. Verifique se há documentos lá');
        console.warn('   4. Se não houver, cadastre um técnico primeiro');
        return [];
      }
      
      const technicians = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('📄 Processando documento:', doc.id, {
          nome: data.nome,
          codigo: data.codigoTecnico,
          email: data.email,
          status: data.status
        });
        return {
          uid: doc.id,
          ...data,
        } as TechnicianProfile;
      });
      
      // Ordenar no cliente
      technicians.sort((a, b) => (b.dataCadastro || 0) - (a.dataCadastro || 0));
      
      console.log(`✅ listTechnicians (sem filtros): ${technicians.length} técnico(s) encontrado(s)`);
      console.log('📝 IDs encontrados:', technicians.map(t => t.uid));
      console.log('📝 Nomes encontrados:', technicians.map(t => t.nome));
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

/**
 * Lista apenas técnicos "pais" (sem tecnicoPaiId). Útil para selecionar o pai
 * no cadastro de um novo técnico.
 */
export async function listParentTechnicians(): Promise<TechnicianProfile[]> {
  const all = await listTechnicians();
  return all.filter(t => !t.tecnicoPaiId && t.status !== 'desligado');
}

/**
 * Lista os filhos de um técnico pai.
 */
export async function listChildrenOf(parentUid: string): Promise<TechnicianProfile[]> {
  const techniciansRef = collection(db, 'technicians');
  try {
    const q = query(techniciansRef, where('tecnicoPaiId', '==', parentUid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ uid: d.id, ...d.data() } as TechnicianProfile));
  } catch {
    // Fallback cliente (evita necessidade de índice)
    const all = await listTechnicians();
    return all.filter(t => t.tecnicoPaiId === parentUid);
  }
}

/**
 * Calcula distância (km) de um técnico até uma localidade. Retorna null se
 * o técnico ou a cidade não possuírem coordenadas.
 */
export function distanceFromTechnicianToCity(
  tech: TechnicianProfile,
  cidade: string,
  uf: string
): number | null {
  const destCoords = getCityCoords(cidade, uf);
  if (!destCoords) return null;
  const dest = { lat: destCoords[1], lng: destCoords[0] };

  const source =
    tech.areaAtendimento?.coordenadas ??
    (tech.cidade && tech.uf ? (() => {
      const c = getCityCoords(tech.cidade, tech.uf);
      return c ? { lat: c[1], lng: c[0] } : null;
    })() : null);

  if (!source) return null;
  return haversineKm(source, dest);
}

/**
 * Verifica se um técnico cobre uma cidade. Considera:
 *  - cidade base (exato)
 *  - cidades adicionais explícitas
 *  - raio de atendimento (quando atendeArredores = true)
 */
export function technicianCoversCity(
  tech: TechnicianProfile,
  cidade: string,
  uf: string
): { covers: boolean; distance: number | null; reason: string } {
  const area = tech.areaAtendimento;
  const normCidade = cidade.trim().toUpperCase();
  const normUf = uf.trim().toUpperCase();

  // 1) cidade base
  if (
    (area?.cidadeBase?.toUpperCase() === normCidade && area?.ufBase?.toUpperCase() === normUf) ||
    (tech.cidade?.toUpperCase() === normCidade && tech.uf?.toUpperCase() === normUf)
  ) {
    return { covers: true, distance: 0, reason: 'Cidade base' };
  }

  // 2) cidades adicionais
  if (area?.cidadesAdicionais?.some(
    c => c.cidade.toUpperCase() === normCidade && c.uf.toUpperCase() === normUf,
  )) {
    const dist = distanceFromTechnicianToCity(tech, cidade, uf);
    return { covers: true, distance: dist, reason: 'Cidade adicional' };
  }

  // 3) raio
  if (area?.atendeArredores && area.raioKm && area.raioKm > 0) {
    const dist = distanceFromTechnicianToCity(tech, cidade, uf);
    if (dist !== null && dist <= area.raioKm) {
      return { covers: true, distance: dist, reason: `Dentro do raio de ${area.raioKm}km` };
    }
    return { covers: false, distance: dist, reason: 'Fora do raio de atendimento' };
  }

  const dist = distanceFromTechnicianToCity(tech, cidade, uf);
  return { covers: false, distance: dist, reason: 'Não cobre esta localidade' };
}

/**
 * Busca técnicos que atendem uma localidade específica, ordenados por distância.
 */
export async function findTechniciansForLocation(
  cidade: string,
  uf: string,
  options?: { onlyActive?: boolean; onlyAvailable?: boolean }
): Promise<Array<TechnicianProfile & { distanceKm: number | null; matchReason: string }>> {
  const all = await listTechnicians();
  const filtered = all.filter(t => {
    if (options?.onlyActive && t.status !== 'ativo') return false;
    if (options?.onlyAvailable && !t.disponivel) return false;
    return true;
  });

  return filtered
    .map(t => {
      const { covers, distance, reason } = technicianCoversCity(t, cidade, uf);
      return covers ? { ...t, distanceKm: distance, matchReason: reason } : null;
    })
    .filter((t): t is TechnicianProfile & { distanceKm: number | null; matchReason: string } => !!t)
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

