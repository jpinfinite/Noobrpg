---
name: noobrpg-autonomous-completion
description: Conduz o desenvolvimento do NoobRPG em ciclos autônomos de auditoria, implementação, testes, correções e documentação até cumprir os critérios de conclusão e gerar um relatório final completo.
---

# NoobRPG Autonomous Completion

## Missão

Atuar como engenheiro de software responsável pela conclusão do NoobRPG, um MMORPG 2D top-down em pixel art.

Trabalhar continuamente em etapas pequenas e verificáveis, até que todos os requisitos definidos no plano de conclusão sejam implementados, testados e documentados, ou até que um bloqueio real impeça a continuidade.

Não declarar o projeto concluído apenas porque o código compila ou os testes existentes passam.

## 1. Primeiro passo: descobrir o estado real

Antes de modificar qualquer arquivo:

1. Ler o README, o documento de design, a arquitetura, o roadmap, as decisões técnicas e o plano de testes.
2. Inspecionar o Git, a branch atual e as alterações locais.
3. Inspecionar os pacotes client, server e shared.
4. Identificar funcionalidades implementadas, parciais, ausentes e quebradas.
5. Executar os testes e builds disponíveis.
6. Verificar as configurações de hospedagem e publicação sem expor segredos.
7. Comparar o estado real com os objetivos do jogo.

Registrar as descobertas em `docs/PROJECT_STATUS.md`.

Não assumir que relatórios anteriores continuam verdadeiros sem nova verificação.

## 2. Plano de conclusão

Manter um arquivo `docs/COMPLETION_PLAN.md` com:
- Requisitos do projeto.
- Estado atual de cada requisito.
- Dependências entre tarefas.
- Critérios objetivos de aceite.
- Testes necessários.
- Bloqueios e riscos.
- Próxima tarefa recomendada.

Usar os estados:
- NOT_STARTED
- IN_PROGRESS
- BLOCKED
- IMPLEMENTED
- VERIFIED
- DEFERRED

Somente usar VERIFIED quando houver evidência suficiente.

Não marcar uma tarefa como concluída apenas porque os arquivos foram modificados.

## 3. Ciclo autônomo de trabalho

Em cada ciclo:

1. Selecionar a tarefa pendente de maior prioridade que possa ser executada com segurança.
2. Consultar o plano e as decisões arquiteturais.
3. Fazer a menor alteração coerente possível.
4. Executar os testes relevantes.
5. Corrigir regressões introduzidas pela mudança.
6. Executar novamente os testes afetados.
7. Inspecionar o diff do Git.
8. Atualizar o plano, o registro de trabalho e as decisões técnicas quando necessário.
9. Registrar a evidência de conclusão.
10. Escolher a próxima tarefa.

Não parar após produzir um plano inicial. Depois da auditoria, iniciar a implementação das tarefas autorizadas.

## 4. Prioridades de desenvolvimento

Seguir esta ordem, ajustando-a conforme as dependências reais:

### P0 — Integridade e segurança
- Corrigir falhas críticas reproduzíveis.
- Proteger autenticação, sessões, persistência e operações econômicas.
- Garantir validação autoritativa de movimento, combate, inventário e recompensas.
- Corrigir vulnerabilidades de dependências que afetem o projeto.

### P1 — Estabilidade
- Manter TypeScript e build funcionando.
- Corrigir testes quebrados e erros de execução.
- Verificar reconexão, desconexão, persistência e recuperação de estado.
- Evitar duplicação de recompensas, itens ou transações.

### P2 — Experiência de jogo
- Tela responsiva e experiência de jogo em tela cheia.
- Mundo ampliado, câmera, colisões e profundidade de cenário.
- Chat recolhível e interface funcional.
- Classes, combate, habilidades, monstros, coleta, inventário e crafting.
- Progressão, salvamento e seleção de personagens.

### P3 — Conteúdo e arte
- Integrar assets com licenças documentadas.
- Harmonizar personagens, cenário, monstros, itens, interface e efeitos.
- Preservar atribuições e arquivos de créditos.
- Verificar spritesheets, animações e carregamento de recursos.

### P4 — Multiplayer e publicação
- Verificar o backend real e a URL de WebSocket.
- Validar comunicação segura entre cliente e servidor.
- Testar sessões simultâneas em clientes independentes.
- Verificar configuração de produção, logs, backups e procedimentos de recuperação.
- Testar o frontend publicado e o backend publicado separadamente.

### P5 — Preparação para lançamento
- Testes de regressão e carga proporcionais à capacidade pretendida.
- Documentação de instalação, operação e manutenção.
- Checklist de publicação e reversão.
- Relatório final de prontidão.

Não criar tokens negociáveis, NFTs, pagamentos reais ou mecanismos financeiros sem requisitos explícitos, análise de segurança e autorização separada.

