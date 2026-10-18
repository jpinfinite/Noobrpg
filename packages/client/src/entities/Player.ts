import Phaser from 'phaser';
import {
  CharacterClass,
  Direction,
  PlayerData,
  EquipmentSlot,
  CLASS_COMBAT_CONFIG,
  ITEM_DEFINITIONS,
  createEmptyInventory,
  addItemToInventory,
  removeItemFromSlot,
  calculateTotalPlayerAttributes,
  evaluateLevelProgression,
  calculateDamage,
  calculateDistance,
  normalizeVector,
  executeCrafting
} from '@noobrpg/shared';
import { Monster } from './Monster.js';

export class Player extends Phaser.Physics.Arcade.Sprite {
  public playerData: PlayerData;
  public isDead: boolean = false;
  public isInvulnerable: boolean = false;
  public isInteractDown: boolean = false;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private actionKeys!: {
    attack: Phaser.Input.Keyboard.Key;
    skill1: Phaser.Input.Keyboard.Key;
    interact: Phaser.Input.Keyboard.Key;
    inventory: Phaser.Input.Keyboard.Key;
    crafting: Phaser.Input.Keyboard.Key;
    class1: Phaser.Input.Keyboard.Key;
    class2: Phaser.Input.Keyboard.Key;
    class3: Phaser.Input.Keyboard.Key;
    class4: Phaser.Input.Keyboard.Key;
  };

  private currentDirection: Direction = Direction.DOWN;
  private lastAttackTime: number = 0;
  private lastSkill1Time: number = 0;
  private respawnPoint = { x: 180, y: 160 };

