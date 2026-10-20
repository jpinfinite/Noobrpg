# Relatório de Criação e Integração da Vila Inicial (Unity → Phaser 3)

**Projeto:** NoobRPG  
**Data:** 19 de Outubro de 2026  
**Status da Missão:** Concluída com Sucesso (Staging Validado & Integrado com Segurança)  
**Motor do Jogo:** Phaser 3.88.2 (HTML5 / TypeScript no Navegador)  
**Ferramenta de Autoria Visual:** Unity 6 (`6000.6.4f1`)  

---

## 1. O que Foi Criado

Foi implementada a **Vila Inicial do NoobRPG** (`NoobRPG_StarterVillage`), fornecendo a primeira experiência ambiental imersiva em pixel art para os jogadores:

1. **Cena de Autoria Visual no Unity 6:**
   - [NoobRPG_StarterVillage.unity](file:///d:/NoobRPG/tools/unity-asset-pipeline/Assets/Scenes/NoobRPG_StarterVillage.unity): cena nativa configurada com componente `Grid` 2D e as quatro camadas canônicas de `Tilemap`.
2. **Construtor Procedural de Editor:**
   - [StarterVillageBuilder.cs](file:///d:/NoobRPG/tools/unity-asset-pipeline/Assets/Editor/StarterVillageBuilder.cs): script de automação C# acessível pelo menu superior do Unity Editor (`Tools > NoobRPG > Build Starter Village Scene and Export`) e por linha de comando (`-executeMethod NoobRPG.EditorPipeline.StarterVillageBuilder.BuildAndExportCommandLine`).
3. **Gerador e Validador Headless de Mapa:**
   - [generate-starter-village-map.ts](file:///d:/NoobRPG/tools/unity-asset-pipeline/scripts/generate-starter-village-map.ts): construtor e exportador em TypeScript com resolução determinística de geometria e integridade de dados.
4. **Exportador de Tileset PNG e Metadados:**
   - [export-tileset-png.ts](file:///d:/NoobRPG/tools/unity-asset-pipeline/scripts/export-tileset-png.ts): gera a imagem rasterizada PNG RGBA32 do tileset com transparência e metadados.
5. **Seletor de Mapa Dinâmico em Staging:**
   - Adicionada alternância via parâmetro `?map=starter_village` e botão flutuante no cliente Phaser sem afetar os jogadores de produção.

### Composição Visual da Vila Inicial
- **Dimensões:** $60 \times 40$ tiles ($960 \times 640$ pixels).
- **Área Base de Grama:** solo verde rico cobrindo toda a extensão transitável da vila (`Ground_Base`, GID 1).
- **Estradas e Caminhos:** estrada principal Norte-Sul (conectando as saídas) e secundária Leste-Oeste em terra batida (`Ground_Deco`, GID 2).
- **Praça Central da Vila:** área nobre de $10 \times 8$ tiles com calçamento em lajes de basalto (`Ground_Deco`, GID 25) e bigorna da Forja posicionada para crafting.
- **Construções Medievais:**
  - Forja do Ferreiro (Noroeste): paredes de tijolos sólidos (`Collision`, GID 4) com porta de entrada e beiral aéreo.
  - Taverna do Aventureiro (Nordeste): estrutura ampla de pedra (`Collision`, GID 4) e telhado em camada superior.
  - Casa do Ancião (Sudoeste): residência aconchegante cercada de arbustos floridos.
- **O Lago Cristalino (Sudeste):** espelho d'água de $13 \times 10$ tiles com água azul límpida (`Collision`, GID 5) e reflexos solares (`Collision`, GID 16).
- **Decorações e Vegetação:** cercas rústicas nas bordas (`Collision`, GID 8), postes de sinalização (`Collision`, GID 26), flores amarelas e vermelhas (`Ground_Deco`, GIDs 6 e 7) e árvores periféricas (`Collision`, GID 32).
- **Camada Aérea:** copas frondosas de carvalhos e beirais de telhado (`Overhead_Foliage`, GIDs 29, 30 e 31) renderizadas em profundidade 2000, permitindo que o jogador caminhe por baixo com sensação 2.5D.
- **Ponto de Spawn:** centrado na praça da vila em $(x=464, y=320)$ com raio livre de obstáculos para circulação de múltiplos jogadores simultâneos.

---

## 2. Arquivos Adicionados e Modificados

### Arquivos Adicionados
- [tools/unity-asset-pipeline/ProjectSettings/ProjectVersion.txt](file:///d:/NoobRPG/tools/unity-asset-pipeline/ProjectSettings/ProjectVersion.txt)
- [tools/unity-asset-pipeline/Assets/Scenes/NoobRPG_StarterVillage.unity](file:///d:/NoobRPG/tools/unity-asset-pipeline/Assets/Scenes/NoobRPG_StarterVillage.unity)
- [tools/unity-asset-pipeline/Assets/Editor/StarterVillageBuilder.cs](file:///d:/NoobRPG/tools/unity-asset-pipeline/Assets/Editor/StarterVillageBuilder.cs)
- [tools/unity-asset-pipeline/scripts/generate-starter-village-map.ts](file:///d:/NoobRPG/tools/unity-asset-pipeline/scripts/generate-starter-village-map.ts)
- [tools/unity-asset-pipeline/scripts/export-tileset-png.ts](file:///d:/NoobRPG/tools/unity-asset-pipeline/scripts/export-tileset-png.ts)
- [tools/unity-asset-pipeline/staging/starter-village/README.md](file:///d:/NoobRPG/tools/unity-asset-pipeline/staging/starter-village/README.md)
- [tools/unity-asset-pipeline/staging/starter-village/map_starter_village.json](file:///d:/NoobRPG/tools/unity-asset-pipeline/staging/starter-village/map_starter_village.json)
- [tools/unity-asset-pipeline/staging/starter-village/tileset_prototype.png](file:///d:/NoobRPG/tools/unity-asset-pipeline/staging/starter-village/tileset_prototype.png)
- [tools/unity-asset-pipeline/staging/starter-village/tileset_prototype.meta.json](file:///d:/NoobRPG/tools/unity-asset-pipeline/staging/starter-village/tileset_prototype.meta.json)
- [packages/client/public/assets/staging/map_starter_village.json](file:///d:/NoobRPG/packages/client/public/assets/staging/map_starter_village.json)
- [docs/STARTER_VILLAGE_REPORT.md](file:///d:/NoobRPG/docs/STARTER_VILLAGE_REPORT.md)

### Arquivos Modificados
- [tools/unity-asset-pipeline/Assets/Editor/NoobRpgMapExporter.cs](file:///d:/NoobRPG/tools/unity-asset-pipeline/Assets/Editor/NoobRpgMapExporter.cs): inclusão de mapeamento automático de propriedades `collides: true` para todos os tiles da camada `Collision`.
- [packages/client/src/scenes/PreloadScene.ts](file:///d:/NoobRPG/packages/client/src/scenes/PreloadScene.ts): carregamento do asset `map_starter_village`.
- [packages/client/src/scenes/WorldScene.ts](file:///d:/NoobRPG/packages/client/src/scenes/WorldScene.ts): suporte a alternância dinâmica de mapa, colisão resiliente via `setCollisionByExclusion([-1, 0])`, spawn adaptativo e botão dev de teste.
- [packages/server/tests/unity_asset_pipeline.test.ts](file:///d:/NoobRPG/packages/server/tests/unity_asset_pipeline.test.ts): 3 novos testes automatizados (testes 5, 6 e 7) cobrindo conformidade da vila, integridade de staging e assets Unity.

---

## 3. Caminhos Reais de Staging e Exportação

| Destino | Caminho no Sistema de Arquivos | Descrição |
| :--- | :--- | :--- |
| **Pipeline Staging** | `tools/unity-asset-pipeline/staging/starter-village/` | Pacote mestre contendo JSON, PNG, metadados e README de staging do pipeline. |
| **Client Staging** | `packages/client/public/assets/staging/map_starter_village.json` | Arquivo consumido diretamente pelo Vite/Phaser quando executado no navegador. |
| **Cena Unity** | `tools/unity-asset-pipeline/Assets/Scenes/NoobRPG_StarterVillage.unity` | Arquivo YAML da cena de autoria para abertura no Unity Editor. |

---

## 4. Como Abrir a Cena no Unity

1. Abra o **Unity Hub**.
2. Clique no botão **Add > Add project from disk**.
3. Selecione a pasta:
   ```
   D:\NoobRPG\tools\unity-asset-pipeline
   ```
4. Certifique-se de selecionar o Editor **Unity 6 (`6000.6.4f1`)**.
5. No painel **Project**, navegue até `Assets/Scenes/` e dê duplo clique em:
   ```
   NoobRPG_StarterVillage.unity
   ```
6. O Unity exibirá a hierarquia com o objeto `Grid` e as quatro camadas prontas para pintura com a Tile Palette.

---

## 5. Como Exportar Novamente o Mapa

### Opção A — Pela Interface do Unity Editor
1. Na barra de menus superior do Unity, clique em:
   ```
   Tools > NoobRPG > Build Starter Village Scene and Export
   ```
   ou, para exportar qualquer Tilemap ativo:
   ```
   Tools > NoobRPG > Export Active Tilemap to Phaser JSON
   ```
2. O arquivo será salvo automaticamente em `packages/client/public/assets/staging/map_starter_village.json`.

### Opção B — Via Linha de Comando (Headless / CI/CD)
```bash
unity run -- -executeMethod NoobRPG.EditorPipeline.StarterVillageBuilder.BuildAndExportCommandLine
```
ou utilizando o pipeline autônomo TypeScript:
```bash
cmd.exe /c "npx tsx tools/unity-asset-pipeline/scripts/generate-starter-village-map.ts"
```

---

## 6. Como Carregar o Mapa no Phaser

O cliente Phaser do NoobRPG possui seletor automático de desenvolvimento:

1. **Modo Normal (Padrão de Produção):**
   Acesse a URL padrão:
   ```
   http://localhost:3000/
   ```
   O jogo carrega o mapa original `map_prototype.json`.
2. **Modo Staging (Vila Inicial do Unity):**
   Acesse com o parâmetro `map`:
   ```
   http://localhost:3000/?map=starter_village
   ```
   O Phaser carrega imediatamente a Vila Inicial `map_starter_village.json`.
3. **Alternância com 1 Clique no Jogo:**
   No canto superior direito da tela, clique no botão flutuante:
   ```
   [ 🗺️ Testar Vila Inicial (Unity Staging) ]
   ```
   A página recarrega alternando instantaneamente entre os mapas.

---

## 7. Testes Executados e Resultados Observados

### 7.1 Validação de Conformidade do Asset
Executado:
```bash
cmd.exe /c "npx tsx tools/unity-asset-pipeline/scripts/validate-phaser-asset.ts packages/client/public/assets/staging/map_starter_village.json"
```
**Resultado:** `valid: true`, 0 erros, 0 avisos.
- Orientação: `orthogonal`
- Dimensões: $60 \times 40$ tiles ($960 \times 640$ px)
- Tamanho de tile: $16 \times 16$ px
- 4 camadas canônicas íntegras (`Ground_Base`, `Ground_Deco`, `Collision`, `Overhead_Foliage`), cada uma com exatamente 2400 tiles numéricos.

### 7.2 Suíte de Testes Automatizados do Monorepo
Executado:
```bash
cmd.exe /c "npm test --prefix packages/server"
```
**Resultado:** **53 de 53 testes aprovados (100% de sucesso)** em 11.79s.
- 7 testes dedicados ao pipeline Unity → Phaser 3 aprovados.
- Testes de Anti-Speedhack, Zero Client Trust, Colisão Autoritativa e AOI preservados com 100% de aprovação.

### 7.3 Compilação e Build de Produção do Cliente
Executado:
```bash
cmd.exe /c "npm run build --prefix packages/client"
```
**Resultado:** **Sucesso absoluto em 8.01s**.
- TypeScript (`tsc`) compilou sem nenhum erro de tipo.
- Chunks gerados: `dist/assets/index-66YXU-KG.js` (159.58 kB) e `dist/assets/phaser-CaWnzXme.js` (1.47 MB).

---

## 8. Compatibilidade com o Sistema Atual de Colisões

- **No Cliente:** implementada dupla checagem de colisão em `WorldScene.ts`:
  1. `this.collisionLayer.setCollisionByProperty({ collides: true })` — respeita a marcação de metadados do Tiled.
  2. `this.collisionLayer.setCollisionByExclusion([-1, 0])` — garante que qualquer tile não vazio na camada `Collision` seja fisicamente impenetrável pelo Arcade Physics.
- **No Servidor:** o servidor autoritativo utiliza caixas AABB de colisão definidas em `MapCollisionGrid.ts`. Como o mapa padrão permanece intocado e o modo staging é opt-in, a integridade da simulação do servidor em produção é 100% preservada. Quando a Vila Inicial for promovida para substituição definitiva do mapa de produção, as caixas AABB de `MapCollisionGrid.ts` poderão ser sincronizadas via script gerador.

---

## 9. Situação do Mapa de Produção

- O mapa de produção oficial [packages/client/public/assets/maps/map_prototype.json](file:///d:/NoobRPG/packages/client/public/assets/maps/map_prototype.json) **permaneceu estritamente intocado e inalterado**.
- Nenhuma alteração foi commitada no Git ou enviada via push/deploy.
- A regra inegociável de isolamento entre Staging e Produção foi rigorosamente cumprida.

---

## 10. Pendências, Limitações e Próximos Passos

### Limitações e Observações Reais
- **Automação de Navegador no Ambiente:** o download do driver Playwright (`1.57.0`) encontrou indisponibilidade na CDN do Azure Edge durante a execução headless do subagente de browser. No entanto, o servidor Vite local (`http://localhost:3000/`) e o backend estão ativos e funcionais para testes manuais no Chrome.
- **Tamanho dos Monstros Locais:** os monstros locais da cena continuam nas posições iniciais ($X \in [100, 280]$), que agora habitam a zona noroeste/norte da vila.

### Próximos Passos Recomendados
1. **Promover a Vila Inicial para Produção (Fase Posterior):** após aprovação visual do usuário, gerar as caixas de colisão correspondentes em `MapCollisionGrid.ts` para que o servidor autoritativo acompanhe os contornos das casas e do lago.
2. **Adicionar NPCs com Diálogo na Vila:** posicionar o Ancião na casa sudoeste e o Ferreiro próximo à bigorna para guiar novos jogadores com tutoriais e quests iniciais.
3. **Novos Tilesets de Alta Resolução via Unity:** utilizar o pipeline testado para importar pacotes de pixel art mais detalhados da Unity Asset Store diretamente para os novos bairros e calabouços do NoobRPG.
