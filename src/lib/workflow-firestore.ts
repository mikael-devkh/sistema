import { db } from "../firebase";
import { collection, addDoc, doc, getDoc, getDocs, query, where, updateDoc, serverTimestamp, orderBy, limit } from "firebase/firestore";
import type { AssignmentRecord, FsaRecord, ActivityRecord, WorkflowStatus } from "../types/workflow";

export async function createOrUpdateFsa(fsa: FsaRecord): Promise<string> {
  if (!fsa.id) throw new Error("FSA id é obrigatório");
  const fsasCol = collection(db, "fsas");
  // Firestore não usa id custom no addDoc facilmente sem set, mantemos como add + campo id
  const q = query(fsasCol, where("id", "==", fsa.id));
  const snap = await getDocs(q);
  if (snap.empty) {
    const ref = await addDoc(fsasCol, { ...fsa, createdAt: Date.now(), updatedAt: Date.now() });
    return ref.id;
  }
  const ref = snap.docs[0].ref;
  await updateDoc(ref, { ...fsa, updatedAt: Date.now() });
  return ref.id;
}

export async function getFsaById(fsaId: string): Promise<FsaRecord | null> {
  if (!fsaId) return null;
  const fsasCol = collection(db, "fsas");
  const q = query(fsasCol, where("id", "==", fsaId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs.map(d => ({ id: d.get("id"), ...(d.data() as FsaRecord) }))[0] || null;
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


