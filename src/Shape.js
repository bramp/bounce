import Phaser from 'phaser';

import constants from './constants';
import COLLISION_CAT from './collision';

import { regularPolygonPoints, centroid } from './utils';

/*
// TODO Remove this code
class PolygonWithTint extends Phaser.GameObjects.Polygon {}
class EllipseWithTint extends Phaser.GameObjects.Ellipse {}

Phaser.Class.mixin(PolygonWithTint, [
  Phaser.GameObjects.Components.Tint,
]);
Phaser.Class.mixin(EllipseWithTint, [
  Phaser.GameObjects.Components.Tint,
]);
*/

export class Shape extends Phaser.GameObjects.Container {
  static color (lives) {
    if (lives <= 0) {
      return 0x000000;
    }

    return Shape.colors[((lives - 1) * 30) % Shape.colors.length].color;
  }

  static GenerateShapePoints () {
    let ret = [];

    for (let sides = 3; sides <= 5; sides++) {
      const radius = constants.shapeRadius[sides - 2];
      const points = regularPolygonPoints(sides, radius);
      const bounds = Phaser.Geom.Rectangle.FromPoints(points);

      // Adjust points to have zero/zero in the top left, adjusted a little.
      for (let i = 0; i < points.length; i++) {
        points[i].x += -bounds.x + constants.shapeStrokeWidth;
        points[i].y += -bounds.y + constants.shapeStrokeWidth;
      }

      ret[sides - 2] = points;
    }

    return ret;
  }

  static GenerateTextures (scene) {
    // TODO Perhaps use graphics.clear() instead of correcting multiple objects

    // Circle
    const radius = constants.shapeRadius[0];
    const cx = radius + constants.shapeStrokeWidth; // cy = x
    const graphics = scene.add.graphics(0, 0)
      .fillStyle(0xffffff)
      .lineStyle(constants.shapeStrokeWidth, 0xffffff, 0.5)
      .fillCircle(cx, cx, radius)
      .strokeCircle(cx, cx, radius);

    if (constants.DEBUG) {
      graphics
        .lineStyle(1, 0xffffff, 1)
        .strokeRect(0, 0, cx * 2, cx * 2);
    }

    graphics
      .generateTexture('shape1', cx * 2, cx * 2)
      .destroy();

    // Polygons
    for (let sides = 3; sides <= 5; sides++) {
      const radius = constants.shapeRadius[sides - 2];
      const points = Shape.points[sides - 2];
      const bounds = Phaser.Geom.Rectangle.FromPoints(points);

      // Adjust points to have zero/zero in the top left, adjusted a little.
      for (let i = 0; i < points.length; i++) {
        points[i].x += -bounds.x + constants.shapeStrokeWidth;
        points[i].y += -bounds.y + constants.shapeStrokeWidth;
      }

      Shape.points[sides - 2] = points;

      const width = bounds.width + 2 * constants.shapeStrokeWidth;
      const height = bounds.height + 2 * constants.shapeStrokeWidth;

      // Fill with white (to be tinted later), and have a small stroke to blend into the background.
      const graphics = scene.add.graphics(0, 0)
        .beginPath()
        .moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length; i++) {
        graphics.lineTo(points[i].x, points[i].y);
      }

      graphics
        .closePath()
        .fillStyle(0xffffff)
        .lineStyle(constants.shapeStrokeWidth, 0xffffff, 0.5)
        .fillPath()
        .strokePath();

      if (constants.DEBUG) {
        graphics
          .lineStyle(1, 0xffffff, 1)
          .strokeRect(0, 0, width - 1, height - 1);
      }

      graphics
        .generateTexture('shape' + sides, width, height)
        .destroy();
    }
  }

  constructor (scene, x, y, rotation, sides, lives, radius) {
    super(scene, x, y);

    console.assert(sides !== 2);

    // TODO Change the shapes to be sprits.

    // Shape
    let shape = new Phaser.GameObjects.Image(scene, 0, 0, 'shape' + sides)
      .setTint(Shape.color(lives));

    this.add(shape);
    this.setSize(shape.width, shape.height);

    // Text
    // TODO Switch to BitmapText for performane.
    // // TODO centroid
    var text = new Phaser.GameObjects.Text(scene,
      -8, -16, // -8, -16, // TODO figure out width/height
      lives,
      {
        fontSize: '32px',
        fill: '#000',
        align: 'center'
      }
    );
    this.add(text);
    this.bringToTop(text);

    if (sides === 1) {
      scene.matter.add.gameObject(this, {
        isStatic: true,
        shape: { // https://cubap.github.io/phaser3-docs/physics_matter-js_components_SetBody.js.html
          type: 'circle',
          radius: radius
        },
        collisionFilter: {
          category: COLLISION_CAT.GAME_OBJECT,
          mask: COLLISION_CAT.BALL_INPLAY
        }
      });
    } else {
      // console.log(Shape.points[sides - 2]);
      // console.log(this._originComponent);
      scene.matter.add.gameObject(this, {
        isStatic: true,
        shape: {
          // API Documented here: https://cubap.github.io/phaser3-docs/physics_matter-js_components_SetBody.js.html
          type: 'fromVerts',
          verts: Shape.points[sides - 2]
        },
        collisionFilter: {
          category: COLLISION_CAT.GAME_OBJECT,
          mask: COLLISION_CAT.BALL_INPLAY
        }
      });

      // HACK, but we need to do this, to align the body correctly.
      console.log(this.body.parts);
      const b = Phaser.Geom.Rectangle.FromPoints(Shape.points[sides - 2]);
      const c = centroid(Shape.points[sides - 2]);

      console.log(b);
      console.log(c);
      console.log(this.width, this.height);

      this.body.parts[0].position.x += 0; // constants.shapeStrokeWidth;
      this.body.parts[0].position.y += 0; // constants.shapeStrokeWidth;

      // this.setExistingBody(this.body);
    }
    this.body.label = 'shape';
    /*
    Phaser.Physics.Matter.Matter.Body.setPosition(this.body, {
      x: this.x + 100,
      y: this.y + 10,
    });
    */

    // this.setRotation(rotation);
    // text.setRotation(-rotation);

    this.shape = shape;
    this.text = text;
    this.lives = lives;
  }

  preUpdate (time, delta) {
    this.pathUpdate(time);
    // super.preUpdate(time, delta);
  }

  hit (ball) {
    const impact = Math.min(ball.strength, this.lives);
    this.lives -= impact;

    this.text.setText(this.lives);
    this.shape.setTint(Shape.color(this.lives));

    return impact;
  }
}
Shape.colors = Phaser.Display.Color.HSVColorWheel();
Shape.points = Shape.GenerateShapePoints();

Phaser.Class.mixin(Shape, [
  Phaser.GameObjects.Components.PathFollower
]);
