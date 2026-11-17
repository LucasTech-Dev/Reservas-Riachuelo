// Sincroniza apenas o trecho de horários; não publica regras.
import { readFile, writeFile } from 'node:fs/promises';
import { TURNOS } from '../backend/config/periodos.js';
const path = new URL('../seguranca/firestore.rules', import.meta.url);
let rules = await readFile(path, 'utf8');
for (const [turno, {periodos}] of Object.entries(TURNOS)) {
  const slots = periodos.map(hora => { const [h,m] = hora.split(':').map(Number); return ((h + 3) * 4 + m / 15) % 96; });
  rules = rules.replace(new RegExp(`d.turno == '${turno}' && quarter == \\[[^\\]]+\\]`), `d.turno == '${turno}' && quarter == [${slots.join(',')}]`);
}
if (process.argv.includes('--check')) {
  if (rules !== await readFile(path,'utf8')) throw new Error('Grade nas regras desatualizada. Execute node scripts/sincronizar-grade.mjs.');
} else await writeFile(path, rules);
