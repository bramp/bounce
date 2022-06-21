/*
 * TODO
 *   The shapes don't seem centered, they are slightly to the left.
 *   Make a neon theme
 *     https://phaser.io/examples/v3/view/game-objects/particle-emitter/particles-on-a-path
 *   Ensure the center of the ball is in the middle (to ensure bounce is correct)
 *   Implement power ups
 *   Add rounded corners to the edges of the walls
 *   Make the balls follow the curved bottom wall.
 *   Effects when shape disappears
   *   Particle Effects (cool simple example https://labs.phaser.io/edit.html?src=src\paths\followers\sparkle%20trail.js)
 *   The new row of shapes should move in from the bottom of the screen.
 *   Changes shapes to use the native rotation, not use drawing each shape differently.
 *   Improve the return to top tween (and throw the ball into the pit)
 *   BUG: The ball (if travelling fast) can go over the bottom curved wall a little.
 *   BUG: The line doesn't take into account gravity. Bend the line over so much. Or disable gravity until the ball hits its first shape.
 *   BUG: You can fire the ball upwards!
 *   BUG: The next release of Phaser will break the matter-js body positions.
 *   The bottom curved wall, is higher than the matter body. Move the matter body up.
 *   Sound!
 *   Webpack
 */
'use strict';

import Phaser from 'phaser';

import constants from './constants';

import { GameScene } from './GameScene';
import { TestScene } from './TestScene';

const config = { // https://photonstorm.github.io/phaser3-docs/Phaser.Types.Core.html#.GameConfig
  type: Phaser.AUTO, // Phaser.CANVAS or Phaser.WEBGL
  width: 1080, // 288, // 1440,   1080
  height: 1920, // 512, // 2560,  1920
  // TODO (this resolution is 0.75 of the original)
  zoom: 0.45, // 0.75x
  render: { // https://photonstorm.github.io/phaser3-docs/Phaser.Types.Core.html#.RenderConfig
    antialias: false
  },
  audio: {
    noAudio: true
  },
  physics: {
    default: 'matter',
    matter: { // https://photonstorm.github.io/phaser3-docs/Phaser.Types.Physics.Matter.html#.MatterWorldConfig
      debug: constants.DEBUG,
      debugShowInternalEdges: true,
      debugShowConvexHulls: true
    }
  },
  scene: [ // First scene is always started
    GameScene
    // TestScene,
  ]
};

new Phaser.Game(config);
