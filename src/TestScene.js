import Phaser from 'phaser';

// TestScene is a simple scene for quickly testing
// TODO It should not be included in any production output
export class TestScene extends Phaser.Scene {
  constructor () {
    super({ // https://photonstorm.github.io/phaser3-docs/Phaser.Types.Scenes.html#.SettingsConfig
      key: 'test'
    });
  }

  preload () {}

  create () {
    this.matter.world.setBounds();

    const points = [
      new Phaser.Math.Vector2(100, 100),
      new Phaser.Math.Vector2(0, 500),
      new Phaser.Math.Vector2(500, 0)
    ];
    let shape = this.add.polygon(500, 500, points, 0x0000ff);

	    this.matter.add.gameObject(shape, {
	      // isStatic: true,
	      shape: { // https://cubap.github.io/phaser3-docs/physics_matter-js_components_SetBody.js.html
	        type: 'fromVerts', // https://brm.io/matter-js/docs/classes/Bodies.html#method_fromVertices
	        verts: points
	      },
	      render: {
	        // To understand offsets read https://github.com/photonstorm/phaser/issues/4067
	        sprite: {
	          // I don't understand what's happening here. xOffset must be 0, but yOffset is the ratio.
	          // xOffset: 0,
	          // yOffset: 0,
	        }
	      }
	    });
  }

  update () {

  }
}
