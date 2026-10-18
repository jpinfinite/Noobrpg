import Phaser from 'phaser';
import {
  evaluateLevelProgression,
  CLASS_COMBAT_CONFIG,
  ITEM_DEFINITIONS,
  CRAFTING_RECIPES,
  ItemRarity,
  EquipmentSlot,
  getItemCount
} from '@noobrpg/shared';
import { Player } from '../entities/Player.js';

interface UISceneData {
  player: Player;
}

export class UIScene extends Phaser.Scene {
  private player!: Player;
  private classLevelText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private mpText!: Phaser.GameObjects.Text;
  private xpText!: Phaser.GameObjects.Text;
  private coordsText!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private skillText!: Phaser.GameObjects.Text;

  private hpBarGraphics!: Phaser.GameObjects.Graphics;
  private mpBarGraphics!: Phaser.GameObjects.Graphics;
  private xpBarGraphics!: Phaser.GameObjects.Graphics;

  // Painéis de Interface (Modais)
  private isInventoryOpen: boolean = false;
  private isCraftingOpen: boolean = false;
  private inventoryContainer!: Phaser.GameObjects.Container;
  private craftingContainer!: Phaser.GameObjects.Container;
  private tooltipContainer!: Phaser.GameObjects.Container;

  // Cache de elementos de slot para atualização reativa
  private slotSprites: Array<{
    bg: Phaser.GameObjects.Graphics;
    icon: Phaser.GameObjects.Sprite;
    qtyText: Phaser.GameObjects.Text;
  }> = [];

  private equipSlotSprites: Record<
    string,
    { bg: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Sprite }
  > = {};

  constructor() {
    super({ key: 'UIScene' });
  }

  public init(data: UISceneData): void {
    this.player = data.player;
  }

