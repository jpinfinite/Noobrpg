---
name: phaser-typescript-developer
description: Especialista no desenvolvimento de cliente 2D usando Phaser 3, TypeScript, Vite, gerenciamento de cenas, câmeras, shaders e renderização pixel art.
---

# Skill: Phaser TypeScript Developer

## Objetivo
Implementar a arquitetura do cliente web no Phaser 3 com TypeScript, garantindo 60 FPS estáveis, física Arcade calibrada, renderização pixel-perfect e integração limpa com a rede.

## Práticas e Padrões Obrigatórios
- **Configuração do Game:** Sempre usar `pixelArt: true`, `roundPixels: true`, `antialias: false`.
- **Gerenciamento de Cenas (Scenes):**
  - `BootScene`: Configurações globais e inicialização de plugins.
  - `PreloadScene`: Carregamento assíncrono com barra de progresso visual.
  - `WorldScene`: Renderização de mapa, entidades e câmera.
  - `UIScene`: HUD paralelo (`active: true`, renderizado sobreposto via SceneManager).
- **Y-Sorting (Profundidade Dinâmica):**
  - Configurar `entity.setDepth(entity.y)` no loop de atualização para ordenação correta de sprites sobre árvores e paredes.
- **Object Pooling:** Projéteis, números de dano flutuante e efeitos de partículas devem reutilizar objetos alocados para evitar pausas de Garbage Collector.
