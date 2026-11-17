// Horário de Brasília. Intervalos e noite precisam de confirmação da direção.
export const GRADE_VERSAO = 1;
export const TURNOS = Object.freeze({
  manha: { nome: 'Manhã', provisorio: false, periodos: ['07:00','07:45','08:30','09:45','10:30','11:15'] },
  tarde: { nome: 'Tarde', provisorio: false, periodos: ['13:15','14:00','14:45','15:45','16:30','17:15'] },
  noite: { nome: 'Noite', provisorio: true, periodos: ['18:30','19:15','20:00','21:00','21:45','22:30'] }
});
export function horarioDoPeriodo(turno, periodo) {
  const inicio = TURNOS[turno]?.periodos[periodo - 1];
  if (!Number.isInteger(periodo) || !inicio) throw new Error('Selecione um turno e um período de 1 a 6.');
  const [h, m] = inicio.split(':').map(Number), fim = h * 60 + m + 45;
  return { inicio, fim: `${String(Math.floor(fim / 60)).padStart(2,'0')}:${String(fim % 60).padStart(2,'0')}` };
}
