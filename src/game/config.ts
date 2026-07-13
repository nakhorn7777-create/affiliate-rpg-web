import Phaser from "phaser";
import { TownScene } from "./scenes/TownScene";

export function createGameConfig(
  parent: HTMLElement
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: 800,
    height: 600,
    backgroundColor: "#1a1a1a",
    pixelArt: false,
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [TownScene],
  };
}
