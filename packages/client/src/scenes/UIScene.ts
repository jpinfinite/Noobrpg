import Phaser from 'phaser';
import {
  evaluateLevelProgression,
  CLASS_COMBAT_CONFIG,
  ITEM_DEFINITIONS,
  CRAFTING_RECIPES,
  ItemRarity,
  EquipmentSlot,
  getItemCount,
  CharacterClass
} from '@noobrpg/shared';
import { Player } from '../entities/Player.js';
import { SoundEffects } from '../audio/SoundEffects.js';

interface UISceneData {
  player: Player;
}

export class UIScene extends Phaser.Scene {
  private player!: Player;
  private statusContainer!: Phaser.GameObjects.Container;
  private classLevelText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private mpText!: Phaser.GameObjects.Text;
  private xpText!: Phaser.GameObjects.Text;

  private hpBarGraphics!: Phaser.GameObjects.Graphics;
  private mpBarGraphics!: Phaser.GameObjects.Graphics;
  private xpBarGraphics!: Phaser.GameObjects.Graphics;

  // Painel Superior Direito e Debug (Alternável via F3)
  private headerRightContainer!: Phaser.GameObjects.Container;
  private isDebugOpen: boolean = true;
  private debugContainer!: Phaser.GameObjects.Container;
  private coordsText!: Phaser.GameObjects.Text;
  private fpsText!: Phaser.GameObjects.Text;
  private skillText!: Phaser.GameObjects.Text;
  private entitiesText!: Phaser.GameObjects.Text;

  // Barra de Ações Inferior (HUD)
  private actionBarContainer!: Phaser.GameObjects.Container;
  private hintsText!: Phaser.GameObjects.Text;
  private atkCdGraphics!: Phaser.GameObjects.Graphics;
  private skillIcon!: Phaser.GameObjects.Sprite;
  private skillCdGraphics!: Phaser.GameObjects.Graphics;
  private skillCdText!: Phaser.GameObjects.Text;
  private skillMpText!: Phaser.GameObjects.Text;
  private potionIcon!: Phaser.GameObjects.Sprite;
  private potionQtyText!: Phaser.GameObjects.Text;

  // Painéis de Interface (Modais)
  private isInventoryOpen: boolean = false;
  private isCraftingOpen: boolean = false;
  private inventoryContainer!: Phaser.GameObjects.Container;
  private craftingContainer!: Phaser.GameObjects.Container;
  private tooltipContainer!: Phaser.GameObjects.Container;
  private btnSound!: Phaser.GameObjects.Rectangle;
  private txtSound!: Phaser.GameObjects.Text;

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
    this.slotSprites = [];
    this.equipSlotSprites = {};
    this.isInventoryOpen = false;
    this.isCraftingOpen = false;

    this.createPlayerStatusPanel();
    this.createHeaderAndDebugPanel();
    this.createBottomActionBar();
    this.createInventoryModal();
    this.createCraftingModal();
    this.createTooltip();

    // Posicionamento inicial responsivo
    this.repositionUI(this.scale.width, this.scale.height);

    // Listener de redimensionamento de janela
    const onResize = (gameSize: Phaser.Structs.Size) => {
      if (!this.sys || !this.sys.isActive()) return;
      this.repositionUI(gameSize.width, gameSize.height);
    };
    this.scale.on('resize', onResize);

    // Listeners de alternância de interface com desinscrição segura no shutdown
    const worldScene = this.scene.get('WorldScene');
    const onToggleInventory = () => {
      if (!this.sys || !this.sys.isActive()) return;
      this.toggleInventory();
    };
    const onToggleCrafting = () => {
      if (!this.sys || !this.sys.isActive()) return;
      this.toggleCrafting();
    };
    const onPlayerUpdated = () => {
      if (!this.sys || !this.sys.isActive()) return;
      if (this.isInventoryOpen) this.refreshInventoryUI();
      if (this.isCraftingOpen) this.refreshCraftingUI();
      this.updateActionBarPotionCount();
    };

    worldScene.events.on('toggle-inventory', onToggleInventory);
    worldScene.events.on('toggle-crafting', onToggleCrafting);
    worldScene.events.on('player-updated', onPlayerUpdated);

