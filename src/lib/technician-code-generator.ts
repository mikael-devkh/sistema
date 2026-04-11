import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';

/**
 * Gera o próximo código de técnico disponível (TEC-001, TEC-002, ...)
 */
export async function generateTechnicianCode(): Promise<string> {
  const techniciansRef = collection(db, 'technicians');
  const q = query(
    techniciansRef,
    orderBy('codigoTecnico', 'desc'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return 'TEC-001';
  }
  
  const lastDoc = snapshot.docs[0];
  const lastCode = lastDoc.data().codigoTecnico as string;
  const lastNumber = parseInt(lastCode.replace('TEC-', ''), 10);
  
  if (isNaN(lastNumber)) {
    return 'TEC-001';
  }
  
  const nextNumber = lastNumber + 1;
  return `TEC-${nextNumber.toString().padStart(3, '0')}`;
}

/**
 * Valida se um código de técnico já existe
 */
export async function codeExists(codigoTecnico: string): Promise<boolean> {
  const techniciansRef = collection(db, 'technicians');
  const q = query(
    techniciansRef,
    where('codigoTecnico', '==', codigoTecnico)
  );
  
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

