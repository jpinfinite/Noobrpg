export declare enum CharacterClass {
    WARRIOR = "WARRIOR",
    RANGER = "RANGER",
    MAGE = "MAGE",
    DRUID = "DRUID"
}
export declare enum Direction {
    DOWN = "down",
    UP = "up",
    LEFT = "left",
    RIGHT = "right",
    DOWN_LEFT = "down_left",
    DOWN_RIGHT = "down_right",
    UP_LEFT = "up_left",
    UP_RIGHT = "up_right"
}
export interface Vector2D {
    x: number;
    y: number;
}
export interface CharacterAttributes {
    maxHp: number;
    currentHp: number;
    maxMp: number;
    currentMp: number;
    attack: number;
    defense: number;
    speed: number;
}
export interface PlayerData {
    id: string;
    name: string;
    characterClass: CharacterClass;
    level: number;
    currentXp: number;
    gold: number;
    meritPoints: number;
    attributes: CharacterAttributes;
    position: Vector2D;
    direction: Direction;
}
//# sourceMappingURL=index.d.ts.map