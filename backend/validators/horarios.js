import { horarioDoPeriodo, GRADE_VERSAO } from '../config/periodos.js';
const fuso = 'America/Sao_Paulo';
const partes = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' });
export function dataEmSaoPaulo(date = new Date()) {
  const p = Object.fromEntries(partes.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function inicioDoIntervalo(data, horario, agora = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^([01]\d|2[0-3]):(00|30)$/.test(horario)) {
    throw new Error('Selecione uma data e um horário de 30 em 30 minutos.');
  }
  const iso = `${data}T${horario}:00-03:00`;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms) || dataEmSaoPaulo(new Date(ms)) !== data) throw new Error('Data inválida.');
  if (ms < agora + 3600000) throw new Error('A reserva exige pelo menos 1 hora de antecedência.');
  if (ms > agora + 28 * 86400000) throw new Error('A reserva deve ocorrer nos próximos 28 dias.');
  return iso;
}
export function proximoIntervalo(agora = Date.now()) {
  const ms = Math.ceil((agora + 3600000 + 60000) / 1800000) * 1800000;
  const date = new Date(ms);
  const horario = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return { data: dataEmSaoPaulo(date), horario };
}

export function intervaloEscolar(data, turno, periodo, agora = Date.now()) {
  const horario = horarioDoPeriodo(turno, periodo);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida.');
  const inicio = `${data}T${horario.inicio}:00-03:00`, ms = Date.parse(inicio);
  if (!Number.isFinite(ms) || dataEmSaoPaulo(new Date(ms)) !== data) throw new Error('Data inválida.');
  if (ms < agora + 3600000) throw new Error('A reserva exige pelo menos 1 hora de antecedência.');
  if (ms > agora + 28 * 86400000) throw new Error('A reserva deve ocorrer nos próximos 28 dias.');
  return { inicio, turno, periodo, gradeVersao: GRADE_VERSAO };
}
