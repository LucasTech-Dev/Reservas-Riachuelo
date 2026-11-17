import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDocFromServer, onSnapshot } from 'firebase/firestore';

export async function entrar({ auth, db }, email, senha) {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email.trim(), senha);
    const snapshot = await getDocFromServer(doc(db, 'usuarios', user.uid));
    const perfil = snapshot.data();
    if (!snapshot.exists() || perfil.uid !== user.uid || !perfil.ativo || !['professor', 'admin'].includes(perfil.perfil)) {
      throw new Error('Conta sem autorização da escola.');
    }
    return { uid: user.uid, ...perfil };
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}
export const sair = ({ auth }) => signOut(auth);

// Cada aba mantém sua própria sessão em memória; nenhum segredo vai para o código.
export function observarSessao({ auth, db }, receber, falhou = () => {}) {
  let cancelarPerfil = () => {};
  let versao = 0;
  const cancelarAuth = onAuthStateChanged(auth, user => {
    const atual = ++versao;
    cancelarPerfil();
    cancelarPerfil = () => {};
    receber(null);
    if (!user) return;
    cancelarPerfil = onSnapshot(doc(db, 'usuarios', user.uid), snapshot => {
      if (atual !== versao) return;
      const perfil = snapshot.data();
      if (!snapshot.exists() || perfil.uid !== user.uid || !perfil.ativo || !['professor', 'admin'].includes(perfil.perfil)) {
        receber(null);
        falhou(new Error('Conta sem autorização da escola.'));
        void signOut(auth).catch(falhou);
        return;
      }
      receber({ ...perfil, uid: user.uid });
    }, error => {
      if (atual !== versao) return;
      receber(null);
      falhou(error);
      void signOut(auth).catch(falhou);
    });
  }, falhou);
  return () => { ++versao; cancelarPerfil(); cancelarAuth(); };
}