  constructor(scene: Phaser.Scene, x: number, y: number, characterClass: CharacterClass = CharacterClass.WARRIOR) {
    const textureKey = Player.getTextureKeyForClass(characterClass);
    super(scene, x, y, textureKey, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Inicializa o inventário de 24 slots e equipamentos vazios
    const inventory = createEmptyInventory();
    const equipped = {
      weapon: null,
      armor: null,
      accessory: null
    };

    // Itens iniciais de teste para demonstrar a Fase 3
    addItemToInventory(inventory, 'pickaxe_copper', 1);
    addItemToInventory(inventory, 'potion_hp_minor', 3);
    addItemToInventory(inventory, 'herb_green', 4);
    addItemToInventory(inventory, 'slime_gel', 2);
    addItemToInventory(inventory, 'iron_ore', 6);
    addItemToInventory(inventory, 'wood_log', 4);

    const initialAttrs = calculateTotalPlayerAttributes(characterClass, 1, equipped);
    this.playerData = {
      id: 'local_player_1',
      name: 'HeroiIniciante',
      characterClass,
      level: 1,
      currentXp: 0,
      gold: 100,
      meritPoints: 0,
      attributes: { ...initialAttrs },
      position: { x, y },
      direction: Direction.DOWN,
      inventory,
      equipped
    };

    this.respawnPoint = { x, y };
    this.initPhysics();
    this.initInput();
  }

  private static getTextureKeyForClass(c: CharacterClass): string {
    switch (c) {
      case CharacterClass.WARRIOR:
        return 'hero_warrior';
      case CharacterClass.RANGER:
        return 'hero_ranger';
      case CharacterClass.MAGE:
        return 'hero_mage';
      case CharacterClass.DRUID:
        return 'hero_druid';
    }
  }

  private initPhysics(): void {
    this.setOrigin(0.5, 0.85);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(12, 8);
    body.setOffset(2, 16);
    body.setCollideWorldBounds(true);
  }

  private initInput(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;

    this.cursors = keyboard.createCursorKeys();
    this.wasdKeys = {
      W: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };

    this.actionKeys = {
      attack: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      skill1: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      interact: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      inventory: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I),
      crafting: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C),
      class1: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      class2: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      class3: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      class4: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR)
    };
  }

  public updatePlayer(time: number, monsters: Monster[]): void {
    if (this.isDead) return;

    this.handleMovement();
    this.handleCombatInputs(time, monsters);
    this.handleClassSwitchInputs();
    this.handleInterfaceToggles();

    this.isInteractDown = this.actionKeys.interact.isDown;

    this.setDepth(this.y);
    this.playerData.position.x = Math.round(this.x);
    this.playerData.position.y = Math.round(this.y);
    this.playerData.direction = this.currentDirection;
  }

  private handleMovement(): void {
    let inputX = 0;
    let inputY = 0;

    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) inputX -= 1;
    if (this.cursors.right.isDown || this.wasdKeys.D.isDown) inputX += 1;
    if (this.cursors.up.isDown || this.wasdKeys.W.isDown) inputY -= 1;
    if (this.cursors.down.isDown || this.wasdKeys.S.isDown) inputY += 1;

    const normalized = normalizeVector(inputX, inputY);
    const speed = this.playerData.attributes.speed;

    this.setVelocity(normalized.x * speed, normalized.y * speed);

    const isMoving = inputX !== 0 || inputY !== 0;
    const animPrefix = 'hero';

    if (isMoving) {
      if (inputY > 0) {
        this.currentDirection = Direction.DOWN;
        this.setFlipX(false);
        this.anims.play(`${animPrefix}_walk_down`, true);
      } else if (inputY < 0) {
        this.currentDirection = Direction.UP;
        this.setFlipX(false);
        this.anims.play(`${animPrefix}_walk_up`, true);
      } else if (inputX > 0) {
        this.currentDirection = Direction.RIGHT;
        this.setFlipX(false);
        this.anims.play(`${animPrefix}_walk_right`, true);
      } else if (inputX < 0) {
        this.currentDirection = Direction.LEFT;
        this.setFlipX(true);
        this.anims.play(`${animPrefix}_walk_right`, true);
      }
    } else {
      if (this.currentDirection === Direction.DOWN) {
        this.setFlipX(false);
        this.anims.play(`${animPrefix}_idle_down`, true);
      } else if (this.currentDirection === Direction.UP) {
        this.setFlipX(false);
        this.anims.play(`${animPrefix}_idle_up`, true);
      } else if (this.currentDirection === Direction.RIGHT) {
        this.setFlipX(false);
        this.anims.play(`${animPrefix}_idle_right`, true);
      } else if (this.currentDirection === Direction.LEFT) {
        this.setFlipX(true);
        this.anims.play(`${animPrefix}_idle_right`, true);
      }
    }
  }

  private handleCombatInputs(time: number, monsters: Monster[]): void {
    const combatConfig = CLASS_COMBAT_CONFIG[this.playerData.characterClass];

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.attack)) {
      if (time - this.lastAttackTime >= combatConfig.attackCooldownMs) {
        this.lastAttackTime = time;
        this.executeBasicAttack(monsters, combatConfig.attackRange);
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.skill1)) {
      if (time - this.lastSkill1Time >= combatConfig.skill1CooldownMs) {
        if (this.playerData.attributes.currentMp >= combatConfig.skill1CostMp) {
          this.lastSkill1Time = time;
          this.playerData.attributes.currentMp -= combatConfig.skill1CostMp;
          this.executeSkill1(monsters);
        } else {
          this.scene.events.emit('floating-text', {
            x: this.x,
            y: this.y - 20,
            text: 'Sem Mana!',
            color: '#38bdf8'
          });
        }
      }
    }
  }

  private handleInterfaceToggles(): void {
    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.inventory)) {
      this.scene.events.emit('toggle-inventory');
    }
    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.crafting)) {
      this.scene.events.emit('toggle-crafting');
    }
  }

  private executeBasicAttack(monsters: Monster[], attackRange: number): void {
    const attackOffset = this.getDirectionOffset(20);
    const fx = this.scene.add.sprite(this.x + attackOffset.x, this.y + attackOffset.y, 'fx_slash');
    fx.setDepth(this.depth + 2);
    this.scene.time.delayedCall(150, () => fx.destroy());

    let closestTarget: Monster | null = null;
    let minDistance = attackRange;

    for (const mob of monsters) {
      if (!mob.active || !mob.visible || mob.currentHp <= 0) continue;
      const dist = calculateDistance(this.x, this.y, mob.x, mob.y);
      if (dist <= attackRange && dist < minDistance) {
        minDistance = dist;
        closestTarget = mob;
      }
    }

    if (closestTarget) {
      const damage = calculateDamage(this.playerData.attributes.attack, closestTarget.monsterConfig.defense);
      const result = closestTarget.takeDamage(damage);

      this.scene.events.emit('floating-text', {
        x: closestTarget.x,
        y: closestTarget.y - 15,
        text: `-${damage}`,
        color: '#ffffff'
      });

      if (result.isDead && result.xpReward > 0) {
        this.gainXp(result.xpReward);
        this.playerData.gold += result.goldReward;
        this.scene.events.emit('floating-text', {
          x: closestTarget.x,
          y: closestTarget.y - 30,
          text: `+${result.xpReward} XP  +${result.goldReward} Gold`,
          color: '#facc15'
        });

        // Dispara sorteio de loot físico no chão
        this.scene.events.emit('spawn-monster-loot', {
          x: closestTarget.x,
          y: closestTarget.y,
          lootTable: closestTarget.monsterConfig.lootTable
        });
      }
    }
  }

  private executeSkill1(monsters: Monster[]): void {
    const charClass = this.playerData.characterClass;

    if (charClass === CharacterClass.DRUID) {
      const healAmount = 35;
      this.playerData.attributes.currentHp = Math.min(
        this.playerData.attributes.maxHp,
        this.playerData.attributes.currentHp + healAmount
      );
      this.scene.events.emit('floating-text', {
        x: this.x,
        y: this.y - 25,
        text: `+${healAmount} HP`,
        color: '#22c55e'
      });
      return;
    }

    const multiplier = charClass === CharacterClass.RANGER ? 1.8 : 1.5;
    const range = charClass === CharacterClass.WARRIOR ? 36 : 140;

    let target: Monster | null = null;
    let minDistance = range;

    for (const mob of monsters) {
      if (!mob.active || !mob.visible || mob.currentHp <= 0) continue;
      const dist = calculateDistance(this.x, this.y, mob.x, mob.y);
      if (dist <= range && dist < minDistance) {
        minDistance = dist;
        target = mob;
      }
    }

    if (target) {
      const rawAtk = Math.round(this.playerData.attributes.attack * multiplier);
      const damage = calculateDamage(rawAtk, target.monsterConfig.defense);
      const result = target.takeDamage(damage);

      this.scene.events.emit('floating-text', {
        x: target.x,
        y: target.y - 20,
        text: `CRÍTICO! -${damage}`,
        color: '#facc15'
      });

      if (result.isDead && result.xpReward > 0) {
        this.gainXp(result.xpReward);
        this.playerData.gold += result.goldReward;
        this.scene.events.emit('spawn-monster-loot', {
          x: target.x,
          y: target.y,
          lootTable: target.monsterConfig.lootTable
        });
      }
    }
  }

  private getDirectionOffset(distance: number): { x: number; y: number } {
    switch (this.currentDirection) {
      case Direction.UP:
        return { x: 0, y: -distance };
      case Direction.DOWN:
        return { x: 0, y: distance };
      case Direction.LEFT:
        return { x: -distance, y: 0 };
      case Direction.RIGHT:
        return { x: distance, y: 0 };
      default:
        return { x: 0, y: distance };
    }
  }

  public takeDamage(amount: number, attacker: Monster): void {
    if (this.isDead || this.isInvulnerable) return;

    this.playerData.attributes.currentHp = Math.max(0, this.playerData.attributes.currentHp - amount);

    this.scene.events.emit('floating-text', {
      x: this.x,
      y: this.y - 25,
      text: `-${amount}`,
      color: '#ef4444'
    });

    this.setTint(0xff5555);
    this.scene.time.delayedCall(150, () => {
      if (this.active && !this.isDead) this.clearTint();
    });

    if (this.playerData.attributes.currentHp <= 0) {
      this.handleDeath();
    }
  }

  private handleDeath(): void {
    this.isDead = true;
    this.setVelocity(0, 0);
    this.setTint(0x555555);

    this.scene.events.emit('floating-text', {
      x: this.x,
      y: this.y - 30,
      text: 'DERROTADO!',
      color: '#ef4444'
    });

    this.scene.time.delayedCall(2500, () => {
      this.respawnAtTown();
    });
  }

  private respawnAtTown(): void {
    this.x = this.respawnPoint.x;
    this.y = this.respawnPoint.y;
    this.playerData.attributes.currentHp = this.playerData.attributes.maxHp;
    this.playerData.attributes.currentMp = this.playerData.attributes.maxMp;
    this.isDead = false;
    this.clearTint();

    this.isInvulnerable = true;
    this.setAlpha(0.6);

    this.scene.time.delayedCall(3000, () => {
      if (this.active) {
        this.isInvulnerable = false;
        this.setAlpha(1.0);
      }
    });
  }

  public gainXp(amount: number): void {
    this.playerData.currentXp += amount;
    const progression = evaluateLevelProgression(this.playerData.level, this.playerData.currentXp);

    if (progression.didLevelUp) {
      this.playerData.level = progression.newLevel;
      this.recalculateAttributes();

      this.scene.events.emit('floating-text', {
        x: this.x,
        y: this.y - 35,
        text: `★ LEVEL UP! NÍVEL ${this.playerData.level} ★`,
        color: '#facc15'
      });
    }

    this.scene.events.emit('player-updated', this.playerData);
  }

  private handleClassSwitchInputs(): void {
    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.class1)) {
      this.switchClass(CharacterClass.WARRIOR);
    } else if (Phaser.Input.Keyboard.JustDown(this.actionKeys.class2)) {
      this.switchClass(CharacterClass.RANGER);
    } else if (Phaser.Input.Keyboard.JustDown(this.actionKeys.class3)) {
      this.switchClass(CharacterClass.MAGE);
    } else if (Phaser.Input.Keyboard.JustDown(this.actionKeys.class4)) {
      this.switchClass(CharacterClass.DRUID);
    }
  }

  public switchClass(newClass: CharacterClass): void {
    if (this.playerData.characterClass === newClass) return;

    this.playerData.characterClass = newClass;
    this.recalculateAttributes();

    const textureKey = Player.getTextureKeyForClass(newClass);
    this.setTexture(textureKey, 0);

    this.scene.events.emit('floating-text', {
      x: this.x,
      y: this.y - 25,
      text: `CLASSE: ${newClass}`,
      color: '#38bdf8'
    });

    this.scene.events.emit('player-updated', this.playerData);
  }

  // --- MÉTODOS DE INVENTÁRIO, EQUIPAMENTOS E CRAFTING (FASE 3) ---

  public tryCollectItem(itemId: string, quantity: number): { success: boolean; added: number } {
    const result = addItemToInventory(this.playerData.inventory, itemId, quantity);
    if (result.addedQuantity > 0) {
      this.scene.events.emit('player-updated', this.playerData);
    }
    return { success: result.success, added: result.addedQuantity };
  }

  public equipItem(slotIndex: number): boolean {
    const slot = this.playerData.inventory[slotIndex];
    if (!slot) return false;

    const itemDef = ITEM_DEFINITIONS[slot.itemId];
    if (!itemDef || !itemDef.equipSlot) return false;

    // Validação de requisitos de nível e classe
    if (itemDef.requiredLevel && this.playerData.level < itemDef.requiredLevel) {
      this.scene.events.emit('floating-text', {
        x: this.x,
        y: this.y - 25,
        text: `Requer Nível ${itemDef.requiredLevel}!`,
        color: '#ef4444'
      });
      return false;
    }

    if (itemDef.requiredClass && this.playerData.characterClass !== itemDef.requiredClass) {
      this.scene.events.emit('floating-text', {
        x: this.x,
        y: this.y - 25,
        text: `Exclusivo para ${itemDef.requiredClass}!`,
        color: '#ef4444'
      });
      return false;
    }

    const targetSlotKey =
      itemDef.equipSlot === EquipmentSlot.WEAPON
        ? 'weapon'
        : itemDef.equipSlot === EquipmentSlot.ARMOR
        ? 'armor'
        : 'accessory';

    const currentEquipped = this.playerData.equipped[targetSlotKey];

    // Troca de item: coloca o anterior no inventário ou remove o item atual
    this.playerData.equipped[targetSlotKey] = slot.itemId;

    if (currentEquipped) {
      this.playerData.inventory[slotIndex] = {
        slotIndex,
        itemId: currentEquipped,
        quantity: 1
      };
    } else {
      this.playerData.inventory[slotIndex] = null;
    }

    this.recalculateAttributes();
    this.scene.events.emit('floating-text', {
      x: this.x,
      y: this.y - 25,
      text: `Equipado: ${itemDef.name}`,
      color: '#38bdf8'
    });
    this.scene.events.emit('player-updated', this.playerData);
    return true;
  }

  public unequipItem(slot: EquipmentSlot): boolean {
    const targetSlotKey =
      slot === EquipmentSlot.WEAPON ? 'weapon' : slot === EquipmentSlot.ARMOR ? 'armor' : 'accessory';

    const itemId = this.playerData.equipped[targetSlotKey];
    if (!itemId) return false;

    const addRes = addItemToInventory(this.playerData.inventory, itemId, 1);
    if (!addRes.success) {
      this.scene.events.emit('floating-text', {
        x: this.x,
        y: this.y - 25,
        text: 'Sem espaço no inventário!',
        color: '#ef4444'
      });
      return false;
    }

    this.playerData.equipped[targetSlotKey] = null;
    this.recalculateAttributes();
    this.scene.events.emit('player-updated', this.playerData);
    return true;
  }

  public useConsumable(slotIndex: number): boolean {
    const slot = this.playerData.inventory[slotIndex];
    if (!slot) return false;

    const itemDef = ITEM_DEFINITIONS[slot.itemId];
    if (!itemDef?.consumableEffect) return false;

    if (itemDef.consumableEffect.hpRestore) {
      const heal = itemDef.consumableEffect.hpRestore;
      this.playerData.attributes.currentHp = Math.min(
        this.playerData.attributes.maxHp,
        this.playerData.attributes.currentHp + heal
      );
      this.scene.events.emit('floating-text', {
        x: this.x,
        y: this.y - 25,
        text: `+${heal} HP`,
        color: '#22c55e'
      });
    }

    if (itemDef.consumableEffect.mpRestore) {
      const mana = itemDef.consumableEffect.mpRestore;
      this.playerData.attributes.currentMp = Math.min(
        this.playerData.attributes.maxMp,
        this.playerData.attributes.currentMp + mana
      );
      this.scene.events.emit('floating-text', {
        x: this.x,
        y: this.y - 25,
        text: `+${mana} MP`,
        color: '#0284c7'
      });
    }

    removeItemFromSlot(this.playerData.inventory, slotIndex, 1);
    this.scene.events.emit('player-updated', this.playerData);
    return true;
  }

  public dropItemFromInventory(slotIndex: number, quantity: number = 1): void {
    const slot = this.playerData.inventory[slotIndex];
    if (!slot) return;

    const toDrop = Math.min(slot.quantity, quantity);
    const itemId = slot.itemId;

    removeItemFromSlot(this.playerData.inventory, slotIndex, toDrop);

    // Spawna o item no chão próximo ao personagem
    this.scene.events.emit('spawn-ground-item', {
      x: this.x + (Math.random() * 20 - 10),
      y: this.y + (Math.random() * 20 - 10),
      itemId,
      quantity: toDrop
    });

    this.scene.events.emit('player-updated', this.playerData);
  }

  public craftItem(recipeId: string): boolean {
    const result = executeCrafting(this.playerData.inventory, recipeId, this.playerData.level);

    if (result.success && result.resultItemId) {
      const def = ITEM_DEFINITIONS[result.resultItemId];
      this.scene.events.emit('floating-text', {
        x: this.x,
        y: this.y - 30,
        text: `★ Forjado: ${def.name}!`,
        color: '#f59e0b'
      });
      this.scene.events.emit('player-updated', this.playerData);
      return true;
    } else {
      let reasonMsg = 'Falha no Crafting!';
      if (result.reason === 'MISSING_INGREDIENTS') reasonMsg = 'Materiais insuficientes!';
      if (result.reason === 'INVENTORY_FULL') reasonMsg = 'Inventário cheio!';
      if (result.reason === 'LEVEL_TOO_LOW') reasonMsg = 'Nível insuficiente!';

      this.scene.events.emit('floating-text', {
        x: this.x,
        y: this.y - 25,
        text: reasonMsg,
        color: '#ef4444'
      });
      return false;
    }
  }

  private recalculateAttributes(): void {
    const totalAttrs = calculateTotalPlayerAttributes(
      this.playerData.characterClass,
      this.playerData.level,
      this.playerData.equipped
    );

    // Mantém a proporção do HP/MP atual
    const hpRatio = this.playerData.attributes.currentHp / this.playerData.attributes.maxHp;
    const mpRatio = this.playerData.attributes.currentMp / this.playerData.attributes.maxMp;

    this.playerData.attributes = {
      ...totalAttrs,
      currentHp: Math.max(1, Math.round(totalAttrs.maxHp * hpRatio)),
      currentMp: Math.max(0, Math.round(totalAttrs.maxMp * mpRatio))
    };
  }
}
