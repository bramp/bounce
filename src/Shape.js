import Phaser from 'phaser';

import constants from './constants';

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

  // Returns the coordinates of the corners of a N sided regular polygon.
  // In the format of "x1 y1 x2 y2 ... xN yN"
  // TODO Move to a generic polygon.js file.
  static calcPoints (rotation, sides, radius) {
    console.assert(sides >= 3, sides);
    console.assert(radius >= 1, radius);

    let points = '';
    for (let i = 0; i < sides; i++) {
      const angle = i * Math.PI * 2 / sides + rotation;
      const x = Math.sin(angle) * radius;
      const y = Math.cos(angle) * radius;

      points += x.toFixed(3) + ' ' + y.toFixed(3) + ' ';
    }

    return points.trim();
  }

  constructor (scene, x, y, rotation, sides, lives, radius) {
    super(scene, x, y);

    // TODO Change the shapes to be sprits.

    // Shape
    let shape;
    if (sides === 1) {
      // Simple circle
      shape = new Phaser.GameObjects.Ellipse(scene, 0, 0, radius * 2, radius * 2);
    } else {
      // Regular polygon
      const points = Shape.calcPoints(rotation, sides, radius);
      this.pathData = points;

      shape = new Phaser.GameObjects.Polygon(scene, 0, 0, points)
        .setOrigin(0, 0);
    }
    // Fill with the color, and have a small stroke to blend into the background.
    shape
      .setFillStyle(Shape.color(lives))
      .setStrokeStyle(constants.shapeStrokeWidth, Shape.color(lives), 0.5)

      // TODO This only works with sprites.
      //.setFillStyle(0xffffff)
      //.setTint(Shape.color(lives)); 

    this.add(shape);
    this.setSize(shape.width, shape.height);

    // Text
    var text = new Phaser.GameObjects.Text(scene,
      -8, -16, // TODO figure out width/height
      lives,
      {
        fontSize: '32px',
        fill: '#000',
        align: 'center'
      }
    );
    text.setDepth(1);
    this.add(text);

    this.shape = shape;
    this.text = text;
    this.lives = lives;
  }

  preUpdate (time, delta) {
    this.pathUpdate(time);
    //super.preUpdate(time, delta);
  }

  hit (ball) {
    const impact = Math.min(ball.strength, this.lives);
    this.lives -= impact;
    this.text.setText(this.lives);
    this.shape
      .setFillStyle(Shape.color(this.lives))
      .setStrokeStyle(this.shape.lineWidth, Shape.color(this.lives));

    // TODO
    // this.shape.setTintFill(Shape.color(this.lives));

    return impact;
  }
}
Shape.colors = Phaser.Display.Color.HSVColorWheel();

Phaser.Class.mixin(Shape, [
  Phaser.GameObjects.Components.PathFollower,
]);