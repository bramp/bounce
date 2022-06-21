import Phaser from 'phaser';

import constants from './constants';
import COLLISION_CAT from './collision';

import { findNearest } from './utils';

import { Ball } from './Ball';
import { Shape } from './Shape';

export class GameScene extends Phaser.Scene {
  constructor () {
    super({ // https://photonstorm.github.io/phaser3-docs/Phaser.Types.Scenes.html#.SettingsConfig
      key: 'game'
    });

    this.level = 0;
    this._score = 0;

    // GameObjects
    this.scoreText = null; // Displaying the score
    this.shooter = null; // The line/arrow for the shooter
    this.shooterBox = null; // The invisible box (where the shooter is)

    this.deathEmitter = null; // Particle emittor for when a shap is destroyed.

    this.balls = []; // List of all the balls.
    this.shapes = []; // List of all shapes.
  }

  preload () {
    Ball.GenerateTextures(this);
    Shape.GenerateTextures(this);
  }

  create () {
    this.createWalls();
    this.createCeiling();
    this.createSlides();
    this.createShooter();

    this.createBall();
    this.createBall();
    this.createBall();

    this.createScore();

    this.setupControls();
    this.setupCollision();

    // Start with a few rows of shapes.
    this.createRowOfShapes(3);
    this.level += 4;

    this.deathEmitter = this.add.particles('ball');

    this.loadBall();
  }

  setupCollision () {
    this.matter.world.on('collisionstart', function (event) {
      // TODO Is this how games do this? check for pairs of objects? instead of per pair handlers?
      // Also collisionstart is per body, not per game object

      for (let i = 0; i < event.pairs.length; i++) {
        const pair = event.pairs[i];

        // Body A is always the object with the "smaller" label.
        const bodyA = (pair.bodyA.label < pair.bodyB.label) ? pair.bodyA : pair.bodyB;
        const bodyB = (pair.bodyA.label < pair.bodyB.label) ? pair.bodyB : pair.bodyA;

        if (bodyA.label === 'ball' && bodyB.label === 'shape') {
          const ball = bodyA.gameObject;
          const shape = bodyB.gameObject;
          if (shape === null) {
            // The shape may have already been destoried on a previous iteration.
            continue;
          }

          this.shapeHit(shape, ball);
        } else if (bodyA.label === 'ball' && bodyB.label === 'wall_bottom') {
          const ball = bodyA.gameObject;
          this.ballFell(ball);
        } else if (constants.DEBUG) {
          if (bodyA.label === 'ball' && (bodyB.label === 'wall' || bodyB.label === 'slide' || bodyB.label === 'ball' || bodyB.label === 'shooter' || bodyB.label === 'ceiling')) {
            // Ignore
          } else {
            console.log('unknown collisionstart', bodyA, bodyB);
          }
        }
      }
    }, this);
  }

  setupControls () {
    this.input.on('pointermove', function (pointer) {
      this.shooter.setTo(0, 0, pointer.x - this.shooter.x, pointer.y - this.shooter.y);
    }, this);

    this.input.on('pointerup', function (pointer) {
      const angle = Phaser.Math.Angle.BetweenPoints(this.shooter, pointer);
      const velocity = {
        x: Math.cos(angle) * constants.ballFireVelociy,
        y: Math.sin(angle) * constants.ballFireVelociy
      };
      this.fire(velocity);
    }, this);
  }

  update () {}

  /*********************/
  /* Setting the stage */
  /*********************/

  createScore () {
    this.scoreText = this.add.text(16, 16, 'Score: 0', {
      fontSize: '32px', // TODO Scale correctly.
      fill: '#fff'
    });
  }