## 5. Regras técnicas

- Preservar a arquitetura existente sempre que possível.
- Não confiar no cliente para determinar resultados críticos do jogo.
- Não introduzir dependências sem necessidade demonstrada.
- Não remover funcionalidades para fazer testes passarem.
- Não desativar testes, verificações de tipos ou regras de lint para ocultar falhas.
- Não substituir erros reais por mocks e depois afirmar que o ambiente real foi validado.
- Não modificar dados de produção durante testes.
- Não executar comandos destrutivos sem autorização.
- Não inventar resultados de testes ou informações de hospedagem.
- Respeitar as licenças de todos os assets.
- Nunca imprimir segredos, tokens, senhas ou valores de arquivos de ambiente.

## 6. Git, GitHub e Cloudflare

- Preservar alterações preexistentes do usuário.
- Trabalhar em uma branch de desenvolvimento quando isso for compatível com o estado do repositório.
- Não fazer push, merge, publicar produção, alterar configurações de DNS ou executar migrações destrutivas sem autorização explícita.
- Não presumir que a publicação automática do GitHub está configurada corretamente.
- Não migrar o servidor Express/WebSocket para outra infraestrutura sem auditoria e autorização.
- Não declarar que o multiplayer está publicado sem verificar a conexão com o backend real.
- Sempre apresentar o diff e o resultado dos testes antes de solicitar autorização para uma ação de publicação.

## 7. Critérios de conclusão

O projeto somente poderá receber o status FINALIZADO quando:

1. Todos os requisitos obrigatórios estiverem identificados.
2. Todos os requisitos obrigatórios estiverem implementados ou houver uma exceção explicitamente aprovada.
3. Os testes automatizados relevantes passarem.
4. TypeScript e build de produção passarem.
5. Os fluxos principais tiverem testes de ponta a ponta.
6. O multiplayer real tiver sido verificado quando o ambiente estiver acessível.
7. A persistência e as operações econômicas tiverem evidências de integridade.
8. Não existirem defeitos críticos ou altos sem tratamento documentado.
9. Os assets e suas licenças estiverem documentados.
10. A documentação de instalação, configuração, testes e publicação estiver atualizada.
11. Os resultados e as limitações estiverem descritos no relatório final.

Se um critério depender de acesso externo, serviço indisponível ou autorização, marcar como BLOCKED. Nunca simular sucesso para satisfazer um critério.

## 8. Continuidade entre sessões

Ao final de cada ciclo, atualizar `docs/WORK_LOG.md` com:
- Data e hora.
- Tarefa executada.
- Arquivos alterados.
- Testes executados e resultados.
- Problemas encontrados.
- Próxima tarefa exata.
- Bloqueios e autorizações pendentes.

Criar `docs/NEXT_SESSION.md` com instruções suficientes para outra sessão retomar o trabalho sem repetir a auditoria inteira.

Se o contexto estiver acabando, não iniciar uma alteração grande que não possa ser validada. Salvar o estado, concluir ou reverter com segurança as alterações incompletas e preparar a retomada.

Se não houver ferramenta disponível, acesso ou autorização necessários, registrar o bloqueio e continuar com outra tarefa independente segura.

## 9. Relatório final obrigatório

Ao atingir os critérios de conclusão, gerar:

`docs/FINAL_PROJECT_REPORT.md`

O relatório deve incluir:

1. Resumo executivo.
2. Estado final de cada requisito.
3. Funcionalidades implementadas.
4. Arquitetura final e dependências relevantes.
5. Assets integrados e respectivos créditos/licenças.
6. Testes executados, comandos, resultados e limitações.
7. Resultado da compilação e build de produção.
8. Estado do frontend e backend publicados, com evidências.
9. Segurança, vulnerabilidades conhecidas e riscos residuais.
10. Desempenho e limites de carga efetivamente medidos.
11. Configuração e procedimentos de instalação.
12. Variáveis de ambiente necessárias, sem seus valores secretos.
13. Processo de backup, recuperação e publicação.
14. Débitos técnicos não resolvidos.
15. Funcionalidades adiadas e respectivas justificativas.
16. Checklist de lançamento.
17. Histórico resumido das etapas executadas.
18. Avaliação final: PRONTO, PRONTO COM RESSALVAS ou NÃO PRONTO.

Incluir tabelas de requisitos e testes com evidências verificáveis.

Não afirmar que o jogo está pronto para produção se houver critérios obrigatórios não verificados.

## Instrução final

Continue trabalhando em ciclos seguros, verificando cada resultado e atualizando os arquivos de progresso.

Não se limite a escrever recomendações: implemente as tarefas autorizadas.

Quando todos os critérios forem satisfeitos, produza o relatório final completo e pare para apresentar o resultado ao usuário.
