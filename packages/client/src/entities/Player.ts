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
  public isVirtualInteractDown: boolean = false;

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
    potion: Phaser.Input.Keyboard.Key;
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
  private isAttackingAnim: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    characterClass: CharacterClass = CharacterClass.WARRIOR,
    initialData?: PlayerData
  ) {
    const finalClass = initialData?.characterClass || characterClass;
    const textureKey = Player.getTextureKeyForClass(finalClass);
    const startX = initialData?.position?.x || x;
    const startY = initialData?.position?.y || y;

    super(scene, startX, startY, textureKey, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    if (initialData) {
      this.playerData = { ...initialData };
    } else {
      // Inicializa o inventário de 24 slots e equipamentos vazios (fallback local)
      const inventory = createEmptyInventory();
      const equipped = {
        weapon: null,
        armor: null,
        accessory: null
      };

      addItemToInventory(inventory, 'pickaxe_copper', 1);
      addItemToInventory(inventory, 'potion_hp_minor', 3);
      addItemToInventory(inventory, 'herb_green', 4);
      addItemToInventory(inventory, 'slime_gel', 2);
      addItemToInventory(inventory, 'iron_ore', 6);
      addItemToInventory(inventory, 'wood_log', 4);

      const initialAttrs = calculateTotalPlayerAttributes(finalClass, 1, equipped);
      this.playerData = {
        id: 'local_player_1',
        name: 'HeroiIniciante',
        characterClass: finalClass,
        level: 1,
        currentXp: 0,
        gold: 100,
        meritPoints: 0,
        attributes: { ...initialAttrs },
        position: { x: startX, y: startY },
        direction: Direction.DOWN,
        inventory,
        equipped
      };
    }

    this.respawnPoint = { x: startX, y: startY };
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
    this.setOrigin(0.5, 1.0);
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
      potion: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
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
    this.handlePotionInput();
    this.handleClassSwitchInputs();
    this.handleInterfaceToggles();

    this.isInteractDown = this.actionKeys.interact.isDown || this.isVirtualInteractDown;

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
    const animPrefix = Player.getTextureKeyForClass(this.playerData.characterClass);

    // Se estiver no ciclo da animação de ataque, não sobrescreve a pose com walk ou idle
    if (this.isAttackingAnim) return;

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
        if (this.scene.anims.exists(`${animPrefix}_walk_left`)) {
          this.setFlipX(false);
          this.anims.play(`${animPrefix}_walk_left`, true);
        } else {
          this.setFlipX(true);
          this.anims.play(`${animPrefix}_walk_right`, true);
        }
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
        if (this.scene.anims.exists(`${animPrefix}_idle_left`)) {
          this.setFlipX(false);
          this.anims.play(`${animPrefix}_idle_left`, true);
        } else {
          this.setFlipX(true);
          this.anims.play(`${animPrefix}_idle_right`, true);
        }
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

  private handlePotionInput(): void {
    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.potion)) {
      this.useQuickPotion();
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

  /**
   * Executa animação procedural de ataque em 3 fases: Antecipação -> Ação -> Recuperação.
   */
  public playAttackVisual(targetX?: number, targetY?: number, isSkill: boolean = false): void {
    if (this.isAttackingAnim) return;
    this.isAttackingAnim = true;

    const charClass = this.playerData.characterClass;

    // Atualiza direção para olhar para o alvo se houver
    if (targetX !== undefined && targetY !== undefined) {
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.currentDirection = dx > 0 ? Direction.RIGHT : Direction.LEFT;
      } else {
        this.currentDirection = dy > 0 ? Direction.DOWN : Direction.UP;
      }
    }

    const dirOffset = this.getDirectionOffset(3);
    const animPrefix = Player.getTextureKeyForClass(charClass);

    // Animação de ataque: toca spritesheet dedicada se existir, senão usa frame procedural de ação
    if (this.anims && this.scene.anims.exists(`${animPrefix}_attack`)) {
      this.setFlipX(this.currentDirection === Direction.LEFT);
      this.anims.play(`${animPrefix}_attack`, true);
    } else {
      let actionFrame = 1; // Down
      if (this.currentDirection === Direction.UP) actionFrame = 5;
      else if (this.currentDirection === Direction.RIGHT || this.currentDirection === Direction.LEFT) actionFrame = 9;

      this.setFlipX(this.currentDirection === Direction.LEFT);
      this.anims?.stop();
      this.setFrame(actionFrame);
    }

    // FASE 1: Antecipação (Wind-up, 50ms - recuo leve de 2px)
    const originalX = this.x;
    const originalY = this.y;
    const recoilX = originalX - dirOffset.x * 0.6;
    const recoilY = originalY - dirOffset.y * 0.6;

    this.scene.tweens.add({
      targets: this,
      x: recoilX,
      y: recoilY,
      duration: 50,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // FASE 2: Golpe / Disparo / Conjuração (Action, 80ms - estocada para a frente)
        const thrustX = originalX + dirOffset.x * 1.4;
        const thrustY = originalY + dirOffset.y * 1.4;

        this.spawnClassAttackFx(charClass, targetX, targetY, isSkill);

        this.scene.tweens.add({
          targets: this,
          x: thrustX,
          y: thrustY,
          duration: 70,
          ease: 'Back.easeOut',
          onComplete: () => {
            // FASE 3: Recuperação (Recovery, 60ms - retorno suave à posição)
            this.scene.tweens.add({
              targets: this,
              x: originalX,
              y: originalY,
              duration: 60,
              ease: 'Sine.easeOut',
              onComplete: () => {
                this.isAttackingAnim = false;
              }
            });
          }
        });
      }
    });
  }

  private spawnClassAttackFx(
    charClass: CharacterClass,
    targetX?: number,
    targetY?: number,
    isSkill: boolean = false
  ): void {
    const startX = this.x;
    const startY = this.y - 4;
    const attackOffset = this.getDirectionOffset(16);

    if (charClass === CharacterClass.WARRIOR) {
      // Efeito de corte em arco (Slash)
      const fx = this.scene.add.sprite(startX + attackOffset.x, startY + attackOffset.y, 'fx_slash');
      fx.setDepth(this.depth + 5);

      let angle = 0;
      if (this.currentDirection === Direction.DOWN) angle = 90;
      else if (this.currentDirection === Direction.UP) angle = -90;
      else if (this.currentDirection === Direction.LEFT) angle = 180;
      fx.setAngle(angle);

      if (isSkill) {
        fx.setScale(1.4);
        fx.setTint(0xfacc15); // Golpe pesado dourado
      } else {
        fx.setScale(1.0);
      }

      this.scene.tweens.add({
        targets: fx,
        scaleX: isSkill ? 1.8 : 1.3,
        scaleY: isSkill ? 1.8 : 1.3,
        alpha: 0,
        duration: 130,
        onComplete: () => fx.destroy()
      });
    } else if (charClass === CharacterClass.RANGER) {
      // Projétil Cosmético: Flecha voando até o alvo
      const destX = targetX !== undefined ? targetX : startX + attackOffset.x * 3;
      const destY = targetY !== undefined ? targetY : startY + attackOffset.y * 3;
      const angleRad = Phaser.Math.Angle.Between(startX, startY, destX, destY);

      const arrow = this.scene.add.sprite(startX, startY, 'fx_arrow');
      arrow.setRotation(angleRad);
      arrow.setDepth(this.depth + 5);
      if (isSkill) arrow.setTint(0xfde047);

      const distance = Phaser.Math.Distance.Between(startX, startY, destX, destY);
      const flightDuration = Math.max(80, Math.min(200, (distance / 420) * 1000));

      this.scene.tweens.add({
        targets: arrow,
        x: destX,
        y: destY,
        duration: flightDuration,
        ease: 'Linear',
        onComplete: () => {
          arrow.destroy();
        }
      });
    } else if (charClass === CharacterClass.MAGE) {
      // Projétil Cosmético: Orbe arcano
      const destX = targetX !== undefined ? targetX : startX + attackOffset.x * 3;
      const destY = targetY !== undefined ? targetY : startY + attackOffset.y * 3;

      const orb = this.scene.add.sprite(startX, startY, 'fx_magic_orb');
      orb.setDepth(this.depth + 5);
      orb.setScale(isSkill ? 1.4 : 1.0);

      const distance = Phaser.Math.Distance.Between(startX, startY, destX, destY);
      const flightDuration = Math.max(90, Math.min(220, (distance / 340) * 1000));

      this.scene.tweens.add({
        targets: orb,
        x: destX,
        y: destY,
        duration: flightDuration,
        ease: 'Quad.easeIn',
        onComplete: () => {
          orb.destroy();
          // Explosão mágica no destino
          const burst = this.scene.add.sprite(destX, destY, 'fx_magic_orb');
          burst.setDepth(this.depth + 6);
          burst.setScale(1.1);
          this.scene.tweens.add({
            targets: burst,
            scale: isSkill ? 2.2 : 1.7,
            alpha: 0,
            duration: 140,
            onComplete: () => burst.destroy()
          });
        }
      });
    } else if (charClass === CharacterClass.DRUID) {
      if (isSkill) {
        // Habilidade de Cura: Bênção da Natureza
        const aura = this.scene.add.sprite(this.x, this.y - 6, 'fx_heal_aura');
        aura.setDepth(this.depth + 5);
        aura.setScale(0.8);
        this.scene.tweens.add({
          targets: aura,
          y: this.y - 22,
          scale: 1.5,
          alpha: 0,
          duration: 380,
          ease: 'Sine.easeOut',
          onComplete: () => aura.destroy()
        });
      } else {
        // Ataque Básico: Espiral de folhas/terra
        const destX = targetX !== undefined ? targetX : startX + attackOffset.x * 3;
        const destY = targetY !== undefined ? targetY : startY + attackOffset.y * 3;

        const natureProj = this.scene.add.sprite(startX, startY, 'fx_nature_burst');
        natureProj.setDepth(this.depth + 5);

        const distance = Phaser.Math.Distance.Between(startX, startY, destX, destY);
        const flightDuration = Math.max(90, Math.min(220, (distance / 350) * 1000));

        this.scene.tweens.add({
          targets: natureProj,
          x: destX,
          y: destY,
          rotation: Math.PI * 4,
          duration: flightDuration,
          ease: 'Linear',
          onComplete: () => {
            natureProj.destroy();
            const leaves = this.scene.add.sprite(destX, destY, 'fx_nature_burst');
            leaves.setDepth(this.depth + 6);
            this.scene.tweens.add({
              targets: leaves,
              scale: 1.6,
              alpha: 0,
              duration: 130,
              onComplete: () => leaves.destroy()
            });
          }
        });
      }
    }
  }

  private executeBasicAttack(monsters: Monster[], attackRange: number): void {
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

    const targetX = closestTarget ? closestTarget.x : undefined;
    const targetY = closestTarget ? closestTarget.y : undefined;

    // Dispara animação corporal de ataque e efeito correspondente à classe
    this.playAttackVisual(targetX, targetY, false);

    // Emite evento para que a cena informe ao servidor se houver multiplayer
    this.scene.events.emit('player-attack-action', {
      targetMonsterId: closestTarget?.id,
      isSkill: false
    });

    if (closestTarget) {
      const damage = calculateDamage(this.playerData.attributes.attack, closestTarget.monsterConfig.defense);
      const isRanged = this.playerData.characterClass === CharacterClass.RANGER || this.playerData.characterClass === CharacterClass.MAGE;
      const delay = isRanged ? 110 : 60;

      this.scene.time.delayedCall(delay, () => {
        if (!closestTarget || !closestTarget.active) return;
        const result = closestTarget.takeDamage(damage, this.x, this.y);

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

          this.scene.events.emit('spawn-monster-loot', {
            x: closestTarget.x,
            y: closestTarget.y,
            lootTable: closestTarget.monsterConfig.lootTable
          });
        }
      });
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
      this.playAttackVisual(undefined, undefined, true);
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

    const targetX = target ? target.x : undefined;
    const targetY = target ? target.y : undefined;

    this.playAttackVisual(targetX, targetY, true);

    this.scene.events.emit('player-attack-action', {
      targetMonsterId: target?.id,
      isSkill: true
    });

    if (target) {
      const rawAtk = Math.round(this.playerData.attributes.attack * multiplier);
      const damage = calculateDamage(rawAtk, target.monsterConfig.defense);
      const isRanged = charClass === CharacterClass.RANGER || charClass === CharacterClass.MAGE;
      const delay = isRanged ? 120 : 60;

      this.scene.time.delayedCall(delay, () => {
        if (!target || !target.active) return;
        const result = target.takeDamage(damage, this.x, this.y);

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
      });
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
    const animPrefix = Player.getTextureKeyForClass(this.playerData.characterClass);
    if (this.anims && this.scene.anims.exists(`${animPrefix}_hurt`)) {
      this.anims.play(`${animPrefix}_hurt`, true);
    }
    this.scene.time.delayedCall(180, () => {
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
    const animPrefix = Player.getTextureKeyForClass(this.playerData.characterClass);
    if (this.anims && this.scene.anims.exists(`${animPrefix}_death`)) {
      this.anims.play(`${animPrefix}_death`, true);
    }

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
    const animPrefix = Player.getTextureKeyForClass(this.playerData.characterClass);
    if (this.anims && this.scene.anims.exists(`${animPrefix}_idle_down`)) {
      this.anims.play(`${animPrefix}_idle_down`, true);
    }

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
    const equipped = this.playerData.equipped || { weapon: null, armor: null, accessory: null };
    const totalAttrs = calculateTotalPlayerAttributes(
      this.playerData.characterClass,
      this.playerData.level,
      equipped
    );

    // Mantém a proporção do HP/MP atual com fallback seguro
    const currentHp = this.playerData.attributes?.currentHp ?? totalAttrs.maxHp;
    const maxHp = this.playerData.attributes?.maxHp || totalAttrs.maxHp;
    const currentMp = this.playerData.attributes?.currentMp ?? totalAttrs.maxMp;
    const maxMp = this.playerData.attributes?.maxMp || totalAttrs.maxMp;

    const hpRatio = maxHp > 0 ? currentHp / maxHp : 1;
    const mpRatio = maxMp > 0 ? currentMp / maxMp : 1;

    this.playerData.attributes = {
      ...totalAttrs,
      currentHp: Math.max(1, Math.round(totalAttrs.maxHp * hpRatio)),
      currentMp: Math.max(0, Math.round(totalAttrs.maxMp * mpRatio))
    };
  }

  public getAttackCooldownProgress(time: number): { remainingMs: number; totalMs: number; ratio: number; isReady: boolean } {
    const combatConfig = CLASS_COMBAT_CONFIG[this.playerData.characterClass];
    const elapsed = time - this.lastAttackTime;
    const remaining = Math.max(0, combatConfig.attackCooldownMs - elapsed);
    return {
      remainingMs: remaining,
      totalMs: combatConfig.attackCooldownMs,
      ratio: remaining / combatConfig.attackCooldownMs,
      isReady: remaining <= 0
    };
  }

  public getSkill1CooldownProgress(time: number): { remainingMs: number; totalMs: number; ratio: number; isReady: boolean } {
    const combatConfig = CLASS_COMBAT_CONFIG[this.playerData.characterClass];
    const elapsed = time - this.lastSkill1Time;
    const remaining = Math.max(0, combatConfig.skill1CooldownMs - elapsed);
    return {
      remainingMs: remaining,
      totalMs: combatConfig.skill1CooldownMs,
      ratio: remaining / combatConfig.skill1CooldownMs,
      isReady: remaining <= 0
    };
  }

  public useQuickPotion(): boolean {
    const inv = this.playerData.inventory;
    const currentHp = this.playerData.attributes.currentHp;
    const maxHp = this.playerData.attributes.maxHp;
    const currentMp = this.playerData.attributes.currentMp;
    const maxMp = this.playerData.attributes.maxMp;

    let potionIndex = -1;
    if (currentHp < maxHp) {
      potionIndex = inv.findIndex(slot => slot && slot.itemId === 'potion_hp_minor');
    }
    if (potionIndex === -1 && currentMp < maxMp) {
      potionIndex = inv.findIndex(slot => slot && slot.itemId === 'potion_mp_minor');
    }
    if (potionIndex === -1) {
      potionIndex = inv.findIndex(slot => slot && (slot.itemId === 'potion_hp_minor' || slot.itemId === 'potion_mp_minor'));
    }

    if (potionIndex !== -1) {
      return this.useConsumable(potionIndex);
    }

    this.scene.events.emit('floating-text', {
      x: this.x,
      y: this.y - 25,
      text: 'Sem Poções!',
      color: '#ef4444'
    });
    return false;
  }

  public triggerBasicAttackFromUI(): void {
    if (this.isDead) return;
    const time = this.scene.time.now;
    const combatConfig = CLASS_COMBAT_CONFIG[this.playerData.characterClass];
    if (time - this.lastAttackTime >= combatConfig.attackCooldownMs) {
      this.lastAttackTime = time;
      const worldScene = this.scene as any;
      const monsters: Monster[] = worldScene.monsters || [];
      this.executeBasicAttack(monsters, combatConfig.attackRange);
    }
  }

  public triggerSkill1FromUI(): void {
    if (this.isDead) return;
    const time = this.scene.time.now;
    const combatConfig = CLASS_COMBAT_CONFIG[this.playerData.characterClass];
    if (time - this.lastSkill1Time >= combatConfig.skill1CooldownMs) {
      if (this.playerData.attributes.currentMp >= combatConfig.skill1CostMp) {
        this.lastSkill1Time = time;
        this.playerData.attributes.currentMp -= combatConfig.skill1CostMp;
        const worldScene = this.scene as any;
        const monsters: Monster[] = worldScene.monsters || [];
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

  public setVirtualInteract(isDown: boolean): void {
    this.isVirtualInteractDown = isDown;
  }
}
