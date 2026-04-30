import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { SeasonalStoreHours } from '../types/scheduling';

const COLLECTION = 'seasonalStoreHours';

function fromFirestore(id: string, data: Record<string, unknown>): SeasonalStoreHours {
  const importedAt = data.importedAt && typeof data.importedAt === 'object' && 'toDate' in data.importedAt
    ? (data.importedAt as { toDate: () => Date }).toDate()
    : null;

  return {
    id,
    loja: String(data.loja ?? ''),
    date: String(data.date ?? ''),
    opensAt: String(data.opensAt ?? ''),
    closesAt: String(data.closesAt ?? ''),
    closed: Boolean(data.closed),
    note: String(data.note ?? ''),
    importedAt,
    importedBy: String(data.importedBy ?? ''),
    sourceFile: String(data.sourceFile ?? ''),
    sourceRow: Number(data.sourceRow ?? 0) || undefined,
  };
}

export function useSeasonalHours() {
  const [items, setItems] = useState<SeasonalStoreHours[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, COLLECTION),
      snap => {
        const next = snap.docs
          .map(d => fromFirestore(d.id, d.data()))
          .filter(item => item.loja && item.date)
          .sort((a, b) => a.date.localeCompare(b.date) || a.loja.localeCompare(b.loja));
        setItems(next);
        setIsLoading(false);
        setError(null);
      },
      err => {
        setError(err);
        setIsLoading(false);
      },
    );
    return unsub;
  }, []);

  const byStore = useMemo(() => {
    const map = new Map<string, SeasonalStoreHours[]>();
    for (const item of items) {
      const list = map.get(item.loja) ?? [];
      list.push(item);
      map.set(item.loja, list);
    }
    return map;
  }, [items]);

  const dates = useMemo(
    () => [...new Set(items.map(item => item.date))].sort(),
    [items],
  );

  const saveMany = useCallback(async (entries: SeasonalStoreHours[], sourceFile?: string) => {
    if (!entries.length) return 0;
    const batch = writeBatch(db);
    for (const entry of entries) {
      const id = `${entry.date}_${entry.loja}`;
      batch.set(doc(db, COLLECTION, id), {
        loja: entry.loja,
        date: entry.date,
        opensAt: entry.opensAt,
        closesAt: entry.closesAt,
        closed: entry.closed,
        note: entry.note ?? '',
        sourceFile: sourceFile ?? entry.sourceFile ?? '',
        sourceRow: entry.sourceRow ?? null,
        importedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return entries.length;
  }, []);

  const removeDate = useCallback(async (date: string) => {
    const snap = await getDocs(query(collection(db, COLLECTION), where('date', '==', date)));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    return snap.size;
  }, []);

  return { items, byStore, dates, isLoading, error, saveMany, removeDate };
}
