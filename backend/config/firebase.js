import { initializeApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, browserSessionPersistence, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Configuração Web injetada pelo consumidor; sem segredos e sem Analytics.
export function criarFirebase(config, { nome, emuladores = false, persistirSessao = false } = {}) {
  if (!config?.projectId || !config?.apiKey || !config?.appId) throw new Error('Configuração Web Firebase incompleta.');
  if (config.projectId.startsWith('demo-') !== emuladores) {
    throw new Error('Projetos demo exigem emuladores; emuladores não aceitam projeto real.');
  }
  const app = initializeApp(config, nome);
  const auth = initializeAuth(app, { persistence: persistirSessao ? browserSessionPersistence : inMemoryPersistence });
  const db = initializeFirestore(app, {});
  if (emuladores) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return { app, auth, db };
}
