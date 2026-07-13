import Phaser from "phaser";
import type { PlayerGameData } from "../types";

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;
const TILE_SIZE = 40;
const PLAYER_SPEED = 200;

export class TownScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super("TownScene");
  }

  preload() {
    this.makeSolidTexture("tile-grass", 0x4a7c3a, TILE_SIZE, TILE_SIZE);
    this.makeSolidTexture("tile-path", 0xc2a267, TILE_SIZE, TILE_SIZE);
    this.makeSolidTexture("player", 0xe6c34a, 32, 32);
    this.makeSolidTexture("prop-tree", 0x2f5d34, 28, 36);
    this.makeSolidTexture("prop-rock", 0x8a8a8a, 24, 20);
  }

  create() {
    const data = this.registry.get("player") as PlayerGameData | undefined;

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawGround();

    this.player = this.physics.add.sprite(
      WORLD_WIDTH / 2,
      WORLD_HEIGHT / 2,
      "player"
    );
    this.player.setCollideWorldBounds(true);

    this.add
      .text(this.player.x, this.player.y - 26, data?.displayName ?? "Player", {
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#00000080",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(10)
      .setName("player-label");

    this.add.image(120, 120, "prop-tree").setDepth(1);
    this.add.image(160, 140, "prop-tree").setDepth(1);
    this.add.image(680, 480, "prop-rock").setDepth(1);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  update() {
    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;

    const velocity = new Phaser.Math.Vector2(
      (left ? -1 : 0) + (right ? 1 : 0),
      (up ? -1 : 0) + (down ? 1 : 0)
    ).normalize().scale(PLAYER_SPEED);

    this.player.setVelocity(velocity.x, velocity.y);

    const label = this.children.getByName("player-label") as
      | Phaser.GameObjects.Text
      | undefined;
    label?.setPosition(this.player.x, this.player.y - 26);
  }

  private drawGround() {
    for (let y = 0; y < WORLD_HEIGHT; y += TILE_SIZE) {
      for (let x = 0; x < WORLD_WIDTH; x += TILE_SIZE) {
        const isPath =
          x >= 320 && x < 480 && (y < 240 || y >= 280 ? true : false);
        this.add
          .image(x + TILE_SIZE / 2, y + TILE_SIZE / 2, isPath ? "tile-path" : "tile-grass")
          .setDepth(0);
      }
    }
  }

  private makeSolidTexture(
    key: string,
    color: number,
    width: number,
    height: number
  ) {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, width, height);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }
}
