# Camada de lógica e serviços

Módulos JavaScript ES6 importados pela interface, com Firebase Web SDK. Sem servidor próprio e sem Cloud Functions.

- `config/`: inicialização do Firebase e configuração pública.
- `services/`: acesso a Authentication e Firestore.
- `validators/`: validações para orientar o usuário.
- `utils/`: funções reutilizáveis.

As validações no navegador não garantem segurança. Autorização e invariantes de reserva devem ser verificadas no Firestore por regras e por um modelo compatível com transações. Nenhum serviço funcional foi implementado nesta etapa.
