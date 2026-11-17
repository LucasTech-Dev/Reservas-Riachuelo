import { TURNOS, horarioDoPeriodo } from '../config/periodos.js';
import { intervaloEscolar, dataEmSaoPaulo } from '../validators/horarios.js';
import { collection, doc, getDocFromServer, getDocsFromServer, query, where, runTransaction, serverTimestamp, Timestamp, onSnapshot, documentId } from 'firebase/firestore';

function locks(db, r) {
  if (r.gradeVersao === 1) return [0,1,2].flatMap(i => [
    doc(db, 'ocupacoes15', r.salaId, 'periodos', String(r.slot + i)),
    doc(db, 'agendaProfessores15', r.professorUid, 'periodos', String(r.slot + i))]);
  return [doc(db, 'ocupacoes', r.salaId, 'periodos', String(r.slot)),
    doc(db, 'agendaProfessores', r.professorUid, 'periodos', String(r.slot))];
}
function conflitosLegados(db, r) {
  return [...new Set([Math.floor(r.slot / 2), Math.floor((r.slot + 2) / 2)])].flatMap(slot => [
    doc(db, 'ocupacoes', r.salaId, 'periodos', String(slot)),
    doc(db, 'agendaProfessores', r.professorUid, 'periodos', String(slot))]);
}
export async function periodosOcupados({ auth, db }, { salaId, data, turno }) {
  if (!auth.currentUser || !TURNOS[turno]) throw new Error('Login e turno necessários.');
  const slots = TURNOS[turno].periodos.map((_,i) => Date.parse(`${data}T${horarioDoPeriodo(turno,i+1).inicio}:00-03:00`) / 900000);
  const min = Math.min(...slots), max = Math.max(...slots) + 2;
  const paths = [['ocupacoes15',salaId,1],['agendaProfessores15',auth.currentUser.uid,1],['ocupacoes',salaId,2],['agendaProfessores',auth.currentUser.uid,2]];
  const occupied = await Promise.all(paths.map(async ([collectionName,uid,factor]) => {
    const snapshot = await getDocsFromServer(query(collection(db,collectionName,uid,'periodos'),where(documentId(),'>=',String(Math.floor(min/factor))),where(documentId(),'<=',String(Math.floor(max/factor)))));
    return { factor, values: new Set(snapshot.docs.map(d => Number(d.id))) };
  }));
  return new Set(slots.flatMap((slot,i) => occupied.some(({factor,values}) => [0,1,2].some(offset=>values.has(Math.floor((slot+offset)/factor)))) ? [i+1] : []));
}
export async function nomesResponsaveis({ db }, uids) {
  return new Map(await Promise.all([...new Set(uids)].map(async uid => {
    const snapshot = await getDocFromServer(doc(db, 'usuarios', uid));
    return [uid, snapshot.data()?.nome || 'Responsável indisponível'];
  })));
}
export async function listarSalas({ db }) {
  return (await getDocsFromServer(collection(db, 'salas'))).docs.map(d => d.data());
}
export async function consultarReserva({ db }, id) {
  const snapshot = await getDocFromServer(doc(db, 'reservas', id));
  return snapshot.exists() ? snapshot.data() : null;
}
export async function listarMinhasReservas({ auth, db }) {
  if (!auth.currentUser) throw new Error('Login necessário.');
  return (await getDocsFromServer(query(collection(db, 'reservas'), where('professorUid', '==', auth.currentUser.uid)))).docs.map(d => d.data());
}
export async function listarReservasAdmin({ db }) {
  return (await getDocsFromServer(collection(db, 'reservas'))).docs.map(d => d.data());
}
export async function solicitarReserva({ auth, db }, { salaId, inicio, turno, periodo }) {
  if (!auth.currentUser) throw new Error('Login necessário.');
  if (!(inicio instanceof Date) && (typeof inicio !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(inicio))) {
    throw new Error('Informe Date ou ISO 8601 com fuso explícito.');
  }
  const escolar = turno !== undefined || periodo !== undefined;
  if (escolar) {
    const validado = intervaloEscolar(dataEmSaoPaulo(new Date(inicio)), turno, periodo);
    if (Date.parse(validado.inicio) !== new Date(inicio).getTime()) throw new Error('Horário incompatível com o período escolar.');
  }
  const date = inicio instanceof Date ? inicio : new Date(inicio);
  const ms = date.getTime();
  if (!Number.isFinite(ms) || ms % (escolar ? 900000 : 1800000) !== 0) throw new Error('Início deve coincidir com intervalo de 30 minutos.');
  const ref = doc(collection(db, 'reservas'));
  const r = { id: ref.id, professorUid: auth.currentUser.uid, salaId, slot: ms / (escolar ? 900000 : 1800000),
    inicio: Timestamp.fromMillis(ms), fim: Timestamp.fromMillis(ms + (escolar ? 2700000 : 1800000)), status: 'pendente',
    criadaEm: serverTimestamp(), atualizadaEm: serverTimestamp() };
  if (escolar) Object.assign(r, { turno, periodo, gradeVersao: 1 });
  const refs = locks(db, r);
  const conflitos = escolar ? conflitosLegados(db, r) : [0,1].flatMap(i => [doc(db, 'ocupacoes15', salaId, 'periodos', String(r.slot * 2 + i)), doc(db, 'agendaProfessores15', r.professorUid, 'periodos', String(r.slot * 2 + i))]);
  await runTransaction(db, async tx => {
    const room = await tx.get(doc(db, 'salas', salaId));
    const occupied = await Promise.all([...refs, ...conflitos].map(p => tx.get(p)));
    if (!room.exists() || !room.data().disponivel) throw new Error('Sala indisponível.');
    if (occupied.some(s => s.exists())) throw new Error('Conflito de horário.');
    tx.set(ref, r);
    refs.forEach(p => tx.set(p, { reservaId: ref.id }));
  });
  return ref.id;
}
export async function decidirReserva({ db }, id, status) {
  if (!['aprovada', 'recusada'].includes(status)) throw new Error('Decisão inválida.');
  await runTransaction(db, async tx => {
    const ref = doc(db, 'reservas', id);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists() || snapshot.data().status !== 'pendente') throw new Error('Reserva não está pendente.');
    tx.update(ref, { status, atualizadaEm: serverTimestamp() });
    if (status === 'recusada') locks(db, snapshot.data()).forEach(p => tx.delete(p));
  });
}
export async function excluirReserva({ db }, id) {
  await runTransaction(db, async tx => {
    const ref = doc(db, 'reservas', id);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error('Reserva não encontrada.');
    if (snapshot.data().status !== 'recusada') locks(db, snapshot.data()).forEach(p => tx.delete(p));
    tx.delete(ref);
  });
}

export function observarReservas({ auth, db }, perfil, receber, falhou = () => {}) {
  if (!auth.currentUser) throw new Error('Login necessário.');
  if (!['professor', 'admin'].includes(perfil)) throw new Error('Perfil inválido.');
  const base = collection(db, 'reservas');
  const consulta = perfil === 'admin' ? base : query(base, where('professorUid', '==', auth.currentUser.uid));
  return onSnapshot(consulta, snapshot => receber(snapshot.docs.map(d => d.data())), falhou);
}
