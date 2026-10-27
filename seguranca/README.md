# Segurança

As regras iniciais bloqueiam toda leitura e escrita. Ainda não foram publicadas.

## Requisitos para próximas etapas

- Autenticação não equivale a autorização: somente usuários previamente autorizados pela escola.
- Professor acessa disponibilidade e administra apenas as próprias reservas dentro dos prazos.
- Administrador gerencia usuários, recursos e reservas.
- Impedir alteração de perfil pelo próprio professor.
- Validar campos, tipos, quantidades, horários, autoria, capacidade e manutenção nas regras.
- Garantir ausência de conflitos inclusive em requisições simultâneas.
- Testar permissões no Emulator antes de liberar as operações.
- Não incluir senhas, dados reais de professores ou chaves privadas no repositório.

O .env é ignorado pelo Git, mas isso não torna secretos os valores enviados ao navegador. A configuração Web Firebase identifica o projeto; Rules são responsáveis pelo controle de acesso.