    // Limpeza rigorosa de eventos ao destruir/desativar a cena
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize);
      worldScene.events.off('toggle-inventory', onToggleInventory);
      worldScene.events.off('toggle-crafting', onToggleCrafting);
      worldScene.events.off('player-updated', onPlayerUpdated);
      this.slotSprites = [];
      this.equipSlotSprites = {};
    });

    // Tecla ESC para fechar janelas
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.isInventoryOpen) this.toggleInventory(false);
      if (this.isCraftingOpen) this.toggleCrafting(false);
    });

    // Tecla F3 para alternar o painel de debug
    this.input.keyboard?.on('keydown-F3', (event: KeyboardEvent) => {
      event?.preventDefault();
      this.toggleDebugPanel();
    });

    // Tecla M para alternar áudio
    this.input.keyboard?.on('keydown-M', () => {
      this.toggleSound();
    });
  }

  public update(time: number, delta: number): void {
    if (!this.player) return;

    this.updateStatusBars();
    this.updateCoordinates();
    this.updateFps();
    this.updateActionBar(time);
  }

  private createPlayerStatusPanel(): void {
    this.statusContainer = this.add.container(10, 10);
    this.statusContainer.setDepth(500);

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0c0a14, 0.94);
    panelBg.lineStyle(1, 0x4338ca, 0.9);
    panelBg.fillRoundedRect(0, 0, 156, 66, 4);
    panelBg.strokeRoundedRect(0, 0, 156, 66, 4);
    this.statusContainer.add(panelBg);

    this.classLevelText = this.add.text(6, 4, 'GUERREIRO  Lv.1', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#f59e0b',
      fontStyle: 'bold'
    });

    this.hpBarGraphics = this.add.graphics();
    this.mpBarGraphics = this.add.graphics();
    this.xpBarGraphics = this.add.graphics();
    this.statusContainer.add([this.hpBarGraphics, this.mpBarGraphics, this.xpBarGraphics]);

    this.hpText = this.add.text(6, 17, 'HP: 120/120', {
      fontFamily: 'monospace',
      fontSize: '6.5px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1.5
    });

    this.mpText = this.add.text(6, 31, 'MP: 30/30', {
      fontFamily: 'monospace',
      fontSize: '6.5px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1.5
    });

    this.xpText = this.add.text(6, 45, 'XP: 0/500 (0%)', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: '#facc15',
      stroke: '#000000',
      strokeThickness: 1.5
    });

    this.statusContainer.add([this.classLevelText, this.hpText, this.mpText, this.xpText]);
  }

  private createHeaderAndDebugPanel(): void {
    this.headerRightContainer = this.add.container(310, 10);
    this.headerRightContainer.setDepth(500);

    // 1. Barra Superior Direita (Botão de Som, Botão F3 e Botão Sair)
    const isMuted = SoundEffects.getInstance().getMuted();

    this.btnSound = this.add.rectangle(40, 8, 38, 14, isMuted ? 0x27272a : 0x064e3b)
      .setStrokeStyle(1, isMuted ? 0x71717a : 0x10b981)
      .setInteractive({ useHandCursor: true });

    this.txtSound = this.add.text(40, 8, isMuted ? 'SOM: OFF' : 'SOM: ON', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: isMuted ? '#a1a1aa' : '#a7f3d0',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.btnSound.on('pointerdown', () => {
      this.toggleSound();
    });

    const btnF3 = this.add.rectangle(86, 8, 38, 14, 0x1e1b4b)
      .setStrokeStyle(1, 0x6366f1)
      .setInteractive({ useHandCursor: true });

    const txtF3 = this.add.text(86, 8, '[F3] INFO', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: '#a5b4fc',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    btnF3.on('pointerdown', () => this.toggleDebugPanel());

    const btnExit = this.add.rectangle(138, 8, 34, 14, 0x450a0a)
      .setStrokeStyle(1, 0xef4444)
      .setInteractive({ useHandCursor: true });

    const txtExit = this.add.text(138, 8, 'SAIR', {
      fontFamily: 'monospace',
      fontSize: '6.5px',
      color: '#fca5a5',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    btnExit.on('pointerdown', () => {
      const worldScene = this.scene.get('WorldScene');
      worldScene.events.emit('request-save-and-exit');
    });

    // 2. Container de Debug Alternável (F3)
    this.debugContainer = this.add.container(0, 20);
    this.debugContainer.setVisible(this.isDebugOpen);

    const infoBg = this.add.graphics();
    infoBg.fillStyle(0x0c0a14, 0.92);
    infoBg.lineStyle(1, 0x334155, 0.9);
    infoBg.fillRoundedRect(0, 0, 164, 56, 4);
    infoBg.strokeRoundedRect(0, 0, 164, 56, 4);
    this.debugContainer.add(infoBg);

    this.coordsText = this.add.text(6, 6, 'X: 000 | Y: 000 [T: 0, 0]', {
      fontFamily: 'monospace',
      fontSize: '7.5px',
      color: '#38bdf8'
    });

    this.fpsText = this.add.text(6, 18, 'FPS: 60 | Fullscreen', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#94a3b8'
    });

    this.skillText = this.add.text(6, 30, 'Atq CD: 0.0s | Hab: [E] 0.0s', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#a78bfa'
    });

    this.entitiesText = this.add.text(6, 42, 'Monstros: 0 | Remotos: 0', {
      fontFamily: 'monospace',
      fontSize: '6.5px',
      color: '#34d399'
    });

    this.debugContainer.add([this.coordsText, this.fpsText, this.skillText, this.entitiesText]);
    this.headerRightContainer.add([this.btnSound, this.txtSound, btnF3, txtF3, btnExit, txtExit, this.debugContainer]);
  }

  private createBottomActionBar(): void {
    this.actionBarContainer = this.add.container(240, 246);
    this.actionBarContainer.setDepth(500);

    // Fundo da barra de ações
    const barBg = this.add.graphics();
    barBg.fillStyle(0x0a0f1d, 0.94);
    barBg.lineStyle(1, 0x334155, 1);
    barBg.fillRoundedRect(-102, -15, 204, 30, 4);
    barBg.strokeRoundedRect(-102, -15, 204, 30, 4);
    this.actionBarContainer.add(barBg);

    // 1. Slot Ataque Básico [ESPAÇO]
    const slotAtk = this.createActionSlot(-78, 0, 'icon_sword', '[ESP]', () => {
      this.player.triggerBasicAttackFromUI();
    });
    this.atkCdGraphics = this.add.graphics();
    this.atkCdGraphics.setPosition(-78, 0);
    this.actionBarContainer.add(this.atkCdGraphics);

    slotAtk.hitZone.on('pointerover', () => {
      this.showActionTooltip('Ataque Básico', 'Golpe primário da classe.\nAtalho: [ESPAÇO] ou Clique', 150, 195);
    });
    slotAtk.hitZone.on('pointerout', () => this.hideTooltip());

    // 2. Slot Habilidade de Classe [E]
    const charClass = this.player?.playerData?.characterClass || CharacterClass.WARRIOR;
    let initSkillIcon = 'fx_slash';
    if (charClass === CharacterClass.RANGER) initSkillIcon = 'fx_arrow';
    else if (charClass === CharacterClass.MAGE) initSkillIcon = 'fx_magic_orb';
    else if (charClass === CharacterClass.DRUID) initSkillIcon = 'fx_nature_burst';

    const slotSkill = this.createActionSlot(-46, 0, initSkillIcon, '[E]', () => {
      this.player.triggerSkill1FromUI();
    });
    this.skillIcon = slotSkill.icon;

    this.skillCdGraphics = this.add.graphics();
    this.skillCdGraphics.setPosition(-46, 0);

    this.skillCdText = this.add.text(-46, 0, '', {
      fontFamily: 'monospace',
      fontSize: '6.5px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setVisible(false);

    const combatCfg = CLASS_COMBAT_CONFIG[this.player?.playerData?.characterClass || 'warrior'];
    this.skillMpText = this.add.text(-36, 6, `${combatCfg.skill1CostMp}m`, {
      fontFamily: 'monospace',
      fontSize: '5.5px',
      color: '#38bdf8',
      stroke: '#000000',
      strokeThickness: 1.5
    }).setOrigin(1, 1);

    this.actionBarContainer.add([this.skillCdGraphics, this.skillCdText, this.skillMpText]);

    slotSkill.hitZone.on('pointerover', () => {
      const currentClass = this.player.playerData.characterClass;
      const cfg = CLASS_COMBAT_CONFIG[currentClass];
      this.showActionTooltip(
        cfg.skill1Name,
        `Custo: ${cfg.skill1CostMp} MP | Recarga: ${(cfg.skill1CooldownMs / 1000).toFixed(1)}s\nAtalho: [E] ou Clique`,
        185,
        195
      );
    });
    slotSkill.hitZone.on('pointerout', () => this.hideTooltip());

    // 3. Slot Poção Rápida [Q]
    const slotPotion = this.createActionSlot(-14, 0, 'icon_potion_hp', '[Q]', () => {
      this.player.useQuickPotion();
    });
    this.potionIcon = slotPotion.icon;

    this.potionQtyText = this.add.text(-4, 6, 'x0', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: '#f8fafc',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(1, 1);
    this.actionBarContainer.add(this.potionQtyText);

    slotPotion.hitZone.on('pointerover', () => {
      const count = getItemCount(this.player.playerData.inventory, 'potion_hp_minor');
      this.showActionTooltip('Poção de Vida', `Restaura 35 HP imediatamente.\nDisponíveis: ${count}\nAtalho: [Q] ou Clique`, 215, 195);
    });
    slotPotion.hitZone.on('pointerout', () => this.hideTooltip());

    // 4. Slot Interagir / Coletar [F]
    const slotInteract = this.createActionSlot(18, 0, 'ui_action_interact', '[F]', undefined, true);
    slotInteract.hitZone.on('pointerover', () => {
      this.showActionTooltip('Interagir / Coletar', 'Colhe recursos ou ativa a forja.\nAtalho: [F] ou Segurar Clique', 245, 195);
    });
    slotInteract.hitZone.on('pointerout', () => this.hideTooltip());

    // 5. Botão Inventário [I]
    const btnInv = this.createMiniButton(52, 0, 'item_drop_bag', '[I]', () => {
      this.toggleInventory();
    });
    btnInv.hitZone.on('pointerover', () => {
      this.showActionTooltip('Inventário', 'Bolsa de 24 slots e equipamentos.\nAtalho: [I]', 275, 195);
    });
    btnInv.hitZone.on('pointerout', () => this.hideTooltip());

    // 6. Botão Crafting [C]
    const btnCraft = this.createMiniButton(78, 0, 'icon_pickaxe', '[C]', () => {
      this.toggleCrafting();
    });
    btnCraft.hitZone.on('pointerover', () => {
      this.showActionTooltip('Bancada & Forja', 'Receitas de forja e fabricação.\nAtalho: [C]', 305, 195);
    });
    btnCraft.hitZone.on('pointerout', () => this.hideTooltip());

    // Dica discreta no rodapé inferior
    this.hintsText = this.add.text(240, 264, '[1-4]: Classes  •  [M]: Som  •  [F3]: Info  •  [ENTER]: Chat', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: '#64748b'
    }).setOrigin(0.5);
  }

  private repositionUI(width: number, height: number): void {
    if (this.statusContainer) {
      this.statusContainer.setPosition(10, 10);
    }
    if (this.headerRightContainer) {
      this.headerRightContainer.setPosition(width - 180, 10);
    }
    if (this.actionBarContainer) {
      this.actionBarContainer.setPosition(Math.round(width / 2), Math.round(height - 28));
    }
    if (this.hintsText) {
      this.hintsText.setPosition(Math.round(width / 2), Math.round(height - 8));
    }
    if (this.inventoryContainer) {
      this.inventoryContainer.setPosition(
        Math.max(10, Math.floor((width - 340) / 2)),
        Math.max(10, Math.floor((height - 210) / 2))
      );
    }
    if (this.craftingContainer) {
      this.craftingContainer.setPosition(
        Math.max(10, Math.floor((width - 360) / 2)),
        Math.max(10, Math.floor((height - 210) / 2))
      );
    }
  }

  private createActionSlot(
    x: number,
    y: number,
    iconKey: string,
    shortcutLabel: string,
    onClick?: () => void,
    isHoldable?: boolean
  ): { bg: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Sprite; hitZone: Phaser.GameObjects.Zone } {
    const size = 24;
    const bg = this.add.graphics();
    bg.fillStyle(0x1e293b, 1);
    bg.lineStyle(1, 0x475569, 1);
    bg.fillRoundedRect(x - size / 2, y - size / 2, size, size, 3);
    bg.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 3);

    const icon = this.add.sprite(x, y, iconKey).setDisplaySize(16, 16);

    const label = this.add.text(x, y - size / 2 + 1, shortcutLabel, {
      fontFamily: 'monospace',
      fontSize: '5.5px',
      color: '#cbd5e1',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1.5
    }).setOrigin(0.5, 0);

    const hitZone = this.add.zone(x, y, size, size).setInteractive({ useHandCursor: true });

    if (onClick) {
      hitZone.on('pointerdown', () => onClick());
    } else if (isHoldable) {
      hitZone.on('pointerdown', () => this.player.setVirtualInteract(true));
      hitZone.on('pointerup', () => this.player.setVirtualInteract(false));
      hitZone.on('pointerout', () => this.player.setVirtualInteract(false));
    }

    hitZone.on('pointerover', () => {
      bg.lineStyle(1, 0xfacc15, 1);
      bg.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 3);
    });

    hitZone.on('pointerout', () => {
      bg.lineStyle(1, 0x475569, 1);
      bg.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 3);
    });

    this.actionBarContainer.add([bg, icon, label, hitZone]);
    return { bg, icon, hitZone };
  }

  private createMiniButton(
    x: number,
    y: number,
    iconKey: string,
    shortcutLabel: string,
    onClick: () => void
  ): { bg: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Sprite; hitZone: Phaser.GameObjects.Zone } {
    const size = 20;
    const bg = this.add.graphics();
    bg.fillStyle(0x0f172a, 1);
    bg.lineStyle(1, 0x334155, 1);
    bg.fillRoundedRect(x - size / 2, y - size / 2, size, size, 2);
    bg.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 2);

    const icon = this.add.sprite(x, y, iconKey).setDisplaySize(13, 13);

    const label = this.add.text(x, y - size / 2 + 1, shortcutLabel, {
      fontFamily: 'monospace',
      fontSize: '5px',
      color: '#94a3b8',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(0.5, 0);

    const hitZone = this.add.zone(x, y, size, size).setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', onClick);

    hitZone.on('pointerover', () => {
      bg.lineStyle(1, 0x6366f1, 1);
      bg.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 2);
    });

    hitZone.on('pointerout', () => {
      bg.lineStyle(1, 0x334155, 1);
      bg.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 2);
    });

    this.actionBarContainer.add([bg, icon, label, hitZone]);
    return { bg, icon, hitZone };
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

  public toggleSound(): boolean {
    const isMuted = SoundEffects.getInstance().toggleMute();
    if (this.btnSound && this.txtSound) {
      this.btnSound.setFillStyle(isMuted ? 0x27272a : 0x064e3b);
      this.btnSound.setStrokeStyle(1, isMuted ? 0x71717a : 0x10b981);
      this.txtSound.setText(isMuted ? 'SOM: OFF' : 'SOM: ON');
      this.txtSound.setColor(isMuted ? '#a1a1aa' : '#a7f3d0');
    }
    return !isMuted;
  }

  private refreshInventoryUI(): void {
    if (!this.sys || !this.sys.isActive() || !this.player || !this.player.playerData) return;
    const inventory = this.player.playerData.inventory;
    if (!inventory) return;

    // Atualiza os 24 slots da grade
    for (let i = 0; i < 24; i++) {
      const slot = inventory[i];
      const slotUI = this.slotSprites[i];
      if (!slotUI || !slotUI.icon || !slotUI.icon.scene) continue;

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
    if (!equipped) return;
    const eqKeys = [
      { slot: EquipmentSlot.WEAPON, id: equipped.weapon },
      { slot: EquipmentSlot.ARMOR, id: equipped.armor },
      { slot: EquipmentSlot.ACCESSORY, id: equipped.accessory }
    ];

    eqKeys.forEach(item => {
      const ui = this.equipSlotSprites[item.slot];
      if (!ui || !ui.icon || !ui.icon.scene) return;
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
    if (!this.sys || !this.sys.isActive() || !this.player || !this.player.playerData) return;
    const data = this.player.playerData;
    const attrs = data.attributes;

    this.classLevelText.setText(`${data.characterClass.toUpperCase()}  Lv.${data.level}  •  🪙 ${data.gold}`);

    // HP
    this.hpBarGraphics.clear();
    this.hpBarGraphics.fillStyle(0x2a080c, 0.95);
    this.hpBarGraphics.fillRoundedRect(64, 15, 84, 8, 2);
    const hpRatio = Math.max(0, Math.min(1, attrs.currentHp / attrs.maxHp));
    if (hpRatio > 0) {
      this.hpBarGraphics.fillStyle(0xe11d48, 1);
      this.hpBarGraphics.fillRoundedRect(64, 15, Math.max(4, 84 * hpRatio), 8, 2);
      this.hpBarGraphics.fillStyle(0xfb7185, 0.7);
      this.hpBarGraphics.fillRect(65, 16, Math.max(2, 82 * hpRatio), 2);
    }
    this.hpText.setText(`HP: ${attrs.currentHp}/${attrs.maxHp}`);

    // MP
    this.mpBarGraphics.clear();
    this.mpBarGraphics.fillStyle(0x04192d, 0.95);
    this.mpBarGraphics.fillRoundedRect(64, 29, 84, 7, 2);
    const mpRatio = Math.max(0, Math.min(1, attrs.currentMp / attrs.maxMp));
    if (mpRatio > 0) {
      this.mpBarGraphics.fillStyle(0x0284c7, 1);
      this.mpBarGraphics.fillRoundedRect(64, 29, Math.max(4, 84 * mpRatio), 7, 2);
      this.mpBarGraphics.fillStyle(0x38bdf8, 0.7);
      this.mpBarGraphics.fillRect(65, 30, Math.max(2, 82 * mpRatio), 2);
    }
    this.mpText.setText(`MP: ${attrs.currentMp}/${attrs.maxMp}`);

    // XP
    const progression = evaluateLevelProgression(data.level, data.currentXp);
    const xpRatio = Math.max(0, Math.min(1, progression.xpInCurrentLevel / progression.xpRequiredForNext));
    const xpPercent = Math.round(xpRatio * 100);

    this.xpBarGraphics.clear();
    this.xpBarGraphics.fillStyle(0x211802, 0.95);
    this.xpBarGraphics.fillRoundedRect(64, 43, 84, 6, 2);
    if (xpRatio > 0) {
      this.xpBarGraphics.fillStyle(0xf59e0b, 1);
      this.xpBarGraphics.fillRoundedRect(64, 43, Math.max(3, 84 * xpRatio), 6, 2);
      this.xpBarGraphics.fillStyle(0xfde047, 0.7);
      this.xpBarGraphics.fillRect(65, 44, Math.max(2, 82 * xpRatio), 1);
    }
    this.xpText.setText(`XP: ${progression.xpInCurrentLevel}/${progression.xpRequiredForNext} (${xpPercent}%)`);
  }

  private updateCoordinates(): void {
    if (!this.isDebugOpen) return;
    const posX = this.player.playerData.position.x;
    const posY = this.player.playerData.position.y;
    const tileX = Math.floor(posX / 16);
    const tileY = Math.floor(posY / 16);

    this.coordsText.setText(`X: ${posX} Y: ${posY} [T: ${tileX},${tileY}]`);
  }

  private updateFps(): void {
    if (!this.isDebugOpen) return;
    const actualFps = Math.round(this.game.loop.actualFps);
    this.fpsText.setText(`FPS: ${actualFps} | 480x270 nativo`);

    const worldScene = this.scene.get('WorldScene') as any;
    const monstersCount = worldScene?.monsters?.filter((m: any) => m.active)?.length ?? 0;
    const remoteCount = worldScene?.remotePlayers?.size ?? 0;
    this.entitiesText.setText(`Monstros: ${monstersCount} | Remotos: ${remoteCount}`);
  }

  private updateActionBar(time: number): void {
    if (!this.player) return;

    // 1. Cooldown de Ataque Básico
    const atkCd = this.player.getAttackCooldownProgress(time);
    this.atkCdGraphics.clear();
    if (!atkCd.isReady && atkCd.ratio > 0) {
      this.atkCdGraphics.fillStyle(0x000000, 0.65);
      const h = 24 * atkCd.ratio;
      this.atkCdGraphics.fillRect(-12, 12 - h, 24, h);
    }

    // 2. Cooldown e MP da Habilidade de Classe
    const skillCd = this.player.getSkill1CooldownProgress(time);
    const charClass = this.player.playerData.characterClass;
    const combatCfg = CLASS_COMBAT_CONFIG[charClass];
    const hasMp = this.player.playerData.attributes.currentMp >= combatCfg.skill1CostMp;

    // Atualiza ícone da habilidade de acordo com a classe
    let skillIconKey = 'fx_slash';
    if (charClass === CharacterClass.RANGER) skillIconKey = 'fx_arrow';
    else if (charClass === CharacterClass.MAGE) skillIconKey = 'fx_magic_orb';
    else if (charClass === CharacterClass.DRUID) skillIconKey = 'fx_nature_burst';

    if (this.skillIcon.texture.key !== skillIconKey) {
      this.skillIcon.setTexture(skillIconKey);
    }

    this.skillCdGraphics.clear();
    if (!skillCd.isReady && skillCd.ratio > 0) {
      this.skillCdGraphics.fillStyle(0x000000, 0.72);
      const h = 24 * skillCd.ratio;
      this.skillCdGraphics.fillRect(-12, 12 - h, 24, h);
      const secs = (skillCd.remainingMs / 1000).toFixed(1);
      this.skillCdText.setText(`${secs}s`).setVisible(true);
    } else {
      this.skillCdText.setVisible(false);
    }

    // Se não tiver MP suficiente, escurece o ícone
    if (!hasMp) {
      this.skillIcon.setTint(0x64748b);
      this.skillMpText.setColor('#ef4444');
    } else {
      this.skillIcon.clearTint();
      this.skillMpText.setColor('#38bdf8');
    }

    // 3. Contador de Poções baseado no inventário real
    this.updateActionBarPotionCount();

    // 4. Debug Panel CD Text
    if (this.isDebugOpen) {
      const atkRem = (atkCd.remainingMs / 1000).toFixed(1);
      const sklRem = (skillCd.remainingMs / 1000).toFixed(1);
      this.skillText.setText(`Atq CD: ${atkRem}s | Hab: [E] ${sklRem}s`);
    }
  }

  private updateActionBarPotionCount(): void {
    if (!this.sys || !this.sys.isActive() || !this.player || !this.player.playerData || !this.potionQtyText || !this.potionIcon || !this.potionIcon.scene) return;
    const potionCount = getItemCount(this.player.playerData.inventory, 'potion_hp_minor');
    this.potionQtyText.setText(`x${potionCount}`);
    if (potionCount <= 0) {
      this.potionQtyText.setColor('#ef4444');
      this.potionIcon.setTint(0x64748b);
    } else {
      this.potionQtyText.setColor('#f8fafc');
      this.potionIcon.clearTint();
    }
  }

  public toggleDebugPanel(force?: boolean): void {
    this.isDebugOpen = force !== undefined ? force : !this.isDebugOpen;
    this.debugContainer.setVisible(this.isDebugOpen);
  }

  private showActionTooltip(titleStr: string, descStr: string, screenX: number, screenY: number): void {
    const titleText = this.tooltipContainer.getByName('tooltip_title') as Phaser.GameObjects.Text;
    const descText = this.tooltipContainer.getByName('tooltip_desc') as Phaser.GameObjects.Text;
    const statsText = this.tooltipContainer.getByName('tooltip_stats') as Phaser.GameObjects.Text;
    const bg = this.tooltipContainer.getByName('tooltip_bg') as Phaser.GameObjects.Graphics;

    titleText.setText(titleStr).setColor('#facc15');
    descText.setText(descStr);
    statsText.setText('');

    bg.clear();
    bg.fillStyle(0x0c0a14, 0.95);
    bg.lineStyle(1, 0x6366f1, 1);
    bg.fillRoundedRect(0, 0, 142, 38, 4);
    bg.strokeRoundedRect(0, 0, 142, 38, 4);

    this.tooltipContainer.setPosition(Math.min(screenX, 325), screenY);
    this.tooltipContainer.setVisible(true);
  }
}
