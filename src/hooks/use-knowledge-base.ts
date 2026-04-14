import { useEffect, useState, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { mockProcedures, type Procedure } from '../data/troubleshootingData';
import { toast } from 'sonner';

const FS_COLLECTION = 'knowledgeBase';

export interface ProcedureWithVotes extends Procedure {
  votes?: { up: number; down: number };
}

/**
 * Real-time Firestore hook for the shared knowledge base.
 * Falls back to mockProcedures if the collection is empty or unreachable.
 */
export function useKnowledgeBase() {
  const [procedures, setProcedures] = useState<ProcedureWithVotes[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, FS_COLLECTION),
      snap => {
        const docs = snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<ProcedureWithVotes, 'id'>),
        })) as ProcedureWithVotes[];

        // If collection is empty on first load, seed with mock data
        if (docs.length === 0 && loading) {
          seedDefaults().catch(() => {
            // Seed failed (permissions?), just show mock data locally
            setProcedures(mockProcedures.map(p => ({ ...p, votes: { up: 0, down: 0 } })));
          });
        } else {
          const sorted = docs.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
          setProcedures(sorted);
        }
        setLoading(false);
      },
      () => {
        // Firestore error — fallback to mocks locally
        setProcedures(mockProcedures.map(p => ({ ...p, votes: { up: 0, down: 0 } })));
        setLoading(false);
      },
    );
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seedDefaults = async () => {
    const batch = writeBatch(db);
    for (const proc of mockProcedures) {
      batch.set(doc(db, FS_COLLECTION, proc.id), {
        ...proc,
        votes: { up: 0, down: 0 },
      });
    }
    await batch.commit();
  };

  const addProcedure = useCallback(async (proc: Omit<ProcedureWithVotes, 'id'>) => {
    try {
      await addDoc(collection(db, FS_COLLECTION), { ...proc, votes: { up: 0, down: 0 } });
    } catch (e: unknown) {
      toast.error('Erro ao adicionar: ' + (e as Error)?.message);
    }
  }, []);

  const updateProcedure = useCallback(async (proc: ProcedureWithVotes) => {
    try {
      const { id, ...data } = proc;
      await setDoc(doc(db, FS_COLLECTION, id), data, { merge: true });
    } catch (e: unknown) {
      toast.error('Erro ao atualizar: ' + (e as Error)?.message);
    }
  }, []);

  const deleteProcedure = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, FS_COLLECTION, id));
    } catch (e: unknown) {
      toast.error('Erro ao excluir: ' + (e as Error)?.message);
    }
  }, []);

  const voteProcedure = useCallback(async (id: string, type: 'up' | 'down') => {
    try {
      await setDoc(
        doc(db, FS_COLLECTION, id),
        { votes: { [type]: increment(1) } },
        { merge: true },
      );
    } catch {
      // Silent — voting is non-critical
    }
  }, []);

  const resetToDefaults = useCallback(async () => {
    try {
      await seedDefaults();
      toast.success('Base restaurada para os padrões.');
    } catch (e: unknown) {
      toast.error('Erro ao restaurar: ' + (e as Error)?.message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { procedures, loading, addProcedure, updateProcedure, deleteProcedure, voteProcedure, resetToDefaults };
}
