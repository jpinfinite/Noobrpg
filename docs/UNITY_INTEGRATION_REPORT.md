# Relatório de Integração Unity CLI → NoobRPG (Phaser 3)

**Data:** 19 de Outubro de 2026  
**Responsável Técnico:** Antigravity AI Engine (Skill: `game-asset-pipeline` & `noobrpg-autonomous-completion`)  
**Status da Integração:** **DIAGNÓSTICO E PIPELINE STAGING CONCLUÍDOS COM SUCESSO**  
**Diretiva Fundamental:** O NoobRPG **não** foi migrado para Unity e continuará sendo executado 100% no navegador via Phaser 3 + TypeScript com servidor autoritativo em Node.js / WebSocket. O Unity atua exclusivamente como ferramenta de autoria e exportação de assets 2D.

---

## 1. Diagnóstico do Ambiente e Versões Detectadas

Todos os dados foram obtidos diretamente do sistema operacional Windows via comandos do terminal, sem suposições:

| Componente | Versão / Identificação | Caminho no Sistema |
| :--- | :--- | :--- |
| **Unity CLI** | `1.0.0-beta.12` (.NET 10.0.12, win32-x64) | `C:\Users\jpdes\AppData\Local\Unity\bin\unity.exe` |
| **Unity Editor** | `6000.6.4f1` (Unity 6 preview / LTS stream, x86_64) | `C:\Program Files\Unity\Hub\Editor\6000.6.4f1\Editor\Unity.exe` |
| **Módulos do Editor** | `Web` (suporte a WebGL habilitado) | Integrado ao Unity 6 Hub Editor |
| **Licença Ativa** | Unity Personal (Assigned) & Asset Store (Assigned) | Vinculada à conta `j.p.designgraficoinfinite@gmail.com` |
| **Projetos Existentes** | `D:\Game\TerraDasCinzas-Unity\guerra das cinzas` | Registrado no Unity Hub Registry |
| **Templates 2D Prontos** | `com.unity.template.universal-2d` (v7.0.0) | Disponível e pronto para criação de projetos 2D |
| **Unity Pipeline Package** | Versões `0.2.0-exp.2` até `0.8.0-exp.1` | Compatível com Unity 6 e AI Agent automation |

---

## 2. Comandos Executados e Resultados Reais

1. `unity version`
   - **Resultado:** Código 0. Versão `1.0.0-beta.12`, runtime `.NET 10.0.12`.
2. `unity editors` & `unity doctor`
   - **Resultado:** Código 0. Detectado `6000.6.4f1` instalado em `C:\Program Files\Unity\Hub\Editor\6000.6.4f1\Editor\Unity.exe`.
3. `unity editors default 6000.6.4f1`
   - **Resultado:** Código 0. Editor Unity 6 configurado com sucesso como o padrão global para automações do CLI.
4. `unity projects list` & `unity license`
   - **Resultado:** Código 0. Licença Personal ativa e projeto existente detectado no drive D:.
5. `unity templates list --editor 6000.6.4f1`
   - **Resultado:** Código 0. Template `Universal 2D` (v7.0.0) confirmado como instalado e pronto.

---

## 3. Compatibilidade e Formatos de Exportação para o Phaser 3

A auditoria da arquitetura do Phaser 3 ([WorldScene.ts](file:///d:/NoobRPG/packages/client/src/scenes/WorldScene.ts) e [PreloadScene.ts](file:///d:/NoobRPG/packages/client/src/scenes/PreloadScene.ts)) confirmou os formatos exatos exigidos:

### 3.1 Mapas de Tilemap
- **Formato:** JSON Ortogonal do Tiled Map (versão 1.10).
- **Dimensões do Tile:** Rigorosamente $16 \times 16$ pixels.
- **Dimensões Padrão do Mapa:** $120 \times 80$ tiles ($1920 \times 1280$ pixels) ou proporcional.
- **Camadas Canônicas Obrigatórias:**
  1. `Ground_Base`: solo base (grama, terra, pisos de pedra).
  2. `Ground_Deco`: caminhos, flores, pedregulhos.
  3. `Collision`: obstáculos sólidos, água e paredes (lido pelo servidor para física AABB).
  4. `Overhead_Foliage`: copas de árvores e coberturas que renderizam acima dos personagens.

### 3.2 Spritesheets e Animações
- **Formato de Imagem:** PNG de 32 bits (RGBA com canal alfa nítido, sem anti-aliasing borrado).
- **Layout:** Horizontal (1 linha, $N$ quadros), múltiplos exatos de $16 \times 24$ ou $24 \times 24$ px.
- **Ponto de Origem / Pivô:** Pé do personagem (`originX: 0.5, originY: 1.0`).

---

## 4. Estrutura Separada e Arquivos Criados

Para garantir preservação absoluta do jogo, foi criada uma área de trabalho isolada:

```
d:\NoobRPG\
├── tools\
│   └── unity-asset-pipeline\
│       ├── .gitignore                      # Ignora Library, Temp, Logs e builds do Unity
│       ├── Assets\
│       │   └── Editor\
│       │       ├── NoobRpgMapExporter.cs   # Exportador C# de Tilemaps -> Tiled JSON
│       │       └── NoobRpgSpriteExporter.cs# Exportador C# de Sprites -> Spritesheets PNG
│       └── scripts\
│           ├── validate-phaser-asset.ts    # Validador automatizado de integridade
│           └── generate-unity-staging-test.ts # Gerador de mapas de staging para testes
├── packages\client\public\assets\staging\
│   ├── map_unity_prototype.json            # Protótipo de teste (30x20 tiles com 4 camadas)
│   └── spritesheet_unity_test.meta.json    # Metadados de spritesheet de staging
└── packages\server\tests\
    └── unity_asset_pipeline.test.ts        # Teste automatizado formal na suíte do servidor
```

---

## 5. Testes e Validação Real

- **Validação de Conformidade do Mapa:** O script [validate-phaser-asset.ts](file:///d:/NoobRPG/tools/unity-asset-pipeline/scripts/validate-phaser-asset.ts) validou tanto o mapa de produção quanto o mapa de staging gerado pelo pipeline Unity, atestando conformidade com as 4 camadas canônicas e tiles de 16x16.
- **Suíte de Testes Automatizados:** O teste [unity_asset_pipeline.test.ts](file:///d:/NoobRPG/packages/server/tests/unity_asset_pipeline.test.ts) foi integrado à suíte oficial do monorepo, resultando em:
  - **50 testes executados, 50 aprovados (0 falhas)**.
- **Integridade do Jogo:** Nenhum arquivo do core do jogo (`map_prototype.json`, lógica de rede, simulação de combate ou banco de dados) foi modificado ou corrompido.

---

## 6. Próximos Passos Concretos

1. Para designers que utilizarem a interface gráfica do Unity: abrir o projeto com o script `NoobRpgMapExporter.cs` na pasta `Editor`, pintar o cenário nas camadas `Ground_Base`, `Ground_Deco`, `Collision` e `Overhead_Foliage`, e clicar no menu `Tools > NoobRPG > Export Active Tilemap to Phaser JSON`.
2. Para exportação headless / CI: utilizar `unity run -- -executeMethod NoobRPG.EditorPipeline.NoobRpgMapExporter.ExportFromCommandLine -mapOutput <caminho>`.
3. Executar o validador `npx tsx tools/unity-asset-pipeline/scripts/validate-phaser-asset.ts <arquivo>` antes de promover qualquer asset de `staging/` para `maps/`.
