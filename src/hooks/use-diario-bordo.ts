import { useEffect, useState, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { toast } from 'sonner';
import type { DiarioEntry, DiarioEntryInput } from '../types/diarioBordo';

const FS_COLLECTION = 'diarioBordo';

export function useDiarioBordo() {
  const [entries, setEntries]   = useState<DiarioEntry[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const q = query(collection(db, FS_COLLECTION), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(
      q,
      snap => {
        setEntries(
          snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<DiarioEntry, 'id'>) })),
        );
        setLoading(false);
      },
      () => {
        toast.error('Erro ao carregar diário de bordo.');
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const addEntry = useCallback(async (input: DiarioEntryInput) => {
    try {
      await addDoc(collection(db, FS_COLLECTION), input);
      toast.success('Registro adicionado ao diário.');
    } catch (e: unknown) {
      toast.error('Erro ao salvar: ' + (e as Error)?.message);
      throw e;
    }
  }, []);

  const removeEntry = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, FS_COLLECTION, id));
      toast.success('Registro removido.');
    } catch (e: unknown) {
      toast.error('Erro ao remover: ' + (e as Error)?.message);
    }
  }, []);

  return { entries, loading, addEntry, removeEntry };
}
