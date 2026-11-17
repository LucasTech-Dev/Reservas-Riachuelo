import { TURNOS, horarioDoPeriodo } from '../../backend/config/periodos.js';
import { criarFirebase } from '../../backend/config/firebase.js';
import { firebaseConfig } from '../../backend/config/firebase.local.js';
import { entrar, sair, observarSessao } from '../../backend/services/auth.js';
import { listarSalas, solicitarReserva, decidirReserva, observarReservas, nomesResponsaveis, periodosOcupados } from '../../backend/services/reservas.js';
import { dataEmSaoPaulo, intervaloEscolar } from '../../backend/validators/horarios.js';

const $ = id => document.getElementById(id);
const nomesStatus = { pendente: 'Pendente', aprovada: 'Aprovada', recusada: 'Recusada' };
const formatarDia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
const formatarHora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
let cliente, sessao = null, salas = [], reservas = [], generation = 0;
let cancelarReservas = () => {}, cancelarSessao = () => {};
let enviando = false, ocupados = new Set(), disponibilidadeChave = '', carregandoPeriodos = false, disponibilidadeVersao = 0;
let selectedDay = dataEmSaoPaulo();
let month = new Date(`${selectedDay.slice(0, 7)}-01T12:00:00-03:00`);
const decidindo = new Set();
let nomes = new Map(), detalheId = null, focoAnterior = null;
const responsavel = r => r.professorUid === sessao?.uid ? sessao.nome : nomes.get(r.professorUid) || 'Responsável indisponível';
function descricaoEscolar(r) {
  return r.gradeVersao === 1 && TURNOS[r.turno] ? `${TURNOS[r.turno].nome}${TURNOS[r.turno].provisorio ? ' (provisório)' : ''} · ${r.periodo}º período` : 'Reserva anterior';
}
function detalhes(r) {
  const items = {
    Responsável: responsavel(r), Sala: salas.find(s => s.id === r.salaId)?.nome || r.salaId,
    Data: formatarDia.format(r.inicio.toDate()),
    Turno: r.gradeVersao === 1 ? `${TURNOS[r.turno]?.nome || r.turno}${TURNOS[r.turno]?.provisorio ? ' (provisório)' : ''}` : 'Não informado',
    Período: r.periodo ? `${r.periodo}º período` : 'Não informado',
    Horário: `${formatarHora.format(r.inicio.toDate())}–${formatarHora.format(r.fim.toDate())}`,
    Status: nomesStatus[r.status] || 'Situação desconhecida'
  };
  if (r.observacoes) items.Observações = r.observacoes;
  $('reservation-detail').replaceChildren();
  for (const [label,value] of Object.entries(items)) {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label; dd.textContent = value; $('reservation-detail').append(dt,dd);
  }
}
function abrirDetalhe(r) {
  detalheId = r.id; focoAnterior = document.activeElement; detalhes(r); $('reservation-dialog').showModal();
}
function tornarClicavel(element, r) {
  element.tabIndex = 0; element.setAttribute('aria-haspopup','dialog'); element.setAttribute('aria-controls','reservation-dialog');
  if (element.tagName === 'ARTICLE') element.setAttribute('role','button');
  element.setAttribute('aria-label', `Ver detalhes: ${salas.find(s => s.id === r.salaId)?.nome || r.salaId}, ${responsavel(r)}, ${formatarDia.format(r.inicio.toDate())}`);
  element.addEventListener('click', event => { if (!event.target.closest('button')) abrirDetalhe(r); });
  element.addEventListener('keydown', event => {
    if (event.target !== element || !['Enter',' '].includes(event.key)) return;
    event.preventDefault(); abrirDetalhe(r);
  });
}
$('close-detail').addEventListener('click', () => $('reservation-dialog').close());
$('reservation-dialog').addEventListener('close', () => {
  detalheId = null;
  if (focoAnterior?.isConnected) focoAnterior.focus({preventScroll:true});
  else if (sessao) document.querySelector('[data-page][aria-current="page"]')?.focus({preventScroll:true});
});
function aviso(mensagem, tipo = '') {
  $('notice').textContent = mensagem;
  $('notice').className = `notice ${tipo}`;
  $('notice').hidden = !mensagem;
}
function mensagemErro(error) {
  const code = error?.code || '';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code)) return 'E-mail ou senha incorretos.';
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  if (code === 'auth/network-request-failed' || code === 'unavailable') return 'Sem conexão. Verifique a internet e tente novamente.';
  if (code === 'permission-denied') return 'Operação não autorizada ou dados fora das regras da reserva. Atualize a página e confira o horário.';
  const conhecidas = ['Conflito de horário.', 'Sala indisponível.', 'Reserva não está pendente.', 'Conta sem autorização da escola.', 'Selecione uma data e um horário de 30 em 30 minutos.', 'Data inválida.', 'A reserva exige pelo menos 1 hora de antecedência.', 'A reserva deve ocorrer nos próximos 28 dias.'];
  return conhecidas.includes(error?.message) ? error.message : 'Não foi possível concluir. Verifique a conexão e tente novamente.';
}
function datas() {
  $('data').min = dataEmSaoPaulo();
  $('data').max = dataEmSaoPaulo(new Date(Date.now() + 28 * 86400000));
}
function horarios() {
  const turno = $('turno').value, anterior = $('periodo').value;
  $('periodo').replaceChildren(new Option('Selecione o período', ''));
  $('periodo').disabled = !turno;
  for (let periodo = 1; turno && periodo <= 6; periodo++) {
    const h = horarioDoPeriodo(turno, periodo);
    const option = new Option(`${periodo}º período · ${h.inicio}–${h.fim}`, String(periodo));
    try { intervaloEscolar($('data').value, turno, periodo); } catch { option.disabled = true; }
    if (ocupados.has(periodo)) { option.disabled = true; option.textContent += ' · Indisponível'; }
    $('periodo').append(option);
  }
  if ([...$('periodo').options].some(o => o.value === anterior && !o.disabled)) $('periodo').value = anterior;
  $('horario-resumo').textContent = turno === 'noite' ? 'Noite: horários provisórios, sujeitos à confirmação da direção.' : '';
  if (carregandoPeriodos) $('horario-resumo').textContent += ' Consultando disponibilidade…';
  if ($('periodo').value) {
    const h = horarioDoPeriodo(turno, Number($('periodo').value));
    $('horario-resumo').textContent += ` Horário da reserva: ${h.inicio}–${h.fim}.`;
  }
  $('request-button').disabled = enviando || !turno || !$('periodo').value || !$('sala').value || carregandoPeriodos || disponibilidadeChave !== chaveDisponibilidade();
}
function chaveDisponibilidade() { return `${$('sala').value}|${$('data').value}|${$('turno').value}`; }
async function atualizarDisponibilidade() {
  const versao = ++disponibilidadeVersao, atual = generation;
  disponibilidadeChave = ''; ocupados = new Set(); carregandoPeriodos = false;
  if (!sessao || !cliente || !$('sala').value || !$('turno').value || !$('data').validity.valid) { horarios(); return; }
  carregandoPeriodos = true; horarios();
  const chave = chaveDisponibilidade();
  try {
    const result = await periodosOcupados(cliente, {salaId:$('sala').value, data:$('data').value, turno:$('turno').value});
    if (versao !== disponibilidadeVersao || atual !== generation) return;
    ocupados = result; disponibilidadeChave = chave;
  } catch(error) { if (versao === disponibilidadeVersao && atual === generation) aviso('Não foi possível consultar a disponibilidade. Use Atualizar para tentar novamente.', 'error'); }
  finally { if (versao === disponibilidadeVersao && atual === generation) { carregandoPeriodos = false; horarios(); } }
}
function renderSalas() {
  const anterior = $('sala').value;
  $('sala').replaceChildren(new Option('Selecione uma sala', ''));
  for (const sala of salas.filter(s => s.disponivel)) $('sala').append(new Option(sala.nome, sala.id));
  if (salas.some(s => s.id === anterior && s.disponivel)) $('sala').value = anterior;
  horarios(); void atualizarDisponibilidade();
}
function cell(text) { const td = document.createElement('td'); td.textContent = text; return td; }
function renderReservas() {
  $('reservations-body').replaceChildren();
  const admin = sessao?.perfil === 'admin';
  const filtro = $('status-filter').value;
  const ordenadas = reservas.filter(r => filtro === 'todas' || r.status === filtro).sort((a, b) => {
    if (admin && (a.status === 'pendente') !== (b.status === 'pendente')) return a.status === 'pendente' ? -1 : 1;
    return b.inicio.toMillis() - a.inicio.toMillis();
  });
  for (const r of ordenadas) {
    const tr = document.createElement('tr');
    tr.dataset.reservaId = r.id; tornarClicavel(tr, r);
    const nomeSala = salas.find(s => s.id === r.salaId)?.nome || r.salaId;
    const inicio = r.inicio.toDate(), fim = r.fim.toDate();
    const salaCell = cell(nomeSala), dateCell = cell(`${formatarDia.format(inicio)} · ${formatarHora.format(inicio)}–${formatarHora.format(fim)}`);
    salaCell.dataset.label = 'Sala'; dateCell.dataset.label = 'Data e horário';
    const nomeCell = cell(responsavel(r)); nomeCell.dataset.label = 'Responsável';
    dateCell.append(document.createElement('br'), document.createTextNode(descricaoEscolar(r)));
    tr.append(salaCell, nomeCell, dateCell);
    const td = document.createElement('td'), status = document.createElement('span');
    status.className = `status ${Object.hasOwn(nomesStatus, r.status) ? r.status : ''}`;
    status.textContent = nomesStatus[r.status] || 'Situação desconhecida';
    td.dataset.label = 'Situação'; td.append(status); tr.append(td);
    if (admin) {
      const actions = document.createElement('td'); actions.dataset.label = 'Direção';
      if (r.status === 'pendente') {
        const group = document.createElement('div'); group.className = 'actions';
        for (const [valor, label] of [['aprovada', 'Aprovar'], ['recusada', 'Recusar']]) {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
          button.className = valor === 'aprovada' ? 'primary' : 'secondary';
          button.disabled = decidindo.has(r.id);
          button.addEventListener('click', () => decidir(r.id, valor));
          group.append(button);
        }
        actions.append(group);
      } else actions.textContent = 'Concluída';
      tr.append(actions);
    }
    $('reservations-body').append(tr);
  }
  $('list-state').textContent = ordenadas.length ? `${ordenadas.length} solicitação(ões). Atualização automática.` : 'Nenhuma solicitação encontrada.';
  renderCalendario();
  if (detalheId) {
    const r = reservas.find(r => r.id === detalheId);
    if (r) detalhes(r); else $('reservation-dialog').close();
  }
}
function acompanhar() {
  cancelarReservas();
  if (!sessao) return;
  const atual = generation;
  $('list-state').textContent = 'Carregando solicitações…';
  cancelarReservas = observarReservas(cliente, sessao.perfil, rows => {
    if (atual !== generation) return;
    reservas = rows; renderReservas(); void atualizarDisponibilidade();
    const faltantes = sessao.perfil === 'admin' ? rows.map(r => r.professorUid).filter(uid => !nomes.has(uid)) : [];
    if (faltantes.length) void nomesResponsaveis(cliente, faltantes).then(result => {
      if (atual !== generation) return;
      for (const [uid,nome] of result) nomes.set(uid,nome);
      renderReservas();
    }).catch(() => { /* Mantém a reserva visível sem ampliar permissões. */ });
  }, error => {
    if (atual !== generation) return;
    reservas = []; renderReservas();
    $('list-state').textContent = 'Não foi possível atualizar as solicitações. Use Atualizar para tentar novamente.';
    aviso(mensagemErro(error), 'error');
  });
}
async function atualizar() {
  if (!sessao) return;
  const atual = generation;
  $('refresh-button').disabled = true;
  try {
    const rows = await listarSalas(cliente);
    if (atual !== generation) return;
    salas = rows; renderSalas(); renderReservas(); acompanhar();
  } catch (error) {
    if (atual === generation) aviso(mensagemErro(error), 'error');
  } finally { $('refresh-button').disabled = false; }
}
async function receberSessao(perfil) {
  const mesma = sessao?.uid === perfil?.uid && sessao?.perfil === perfil?.perfil;
  if (mesma && perfil) return;
  ++generation; ++disponibilidadeVersao; disponibilidadeChave = ''; ocupados.clear(); carregandoPeriodos = false; cancelarReservas(); cancelarReservas = () => {};
  $('reservation-dialog').close(); $('reservation-detail').replaceChildren();
  sessao = perfil; salas = []; reservas = []; nomes.clear(); decidindo.clear();
  $('reservations-body').replaceChildren();
  $('auth-view').hidden = Boolean(perfil); $('workspace').hidden = !perfil;
  $('professor-view').hidden = true;
  $('calendar-view').hidden = true;
  $('reservas-section').hidden = true;
  $('new-reservation-link').hidden = perfil?.perfil !== 'professor';
  $('calendar-new-link').hidden = perfil?.perfil !== 'professor';
  $('actions-heading').hidden = perfil?.perfil !== 'admin';
  if (!perfil) { $('login-password').value = ''; $('session-summary').textContent = ''; renderSalas(); return; }
  $('session-summary').textContent = `${perfil.nome} · ${perfil.perfil === 'admin' ? 'Direção' : 'Professor'}`;
  $('list-title').textContent = perfil.perfil === 'admin' ? 'Solicitações para a direção' : 'Minhas solicitações';
  aviso('');
  navegar();
  await atualizar();
}
async function decidir(id, status) {
  if (!sessao || sessao.perfil !== 'admin' || decidindo.has(id)) return;
  const atual = generation;
  decidindo.add(id); renderReservas();
  try {
    await decidirReserva(cliente, id, status);
    if (atual === generation) aviso(`Reserva ${status === 'aprovada' ? 'aprovada' : 'recusada'} com sucesso.`, 'success');
  } catch (error) { if (atual === generation) aviso(mensagemErro(error), 'error'); }
  finally { decidindo.delete(id); if (atual === generation) renderReservas(); }
}
function navegar() {
  if (!sessao) return;
  let page = location.hash.slice(1);
  if (!['calendario', 'nova-reserva', 'reservas'].includes(page) || (page === 'nova-reserva' && sessao.perfil !== 'professor')) page = 'calendario';
  $('calendar-view').hidden = page !== 'calendario';
  $('professor-view').hidden = page !== 'nova-reserva';
  $('reservas-section').hidden = page !== 'reservas';
  for (const link of document.querySelectorAll('[data-page]')) {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (page === 'nova-reserva') { datas(); void atualizarDisponibilidade(); }
  if (page === 'calendario') renderCalendario();
}
function renderCalendario() {
  if (!sessao) return;
  $('calendar-description').textContent = sessao.perfil === 'admin' ? 'Solicitações recebidas pela direção.' : 'Suas solicitações. A disponibilidade da sala é confirmada ao enviar a reserva.';
  $('calendar-month').textContent = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(month);
  const year = month.getUTCFullYear(), m = month.getUTCMonth();
  const first = new Date(Date.UTC(year, m, 1, 15));
  const count = new Date(Date.UTC(year, m + 1, 0, 15)).getUTCDate();
  $('calendar-grid').replaceChildren();
  for (let i = 0; i < first.getUTCDay(); i++) { const blank = document.createElement('span'); blank.className = 'calendar-blank'; $('calendar-grid').append(blank); }
  for (let day = 1; day <= count; day++) {
    const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const entries = reservas.filter(r => dataEmSaoPaulo(r.inicio.toDate()) === iso);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'calendar-day'; button.dataset.date = iso;
    if (iso === dataEmSaoPaulo()) button.classList.add('today');
    button.setAttribute('aria-pressed', String(iso === selectedDay));
    button.setAttribute('aria-label', `${day} de ${$('calendar-month').textContent}, ${entries.length} solicitação(ões)`);
    const number = document.createElement('span'); number.textContent = day; button.append(number);
    const dots = document.createElement('span'); dots.className = 'day-dots';
    for (const state of ['pendente', 'aprovada', 'recusada']) if (entries.some(r => r.status === state)) { const dot = document.createElement('i'); dot.className = `dot ${state}`; dots.append(dot); }
    button.append(dots);
    button.addEventListener('click', () => {
      selectedDay = iso; renderCalendario();
      $('day-details').focus({preventScroll:true});
      $('day-details').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    });
    $('calendar-grid').append(button);
  }
  $('selected-day-title').textContent = `Reservas em ${formatarDia.format(new Date(`${selectedDay}T12:00:00-03:00`))}`;
  const entries = reservas.filter(r => dataEmSaoPaulo(r.inicio.toDate()) === selectedDay).sort((a,b) => a.inicio.toMillis() - b.inicio.toMillis());
  const target = $('selected-day-reservations'); target.replaceChildren();
  if (!entries.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Nenhuma solicitação sua nesta data.'; if (sessao.perfil === 'admin') p.textContent = 'Nenhuma solicitação nesta data.'; target.append(p); }
  for (const r of entries) {
    const article = document.createElement('article'); article.className = 'day-reservation'; article.dataset.reservaId = r.id; tornarClicavel(article,r);
    const name = document.createElement('strong'); name.textContent = salas.find(s => s.id === r.salaId)?.nome || r.salaId;
    const period = document.createElement('span'); period.textContent = `${formatarHora.format(r.inicio.toDate())}–${formatarHora.format(r.fim.toDate())}`;
    const badge = document.createElement('span'); badge.className = `status ${Object.hasOwn(nomesStatus,r.status) ? r.status : ''}`; badge.textContent = nomesStatus[r.status] || 'Situação desconhecida';
    const owner = document.createElement('span'); owner.className = 'reservation-owner'; owner.textContent = responsavel(r);
    const school = document.createElement('span'); school.textContent = descricaoEscolar(r);
    article.append(name,owner,school,period,badge); target.append(article);
  }
}
$('previous-month').addEventListener('click', () => { month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1, 15)); selectedDay = dataEmSaoPaulo(month); renderCalendario(); });
$('next-month').addEventListener('click', () => { month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1, 15)); selectedDay = dataEmSaoPaulo(month); renderCalendario(); });
$('status-filter').addEventListener('change', renderReservas);
window.addEventListener('hashchange', navegar);
$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter;
  if (button.disabled) return;
  button.disabled = true; aviso('Entrando…');
  const senha = $('login-password').value; $('login-password').value = '';
  try { await entrar(cliente, $('login-email').value, senha); }
  catch (error) { aviso(mensagemErro(error), 'error'); }
  finally { button.disabled = false; }
});
$('logout-button').addEventListener('click', async () => {
  $('logout-button').disabled = true;
  try { await sair(cliente); aviso('Sessão encerrada.'); }
  catch (error) { aviso(mensagemErro(error), 'error'); }
  finally { $('logout-button').disabled = false; }
});
$('reservation-form').addEventListener('submit', async event => {
  event.preventDefault(); if (enviando || sessao?.perfil !== 'professor') return;
  const atual = generation;
  enviando = true; horarios(); aviso('Enviando solicitação…');
  try {
    await solicitarReserva(cliente, { salaId: $('sala').value, ...intervaloEscolar($('data').value, $('turno').value, Number($('periodo').value)) });
    if (atual === generation) { $('status-filter').value = 'todas'; location.hash = 'reservas'; aviso('Solicitação enviada. Aguarde a aprovação da direção.', 'success'); }
  } catch (error) { if (atual === generation) aviso(mensagemErro(error), 'error'); }
  finally { enviando = false; if (atual === generation) void atualizarDisponibilidade(); }
});
$('data').addEventListener('change', () => { datas(); void atualizarDisponibilidade(); });
$('sala').addEventListener('change', () => void atualizarDisponibilidade());
$('turno').addEventListener('change', () => { $('periodo').value = ''; void atualizarDisponibilidade(); });
$('periodo').addEventListener('change', horarios);
$('refresh-button').addEventListener('click', () => { datas(); horarios(); void atualizar(); });
window.addEventListener('offline', () => aviso('Sem conexão. Reconecte para consultar ou enviar reservas.', 'error'));
window.addEventListener('online', () => { aviso('Conexão restabelecida.'); void atualizar(); });
window.addEventListener('pagehide', event => { if (!event.persisted) { cancelarReservas(); cancelarSessao(); } });
try {
  for (const [id,turno] of Object.entries(TURNOS)) $('turno').append(new Option(`${turno.nome}${turno.provisorio ? ' (provisório)' : ''}`,id));
  datas(); $('data').value = dataEmSaoPaulo(); horarios();
  const emuladores = import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === 'true';
  cliente = criarFirebase(emuladores ? {projectId:'demo-reservas-validacao',apiKey:'demo-key',appId:'demo-app'} : firebaseConfig, { persistirSessao: true, emuladores });
  cancelarSessao = observarSessao(cliente, perfil => { void receberSessao(perfil); }, error => aviso(mensagemErro(error), 'error'));
  aviso('');
} catch { aviso('Não foi possível iniciar. Confira a configuração local do Firebase e reinicie o aplicativo.', 'error'); }
