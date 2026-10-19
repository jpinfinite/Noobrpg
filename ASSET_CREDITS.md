# Registro e Manifesto de Licenças de Assets — NoobRPG

**Data de Atualização:** 19 de Outubro de 2026  
**Padrão de Conformidade:** OpenGameArt / Creative Commons / Direitos Autorais  
**Motor Gráfico:** Phaser 3.88.2 (2D Pixel Art Top-Down)  

---

## 1. Diretrizes de Uso de Assets

O NoobRPG utiliza uma combinação de **spritesheets em pixel art profissional** e **texturas procedurais em canvas de alta precisão (16×16 px)**. Todos os recursos visuais e sonoros incorporados ao jogo cumprem com as seguintes regras:
- Compatibilidade estrita com licenças permissivas (**CC0**, **CC-BY 3.0/4.0**, **OGA-BY 3.0** ou de domínio público).
- Ponto de vista ortogonal/top-down em pixel art 16×16 ou 16×24 com ancoragem no pé (`originX: 0.5, originY: 0.85` a `1.0`).
- Registro explícito de autor, fonte e termos de modificação.

---

## 2. Inventário de Recursos e Atribuições

### 2.1 Personagens e Classes de Heróis
| Identificador no Jogo | Arquivo / Diretório | Formato & Frames | Origem & Autor | Licença | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `hero_warrior` | `packages/client/public/assets/sprites/warrior/` | Spritesheets PNG (20x24 a 24x24 px)<br>Idle, Walk, Attack, Hurt, Death | Pacote original de Sprites Pixel Art (`files-sprites`) | CC-BY / OGA-BY (Uso autorizado com atribuição) | **INTEGRADO** |
| `hero_ranger` | `packages/client/public/assets/sprites/ranger/` | Spritesheets PNG (16x24 a 54x24 px)<br>Idle, Walk, Attack, Hurt, Death | Pacote original de Sprites Pixel Art (`files-sprites`) | CC-BY / OGA-BY (Uso autorizado com atribuição) | **INTEGRADO** |
| `hero_mage` | `packages/client/public/assets/sprites/mage/` | Spritesheets PNG (16x24 a 60x24 px)<br>Idle, Walk, Attack, Hurt, Death | Pacote original de Sprites Pixel Art (`files-sprites`) | CC-BY / OGA-BY (Uso autorizado com atribuição) | **INTEGRADO** |
| `hero_druid` | `packages/client/public/assets/sprites/druid/` | Spritesheets PNG (16x24 a 58x24 px)<br>Idle, Walk, Attack, Hurt, Death | Pacote original de Sprites Pixel Art (`files-sprites`) | CC-BY / OGA-BY (Uso autorizado com atribuição) | **INTEGRADO** |

### 2.2 Monstros e Inimigos
| Identificador no Jogo | Arquivo / Geração | Formato & Dimensões | Autor / Origem | Licença | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `mob_slime` | `TextureGenerator.generateSlimeSpritesheet` | Procedural Canvas 16×16 px<br>Idle e Salto pulsante | NoobRPG Engine Team | CC0 (Domínio Público) | **INTEGRADO** |
| `mob_goblin` | `TextureGenerator.generateGoblinSpritesheet` | Procedural Canvas 16×24 px<br>Idle e Patrulha armada | NoobRPG Engine Team | CC0 (Domínio Público) | **INTEGRADO** |

### 2.3 Terreno, Mapa e Elementos do Cenário
| Identificador no Jogo | Arquivo / Geração | Formato & Dimensões | Autor / Origem | Licença | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `tileset_prototype` | `TextureGenerator.generateTileset` | Canvas PNG 128×64 px (16×16 por tile)<br>Grama, terra, caminhos, água animada e flores | NoobRPG Engine Team | CC0 (Domínio Público) | **INTEGRADO** |
| `map_prototype` | `packages/client/public/assets/maps/map_prototype.json` | Tiled Map JSON Ortogonal ($120 \times 80$ tiles)<br>Camadas: Ground, Ground_Deco, Collision, Overhead_Foliage | NoobRPG Map Design | CC0 (Domínio Público) | **INTEGRADO** |
| `prop_tree` | `TextureGenerator.generateTreeProp` | Canvas PNG 32×48 px<br>Tronco e copa integrados / separados | NoobRPG Engine Team | CC0 (Domínio Público) | **INTEGRADO** |
| `prop_pillar` | `TextureGenerator.generatePillarProp` | Canvas PNG 16×32 px<br>Pilar de pedra da praça central | NoobRPG Engine Team | CC0 (Domínio Público) | **INTEGRADO** |

### 2.4 Itens, Coleta e Interface
| Identificador no Jogo | Arquivo / Geração | Formato & Dimensões | Autor / Origem | Licença | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `node_ore` | `TextureGenerator.generateOreNode` | Canvas PNG 16×16 px (Veio de minério) | NoobRPG Engine Team | CC0 (Domínio Público) | **INTEGRADO** |
| `node_herb` | `TextureGenerator.generateHerbNode` | Canvas PNG 16×16 px (Arbusto de ervas) | NoobRPG Engine Team | CC0 (Domínio Público) | **INTEGRADO** |
| `prop_anvil` | `TextureGenerator.generateAnvilProp` | Canvas PNG 16×16 px (Bancada da forja) | NoobRPG Engine Team | CC0 (Domínio Público) | **INTEGRADO** |
| `item_icons` | `TextureGenerator.generateItemIcons` | Canvas PNG 16×16 px (Espadas, armaduras, poções, minérios) | NoobRPG Engine Team | CC0 (Domínio Público) | **INTEGRADO** |
| `fx_*` | `TextureGenerator.generate*Fx` | Efeitos de corte, flecha, orbe mágico, explosão de natureza e cura | NoobRPG Engine Team | CC0 (Domínio Público) | **INTEGRADO** |

---

## 3. Instruções para Futuras Inclusões do OpenGameArt

Ao baixar e incorporar novos pacotes do [OpenGameArt.org](https://opengameart.org/):
1. **Verificação Prévia:**
   - Conferir se a licença é **CC0**, **CC-BY 3.0/4.0** ou **OGA-BY 3.0**.
   - Recusar assets com restrição NC (Não-Comercial) ou ND (Sem Derivados) se houver intenção de customização.
2. **Registro Obrigatório:**
   - Adicionar uma nova linha na tabela correspondente deste documento (`ASSET_CREDITS.md`).
   - Armazenar o arquivo bruto não modificado em pasta de origem identificada antes de qualquer corte ou conversão.
3. **Formatação Técnica:**
   - Garantir alinhamento de tiles em múltiplos exatos de 16 px sem anti-aliasing borrado.
   - Preservar transparência no canal alfa (PNG de 32 bits).