  createWalls () {
    const config = this.sys.game.config;

    // Set the bounds of the game, to where the walls are.
    // We don't really need to do this, but it simplifies some of the bounds checking in the game.
    this.matter.world.setBounds(
      constants.sideWidth + constants.wallWidth, 0,
      config.width - (constants.sideWidth + constants.wallWidth) * 2, config.height);

    for (let position in this.matter.world.walls) {
      const wall = this.matter.world.walls[position];
      wall.label = 'wall';
      wall.collisionFilter = {
        group: 0,
        category: COLLISION_CAT.GAME_OBJECT,
        mask: COLLISION_CAT.BALL_INPLAY | COLLISION_CAT.BALL_WAITING
      };
    }

    // Create the left/right wall graphics with no physic bodies (since its handled above)
    // Left
    const wallHeight = config.height - constants.wallTop - constants.wallBottom;
    this.add.line(constants.sideWidth, constants.wallTop, 0, 0, 0, wallHeight)
      .setOrigin(0, 0)
      .setLineWidth(constants.wallWidth) // Oddly this needs to be set, the setStrokeStyle(lineWidth) doesn't seem to work.
      .setStrokeStyle(constants.wallWidth, constants.wallColour);

    // Right
    this.add.line(config.width - constants.sideWidth, constants.wallTop, 0, 0, 0, wallHeight)
      .setOrigin(0, 0)
      .setLineWidth(constants.wallWidth)
      .setStrokeStyle(constants.wallWidth, constants.wallColour);

    // Bottom (curved wall)
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(0, 0), // left point
      new Phaser.Math.Vector2(config.width / 2, 2 * constants.wallCurveHeight), // mid point (twice the needed height)
      new Phaser.Math.Vector2(config.width, 0)); // right point

    // TODO 1.2 seems to be a magic number, lets swap this for something more principled.
    const wall = this.add.curve(config.width / 2, constants.wallTop + wallHeight + constants.wallCurveHeight + 1.2 * constants.sideWidth, curve)
      .setStrokeStyle(constants.wallWidth * 2, constants.wallColour);

    const points = curve.getPoints(11).concat([ // Number of points must be odd (e.g 11), to keep the convex body symetrical.
      new Phaser.Math.Vector2(config.width, constants.wallCurveHeight + constants.wallThickness),
      new Phaser.Math.Vector2(0, constants.wallCurveHeight + constants.wallThickness)
    ]);

    const b = Phaser.Geom.Rectangle.FromPoints(points);

