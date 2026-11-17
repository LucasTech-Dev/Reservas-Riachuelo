# Reservas Riachuelo

Sistema de reservas de salas do Instituto Estadual Riachuelo, com autenticação Firebase, calendário e aprovação pela direção.

**Site:** https://reservas-riachuelo.pages.dev/

## Executar

Requer Node.js 24 e npm.

```bash
npm ci
cp backend/config/firebase.example.js backend/config/firebase.local.js
```

Preencha `firebase.local.js` com a configuração Web do projeto Firebase autorizado. Na máquina onde o projeto já funciona, preserve o arquivo existente. A configuração local não é enviada ao GitHub. Nunca coloque senhas, tokens ou chaves do Firebase Admin SDK nesse arquivo.

```bash
npm run dev
```

Abra http://127.0.0.1:5173. Use uma conta autorizada pela escola; não há cadastro público. Cada aba mantém sua própria sessão até sair ou fechar a aba. Internet é necessária para acessar o Firebase.

## Reservas

O professor escolhe sala, data, turno e um período de 45 minutos. A direção aprova ou recusa; o status é atualizado automaticamente. Cada solicitação ocupa um período, com antecedência mínima de uma hora e máxima de 28 dias. Pendentes também bloqueiam a disponibilidade. Reservas antigas de 30 minutos continuam compatíveis.

O calendário rola até as reservas da data selecionada. Cards e linhas mostram o responsável e abrem detalhes, com botão para fechar e suporte ao teclado. Professor consulta apenas suas reservas; direção consulta as solicitações autorizadas. A interface mantém o visual azul e adapta-se a celulares e computadores.

## Horários escolares

A configuração central fica em `backend/config/periodos.js`.

| Período | Manhã | Tarde | Noite — provisório |
| --- | --- | --- | --- |
| 1 | 07:00–07:45 | 13:15–14:00 | 18:30–19:15 |
| 2 | 07:45–08:30 | 14:00–14:45 | 19:15–20:00 |
| 3 | 08:30–09:15 | 14:45–15:30 | 20:00–20:45 |
| 4 | 09:45–10:30 | 15:45–16:30 | 21:00–21:45 |
| 5 | 10:30–11:15 | 16:30–17:15 | 21:45–22:30 |
| 6 | 11:15–12:00 | 17:15–18:00 | 22:30–23:15 |

Horário de Brasília. Confirmar os intervalos e a grade noturna com a direção antes do uso definitivo.

Depois de ajustar a grade, execute `npm run grade:sincronizar` para atualizar o trecho correspondente das regras locais. O build verifica se a grade e as regras estão sincronizadas. Uma grade já utilizada precisa de uma nova versão e da preservação da validação anterior nas regras para continuar permitindo decisões sobre reservas históricas.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `front/` | HTML, CSS e JavaScript da interface |
| `backend/config/` | Inicialização Firebase, modelo da configuração Web e grade escolar |
| `backend/services/` | Autenticação e operações de reservas executadas no navegador |
| `backend/validators/` | Validação de datas e horários |
| `banco/firestore.indexes.json` | Configuração dos índices Firestore |
| `seguranca/firestore.rules` | Permissões, validações e bloqueios de conflitos |
| `scripts/` | Sincronização da grade com as regras locais |
| `firebase.json` | Caminhos de publicação das regras e índices |
| `vite.config.js` | Desenvolvimento e build estático |

As contas de demonstração desta máquina ficam em `.local/contas-demonstracao.json`, fora do Git e do build. Não compartilhe esse arquivo.

## Build e publicação

```bash
npm run build
npm run preview
```

O preview abre em http://127.0.0.1:4173. O pacote de produção fica em `dist/`; não sirva a raiz do repositório na internet.

O projeto existente usa Cloudflare Pages Direct Upload, sem publicação automática pelo GitHub. Para atualizar o mesmo site, com a conta Cloudflare autorizada:

```bash
npx wrangler@4.163.0 pages deploy dist --project-name reservas-riachuelo --branch main --commit-dirty=true
```

Se houver alteração de regras, revise e valide antes de publicar. Com Firebase CLI autenticado no projeto autorizado:

```bash
firebase deploy --only firestore:rules --project security-2b666 --config firebase.json
```

Reservas escolares usam três blocos de 15 minutos por sala e por professor. As regras verificam conflitos com os bloqueios antigos de 30 minutos, autoria, perfis ativos, antecedência, duração, timestamps do servidor e transações atômicas. Não é necessário criar outro banco ou migrar reservas antigas.

A versão publicada foi validada com 145 verificações locais e 20 cenários públicos no Chrome com Firebase real. Os arquivos de testes, diagnósticos e relatórios históricos foram retirados da estrutura a pedido do responsável pelo projeto.
