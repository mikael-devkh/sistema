import { db } from "../firebase";
import { collection, addDoc, doc, getDoc, setDoc, getDocs, query, where, updateDoc, serverTimestamp, orderBy, limit } from "firebase/firestore";
import type { AssignmentRecord, FsaRecord, ActivityRecord, WorkflowStatus } from "../types/workflow";

export async function createOrUpdateFsa(fsa: FsaRecord): Promise<string> {
  if (!fsa.id) throw new Error("FSA id é obrigatório");
  const ref = doc(db, "fsas", fsa.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...fsa, createdAt: Date.now(), updatedAt: Date.now() });
  } else {
    await updateDoc(ref, { ...fsa, updatedAt: Date.now() });
  }
  return fsa.id;
}

export async function getFsaById(fsaId: string): Promise<FsaRecord | null> {
  if (!fsaId) return null;
  const snap = await getDoc(doc(db, "fsas", fsaId));
  if (snap.exists()) return { ...(snap.data() as FsaRecord), id: snap.id };
  // Fallback for legacy documents where doc ID differs from fsa.id field
  const legacy = await getDocs(query(collection(db, "fsas"), where("id", "==", fsaId)));
  if (legacy.empty) return null;
  const d = legacy.docs[0];
  return { ...(d.data() as FsaRecord), id: d.get("id") };
}

export async function listAssignmentsByTechnician(tecnicoId: string): Promise<AssignmentRecord[]> {
  const col = collection(db, "assignments");
  const qy = query(col, where("tecnicoId", "==", tecnicoId));
  const snap = await getDocs(qy);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as AssignmentRecord) }));
}

export async function updateAssignmentStatus(assignmentId: string, status: WorkflowStatus) {
  await updateDoc(doc(db, "assignments", assignmentId), { status });
}

export async function appendActivity(activity: ActivityRecord) {
  const col = collection(db, "activity");
  await addDoc(col, { ...activity, ts: activity.ts || Date.now() });
}

export async function listAllAssignments(): Promise<AssignmentRecord[]> {
  const col = collection(db, "assignments");
  const snap = await getDocs(col);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as AssignmentRecord) }));
}

export async function reassignAssignment(assignmentId: string, tecnicoId: string) {
  await updateDoc(doc(db, "assignments", assignmentId), { tecnicoId });
}