    this.matter.add.gameObject(wall, {
      isStatic: true,
      label: 'wall_bottom',
      shape: { // https://cubap.github.io/phaser3-docs/physics_matter-js_components_SetBody.js.html
        type: 'fromVerts', // https://brm.io/matter-js/docs/classes/Bodies.html#method_fromVertices
        verts: points
      },
      render: {
        // To understand offsets read https://github.com/photonstorm/phaser/issues/4067
        sprite: {
          // I don't understand what's happening here. xOffset must be 0, but yOffset is the ratio.
          xOffset: 0, // b.width / (b.width + wall.width),
          yOffset: b.height / (b.height + wall.height)
        }
      },
      collisionFilter: {
        category: COLLISION_CAT.GAME_OBJECT,
        mask: COLLISION_CAT.BALL_INPLAY | COLLISION_CAT.BALL_WAITING
      }
    });
  }

  // Create a slide. It is made up of a single line, and two bodies.
  // One body is above the line, stopping in-play balls escaping, and the other
  // is below the line, stopping out of play balls entering.
  createSlide (x, y, slope) {
    const start = slope.getStartPoint();
    const end = slope.getEndPoint();

    const slide = this.add.curve(0, 0, slope)
      .setStrokeStyle(constants.wallWidth * 2, constants.wallColour);

    // Draw a triangle for bottom half
    const points = [
      new Phaser.Math.Vector2(start.x, start.y),
      new Phaser.Math.Vector2(end.x, end.y),
      new Phaser.Math.Vector2(start.x, end.y)
    ];

    this.matter.add.gameObject(slide, {
      isStatic: true,
      label: 'slide',
      shape: {
        type: 'fromVerts',
        verts: points
      },
      collisionFilter: {
        category: COLLISION_CAT.BALL_WAITING,
        mask: COLLISION_CAT.BALL_WAITING
      }
    });

    // Nudge the position buy the centerOfMass (to align it correctly :/)
    slide.setPosition(
      x + slide.centerOfMass.x,
      y + slide.centerOfMass.y
    );

    return slide;
  }

  // Create a single invisible ceiling object
  createCeiling (x, y, slope) {
    const config = this.sys.game.config;

    const left = constants.sideWidth;
    const right = config.width - constants.sideWidth;
    const slideWidth = (right - left - constants.slideOpening) / 2;

    const cleft = left - slideWidth / constants.slideHeight * constants.wallThickness;
    const cright = right + slideWidth / constants.slideHeight * constants.wallThickness;
    const ceiling = this.add.zone(config.width / 2, 0,
      cright - cleft, constants.slideHeight + constants.wallThickness);

    // Draw a trapezoid (with constants.wallThickness padding, to ensure no balls leak though).
    const points = [
      new Phaser.Math.Vector2(cleft, 0),
      new Phaser.Math.Vector2(cright, 0),
      new Phaser.Math.Vector2(right - slideWidth, constants.slideHeight + constants.wallThickness),
      new Phaser.Math.Vector2(left + slideWidth, constants.slideHeight + constants.wallThickness)
    ];

    this.matter.add.gameObject(ceiling, {
      isStatic: true,
      label: 'slide',
      shape: {
        type: 'fromVerts',
        verts: points
      },
      collisionFilter: {
        category: COLLISION_CAT.GAME_OBJECT,
        mask: COLLISION_CAT.BALL_INPLAY
      }
    });

    // Nudge the position buy the centerOfMass (to align it correctly :/)
    ceiling.setPosition(
      config.width / 2,
      (constants.wallTop + constants.wallThickness) / 2
    );

    return ceiling;
  }

  // Create the slides at the top that the balls roll down.
  createSlides () {
    const config = this.sys.game.config;

    const left = constants.sideWidth;
    const right = config.width - constants.sideWidth;
    const slideWidth = (right - left - constants.slideOpening) / 2;

    const leftSlope = new Phaser.Curves.Line(
      new Phaser.Math.Vector2(0, 0),
      new Phaser.Math.Vector2(slideWidth, constants.slideHeight));

    this.createSlide(left, constants.wallTop, leftSlope);

    const rightSlope = new Phaser.Curves.Line(
      new Phaser.Math.Vector2(0, 0),
      new Phaser.Math.Vector2(-slideWidth, constants.slideHeight));

    this.createSlide(right - slideWidth, constants.wallTop, rightSlope);
  }

  createShooter () {
    const config = this.sys.game.config;

    // The area that shoots the ball down
    this.shooterBox = this.add.zone(
      config.width / 2, constants.wallTop + constants.slideHeight + constants.slideOpening / 4,
      2 * constants.slideOpening, constants.slideOpening / 2);
    this.matter.add.gameObject(this.shooterBox, {
      isStatic: true,
      label: 'shooter',
      collisionFilter: {
        category: COLLISION_CAT.BALL_WAITING,
        mask: COLLISION_CAT.BALL_WAITING
      }
    });

    // The shooter arrow
    this.shooter = this.add.line(
      this.shooterBox.x, this.shooterBox.y,
      0, 0, 0, 0,
      0xffffff);
  }

  createBall () {
    const config = this.sys.game.config;
    const ball = new Ball(this, config.width / 2, constants.wallTop);

    this.add.existing(ball);
    this.matter.add.gameObject(ball, {
      shape: {
        type: 'circle'
      }
    });

    ball.body.label = 'ball';
    ball.setBounce(0.8);
    ball.setFriction(0.5, 0, 0);
    ball.setState(Ball.STATE_WAITING);

    this.ballsWaiting++; // TODO maybe move that into update state (or just get rid of it)
    this.balls.push(ball);
  }

  createRowOfShapes (rows) {
    rows = rows || 1;

    const config = this.sys.game.config;
    const playWidth = config.width - 2 * (constants.wallWidth + constants.sideWidth);
    const shapeSpacing = playWidth / constants.shapesPerRow;

    let y = config.height - constants.wallBottom - shapeSpacing / 2;
    let level = this.level;

    for (let row = 0; row < rows; row++) {
      let x = constants.sideWidth + constants.wallWidth + shapeSpacing / 2;

      const cols = (level % 2 === 0) ? 6 : 5;
      if (cols === 5) {
        // If this is a odd, start the shape a little futher out.
        x += shapeSpacing / 2;
      }

      for (let i = 0; i < cols; i++) {
        const sides = Phaser.Math.Between(2, 5); // TODO make min/max constants
        const rotation = Phaser.Math.FloatBetween(0, 2 * Math.PI);
        const strength = Phaser.Math.Between(1, 3); // TODO

        const radius = constants.shapeRadius[sides - 2];

        let shape = new Shape(this, x, y, rotation, sides === 2 ? 1 : sides, strength, radius);

        this.add.existing(shape);
        this.shapes.push(shape);

        x += shapeSpacing;
      }
      level++;
      y -= shapeSpacing;
    }
  }

  /*********************/
  /* Simple properties */
  /*********************/

  get score () {
    return this._score;
  }

  set score (x) {
    this._score = x;
    this.scoreText.setText('Score: ' + this._score);
  }

  // Returns if all the balls are waiting.
  allBallsWaiting () {
    return this.balls.every((ball) => ball.state === Ball.STATE_WAITING);
  }

  /*********************/
  /* Game Logic        */
  /*********************/

  // Progress to the next level, raising the shapes, and loading the shooter
  nextLevel (callback) {
    console.assert(this.allBallsWaiting());

    this.moveShapesUp(function () {
      this.createRowOfShapes();

      if (callback) {
        // Only call the callback when all shapes have moved
        callback.call(this);
      }
    });
    this.level++;
    // TODO Check if shape hit the top (aka game over)
  }

  // Moves all shapes up, and calls callback once done.
  moveShapesUp (callback) {
    // TODO Perhaps make these constants (or calculated once).
    const config = this.sys.game.config;
    const playWidth = config.width - 2 * (constants.wallWidth + constants.sideWidth);
    const shapeSpacing = playWidth / constants.shapesPerRow;

    const path = new Phaser.Curves.Path(0, 0).lineTo(0, -shapeSpacing);
    let toMove = 0;

    for (let i = 0; i < this.shapes.length; i++) {
      toMove++;
      this.shapes[i].setPath(path, {
        duration: 200, // TODO Make a constant

        callbackScope: this,
        onComplete: function () {
          toMove--;
          if (toMove === 0 && callback) {
            // Only call the callback when all shapes have moved up.
            callback.call(this);
          }
        }
      });
    }

    // If there were no shapes to move, the callback doesn't get called. So do so now.
    if (toMove === 0 && callback) {
      callback.call(this);
    }
  }

  // Called when a ball falls out of play
  ballFell (ball) {
    if (ball.state !== Ball.STATE_INPLAY) {
      // If the ball wasn't in play (this has falsely triggered);
      return;
    }

    const config = this.sys.game.config;

    // Float the ball back to the top of the screen.
    let path = new Phaser.Curves.Path();

    const pathBottomY = config.height - ball.y - constants.wallBottom + constants.sideWidth / 2;
    const pathTopY = -ball.y;

    // TODO maybe make it go up the side it was moving in.
    if (ball.x < config.width / 2) {
      // On the left
      const x = -ball.x + constants.sideWidth / 2;
      path
        .lineTo(x, pathBottomY) // TODO Turn this into a curve
        .lineTo(x, pathTopY)
        .lineTo(-ball.x + config.width / 4, pathTopY);
    } else {
      // On the right
      const x = -ball.x + config.width - constants.sideWidth / 2;
      path
        .lineTo(x, pathBottomY) // TODO Turn this into a curve
        .lineTo(x, pathTopY)
        .lineTo(-ball.x + 3 * config.width / 4, pathTopY);
    }

    ball.setState(Ball.STATE_MOVING_TO_WAITING);
    ball.setPath(path, {
      callbackScope: this,
      onComplete: function () {
        ball.setState(Ball.STATE_WAITING);

        if (this.allBallsWaiting()) {
          this.nextLevel(function () {
            this.loadBall();
          });
        }
      }
    });
  }

  // Fire all the balls with the specific velocity.
  fire (velocity) {
    // Find next firing ball
    const next = this.balls.find((ball) => ball.state === Ball.STATE_LOADED);
    if (!next) {
      console.log('No balls to fire: ', this.balls.map((ball) => ball.debugString()));
      return;
    }

    this.fireBall(next, velocity);
  }

  fireBall (ball, velocity) {
    console.assert(ball instanceof Ball, 'Argument is not a ball: ', ball);
    console.assert(ball.state === Ball.STATE_LOADED);

    ball.setState(Ball.STATE_INPLAY);
    ball.setVelocity(velocity.x, velocity.y);

    // Queue up the next ball.
    this.loadBall(function (ball) {
      // Once the next ball is queued, FIRE!
      this.fireBall(ball, velocity);
    });
  }

  // Load the next available ball
  // Callback is called when the ball is loaded.
  loadBall (loadedCallback) {
    const waitingBalls = this.balls.filter((ball) => ball.state === Ball.STATE_WAITING);
    let ball = findNearest(waitingBalls, this.shooter.x, this.shooter.y);

    if (ball) {
      const path = new Phaser.Curves.Path()
        .lineTo(this.shooterBox.x - ball.x, this.shooterBox.y - ball.y);

      ball.setPath(path, {
        callbackScope: this,
        duration: 200, // ms // TODO Make a constant
        onComplete: function (tween, targets) {
          ball.setState(Ball.STATE_LOADED);

          if (loadedCallback) {
            loadedCallback.call(this, ball);
          }
        }
      });
    } else {
      // TODO Do we need to do something if there are no balls ready to load?
    }
  }

  // The shape and the ball hit
  shapeHit (shape, ball) {
    // TODO Shape can be null, if two balls hit it at the same time, and one of them destories it, and the 2nd doesn't know that yet.
    console.assert(shape !== null);
    console.assert(ball !== null);

    this.score += shape.hit(ball);

    // If the ball has stopped bouncing sideways, randomly nudge it.
    if (Math.abs(ball.body.velocity.x) < 1) {
      const nudge = Phaser.Math.FloatBetween(1, 2);
      if (ball.body.velocity.x > 0) {
        ball.setVelocityX(nudge);
      } else {
        ball.setVelocityX(-nudge);
      }
    };

    if (shape.lives <= 0) {
      const b = shape.getBounds();
      this.deathEmitter.createEmitter({
        alpha: { start: 1, end: 0 },
        scale: 0.5,
        // tint: { start: 0xff945e, end: 0xff945e }, // TODO use tint!
        speed: 20,
        // accelerationY: { min: -300, max: 300 },
        angle: { min: 0, max: 360 },
        rotate: { min: -180, max: 180 },
        lifespan: { min: 1000, max: 1100 },
        blendMode: 'ADD',
        frequency: 0,
        maxParticles: 10,
        x: b.x, // { min: b.left, max: b.right },
        y: b.y // { min: b.top, max: b.bottom }
      });

      shape
        .setActive(false)
        .setVisible(false)
        .body.destroy();

      // TODO Should this be a map of some kind?
      this.shapes.splice(this.shapes.indexOf(shape), 1);

      if (this.shapes.length === 0) {
        // Do something
      }
    }
  }
}
