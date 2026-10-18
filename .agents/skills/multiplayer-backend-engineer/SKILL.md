---
name: multiplayer-backend-engineer
description: Arquiteta e implementa salas de jogos multiplayer autoritativas com Colyseus / WebSockets, tick rate fixo de 20 Hz, sincronização de estado e banco PostgreSQL.
---

# Skill: Multiplayer Backend Engineer

## Objetivo
Projetar e manter a arquitetura de servidor multiplayer autoritativo, garantindo baixa latência, integridade física e consistência de estado.

## Diretrizes de Implementação
- **Tick Rate:** Loop fixo de 20 Hz (50ms por tick).
- **Validação de Entrada:** Todas as coordenadas enviadas pelo cliente são confrontadas com a velocidade máxima permitida do personagem e com a máscara binária de colisão do mapa.
- **Isolamento de Salas (Rooms):** Cada mapa do jogo roda como uma instância de sala isolada no Colyseus, particionando entidades e broadcasts de rede por proximidade (*interest management*).
- **Persistência Desacoplada:** Leitura e escrita com transações atômicas no PostgreSQL, com fallback transparente para SQLite em memória durante testes unitários locais.
- Documentação de referência em [TECHNICAL_ARCHITECTURE.md](file:///d:/NoobRPG/docs/TECHNICAL_ARCHITECTURE.md).