  public create(): void {
    this.createPlayerStatusPanel();
    this.createInfoPanel();
    this.createControlsHintPanel();
    this.createInventoryModal();
    this.createCraftingModal();
    this.createTooltip();

    // Listeners de alternância de interface
    const worldScene = this.scene.get('WorldScene');
    worldScene.events.on('toggle-inventory', () => this.toggleInventory());
    worldScene.events.on('toggle-crafting', () => this.toggleCrafting());
    worldScene.events.on('player-updated', () => {
      this.refreshInventoryUI();
      this.refreshCraftingUI();
    });

    // Tecla ESC para fechar janelas
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.isInventoryOpen) this.toggleInventory(false);
      if (this.isCraftingOpen) this.toggleCrafting(false);
    });
  }

  public update(): void {
    if (!this.player) return;

    this.updateStatusBars();
    this.updateCoordinates();
    this.updateFps();
  }

  private createPlayerStatusPanel(): void {
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0c0a14, 0.9);
    panelBg.lineStyle(1, 0x4338ca, 0.9);
    panelBg.fillRoundedRect(8, 8, 150, 64, 4);
    panelBg.strokeRoundedRect(8, 8, 150, 64, 4);

    this.classLevelText = this.add.text(14, 12, 'GUERREIRO  Lv.1', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#f59e0b',
      fontStyle: 'bold'
    });

    this.hpBarGraphics = this.add.graphics();
    this.mpBarGraphics = this.add.graphics();
    this.xpBarGraphics = this.add.graphics();

    this.hpText = this.add.text(14, 24, 'HP: 120/120', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#ffffff'
    });

    this.mpText = this.add.text(14, 38, 'MP: 30/30', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#ffffff'
    });

    this.xpText = this.add.text(14, 52, 'XP: 0/500 (0%)', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#facc15'
    });
  }

  private createInfoPanel(): void {
    const infoBg = this.add.graphics();
    infoBg.fillStyle(0x0c0a14, 0.9);
    infoBg.lineStyle(1, 0x334155, 0.8);
    infoBg.fillRoundedRect(310, 8, 162, 54, 4);
    infoBg.strokeRoundedRect(310, 8, 162, 54, 4);

    this.coordsText = this.add.text(316, 13, 'X: 000 | Y: 000', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#38bdf8'
    });

    this.fpsText = this.add.text(316, 26, 'FPS: 60 | 480x270', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#94a3b8'
    });

    this.skillText = this.add.text(316, 40, '[E] Golpe Pesado', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#a78bfa'
    });
  }

  private createControlsHintPanel(): void {
    const hintBg = this.add.graphics();
    hintBg.fillStyle(0x0c0a14, 0.85);
    hintBg.fillRect(0, 256, 480, 14);

    this.add.text(
      6,
      259,
      '[ESPAÇO]: Atacar  |  [F]: Coletar/Interagir  |  [I]: Inventário  |  [C]: Crafting  |  [1-4]: Classes',
      {
        fontFamily: 'monospace',
        fontSize: '6px',
        color: '#e2e8f0'
      }
    );
  }

  // --- MODAL DE INVENTÁRIO (24 SLOTS + EQUIPAMENTOS) ---

  private createInventoryModal(): void {
    this.inventoryContainer = this.add.container(60, 40);
    this.inventoryContainer.setVisible(false);
    this.inventoryContainer.setDepth(10000);

    // Fundo do painel do inventário
    const bg = this.add.graphics();
    bg.fillStyle(0x0f172a, 0.95);
    bg.lineStyle(2, 0x6366f1, 1);
    bg.fillRoundedRect(0, 0, 360, 180, 6);
    bg.strokeRoundedRect(0, 0, 360, 180, 6);
    this.inventoryContainer.add(bg);

    // Título e botão fechar
    const title = this.add.text(14, 10, 'INVENTÁRIO & EQUIPAMENTOS', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#f59e0b',
      fontStyle: 'bold'
    });
    this.inventoryContainer.add(title);

    const closeBtn = this.add
      .text(340, 10, 'X', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ef4444',
        fontStyle: 'bold'
      })
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.toggleInventory(false));
    this.inventoryContainer.add(closeBtn);

    // Grade de 24 Slots (6 colunas x 4 linhas)
    const startX = 14;
    const startY = 32;
    const slotSize = 22;
    const padding = 4;

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        const slotIdx = row * 6 + col;
        const x = startX + col * (slotSize + padding);
        const y = startY + row * (slotSize + padding);

        const slotBg = this.add.graphics();
        slotBg.fillStyle(0x1e293b, 1);
        slotBg.lineStyle(1, 0x334155, 1);
        slotBg.fillRoundedRect(x, y, slotSize, slotSize, 2);
        slotBg.strokeRoundedRect(x, y, slotSize, slotSize, 2);

        // Ícone do item no slot
        const icon = this.add.sprite(x + 11, y + 11, 'item_drop_bag').setVisible(false);
        icon.setDisplaySize(16, 16);

        // Quantidade no slot
        const qtyText = this.add
          .text(x + 20, y + 13, '', {
            fontFamily: 'monospace',
            fontSize: '6px',
            color: '#f8fafc',
            stroke: '#000000',
            strokeThickness: 2
          })
          .setOrigin(1, 0);

        // Interação com o slot
        const hitArea = this.add
          .zone(x + 11, y + 11, slotSize, slotSize)
          .setInteractive({ useHandCursor: true });

        hitArea.on('pointerover', () => {
          slotBg.lineStyle(1, 0xfacc15, 1);
          slotBg.strokeRoundedRect(x, y, slotSize, slotSize, 2);
          this.showSlotTooltip(slotIdx, x + 60, y + 40);
        });

        hitArea.on('pointerout', () => {
          slotBg.lineStyle(1, 0x334155, 1);
          slotBg.strokeRoundedRect(x, y, slotSize, slotSize, 2);
          this.hideTooltip();
        });

        hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (pointer.rightButtonDown()) {
            this.player.dropItemFromInventory(slotIdx, 1);
          } else {
            this.handleSlotClick(slotIdx);
          }
        });

        this.inventoryContainer.add([slotBg, icon, qtyText, hitArea]);
        this.slotSprites.push({ bg: slotBg, icon, qtyText });
      }
    }

    // Seção de Equipamentos (Arma, Armadura, Acessório)
    const equipStartX = 200;
    const equipSlots: Array<{ label: string; key: EquipmentSlot }> = [
      { label: 'ARMA', key: EquipmentSlot.WEAPON },
      { label: 'ARMADURA', key: EquipmentSlot.ARMOR },
      { label: 'ACESSÓRIO', key: EquipmentSlot.ACCESSORY }
    ];

    equipSlots.forEach((eq, index) => {
      const y = startY + index * 36;

      const labelText = this.add.text(equipStartX, y, eq.label, {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#94a3b8'
      });

      const eqBg = this.add.graphics();
      eqBg.fillStyle(0x1e293b, 1);
      eqBg.lineStyle(1, 0x6366f1, 1);
      eqBg.fillRoundedRect(equipStartX + 80, y - 4, 26, 26, 3);
      eqBg.strokeRoundedRect(equipStartX + 80, y - 4, 26, 26, 3);

      const icon = this.add.sprite(equipStartX + 93, y + 9, 'item_drop_bag').setVisible(false);
      icon.setDisplaySize(16, 16);

      const hit = this.add
        .zone(equipStartX + 93, y + 9, 26, 26)
        .setInteractive({ useHandCursor: true });

      hit.on('pointerdown', () => {
        this.player.unequipItem(eq.key);
      });

      this.inventoryContainer.add([labelText, eqBg, icon, hit]);
      this.equipSlotSprites[eq.key] = { bg: eqBg, icon };
    });

    // Dica de ações de inventário no rodapé do modal
    const invHelp = this.add.text(14, 155, 'Clique esquerdo: Usar/Equipar  |  Clique direito: Descartar', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: '#64748b'
    });
    this.inventoryContainer.add(invHelp);
  }

  // --- MODAL DE CRAFTING ---

  private createCraftingModal(): void {
    this.craftingContainer = this.add.container(60, 40);
    this.craftingContainer.setVisible(false);
    this.craftingContainer.setDepth(10000);

    const bg = this.add.graphics();
    bg.fillStyle(0x0f172a, 0.95);
    bg.lineStyle(2, 0xf59e0b, 1);
    bg.fillRoundedRect(0, 0, 360, 180, 6);
    bg.strokeRoundedRect(0, 0, 360, 180, 6);
    this.craftingContainer.add(bg);

    const title = this.add.text(14, 10, 'FORJA & BANCADA DE CRAFTING', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#f59e0b',
      fontStyle: 'bold'
    });
    this.craftingContainer.add(title);

    const closeBtn = this.add
      .text(340, 10, 'X', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ef4444',
        fontStyle: 'bold'
      })
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.toggleCrafting(false));
    this.craftingContainer.add(closeBtn);

    this.renderCraftingRecipes();
  }

  private renderCraftingRecipes(): void {
    const startY = 32;

    CRAFTING_RECIPES.forEach((recipe, idx) => {
      const y = startY + idx * 34;

      const itemDef = ITEM_DEFINITIONS[recipe.resultItemId];
      const iconKey = itemDef?.iconKey || 'item_drop_bag';

      const icon = this.add.sprite(24, y + 10, iconKey).setDisplaySize(16, 16);

      const nameText = this.add.text(40, y + 2, recipe.name, {
        fontFamily: 'monospace',
        fontSize: '7.5px',
        color: '#f8fafc',
        fontStyle: 'bold'
      });

      // Ingredientes necessários
      const ingredientsDesc = recipe.ingredients
        .map(ing => {
          const ingDef = ITEM_DEFINITIONS[ing.itemId];
          return `${ingDef?.name || ing.itemId}: ${ing.quantity}x`;
        })
        .join(' | ');

      const matText = this.add.text(40, y + 14, ingredientsDesc, {
        fontFamily: 'monospace',
        fontSize: '6px',
        color: '#94a3b8'
      });

      // Botão Fabricar
      const craftBtnBg = this.add.graphics();
      craftBtnBg.fillStyle(0x166534, 1);
      craftBtnBg.fillRoundedRect(280, y + 4, 60, 16, 3);

      const craftBtnText = this.add
        .text(310, y + 12, 'Fabricar', {
          fontFamily: 'monospace',
          fontSize: '7px',
          color: '#ffffff',
          fontStyle: 'bold'
        })
        .setOrigin(0.5);

      const hitZone = this.add
        .zone(310, y + 12, 60, 16)
        .setInteractive({ useHandCursor: true });

      hitZone.on('pointerdown', () => {
        this.player.craftItem(recipe.id);
      });

      this.craftingContainer.add([icon, nameText, matText, craftBtnBg, craftBtnText, hitZone]);
    });
  }

  // --- TOOLTIP DE ITENS ---

  private createTooltip(): void {
    this.tooltipContainer = this.add.container(0, 0);
    this.tooltipContainer.setVisible(false);
    this.tooltipContainer.setDepth(10001);

    const bg = this.add.graphics();
    bg.name = 'tooltip_bg';
    this.tooltipContainer.add(bg);

    const title = this.add.text(6, 6, '', {
      fontFamily: 'monospace',
      fontSize: '7.5px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    title.name = 'tooltip_title';

    const desc = this.add.text(6, 18, '', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: '#cbd5e1',
      wordWrap: { width: 130 }
    });
    desc.name = 'tooltip_desc';

    const stats = this.add.text(6, 38, '', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: '#38bdf8'
    });
    stats.name = 'tooltip_stats';

    this.tooltipContainer.add([title, desc, stats]);
  }

  private showSlotTooltip(slotIndex: number, screenX: number, screenY: number): void {
    const slot = this.player.playerData.inventory[slotIndex];
    if (!slot) return;

    const itemDef = ITEM_DEFINITIONS[slot.itemId];
    if (!itemDef) return;

    const titleText = this.tooltipContainer.getByName('tooltip_title') as Phaser.GameObjects.Text;
    const descText = this.tooltipContainer.getByName('tooltip_desc') as Phaser.GameObjects.Text;
    const statsText = this.tooltipContainer.getByName('tooltip_stats') as Phaser.GameObjects.Text;
    const bg = this.tooltipContainer.getByName('tooltip_bg') as Phaser.GameObjects.Graphics;

    // Cor baseada na raridade
    let color = '#ffffff';
    if (itemDef.rarity === ItemRarity.UNCOMMON) color = '#22c55e';
    if (itemDef.rarity === ItemRarity.RARE) color = '#38bdf8';
    if (itemDef.rarity === ItemRarity.EPIC) color = '#c084fc';

    titleText.setText(itemDef.name);
    titleText.setColor(color);
    descText.setText(itemDef.description);

    let statsStr = `Valor: ${itemDef.goldValue} Gold`;
    if (itemDef.attributesBonus) {
      if (itemDef.attributesBonus.attack) statsStr += ` | Atq: +${itemDef.attributesBonus.attack}`;
      if (itemDef.attributesBonus.defense) statsStr += ` | Def: +${itemDef.attributesBonus.defense}`;
      if (itemDef.attributesBonus.maxHp) statsStr += ` | HP: +${itemDef.attributesBonus.maxHp}`;
    }
    if (itemDef.consumableEffect?.hpRestore) {
      statsStr += ` | Cura: +${itemDef.consumableEffect.hpRestore} HP`;
    }
    statsText.setText(statsStr);

    bg.clear();
    bg.fillStyle(0x0c0a14, 0.95);
    bg.lineStyle(1, 0x475569, 1);
    bg.fillRoundedRect(0, 0, 142, 54, 4);
    bg.strokeRoundedRect(0, 0, 142, 54, 4);

    this.tooltipContainer.setPosition(Math.min(screenX, 320), Math.min(screenY, 200));
    this.tooltipContainer.setVisible(true);
  }

  private hideTooltip(): void {
    this.tooltipContainer.setVisible(false);
  }

  private handleSlotClick(slotIndex: number): void {
    const slot = this.player.playerData.inventory[slotIndex];
    if (!slot) return;

    const itemDef = ITEM_DEFINITIONS[slot.itemId];
    if (!itemDef) return;

    if (itemDef.equipSlot) {
      this.player.equipItem(slotIndex);
    } else if (itemDef.consumableEffect) {
      this.player.useConsumable(slotIndex);
    }
  }

  public toggleInventory(force?: boolean): void {
    this.isInventoryOpen = force !== undefined ? force : !this.isInventoryOpen;
    if (this.isInventoryOpen && this.isCraftingOpen) this.isCraftingOpen = false;

    this.inventoryContainer.setVisible(this.isInventoryOpen);
    this.craftingContainer.setVisible(this.isCraftingOpen);
    this.hideTooltip();
    if (this.isInventoryOpen) this.refreshInventoryUI();
  }

  public toggleCrafting(force?: boolean): void {
    this.isCraftingOpen = force !== undefined ? force : !this.isCraftingOpen;
    if (this.isCraftingOpen && this.isInventoryOpen) this.isInventoryOpen = false;

    this.craftingContainer.setVisible(this.isCraftingOpen);
    this.inventoryContainer.setVisible(this.isInventoryOpen);
    this.hideTooltip();
    if (this.isCraftingOpen) this.refreshCraftingUI();
  }

  private refreshInventoryUI(): void {
    const inventory = this.player.playerData.inventory;

    // Atualiza os 24 slots da grade
    for (let i = 0; i < 24; i++) {
      const slot = inventory[i];
      const slotUI = this.slotSprites[i];
      if (!slotUI) continue;

      if (slot) {
        const def = ITEM_DEFINITIONS[slot.itemId];
        slotUI.icon.setTexture(def?.iconKey || 'item_drop_bag');
        slotUI.icon.setVisible(true);
        slotUI.qtyText.setText(slot.quantity > 1 ? `${slot.quantity}` : '');
      } else {
        slotUI.icon.setVisible(false);
        slotUI.qtyText.setText('');
      }
    }

    // Atualiza os 3 slots equipados
    const equipped = this.player.playerData.equipped;
    const eqKeys = [
      { slot: EquipmentSlot.WEAPON, id: equipped.weapon },
      { slot: EquipmentSlot.ARMOR, id: equipped.armor },
      { slot: EquipmentSlot.ACCESSORY, id: equipped.accessory }
    ];

    eqKeys.forEach(item => {
      const ui = this.equipSlotSprites[item.slot];
      if (!ui) return;
      if (item.id) {
        const def = ITEM_DEFINITIONS[item.id];
        ui.icon.setTexture(def?.iconKey || 'item_drop_bag');
        ui.icon.setVisible(true);
      } else {
        ui.icon.setVisible(false);
      }
    });
  }

  private refreshCraftingUI(): void {
    // Reavalia estado quando o painel for aberto
  }

  private updateStatusBars(): void {
    const data = this.player.playerData;
    const attrs = data.attributes;

    this.classLevelText.setText(`${data.characterClass}  Lv.${data.level}`);

    // HP
    this.hpBarGraphics.clear();
    this.hpBarGraphics.fillStyle(0x331018, 0.9);
    this.hpBarGraphics.fillRect(72, 25, 80, 6);
    const hpRatio = Math.max(0, Math.min(1, attrs.currentHp / attrs.maxHp));
    this.hpBarGraphics.fillStyle(0xe11d48, 1);
    this.hpBarGraphics.fillRect(72, 25, 80 * hpRatio, 6);
    this.hpText.setText(`HP: ${attrs.currentHp}/${attrs.maxHp}`);

    // MP
    this.mpBarGraphics.clear();
    this.mpBarGraphics.fillStyle(0x0c2540, 0.9);
    this.mpBarGraphics.fillRect(72, 39, 80, 5);
    const mpRatio = Math.max(0, Math.min(1, attrs.currentMp / attrs.maxMp));
    this.mpBarGraphics.fillStyle(0x0284c7, 1);
    this.mpBarGraphics.fillRect(72, 39, 80 * mpRatio, 5);
    this.mpText.setText(`MP: ${attrs.currentMp}/${attrs.maxMp}`);

    // XP
    const progression = evaluateLevelProgression(data.level, data.currentXp);
    const xpRatio = Math.max(0, Math.min(1, progression.xpInCurrentLevel / progression.xpRequiredForNext));
    const xpPercent = Math.round(xpRatio * 100);

    this.xpBarGraphics.clear();
    this.xpBarGraphics.fillStyle(0x281e05, 0.9);
    this.xpBarGraphics.fillRect(72, 53, 80, 4);
    this.xpBarGraphics.fillStyle(0xf59e0b, 1);
    this.xpBarGraphics.fillRect(72, 53, 80 * xpRatio, 4);
    this.xpText.setText(`XP: ${progression.xpInCurrentLevel}/${progression.xpRequiredForNext} (${xpPercent}%)`);

    const combatCfg = CLASS_COMBAT_CONFIG[data.characterClass];
    this.skillText.setText(`[E] ${combatCfg.skill1Name} (${combatCfg.skill1CostMp} MP)`);
  }

  private updateCoordinates(): void {
    const posX = this.player.playerData.position.x;
    const posY = this.player.playerData.position.y;
    const tileX = Math.floor(posX / 16);
    const tileY = Math.floor(posY / 16);

    this.coordsText.setText(`X: ${posX} Y: ${posY} [T: ${tileX},${tileY}]`);
  }

  private updateFps(): void {
    const actualFps = Math.round(this.game.loop.actualFps);
    this.fpsText.setText(`FPS: ${actualFps} | Gold: ${this.player.playerData.gold}`);
  }
}
