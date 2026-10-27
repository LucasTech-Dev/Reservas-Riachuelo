# Arquitetura

Front-end: HTML, CSS e JavaScript. Camada de serviços: JavaScript com módulos ES6 e Firebase Web SDK. Persistência: Firestore. Identidade: Firebase Authentication. Servidor próprio com hospedagem no cloudflare.

O front importa os serviços de backend. O Firebase aplica as regras de seguranca/firestore.rules. A pasta banco guarda documentação e índices, não uma instância local do banco.

A escolha do mecanismo de build/configuração é a próxima etapa. Navegadores não carregam .env automaticamente. A publicação deverá incluir os módulos públicos importados pelo front, sem expor .env, backups ou credenciais.
