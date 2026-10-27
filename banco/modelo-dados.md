# Modelo inicial (a validar antes da implementação)

| Coleção | Finalidade |
| --- | --- |
| usuarios/{uid} | Nome, e-mail educacional, perfil e situação de acesso |
| recursos/{id} | Sala ou equipamento, quantidade, identificação e manutenção |
| reservas/{id} | Professor, recurso, turma, início, fim, quantidade, estado e campos específicos |
| configuracoes/{id} | Calendário letivo e parâmetros da escola |

O perfil administrador deve ser provisionado por processo confiável; o professor não pode promover a própria conta.

## Concorrência pendente

Apenas consultar reservas antes de gravar não impede conflitos simultâneos. Antes de liberar escritas, definir documentos de ocupação por recurso/período e por professor/período, com transações e Security Rules que garantam capacidade e exclusividade de sala. A granularidade depende dos períodos de aula da escola.

Definir também fuso America/Sao_Paulo, calendário letivo, recursos por unidade/carrinho, devoluções e política de cancelamento. Este documento é uma proposta, não um esquema já implementado.
