# Reservas-Riachuelo

Sistema de reservas de salas e equipamentos do Instituto Estadual Riachuelo, com calendário interativo, controle de disponibilidade e painel administrativo. Desenvolvido com HTML, CSS, JavaScript (ES6), Firebase Firestore e Authentication.

## Estrutura

| Caminho | Responsabilidade |
| --- | --- |
| `front/` | Páginas HTML, estilos, scripts de interface e imagens |
| `backend/` | Módulos ES6 de lógica, validação e acesso ao Firebase |
| `banco/` | Modelo de dados, índices e exemplos sem dados pessoais |
| `seguranca/` | Regras do Firestore e documentação de permissões |
| `docs/` | Escopo, decisões e etapas |
| `.env.example` | Modelo das configurações locais |
| `firebase.json` | Caminhos das regras e índices do Firebase |

## Estado atual

Estrutura inicial criada. Login, Firebase SDK, reservas, calendário e painel ainda não foram implementados. Nenhum recurso Firebase foi criado ou publicado por esta estrutura.

O nome backend identifica a camada de serviços do projeto. Ela será executada no navegador com Firebase Web SDK, sem servidor Node.js ou Cloud Functions. Código enviado ao navegador é público; permissões efetivas devem ser aplicadas pelas Security Rules.

## Como começar

1. Clone o repositório.
2. Copie `.env.example` para `.env` e preencha a configuração do projeto Firebase.
3. Consulte `docs/etapas.md` antes de implementar.
4. Para visualizar a página inicial, execute `python3 -m http.server 8000 --directory front` na raiz e abra http://localhost:8000/.

O arquivo .env ainda não é carregado: a integração e o mecanismo de configuração do Firebase serão implementados na próxima etapa. O servidor acima é apenas para visualizar a estrutura inicial localmente. Em produção, publique somente os arquivos públicos necessários.

## Segurança

As regras iniciais negam todo acesso ao Firestore até a implementação dos perfis e validações. Não publique regras permissivas para contornar isso. Nunca coloque chaves privadas, credenciais Admin SDK ou senhas no front-end.

Veja `seguranca/README.md` e `docs/arquitetura.md`.
