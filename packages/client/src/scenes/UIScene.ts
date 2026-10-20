import Phaser from 'phaser';
import {
  evaluateLevelProgression,
  CLASS_COMBAT_CONFIG,
  ITEM_DEFINITIONS,
  CRAFTING_RECIPES,
  ItemRarity,
  EquipmentSlot,
  getItemCount,
  addItemToInventory,
  hasIngredients,
  ItemCategory,
  CharacterClass,
  S2C_QuestUpdatePayload,
  PendingRewardItem,
  S2C_AchievementsUpdatePayload,
  S2C_AchievementUnlockedPayload,
  TITLE_DEFINITIONS,
  ACHIEVEMENT_DEFINITIONS,
  AchievementProgress
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
  private activeTitleHudText?: Phaser.GameObjects.Text;
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
  private isAchievementsOpen: boolean = false;
  private inventoryContainer!: Phaser.GameObjects.Container;
  private craftingContainer!: Phaser.GameObjects.Container;
  private achievementsContainer!: Phaser.GameObjects.Container;
  private achievementsData?: S2C_AchievementsUpdatePayload;
  private achievementsListContainer!: Phaser.GameObjects.Container;
  private activeTitleModalText?: Phaser.GameObjects.Text;
  private titlesButtonsContainer!: Phaser.GameObjects.Container;
  private toastContainer?: Phaser.GameObjects.Container;
  private toastTitleText?: Phaser.GameObjects.Text;
  private tooltipContainer!: Phaser.GameObjects.Container;
  private btnSound!: Phaser.GameObjects.Rectangle;
  private txtSound!: Phaser.GameObjects.Text;

  // Painel de Tutorial e Diálogo com NPCs (Missão 2)
  private tutorialStep: number = 0;
  private tutorialContainer!: Phaser.GameObjects.Container;
  private tutorialTitleText!: Phaser.GameObjects.Text;
  private tutorialObjectiveText!: Phaser.GameObjects.Text;
  private isNpcDialogOpen: boolean = false;
  private npcDialogContainer!: Phaser.GameObjects.Container;
  private npcPortraitSprite!: Phaser.GameObjects.Sprite;
  private npcDialogNameText!: Phaser.GameObjects.Text;
  private npcDialogRoleText!: Phaser.GameObjects.Text;
  private npcDialogSpeechText!: Phaser.GameObjects.Text;
  private npcDialogRewardText!: Phaser.GameObjects.Text;
  private npcDialogBtnBg!: Phaser.GameObjects.Graphics;
  private npcDialogBtnText!: Phaser.GameObjects.Text;
  private activeNpcId: string | null = null;
  private onDialogActionCallback: (() => void) | null = null;

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

  // Recompensas pendentes (Missão 7)
  private pendingBadgeContainer?: Phaser.GameObjects.Container;
  private pendingBadgeText?: Phaser.GameObjects.Text;
  private pendingInvBanner?: Phaser.GameObjects.Container;
  private pendingInvText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  public init(data: UISceneData): void {
    this.player = data.player;
    if (this.player?.playerData?.quests?.starter_tutorial) {
      this.tutorialStep = this.player.playerData.quests.starter_tutorial.step;
    }
  }

  public create(): void {
    this.slotSprites = [];
    this.equipSlotSprites = {};
    this.isInventoryOpen = false;
    this.isCraftingOpen = false;

    this.createPlayerStatusPanel();
    this.createHeaderAndDebugPanel();
    this.createBottomActionBar();
    this.createTutorialHUD();
    this.createNpcDialogModal();
    this.createInventoryModal();
    this.createCraftingModal();
    this.createAchievementsModal();
    this.createToastNotification();
    this.createTooltip();
    this.createPendingRewardsBadge();

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
      this.updatePendingRewardsUI();
    };
    const onOpenNpcDialog = (data: { npcId: string; npcName: string; role: string }) => {
      if (!this.sys || !this.sys.isActive()) return;
      this.openNpcDialog(data.npcId, data.npcName, data.role);
    };
    const onQuestUpdated = (payload: S2C_QuestUpdatePayload) => {
      if (!this.sys || !this.sys.isActive()) return;
      if (payload.quest) {
        const q = payload.quest;
        if (this.player && this.player.playerData) {
          if (!this.player.playerData.quests) {
            this.player.playerData.quests = {};
          }
          this.player.playerData.quests[q.questId] = q;
        }

        if (q.questId === 'starter_tutorial') {
          this.tutorialStep = q.step;
        }

        // Concessão visual de recompensas autoritativas enviadas pelo servidor
        if (payload.rewardsAwarded) {
          if (payload.rewardsAwarded.gold && this.player?.playerData) {
            this.player.playerData.gold += payload.rewardsAwarded.gold;
            SoundEffects.getInstance().playLevelUp();
          }
          if (payload.rewardsAwarded.xp && this.player) {
            this.player.gainXp(payload.rewardsAwarded.xp);
          }
          if (payload.rewardsAwarded.items && this.player?.playerData) {
            for (const item of payload.rewardsAwarded.items) {
              addItemToInventory(this.player.playerData.inventory, item.itemId, item.quantity);
            }
            SoundEffects.getInstance().playItemPickup();
            this.player.scene.events.emit('player-updated', this.player.playerData);
          }

          const worldScene = this.scene.get('WorldScene');
          let rewardText = '';
          if (payload.rewardsAwarded.gold && payload.rewardsAwarded.xp) {
            rewardText = `+${payload.rewardsAwarded.gold} Gold! +${payload.rewardsAwarded.xp} XP!`;
          } else if (payload.rewardsAwarded.items) {
            rewardText = payload.rewardsAwarded.items.map(it => `+${it.quantity} ${it.itemId}`).join('  ');
          }
          if (rewardText && this.player) {
            worldScene.events.emit('floating-text', {
              x: this.player.x,
              y: this.player.y - 30,
              text: rewardText,
              color: '#facc15'
            });
          }
        }

        this.updateTutorialHUD();

        // Se o diálogo com NPC estiver aberto, atualiza o conteúdo
        if (this.isNpcDialogOpen && this.activeNpcId) {
          if (this.activeNpcId === 'npc_elder') {
            this.setupElderDialog();
          } else if (this.activeNpcId === 'npc_blacksmith') {
            this.setupBlacksmithDialog();
          } else if (this.activeNpcId === 'npc_guard') {
            this.setupGuardDialog();
          } else if (this.activeNpcId === 'npc_tavern') {
            this.setupTavernDialog();
          }
        }
      }
    };

    const onInventoryUpdated = () => {
      if (!this.sys || !this.sys.isActive()) return;
      this.refreshInventoryUI();
      this.updateActionBarPotionCount();
      this.updatePendingRewardsUI();
    };

    const onPendingRewardsUpdated = () => {
      if (!this.sys || !this.sys.isActive()) return;
      this.updatePendingRewardsUI();
    };

    const onToggleAchievements = () => {
      if (!this.sys || !this.sys.isActive()) return;
      this.toggleAchievements();
    };

    const onAchievementsUpdated = (payload: S2C_AchievementsUpdatePayload) => {
      if (!this.sys || !this.sys.isActive()) return;
      this.updateAchievementsUI(payload);
    };

    const onAchievementUnlocked = (payload: S2C_AchievementUnlockedPayload) => {
      if (!this.sys || !this.sys.isActive()) return;
      this.showAchievementToast(payload.achievement?.title || 'Conquista Desbloqueada!');
    };

    worldScene.events.on('toggle-inventory', onToggleInventory);
    worldScene.events.on('toggle-crafting', onToggleCrafting);
    worldScene.events.on('toggle-achievements', onToggleAchievements);
    worldScene.events.on('player-updated', onPlayerUpdated);
    worldScene.events.on('inventory-updated', onInventoryUpdated);
    worldScene.events.on('pending-rewards-updated', onPendingRewardsUpdated);
    worldScene.events.on('achievements-updated', onAchievementsUpdated);
    worldScene.events.on('achievement-unlocked', onAchievementUnlocked);
    worldScene.events.on('open-npc-dialog', onOpenNpcDialog);
    worldScene.events.on('quest-updated', onQuestUpdated);

    // Limpeza rigorosa de eventos ao destruir/desativar a cena
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize);
      worldScene.events.off('toggle-inventory', onToggleInventory);
      worldScene.events.off('toggle-crafting', onToggleCrafting);
      worldScene.events.off('toggle-achievements', onToggleAchievements);
      worldScene.events.off('player-updated', onPlayerUpdated);
      worldScene.events.off('inventory-updated', onInventoryUpdated);
      worldScene.events.off('pending-rewards-updated', onPendingRewardsUpdated);
      worldScene.events.off('achievements-updated', onAchievementsUpdated);
      worldScene.events.off('achievement-unlocked', onAchievementUnlocked);
      worldScene.events.off('open-npc-dialog', onOpenNpcDialog);
      worldScene.events.off('quest-updated', onQuestUpdated);
      this.slotSprites = [];
      this.equipSlotSprites = {};
    });

    // Tecla ESC para fechar janelas
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.isNpcDialogOpen) this.closeNpcDialog();
      if (this.isInventoryOpen) this.toggleInventory(false);
      if (this.isCraftingOpen) this.toggleCrafting(false);
      if (this.isAchievementsOpen) this.toggleAchievements(false);
    });

    // Tecla Y para alternar painel de Conquistas & Títulos
    this.input.keyboard?.on('keydown-Y', () => {
      this.toggleAchievements();
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
    panelBg.fillRoundedRect(0, 0, 156, 76, 4);
    panelBg.strokeRoundedRect(0, 0, 156, 76, 4);
    this.statusContainer.add(panelBg);

    this.classLevelText = this.add.text(6, 4, 'GUERREIRO  Lv.1', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#f59e0b',
      fontStyle: 'bold'
    });

    this.activeTitleHudText = this.add.text(6, 58, '', {
      fontFamily: 'monospace',
      fontSize: '6.5px',
      color: '#facc15',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1.5
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

    this.statusContainer.add([this.classLevelText, this.activeTitleHudText, this.hpText, this.mpText, this.xpText]);
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

    // 7. Botão Conquistas & Títulos [Y]
    const btnAch = this.createMiniButton(104, 0, 'icon_trophy', '[Y]', () => {
      this.toggleAchievements();
    });
    btnAch.hitZone.on('pointerover', () => {
      this.showActionTooltip('Conquistas & Títulos', 'Lista de façanhas e títulos.\nAtalho: [Y]', 335, 195);
    });
    btnAch.hitZone.on('pointerout', () => this.hideTooltip());

    // Dica discreta no rodapé inferior
    this.hintsText = this.add.text(240, 264, '[1-4]: Classes  •  [M]: Som  •  [F3]: Info  •  [Y]: Conquistas  •  [ENTER]: Chat', {
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
    if (this.tutorialContainer) {
      this.tutorialContainer.setPosition(10, 80);
    }
    if (this.npcDialogContainer) {
      this.npcDialogContainer.setPosition(
        Math.max(10, Math.floor((width - 340) / 2)),
        Math.max(10, Math.floor((height - 150) / 2))
      );
    }
    if (this.pendingBadgeContainer) {
      this.pendingBadgeContainer.setPosition(Math.round(width / 2), 26);
    }
    if (this.achievementsContainer) {
      this.achievementsContainer.setPosition(
        Math.max(10, Math.floor((width - 400) / 2)),
        Math.max(10, Math.floor((height - 230) / 2))
      );
    }
    if (this.toastContainer) {
      this.toastContainer.setPosition(Math.round(width / 2), 30);
    }
  }

  // --- PAINEL DE MISSÃO / TUTORIAL DA VILA INICIAL ---

  private createTutorialHUD(): void {
    this.tutorialContainer = this.add.container(10, 80);
    this.tutorialContainer.setDepth(500);

    const bg = this.add.graphics();
    bg.fillStyle(0x0c0a14, 0.92);
    bg.lineStyle(1, 0xf59e0b, 0.85);
    bg.fillRoundedRect(0, 0, 156, 38, 4);
    bg.strokeRoundedRect(0, 0, 156, 38, 4);
    this.tutorialContainer.add(bg);

    this.tutorialTitleText = this.add.text(6, 4, '★ TUTORIAL: BOAS-VINDAS', {
      fontFamily: 'monospace',
      fontSize: '6.5px',
      color: '#f59e0b',
      fontStyle: 'bold'
    });

    this.tutorialObjectiveText = this.add.text(6, 16, '', {
      fontFamily: 'monospace',
      fontSize: '5.5px',
      color: '#e2e8f0',
      wordWrap: { width: 144 }
    });

    this.tutorialContainer.add([this.tutorialTitleText, this.tutorialObjectiveText]);
    this.updateTutorialHUD();
  }

  private updateTutorialHUD(): void {
    if (!this.tutorialObjectiveText || !this.tutorialTitleText) return;

    // 1. Se o tutorial ainda não terminou, ele tem prioridade
    if (this.tutorialStep < 3) {
      switch (this.tutorialStep) {
        case 0:
          this.tutorialTitleText.setText('★ TUTORIAL: BOAS-VINDAS');
          this.tutorialTitleText.setColor('#f59e0b');
          this.tutorialObjectiveText.setText('Fale com o Ancião Aldor na entrada da praça [F]');
          break;
        case 1:
          this.tutorialTitleText.setText('★ TUTORIAL: A FORJA');
          this.tutorialTitleText.setColor('#f59e0b');
          this.tutorialObjectiveText.setText('Procure o Ferreiro Brann na bigorna e receba materiais [F]');
          break;
        case 2:
          this.tutorialTitleText.setText('★ TUTORIAL: BÊNÇÃO FINAL');
          this.tutorialTitleText.setColor('#f59e0b');
          this.tutorialObjectiveText.setText('Retorne ao Ancião Aldor para concluir sua iniciação [F]');
          break;
      }
      return;
    }

    // 2. Se o tutorial estiver concluído, verifica missões secundárias ativas
    const quests = this.player?.playerData?.quests || {};
    const guardQuest = quests.quest_plains_threat;
    const tavernQuest = quests.quest_tavern_supplies;

    if (guardQuest && !guardQuest.completed && guardQuest.step > 0) {
      if (guardQuest.step === 1) {
        const kills = (guardQuest.claimedRewards || []).filter(r => r.startsWith('slime_kill_')).length;
        this.tutorialTitleText.setText('⚔ CAÇADA NAS PLANÍCIES');
        this.tutorialTitleText.setColor('#38bdf8');
        this.tutorialObjectiveText.setText(`Elimine slimes nas planícies (${kills}/3)`);
      } else if (guardQuest.step === 2) {
        this.tutorialTitleText.setText('★ CAÇADA CONCLUÍDA');
        this.tutorialTitleText.setColor('#10b981');
        this.tutorialObjectiveText.setText('Reporte ao Guarda Alistair no portão Norte [F]');
      }
      return;
    }

    if (tavernQuest && !tavernQuest.completed && tavernQuest.step > 0) {
      const herbCount = getItemCount(this.player?.playerData?.inventory || [], 'herb_green');
      if (herbCount < 3) {
        this.tutorialTitleText.setText('🌿 SUPRIMENTOS DA TAVERNA');
        this.tutorialTitleText.setColor('#4ade80');
        this.tutorialObjectiveText.setText(`Colete Ervas Verdes nos arbustos (${herbCount}/3)`);
      } else {
        this.tutorialTitleText.setText('★ ERVAS REUNIDAS');
        this.tutorialTitleText.setColor('#10b981');
        this.tutorialObjectiveText.setText('Entregue as 3 ervas ao Taverneiro Tobin [F]');
      }
      return;
    }

    // 3. Se nenhuma missão em andamento, sugere novos NPCs
    if (!guardQuest || guardQuest.step === 0) {
      this.tutorialTitleText.setText('★ MISSÃO DISPONÍVEL');
      this.tutorialTitleText.setColor('#f59e0b');
      this.tutorialObjectiveText.setText('Fale com o Guarda Alistair no Portão Norte [F]');
      return;
    }

    if (!tavernQuest || tavernQuest.step === 0) {
      this.tutorialTitleText.setText('★ MISSÃO DISPONÍVEL');
      this.tutorialTitleText.setColor('#f59e0b');
      this.tutorialObjectiveText.setText('Visite o Taverneiro Tobin na praça da vila [F]');
      return;
    }

    // 4. Todas as missões da vila concluídas
    this.tutorialTitleText.setText('★ TODAS AS MISSÕES CUMPRIDAS!');
    this.tutorialTitleText.setColor('#10b981');
    this.tutorialObjectiveText.setText('Explore as planícies e enfrente os perigos exteriores!');
  }

  // --- MODAL DE DIÁLOGO COM NPCS ---

  private createNpcDialogModal(): void {
    this.npcDialogContainer = this.add.container(70, 60);
    this.npcDialogContainer.setVisible(false);
    this.npcDialogContainer.setDepth(12000);

    // Fundo estilizado com borda dourada
    const bg = this.add.graphics();
    bg.fillStyle(0x0f172a, 0.98);
    bg.lineStyle(2, 0xf59e0b, 1);
    bg.fillRoundedRect(0, 0, 340, 150, 6);
    bg.strokeRoundedRect(0, 0, 340, 150, 6);
    this.npcDialogContainer.add(bg);

    // Moldura do Retrato
    const portraitFrame = this.add.graphics();
    portraitFrame.fillStyle(0x1e293b, 1);
    portraitFrame.lineStyle(1, 0xd97706, 1);
    portraitFrame.fillRoundedRect(12, 14, 44, 52, 4);
    portraitFrame.strokeRoundedRect(12, 14, 44, 52, 4);
    this.npcDialogContainer.add(portraitFrame);

    this.npcPortraitSprite = this.add.sprite(34, 42, 'npc_elder', 0).setScale(1.8);
    this.npcDialogContainer.add(this.npcPortraitSprite);

    // Nome e Título do NPC
    this.npcDialogNameText = this.add.text(66, 12, '', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#fef08a',
      fontStyle: 'bold'
    });

    this.npcDialogRoleText = this.add.text(66, 24, '', {
      fontFamily: 'monospace',
      fontSize: '6.5px',
      color: '#94a3b8'
    });

    // Botão Fechar [X]
    const closeBtn = this.add.text(324, 10, 'X', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ef4444',
      fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeNpcDialog());

    // Linha divisória ornamental
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x334155, 1);
    divider.lineBetween(66, 35, 324, 35);

    // Texto de Fala
    this.npcDialogSpeechText = this.add.text(66, 40, '', {
      fontFamily: 'monospace',
      fontSize: '6.5px',
      color: '#f1f5f9',
      wordWrap: { width: 258 },
      lineSpacing: 2
    });

    // Texto de Recompensa / Status
    this.npcDialogRewardText = this.add.text(66, 100, '', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: '#facc15',
      fontStyle: 'bold'
    });

    // Botão de Ação Interativo
    this.npcDialogBtnBg = this.add.graphics();
    this.drawDialogButton(false);

    this.npcDialogBtnText = this.add.text(250, 130, 'Continuar', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const hitBtn = this.add.zone(250, 130, 140, 20).setInteractive({ useHandCursor: true });
    hitBtn.on('pointerdown', () => {
      if (this.onDialogActionCallback) {
        this.onDialogActionCallback();
      } else {
        this.closeNpcDialog();
      }
    });

    hitBtn.on('pointerover', () => {
      this.drawDialogButton(true);
    });

    hitBtn.on('pointerout', () => {
      this.drawDialogButton(false);
    });

    this.npcDialogContainer.add([
      this.npcDialogNameText,
      this.npcDialogRoleText,
      closeBtn,
      divider,
      this.npcDialogSpeechText,
      this.npcDialogRewardText,
      this.npcDialogBtnBg,
      this.npcDialogBtnText,
      hitBtn
    ]);
  }

  private drawDialogButton(isHover: boolean): void {
    this.npcDialogBtnBg.clear();
    this.npcDialogBtnBg.fillStyle(isHover ? 0xd97706 : 0xb45309, 1);
    this.npcDialogBtnBg.lineStyle(1, isHover ? 0xfef08a : 0xf59e0b, 1);
    this.npcDialogBtnBg.fillRoundedRect(180, 120, 140, 20, 3);
    this.npcDialogBtnBg.strokeRoundedRect(180, 120, 140, 20, 3);
  }

  public openNpcDialog(npcId: string, npcName: string, role: string): void {
    if (this.isInventoryOpen) this.toggleInventory(false);
    if (this.isCraftingOpen) this.toggleCrafting(false);

    this.activeNpcId = npcId;
    this.isNpcDialogOpen = true;
    this.npcDialogContainer.setVisible(true);

    this.npcDialogNameText.setText(npcName);
    this.npcDialogRoleText.setText(`<${role}>`);

    // Atualiza o retrato
    let portraitKey = 'npc_elder';
    if (npcId === 'npc_blacksmith') portraitKey = 'npc_blacksmith';
    else if (npcId === 'npc_guard') portraitKey = 'npc_guard';
    else if (npcId === 'npc_tavern') portraitKey = 'npc_tavern';
    this.npcPortraitSprite.setTexture(portraitKey, 0);

    // Diálogos específicos e lógica das missões
    if (npcId === 'npc_elder') {
      this.setupElderDialog();
    } else if (npcId === 'npc_blacksmith') {
      this.setupBlacksmithDialog();
    } else if (npcId === 'npc_guard') {
      this.setupGuardDialog();
    } else if (npcId === 'npc_tavern') {
      this.setupTavernDialog();
    }
  }

  private setupElderDialog(): void {
    if (this.tutorialStep === 0) {
      this.npcDialogSpeechText.setText(
        'Saudações, nobre viajante! Bem-vindo à Vila de Aethelgard. Nossas paliçadas mantêm os perigos afastados, mas o mundo exterior está repleto de monstros perigosos.\n\nVocê pode caminhar livremente usando [W, A, S, D] ou as [Setas]. Antes de cruzar os portões, visite a Praça Central a leste e fale com o Ferreiro Brann ao lado da bigorna para aprender a forjar seu primeiro equipamento!'
      );
      this.npcDialogRewardText.setText('» Objetivo: Fale com o Ferreiro Brann na Praça');
      this.npcDialogBtnText.setText('Entendido, vou procurá-lo!');
      this.onDialogActionCallback = () => {
        SoundEffects.getInstance().playUiClick();
        const worldScene = this.scene.get('WorldScene');
        worldScene.events.emit('request-quest-action', {
          questId: 'starter_tutorial',
          npcId: 'npc_elder',
          action: 'dialogue_next'
        });
        this.closeNpcDialog();
      };
    } else if (this.tutorialStep === 1) {
      this.npcDialogSpeechText.setText(
        'O Ferreiro Brann está aguardando você junto à bigorna na Praça Central a leste. Vá até ele para receber seus materiais e aprender a arte da forja!'
      );
      this.npcDialogRewardText.setText('» Objetivo Pendente: Encontrar o Ferreiro Brann');
      this.npcDialogBtnText.setText('Voltando à praça...');
      this.onDialogActionCallback = () => {
        SoundEffects.getInstance().playUiClick();
        this.closeNpcDialog();
      };
    } else if (this.tutorialStep === 2) {
      this.npcDialogSpeechText.setText(
        'Excelente trabalho, bravo herói! Vejo que você já aprendeu com Brann e compreende os pilares da forja e sobrevivência.\n\nComo recompensa por completar sua iniciação na vila, receba nossa bênção: 50 Moedas de Ouro e 30 Pontos de Experiência. Fora dos portões, use [ESPAÇO] para o ataque básico e [E] para sua habilidade especial. Se ficar ferido, beba poções com [Q]! Vá em frente e traga glória ao nosso reino!'
      );
      this.npcDialogRewardText.setText('★ Recompensa: +50 Gold & +30 XP!');
      this.npcDialogBtnText.setText('Receber Bênção & Concluir');
      this.onDialogActionCallback = () => {
        SoundEffects.getInstance().playUiClick();
        const worldScene = this.scene.get('WorldScene');
        worldScene.events.emit('request-quest-action', {
          questId: 'starter_tutorial',
          npcId: 'npc_elder',
          action: 'claim_blessing'
        });
        this.closeNpcDialog();
      };
    } else {
      const pending = this.player?.playerData?.pendingRewards;
      if (pending && pending.length > 0) {
        const totalPending = pending.reduce((sum: number, r: PendingRewardItem) => sum + r.quantity, 0);
        this.npcDialogSpeechText.setText(
          `Olá novamente! Guardamos ${totalPending} item(ns) de suas aventuras porque sua mochila estava cheia. Quando tiver espaço livre, você pode resgatá-los!`
        );
        this.npcDialogRewardText.setText(`🎁 ${pending.length} pacote(s) pendente(s) aguardando espaço`);
        this.npcDialogBtnText.setText('Resgatar Itens Guardados');
        this.onDialogActionCallback = () => {
          SoundEffects.getInstance().playItemPickup();
          const worldScene = this.scene.get('WorldScene');
          worldScene.events.emit('claim-pending-rewards');
          this.closeNpcDialog();
        };
      } else {
        this.npcDialogSpeechText.setText(
          'Que as bênçãos dos ancestrais iluminem seus passos, campeão de Aethelgard! Lembre-se: quando subir de nível, seus atributos se fortalecerão automaticamente. Se precisar de recursos, explore os arredores e visite o mercado de jogadores.'
        );
        this.npcDialogRewardText.setText('★ Tutorial Concluído com Sucesso!');
        this.npcDialogBtnText.setText('Até logo, Ancião Aldor');
        this.onDialogActionCallback = () => {
          SoundEffects.getInstance().playUiClick();
          this.closeNpcDialog();
        };
      }
    }
  }

  private setupBlacksmithDialog(): void {
    if (this.tutorialStep === 0) {
      this.npcDialogSpeechText.setText(
        'Ora, você parece novo por estas bandas! Antes de lidar com fogo, ferro e martelo, apresente-se ao Ancião Aldor na entrada da vila. Ele saberá se você tem o coração valoroso de um aventureiro.'
      );
      this.npcDialogRewardText.setText('» Dica: Encontre o Ancião Aldor próximo ao spawn');
      this.npcDialogBtnText.setText('Vou falar com o Ancião');
      this.onDialogActionCallback = () => {
        SoundEffects.getInstance().playUiClick();
        this.closeNpcDialog();
      };
    } else if (this.tutorialStep === 1) {
      this.npcDialogSpeechText.setText(
        'Ah, o Ancião enviou você? Muito bem! Em NoobRPG, você mesmo forja seu destino. Nenhum guerreiro ou mago sobrevive muito tempo lá fora sem lâmina afiada ou cajado firme.\n\nTome estes lingotes de ferro e tábuas de madeira! Aproxime-se da Bigorna ao meu lado e aperte [F] ou use a tecla [C] para abrir o menu de Crafting. Se quiser conferir sua bolsa, aperte [I]. Volte ao Ancião quando terminar!'
      );
      this.npcDialogRewardText.setText('★ Receber: +4 Tábuas de Madeira & +4 Minérios de Ferro');
      this.npcDialogBtnText.setText('Pegar Materiais & Forjar');
      this.onDialogActionCallback = () => {
        SoundEffects.getInstance().playUiClick();
        const worldScene = this.scene.get('WorldScene');
        worldScene.events.emit('request-quest-action', {
          questId: 'starter_tutorial',
          npcId: 'npc_blacksmith',
          action: 'claim_materials'
        });
        this.closeNpcDialog();
      };
    } else {
      this.npcDialogSpeechText.setText(
        'Aço temperado e madeira nobre: essa é a verdadeira poesia da forja! Se precisar de mais minério, extraia dos veios de rocha com sua Picareta de Cobre [F]. A bigorna estará sempre pronta para aquecer seus metais!'
      );
      this.npcDialogRewardText.setText('» Dica: Pressione [C] para forjar ou use [F] na Bigorna');
      this.npcDialogBtnText.setText('Obrigado, Ferreiro Brann!');
      this.onDialogActionCallback = () => {
        SoundEffects.getInstance().playUiClick();
        this.closeNpcDialog();
      };
    }
  }

  private setupGuardDialog(): void {
    const quest = this.player?.playerData?.quests?.quest_plains_threat || {
      questId: 'quest_plains_threat',
      step: 0,
      completed: false,
      claimedRewards: []
    };

    if (quest.step === 0) {
      this.npcDialogSpeechText.setText(
        'Atenção, forasteiro! As planícies além destes portões tornaram-se perigosas. Slimes vorazes e criaturas hostis rondam os arredores das paliçadas.\n\nPreciso de bravos aventureiros para patrulhar e conter as criaturas antes que ameacem a vila. Elimine 3 Slimes nas planícies e a guarnição concederá uma generosa recompensa em ouro, experiência e provisões!'
      );
      this.npcDialogRewardText.setText('» Objetivo: Derrotar 3 Slimes nas Planícies\n★ Recompensa: +60 Gold, +40 XP & +2 Poções Menores de Vida');
      this.npcDialogBtnText.setText('Aceitar Missão de Caça');
      this.onDialogActionCallback = () => {
        SoundEffects.getInstance().playUiClick();
        const worldScene = this.scene.get('WorldScene');
        worldScene.events.emit('request-quest-action', {
          questId: 'quest_plains_threat',
          npcId: 'npc_guard',
          action: 'START'
        });
        this.closeNpcDialog();
      };
    } else if (quest.step === 1) {
      const kills = (quest.claimedRewards || []).filter(r => r.startsWith('slime_kill_')).length;
      this.npcDialogSpeechText.setText(
        `Nossos batedores continuam monitorando o perímetro. Até o momento você abateu ${kills}/3 Slimes.\n\nEmpunhe sua arma, cruze os portões com cautela e derrote os slimes restantes!`
      );
      this.npcDialogRewardText.setText(`» Em Andamento: Slimes Derrotados (${kills}/3)`);
      this.npcDialogBtnText.setText('Continuar Patrulha');
      this.onDialogActionCallback = () => {
        SoundEffects.getInstance().playUiClick();
        this.closeNpcDialog();
      };
    } else if (quest.step === 2) {
      this.npcDialogSpeechText.setText(
        'Excelente trabalho de patrulha! Os batedores confirmaram que os 3 slimes foram eliminados e as rotas estão mais tranquilas.\n\nReceba o pagamento da guarnição de Aethelgard: 60 Moedas de Ouro, 40 XP e 2 Poções Menores de Vida. Continue honrando nossa sentinela!'
      );
      this.npcDialogRewardText.setText('★ Recompensa: +60 Gold, +40 XP & +2 Poções Menores de Vida!');
      this.npcDialogBtnText.setText('Entregar Relatório & Concluir');
      this.onDialogActionCallback = () => {
        SoundEffects.getInstance().playUiClick();
        const worldScene = this.scene.get('WorldScene');
        worldScene.events.emit('request-quest-action', {
          questId: 'quest_plains_threat',
          npcId: 'npc_guard',
          action: 'COMPLETE'
        });
        this.closeNpcDialog();
      };
    } else {
      this.npcDialogSpeechText.setText(
        'Obrigado pelo seu valoroso serviço aos portões, sentinela honorário! Graças a você, nossos comboios comerciais transitam com segurança.'
      );
      this.npcDialogRewardText.setText('★ Missão de Caça Concluída com Honra!');
      this.npcDialogBtnText.setText('Em guarda, Alistair!');
      this.onDialogActionCallback = () => {
        SoundEffects.getInstance().playUiClick();
        this.closeNpcDialog();
      };
    }
  }

  private setupTavernDialog(): void {
    const quest = this.player?.playerData?.quests?.quest_tavern_supplies || {
      questId: 'quest_tavern_supplies',
      step: 0,
      completed: false,
      claimedRewards: []
    };

    if (quest.step === 0) {
      this.npcDialogSpeechText.setText(
        'Saudações, aventureiro sedento! Bem-vindo à Taverna do Javali Saltitante! Nossos barris de infusões revigorantes estão quase no fim e os caldeirões precisam de ervas frescas colhidas nos campos.\n\nSe você me trouxer 3 Ervas Verdes dos arbustos da vila ou planícies, recompensarei você com 50 Moedas de Ouro, 35 XP e uma Poção de Vida Reforçada da adega!'
      );
      this.npcDialogRewardText.setText('» Objetivo: Entregar 3 Ervas Verdes (herb_green)\n★ Recompensa: +50 Gold, +35 XP & +1 Poção de Vida Reforçada');
      this.npcDialogBtnText.setText('Aceitar Missão de Coleta');
      this.onDialogActionCallback = () => {
        SoundEffects.getInstance().playUiClick();
        const worldScene = this.scene.get('WorldScene');
        worldScene.events.emit('request-quest-action', {
          questId: 'quest_tavern_supplies',
          npcId: 'npc_tavern',
          action: 'START'
        });
        this.closeNpcDialog();
      };
    } else if (quest.step === 1) {
      const herbCount = getItemCount(this.player?.playerData?.inventory || [], 'herb_green');
      if (herbCount < 3) {
        this.npcDialogSpeechText.setText(
          `Hum, você tem apenas ${herbCount}/3 Ervas Verdes na sua bolsa. Lembre-se: os arbustos verdejantes crescem perto das cercas da vila e nos descampados das planícies. Aproxime-se e pressione [F] para colher!`
        );
        this.npcDialogRewardText.setText(`» Em Andamento: Ervas no Inventário (${herbCount}/3)`);
        this.npcDialogBtnText.setText('Vou procurar nos arbustos');
        this.onDialogActionCallback = () => {
          SoundEffects.getInstance().playUiClick();
          this.closeNpcDialog();
        };
      } else {
        this.npcDialogSpeechText.setText(
          'Ah, que perfume revigorante! Vejo que você reuniu 3 Ervas Verdes bem frescas. Isso será perfeito para preparar novas poções para os viajantes!\n\nEntregue os materiais e receba sua justa recompensa da Taverna!'
        );
        this.npcDialogRewardText.setText('» Pronto para Entrega: 3 Ervas Verdes!\n★ Recompensa: +50 Gold, +35 XP & +1 Poção de Vida Reforçada!');
        this.npcDialogBtnText.setText('Entregar Ervas & Receber Recompensa');
        this.onDialogActionCallback = () => {
          SoundEffects.getInstance().playUiClick();
          const worldScene = this.scene.get('WorldScene');
          worldScene.events.emit('request-quest-action', {
            questId: 'quest_tavern_supplies',
            npcId: 'npc_tavern',
            action: 'COMPLETE'
          });
          this.closeNpcDialog();
        };
      }
    } else {
      const pending = this.player?.playerData?.pendingRewards;
      if (pending && pending.length > 0) {
        const totalPending = pending.reduce((sum: number, r: PendingRewardItem) => sum + r.quantity, 0);
        this.npcDialogSpeechText.setText(
          `Olá amigo! Ainda temos ${totalPending} suprimento(s) guardados para você. Libere espaço na mochila e resgate-os quando quiser!`
        );
        this.npcDialogRewardText.setText(`🎁 ${pending.length} pacote(s) de suprimentos guardados`);
        this.npcDialogBtnText.setText('Resgatar Suprimentos');
        this.onDialogActionCallback = () => {
          SoundEffects.getInstance().playItemPickup();
          const worldScene = this.scene.get('WorldScene');
          worldScene.events.emit('claim-pending-rewards');
          this.closeNpcDialog();
        };
      } else {
        this.npcDialogSpeechText.setText(
          'Suas ervas deram origem às melhores infusões que esta taverna já serviu! Se precisar de descanso ou de um bom gole, o balcão está sempre à sua disposição, amigo!'
        );
        this.npcDialogRewardText.setText('★ Suprimentos da Taverna Entregues com Sucesso!');
        this.npcDialogBtnText.setText('Saúde, Tobin!');
        this.onDialogActionCallback = () => {
          SoundEffects.getInstance().playUiClick();
          this.closeNpcDialog();
        };
      }
    }
  }

  public closeNpcDialog(): void {
    this.isNpcDialogOpen = false;
    this.npcDialogContainer.setVisible(false);
    this.activeNpcId = null;
    this.onDialogActionCallback = null;
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

    // Banner de recompensas pendentes dentro do inventário
    this.pendingInvBanner = this.add.container(200, 142);
    this.pendingInvBanner.setVisible(false);

    const bannerBg = this.add.graphics();
    bannerBg.fillStyle(0x78350f, 0.95);
    bannerBg.lineStyle(1, 0xf59e0b, 1);
    bannerBg.fillRoundedRect(0, 0, 140, 22, 3);
    bannerBg.strokeRoundedRect(0, 0, 140, 22, 3);

    this.pendingInvText = this.add.text(8, 6, '🎁 Guardados: 0 itens', {
      fontFamily: 'monospace',
      fontSize: '6px',
      color: '#fef08a',
      fontStyle: 'bold'
    });

    const claimBtnBg = this.add.graphics();
    claimBtnBg.fillStyle(0x166534, 1);
    claimBtnBg.fillRoundedRect(92, 3, 44, 16, 2);

    const claimBtnText = this.add
      .text(114, 11, 'Resgatar', {
        fontFamily: 'monospace',
        fontSize: '6px',
        color: '#ffffff',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    const claimHit = this.add.zone(114, 11, 44, 16).setInteractive({ useHandCursor: true });
    claimHit.on('pointerdown', () => {
      SoundEffects.getInstance().playItemPickup();
      const worldScene = this.scene.get('WorldScene');
      worldScene.events.emit('claim-pending-rewards');
    });

    this.pendingInvBanner.add([bannerBg, this.pendingInvText, claimBtnBg, claimBtnText, claimHit]);
    this.inventoryContainer.add(this.pendingInvBanner);
  }

  // --- MODAL DE CRAFTING ---

  private createCraftingModal(): void {
    this.craftingContainer = this.add.container(60, 20);
    this.craftingContainer.setVisible(false);
    this.craftingContainer.setDepth(10000);

    const bg = this.add.graphics();
    bg.fillStyle(0x0f172a, 0.95);
    bg.lineStyle(2, 0xf59e0b, 1);
    bg.fillRoundedRect(0, 0, 360, 225, 6);
    bg.strokeRoundedRect(0, 0, 360, 225, 6);
    this.craftingContainer.add(bg);

    const title = this.add.text(14, 8, 'FORJA & BANCADA DE ALQUIMIA', {
      fontFamily: 'monospace',
      fontSize: '8.5px',
      color: '#f59e0b',
      fontStyle: 'bold'
    });
    this.craftingContainer.add(title);

    const closeBtn = this.add
      .text(340, 8, 'X', {
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
    const startY = 24;

    CRAFTING_RECIPES.forEach((recipe, idx) => {
      const y = startY + idx * 28;

      const itemDef = ITEM_DEFINITIONS[recipe.resultItemId];
      const iconKey = itemDef?.iconKey || 'item_drop_bag';

      const icon = this.add.sprite(20, y + 10, iconKey).setDisplaySize(14, 14);

      const isAlchemy = recipe.category === ItemCategory.CONSUMABLE;
      const tag = isAlchemy ? '[Alquimia] ' : '[Forja] ';
      const tagColor = isAlchemy ? '#34d399' : '#f59e0b';

      const nameText = this.add.text(32, y + 2, `${tag}${recipe.name}`, {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: isAlchemy ? '#a7f3d0' : '#fef08a',
        fontStyle: 'bold'
      });

      // Ingredientes necessários
      const ingredientsDesc = recipe.ingredients
        .map(ing => {
          const ingDef = ITEM_DEFINITIONS[ing.itemId];
          return `${ingDef?.name || ing.itemId}: ${ing.quantity}x`;
        })
        .join(' | ');

      const matText = this.add.text(32, y + 13, ingredientsDesc, {
        fontFamily: 'monospace',
        fontSize: '5.5px',
        color: '#94a3b8'
      });

      // Checa se o jogador possui os ingredientes
      const hasMats = this.player?.playerData?.inventory ? hasIngredients(this.player.playerData.inventory, recipe.ingredients) : false;

      // Botão Fabricar com estado visual reativo
      const craftBtnBg = this.add.graphics();
      craftBtnBg.fillStyle(hasMats ? 0x166534 : 0x334155, 1);
      craftBtnBg.fillRoundedRect(280, y + 4, 60, 15, 3);

      const craftBtnText = this.add
        .text(310, y + 11.5, hasMats ? 'Fabricar' : 'Faltam Itens', {
          fontFamily: 'monospace',
          fontSize: '6.5px',
          color: hasMats ? '#ffffff' : '#94a3b8',
          fontStyle: 'bold'
        })
        .setOrigin(0.5);

      const hitZone = this.add
        .zone(310, y + 11.5, 60, 15)
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

    this.updatePendingRewardsUI();
  }

  private refreshCraftingUI(): void {
    // Reavalia estado quando o painel for aberto
  }

  private updateStatusBars(): void {
    if (!this.sys || !this.sys.isActive() || !this.player || !this.player.playerData) return;
    const data = this.player.playerData;
    const attrs = data.attributes;

    this.classLevelText.setText(`${data.characterClass.toUpperCase()}  Lv.${data.level}  •  🪙 ${data.gold}`);

    if (this.activeTitleHudText) {
      if (data.activeTitle && TITLE_DEFINITIONS[data.activeTitle]) {
        const def = TITLE_DEFINITIONS[data.activeTitle];
        this.activeTitleHudText.setText(`<${def.name}>`);
        if (def.color) this.activeTitleHudText.setColor(def.color);
        this.activeTitleHudText.setVisible(true);
      } else {
        this.activeTitleHudText.setVisible(false);
      }
    }

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

  private createPendingRewardsBadge(): void {
    this.pendingBadgeContainer = this.add.container(240, 26);
    this.pendingBadgeContainer.setDepth(600);
    this.pendingBadgeContainer.setVisible(false);

    const bg = this.add.graphics();
    bg.fillStyle(0x78350f, 0.95);
    bg.lineStyle(1, 0xf59e0b, 1);
    bg.fillRoundedRect(-100, -10, 200, 20, 4);
    bg.strokeRoundedRect(-100, -10, 200, 20, 4);

    this.pendingBadgeText = this.add
      .text(0, 0, '🎁 Recompensas Pendentes! [Clique]', {
        fontFamily: 'monospace',
        fontSize: '6.5px',
        color: '#fef08a',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);

    const hit = this.add.zone(0, 0, 200, 20).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      SoundEffects.getInstance().playItemPickup();
      const worldScene = this.scene.get('WorldScene');
      worldScene.events.emit('claim-pending-rewards');
    });

    this.pendingBadgeContainer.add([bg, this.pendingBadgeText, hit]);
  }

  private updatePendingRewardsUI(): void {
    if (!this.sys || !this.sys.isActive() || !this.player || !this.player.playerData) return;
    const pending = this.player.playerData.pendingRewards || [];
    const hasPending = pending.length > 0;

    if (this.pendingBadgeContainer && this.pendingBadgeText) {
      if (hasPending) {
        const totalItems = pending.reduce((sum: number, it: PendingRewardItem) => sum + it.quantity, 0);
        this.pendingBadgeText.setText(`🎁 ${totalItems} Recompensa(s) Guardada(s)! [Resgatar]`);
        this.pendingBadgeContainer.setVisible(true);
      } else {
        this.pendingBadgeContainer.setVisible(false);
      }
    }

    if (this.pendingInvBanner && this.pendingInvText) {
      if (hasPending) {
        const totalItems = pending.reduce((sum: number, it: PendingRewardItem) => sum + it.quantity, 0);
        this.pendingInvText.setText(`🎁 Guardados: ${totalItems} itens`);
        this.pendingInvBanner.setVisible(true);
      } else {
        this.pendingInvBanner.setVisible(false);
      }
    }
  }

  // --- MODAL DE CONQUISTAS & TÍTULOS HONORÍFICOS ---

  private createAchievementsModal(): void {
    this.achievementsContainer = this.add.container(40, 25);
    this.achievementsContainer.setVisible(false);
    this.achievementsContainer.setDepth(11000);

    // 1. Fundo do painel
    const bg = this.add.graphics();
    bg.fillStyle(0x0c0a17, 0.96);
    bg.lineStyle(2, 0x4338ca, 1);
    bg.fillRoundedRect(0, 0, 400, 230, 6);
    bg.strokeRoundedRect(0, 0, 400, 230, 6);

    // Linha dourada ornamental superior
    bg.lineStyle(1, 0xf59e0b, 0.8);
    bg.strokeRoundedRect(2, 2, 396, 226, 5);
    this.achievementsContainer.add(bg);

    // 2. Cabeçalho
    const icon = this.add.sprite(18, 14, 'icon_trophy').setDisplaySize(14, 14);
    const title = this.add.text(30, 10, 'CONQUISTAS & TÍTULOS DE AETHELGARD', {
      fontFamily: 'monospace',
      fontSize: '8.5px',
      color: '#facc15',
      fontStyle: 'bold'
    });

    const closeBtn = this.add.text(384, 8, 'X', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ef4444',
      fontStyle: 'bold'
    }).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.toggleAchievements(false));

    this.achievementsContainer.add([icon, title, closeBtn]);

    // 3. Seção Superior: Títulos Honoríficos
    const titleBoxBg = this.add.graphics();
    titleBoxBg.fillStyle(0x131127, 0.9);
    titleBoxBg.lineStyle(1, 0x3730a3, 0.8);
    titleBoxBg.fillRoundedRect(8, 24, 384, 44, 4);
    titleBoxBg.strokeRoundedRect(8, 24, 384, 44, 4);
    this.achievementsContainer.add(titleBoxBg);

    const titleHeader = this.add.text(14, 28, 'TÍTULO ATIVO:', {
      fontFamily: 'monospace',
      fontSize: '6.5px',
      color: '#94a3b8',
      fontStyle: 'bold'
    });

    this.activeTitleModalText = this.add.text(78, 28, '<Nenhum Título Equipado>', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#e2e8f0',
      fontStyle: 'bold'
    });

    this.titlesButtonsContainer = this.add.container(14, 42);
    this.achievementsContainer.add([titleHeader, this.activeTitleModalText, this.titlesButtonsContainer]);

    // 4. Seção Inferior: Lista de Conquistas
    const listHeader = this.add.text(14, 72, 'FAÇANHAS & DESAFIOS (0/12):', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#cbd5e1',
      fontStyle: 'bold'
    });
    this.achievementsContainer.add(listHeader);

    this.achievementsListContainer = this.add.container(8, 84);
    this.achievementsContainer.add(this.achievementsListContainer);
  }

  public toggleAchievements(open?: boolean): void {
    const nextState = open !== undefined ? open : !this.isAchievementsOpen;
    this.isAchievementsOpen = nextState;
    this.achievementsContainer.setVisible(nextState);

    if (nextState) {
      if (this.isInventoryOpen) this.toggleInventory(false);
      if (this.isCraftingOpen) this.toggleCrafting(false);
      if (this.isNpcDialogOpen) this.closeNpcDialog();
      SoundEffects.getInstance().playUiClick();

      const worldScene = this.scene.get('WorldScene');
      worldScene.events.emit('request-get-achievements');
    }
  }

  public updateAchievementsUI(payload: S2C_AchievementsUpdatePayload): void {
    this.achievementsData = payload;
    if (!this.achievementsContainer) return;

    // 1. Atualiza Título Ativo
    if (this.activeTitleModalText) {
      if (payload.activeTitle && TITLE_DEFINITIONS[payload.activeTitle]) {
        const def = TITLE_DEFINITIONS[payload.activeTitle];
        this.activeTitleModalText.setText(`<${def.name}>`);
        if (def.color) this.activeTitleModalText.setColor(def.color);
      } else {
        this.activeTitleModalText.setText('<Nenhum Título Equipado>');
        this.activeTitleModalText.setColor('#94a3b8');
      }
    }

    // 2. Atualiza Botões de Títulos Desbloqueados
    this.titlesButtonsContainer.removeAll(true);
    let titleBtnX = 0;

    // Botão de Desequipar (se tiver título ativo)
    if (payload.activeTitle) {
      const unequipBtn = this.add.graphics();
      unequipBtn.fillStyle(0x3f1212, 1);
      unequipBtn.lineStyle(1, 0xef4444, 1);
      unequipBtn.fillRoundedRect(titleBtnX, 0, 52, 18, 3);
      unequipBtn.strokeRoundedRect(titleBtnX, 0, 52, 18, 3);

      const unequipTxt = this.add.text(titleBtnX + 26, 9, 'Desequipar', {
        fontFamily: 'monospace',
        fontSize: '5.5px',
        color: '#fca5a5'
      }).setOrigin(0.5);

      const unequipHit = this.add.zone(titleBtnX + 26, 9, 52, 18).setInteractive({ useHandCursor: true });
      unequipHit.on('pointerdown', () => {
        SoundEffects.getInstance().playUiClick();
        const worldScene = this.scene.get('WorldScene');
        worldScene.events.emit('request-equip-title', { titleId: null });
      });

      this.titlesButtonsContainer.add([unequipBtn, unequipTxt, unequipHit]);
      titleBtnX += 58;
    }

    if (payload.unlockedTitles.length === 0 && !payload.activeTitle) {
      const emptyTitlesText = this.add.text(0, 4, 'Complete conquistas para desbloquear títulos honoríficos!', {
        fontFamily: 'monospace',
        fontSize: '6px',
        color: '#64748b'
      });
      this.titlesButtonsContainer.add(emptyTitlesText);
    } else {
      payload.unlockedTitles.forEach((tId: string) => {
        const titleDef = TITLE_DEFINITIONS[tId];
        if (!titleDef) return;

        const isEquipped = payload.activeTitle === tId;
        const btnW = Math.max(50, titleDef.name.length * 5.2 + 10);

        const btnBg = this.add.graphics();
        btnBg.fillStyle(isEquipped ? 0x064e3b : 0x1e1b4b, 1);
        btnBg.lineStyle(1, isEquipped ? 0x10b981 : 0x6366f1, 1);
        btnBg.fillRoundedRect(titleBtnX, 0, btnW, 18, 3);
        btnBg.strokeRoundedRect(titleBtnX, 0, btnW, 18, 3);

        const btnTxt = this.add.text(titleBtnX + btnW / 2, 9, isEquipped ? `✓ ${titleDef.name}` : titleDef.name, {
          fontFamily: 'monospace',
          fontSize: '5.5px',
          color: isEquipped ? '#a7f3d0' : (titleDef.color || '#cbd5e1'),
          fontStyle: isEquipped ? 'bold' : 'normal'
        }).setOrigin(0.5);

        const hit = this.add.zone(titleBtnX + btnW / 2, 9, btnW, 18).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => {
          SoundEffects.getInstance().playUiClick();
          const worldScene = this.scene.get('WorldScene');
          worldScene.events.emit('request-equip-title', { titleId: isEquipped ? null : tId });
        });

        hit.on('pointerover', () => {
          this.showActionTooltip(titleDef.name, `${titleDef.description}\nClique para ${isEquipped ? 'desequipar' : 'equipar'} este título.`, 200, 80);
        });
        hit.on('pointerout', () => this.hideTooltip());

        this.titlesButtonsContainer.add([btnBg, btnTxt, hit]);
        titleBtnX += btnW + 5;
      });
    }

    // 3. Atualiza Lista de Conquistas (Grade 2 Colunas x 6 Linhas)
    this.achievementsListContainer.removeAll(true);

    const colWidth = 188;
    const cardHeight = 22;
    const paddingX = 8;
    const paddingY = 2;

    const list = Object.values(payload.achievements || {});
    list.forEach((ach: AchievementProgress, idx: number) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = col * (colWidth + paddingX);
      const y = row * (cardHeight + paddingY);

      const def = (ACHIEVEMENT_DEFINITIONS as any)[ach.achievementId];
      const achName = def?.title || ach.achievementId;
      const achDesc = def?.description || '';

      const cardBg = this.add.graphics();
      cardBg.fillStyle(ach.completed ? 0x0f291e : 0x131124, 0.95);
      cardBg.lineStyle(1, ach.completed ? 0x059669 : 0x334155, 0.9);
      cardBg.fillRoundedRect(x, y, colWidth, cardHeight, 3);
      cardBg.strokeRoundedRect(x, y, colWidth, cardHeight, 3);

      // Nome da Conquista
      const nameTxt = this.add.text(x + 5, y + 2, achName, {
        fontFamily: 'monospace',
        fontSize: '6px',
        color: ach.completed ? '#34d399' : '#94a3b8',
        fontStyle: 'bold'
      });

      // Progresso numérico
      const progressLabel = ach.completed ? '[OK]' : `${ach.currentProgress}/${ach.targetProgress}`;
      const progTxt = this.add.text(x + colWidth - 5, y + 2, progressLabel, {
        fontFamily: 'monospace',
        fontSize: '5.5px',
        color: ach.completed ? '#10b981' : '#cbd5e1'
      }).setOrigin(1, 0);

      // Barra de progresso visual
      const barBg = this.add.graphics();
      barBg.fillStyle(0x1e293b, 1);
      barBg.fillRect(x + 5, y + 10, 110, 3);

      const ratio = Math.min(1, ach.currentProgress / (ach.targetProgress || 1));
      if (ratio > 0) {
        barBg.fillStyle(ach.completed ? 0x10b981 : 0x38bdf8, 1);
        barBg.fillRect(x + 5, y + 10, Math.round(110 * ratio), 3);
      }

      // Descrição sucinta
      const descTxt = this.add.text(x + 5, y + 14, achDesc.length > 36 ? achDesc.slice(0, 34) + '..' : achDesc, {
        fontFamily: 'monospace',
        fontSize: '5px',
        color: '#64748b'
      });

      this.achievementsListContainer.add([cardBg, nameTxt, progTxt, barBg, descTxt]);

      // Botão ou tag de Resgate de Recompensa
      if (ach.completed) {
        if (!ach.rewardClaimed) {
          const claimBtnBg = this.add.graphics();
          claimBtnBg.fillStyle(0x78350f, 1);
          claimBtnBg.lineStyle(1, 0xf59e0b, 1);
          claimBtnBg.fillRoundedRect(x + 120, y + 9, 63, 10, 2);
          claimBtnBg.strokeRoundedRect(x + 120, y + 9, 63, 10, 2);

          const claimTxt = this.add.text(x + 151, y + 14, '★ Resgatar', {
            fontFamily: 'monospace',
            fontSize: '5.5px',
            color: '#fef08a',
            fontStyle: 'bold'
          }).setOrigin(0.5);

          const claimHit = this.add.zone(x + 151, y + 14, 63, 10).setInteractive({ useHandCursor: true });
          claimHit.on('pointerdown', () => {
            SoundEffects.getInstance().playItemPickup();
            const worldScene = this.scene.get('WorldScene');
            worldScene.events.emit('request-claim-achievement-reward', { achievementId: ach.achievementId });
          });

          this.achievementsListContainer.add([claimBtnBg, claimTxt, claimHit]);
        } else {
          const claimedTxt = this.add.text(x + 151, y + 14, '✓ Resgatado', {
            fontFamily: 'monospace',
            fontSize: '5px',
            color: '#059669'
          }).setOrigin(0.5);
          this.achievementsListContainer.add(claimedTxt);
        }
      }
    });
  }

  // --- POPUP TOAST DE NOTIFICAÇÃO DE CONQUISTA DESBLOQUEADA ---

  private createToastNotification(): void {
    this.toastContainer = this.add.container(240, -40);
    this.toastContainer.setDepth(20000);
    this.toastContainer.setVisible(false);

    const bg = this.add.graphics();
    bg.fillStyle(0x0f172a, 0.96);
    bg.lineStyle(1, 0xf59e0b, 1);
    bg.fillRoundedRect(-110, -14, 220, 28, 5);
    bg.strokeRoundedRect(-110, -14, 220, 28, 5);
    this.toastContainer.add(bg);

    const trophy = this.add.sprite(-95, 0, 'icon_trophy').setDisplaySize(14, 14);
    const label = this.add.text(-82, -8, '★ CONQUISTA DESBLOQUEADA!', {
      fontFamily: 'monospace',
      fontSize: '6.5px',
      color: '#f59e0b',
      fontStyle: 'bold'
    });

    this.toastTitleText = this.add.text(-82, 2, '', {
      fontFamily: 'monospace',
      fontSize: '7.5px',
      color: '#34d399',
      fontStyle: 'bold'
    });

    this.toastContainer.add([trophy, label, this.toastTitleText]);
  }

  public showAchievementToast(achievementName: string): void {
    if (!this.toastContainer || !this.toastTitleText) return;

    SoundEffects.getInstance().playLevelUp();
    this.toastTitleText.setText(achievementName);
    this.toastContainer.setVisible(true);
    this.toastContainer.setAlpha(0);
    this.toastContainer.setY(-40);

    this.tweens.killTweensOf(this.toastContainer);

    this.tweens.add({
      targets: this.toastContainer,
      y: 32,
      alpha: 1,
      duration: 350,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(3000, () => {
          if (!this.toastContainer) return;
          this.tweens.add({
            targets: this.toastContainer,
            y: -40,
            alpha: 0,
            duration: 350,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              if (this.toastContainer) this.toastContainer.setVisible(false);
            }
          });
        });
      }
    });
  }
}
