/*
 * TODO
 *   The shapes don't seem centered, they are slightly to the left.
 *   Make a neon theme
 *   Ensure the center of the ball is in the middle (to ensure bounce is correct)
 *   Implement power ups
 *   Add rounded corners to the edges of the walls
 *   Make the balls follow the curved bottom wall.
 *   Effects when shape disappears
 *   Particle Effects
 *   Changes shapes to use the native rotation, not use drawing each shape differently.
 *   Sound!
 *   Webpack
 */
"use strict"

const DEBUG = true;

const M = Phaser.Physics.Matter.Matter;

var factor = 0.75; // Scaling factor TODO Remove this

const sideWidth = 94 * factor;
const wallTop = 130 * factor;    // Distance from top of screen
const wallBottom = 230 * factor; // Distance from bottom of screen
const wallWidth = 6 * factor;
const wallCurveHeight = 120 * factor;
const wallColour = 0xffffff;
const slideHeight = 240 * factor;
const slideOpening = sideWidth; // 100 * factor;

const ballRadius = 24 * factor;
const shapeSpacing = 100 * factor;
const shapeRadius = [
    72 * factor, // Circle
    90 * factor, // Triangle
    90 * factor, // Square
    80 * factor, // Pentagon
];

const ballFireVelociy = 40;

const BALL_STATE = {
    WAITING: 1,           // Waiting to be loaded
    LOADED: 2,            // In the process of being loaded to fired.
    INPLAY: 3,            // Bouncing around in play
    MOVING_TO_WAITING: 4, // Moving back to the top
}

const COLLISION_CAT = {
    BALL_WAITING: 1,
    BALL_INPLAY:  2,
    GAME_OBJECT:  4, // Shapes and walls
}


// TODO Move to library
// Returns the nearest object in objects, to the coordinates (x,y).
function findNearest(objects, x, y) {
    if (objects.length === 0) {
        return;
    }

    let closest = 0;
    let closestDistance = Phaser.Math.Distance.Squared(x, y, objects[0].x, objects[0].y);

    // Find nearest ball to the shooter, and move it.
    for (let i = 1; i < objects.length; i++) {
        const d = Phaser.Math.Distance.Squared(x, y, objects[i].x, objects[i].y);
        if (d < closestDistance) {
            closest = i;
            closestDistance = d;
        }
    }

    return objects[closest];
}

// TODO We could implement a custom plugin to make it easy to create balls
// e.g https://labs.phaser.io/edit.html?src=src%5Cplugins%5Ccustom%20game%20object.js
// TODO Make the Ball class also setup the matter body
class Ball extends Phaser.GameObjects.PathFollower {
    constructor (scene, x, y) {
        super(scene, null, x, y, 'ball_waiting');

        this.radius = ballRadius;
        this.strength = 1;

        // Previous value of isStatic(), and the number of in progress following.
        this._isFollowingCount = 0;
        this._wasStatic = null;
    }

    setState(newState) {
        if (this.state === newState) {
            return;
        }
        console.log("state: ", newState);

        if (newState === BALL_STATE.WAITING) {
            this.body.collisionFilter = {
                group: 0,
                category: COLLISION_CAT.BALL_WAITING,
                mask: COLLISION_CAT.BALL_WAITING | COLLISION_CAT.GAME_OBJECT,
            }
            this.scene.textures.setTexture(this, 'ball_waiting');

        } else if (newState === BALL_STATE.LOADED) {
            console.assert(this.state === BALL_STATE.WAITING, "Ball moved to FIRING state from invalid state:", this.state);
            this.scene.textures.setTexture(this, 'ball_inplay');
            this.setStatic(true);

        } else if (newState === BALL_STATE.INPLAY) {
            this.body.collisionFilter = {
                group: 0,
                category: COLLISION_CAT.BALL_INPLAY,
                mask: COLLISION_CAT.GAME_OBJECT,
            }
            this.scene.textures.setTexture(this, 'ball_inplay');
            this.setStatic(false);

        } else if (newState === BALL_STATE.MOVING_TO_WAITING) {
            console.assert(this.state === BALL_STATE.INPLAY, "Ball moved to MOVING_TO_WAITING state from invalid state:", this.state);
            this.scene.textures.setTexture(this, 'ball_waiting');
            this.setStatic(false);

        } else {
            console.assert(false, "Invalid new state: ", newState)
        }
        this.state = newState
    }

    // TODO turn the following into a MatterPathFollower Mixin.
    startFollow (config, startAt) {
        config = config || {};

        // No need to reconfigure this, if we are using the existing config.
        if (config != this.pathConfig) {
            // Because we override the callbacks, save the original ones (to not break the API).
            const oldOnStart = this.getCallback(config, 'onStart');
            const oldOnComplete = this.getCallback(config, 'onComplete');

            config.onStart = function(...args) {
                if (this._isFollowingCount === 0) {
                    this._wasStatic = this.isStatic();

                    // Must be static to disable matter.js movement's.
                    this.setStatic(true);
                }
                this._isFollowingCount++;

                if (oldOnStart) {
                    oldOnStart.func.apply(oldOnStart.scope, args);
                }
            }
            config.onStartScope = this;

            config.onComplete = function(...args) {
                this._isFollowingCount--;

                // Resume matter movement
                if (this._isFollowingCount === 0) {
                    // If we are no longer following a path, reset to the pre-following state.
                    this.setStatic(this._wasStatic);
                }

                if (oldOnComplete) {
                    oldOnComplete.func.apply(oldOnComplete.scope, args);
                }
            }
            config.onCompleteScope = this;
        }

        super.startFollow(config, startAt);
    }

    // Returns callback from the config.
    getCallback(config, name) {
        const callback = Phaser.Utils.Objects.GetValue(config, name, false);
        if (callback) {
            let scope = Phaser.Utils.Objects.GetValue(config, 'callbackScope', null);
            scope = Phaser.Utils.Objects.GetValue(config, name + 'Scope', scope);

            return { func: callback, scope: scope };
        }
        return null;
    }

    debugString() {
        return `Ball(x: ${this.x}, y: ${this.y}, state: ${this.state})`
    }
}


class Shape extends Phaser.GameObjects.Container {
    static color(lives) {
        if(lives <= 0) {
            return 0x000000;
        }

        return Shape.colors[((lives-1) * 30) % Shape.colors.length].color;
    }

    // Returns the coordinates of the corners of a N sided regular polygon.
    // In the format of "x1 y1 x2 y2 ... xN yN"
    // TODO Move to a generic polygon.js file.
    static calcPoints(rotation, sides, radius) {
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
            .setStrokeStyle(4 * factor, Shape.color(lives), 0.5);

        this.add(shape);
        this.setSize(shape.width, shape.height);

        // Text
        var text = new Phaser.GameObjects.Text(scene,
            -8, -16, // TODO figure out width/height
            lives,
            {
                fontSize: '32px',
                fill: '#000',
                align: 'center',
            }
        );
        text.setDepth(1);
        this.add(text);

        this.shape = shape;
        this.text = text;
        this.lives = lives;
    }

    hit() {
        this.lives -= 1;
        this.text.setText(this.lives);
        this.shape.setFillStyle(Shape.color(this.lives));
        this.shape.setStrokeStyle(this.shape.lineWidth, Shape.color(this.lives));
    }
}
Shape.colors = Phaser.Display.Color.HSVColorWheel();

class GameScene extends Phaser.Scene {
    constructor () {
        super({ // https://photonstorm.github.io/phaser3-docs/Phaser.Types.Scenes.html#.SettingsConfig
            key: 'game',
        });

        this.level = 1;
        
        this._score = 0;

        // GameObjects
        this.scoreText; // Displaying the score
        this.shooter;    // The line/arrow for the shooter
        this.shooterBox; // The invisible box (where the shooter is)

        this.balls = [];
        this.shapes = []; // List of all shapes.
    }

    preload ()
    {
        this.drawBallGraphics();
    }

    // TODO Make a static method of ball
    drawBallGraphic(name, color) {
        // Draw the ball
        const graphics = this.add.graphics(0, 0)
            .fillStyle(color, 1.0)
            .fillCircle(ballRadius, ballRadius, ballRadius);

        // A little spot on the ball (to see angular spin)
        if (DEBUG) {
            graphics
                .fillStyle(0xFF0000, 1.0)
                .fillCircle(ballRadius / 2, ballRadius / 2, ballRadius / 2);
        }

        graphics
            .generateTexture(name, ballRadius*2, ballRadius*2)
            .destroy();
    }

    drawBallGraphics() {
        this.drawBallGraphic('ball_inplay', 0xFFFFFF);
        this.drawBallGraphic('ball_waiting', 0xFFFF00);
    }

    create ()
    {
        this.matter.world.on('collisionstart', function(event) {
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

                    this.shapeHit(shape, ball);

                } else if (bodyA.label === 'ball' && bodyB.label === 'wall_bottom') {
                    const ball = bodyA.gameObject;

                    this.ballFell(ball);

                } else if (DEBUG) {
                    if (bodyA.label === 'ball' && (bodyB.label === 'wall' || bodyB.label === 'slide' || bodyB.label === 'ball' || bodyB.label === 'shooter')) {
                        // Ignore
                    } else {
                        console.log("unknown collisionstart", bodyA, bodyB);
                    } 
                }
            }
        }, this);


        this.createWalls();
        this.createSlides();
        this.createShooter();
        this.createShapes();
        this.createBall();
        this.createBall();
        this.createBall();
        this.createScore();

        this.setupControls();

        this.nextLevel();
//        this.nextLevel();
//        this.nextLevel();
    }

    setupControls() {
        this.input.on('pointermove', function (pointer) {
            this.shooter.setTo(0, 0, pointer.x - this.shooter.x, pointer.y - this.shooter.y);
        }, this);

        this.input.on('pointerup', function (pointer) {
            console.log("fire");

            const angle = Phaser.Math.Angle.BetweenPoints(this.shooter, pointer);
            const velocity_x = Math.cos(angle) * ballFireVelociy;
            const velocity_y = Math.sin(angle) * ballFireVelociy;

            this.fire(velocity_x, velocity_y);
        }, this);
    }

    // Fire all the balls with the specific velocity.
    fire(velocity_x, velocity_y) {
        // Find next firing ball
        const next = this.balls.find((ball) => ball.state === BALL_STATE.LOADED);
        console.assert(next, "No balls to fire: ", this.balls.map((ball) => ball.debugString()));

        this.fireBall(next, velocity_x, velocity_y);
    }

    fireBall(ball, velocity_x, velocity_y) {
        console.assert(ball instanceof Ball, "Argument is not a ball: ", ball);
        console.assert(ball.state === BALL_STATE.LOADED);

        ball.setState(BALL_STATE.INPLAY);
        ball.setVelocity(velocity_x, velocity_y);

        console.log(ball.x, ball.y);

        // Queue up the next ball.
        this.loadBall(function (ball) {
            // Once the ball is queued, FIRE!
            this.fireBall(ball, velocity_x, velocity_y);
        });
    }

    // Load the next available ball
    // Callback is called when the ball is loaded.
    loadBall(loadedCallback) {
        const waitingBalls = this.balls.filter((ball) => ball.state == BALL_STATE.WAITING);
        let ball = findNearest(waitingBalls, this.shooter.x, this.shooter.y);

        if (ball) {
            const path = new Phaser.Curves.Path()
                .lineTo(this.shooterBox.x - ball.x, this.shooterBox.y - ball.y);

            ball.setPath(path, {
                callbackScope: this,
                duration: 200, // ms // TODO Make a constant
                onComplete: function(tween, targets) {
                    ball.setState(BALL_STATE.LOADED);

                    if (loadedCallback) {
                        loadedCallback.call(this, ball);
                    }
                },
            });
        } else {
            // TODO Do we need to do something if there are no balls ready to load?
        }
    }


    update () {}

    createScore() {
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
            fontSize: '32px', // TODO Scale correctly.
            fill: '#fff',
        });
    }

    createWalls() {
        // Set the bounds of the game, to where the walls are.
        // We don't really need to do this, but it simplifies some of the bounds checking in the game.
        this.matter.world.setBounds(
            sideWidth + wallWidth, 0,                              
            config.width - (sideWidth + wallWidth) * 2, config.height);

        for(let position in this.matter.world.walls) {
            const wall = this.matter.world.walls[position];
            wall.label = 'wall';
            wall.collisionFilter = {
                group: 0,
                category: COLLISION_CAT.GAME_OBJECT,
                mask: COLLISION_CAT.BALL_INPLAY | COLLISION_CAT.BALL_WAITING,
            }
        }

        // Create the left/right wall graphics with no physic bodies (since its handled above)
        // Left
        const wallHeight = config.height - wallTop - wallBottom;
        this.add.line(sideWidth, wallTop, 0, 0, 0, wallHeight)
            .setOrigin(0, 0)
            .setLineWidth(wallWidth) // Oddly this needs to be set, the setStrokeStyle(lineWidth) doesn't seem to work.
            .setStrokeStyle(wallWidth, wallColour);

        // Right
        this.add.line(config.width - sideWidth, wallTop, 0, 0, 0, wallHeight)
            .setOrigin(0, 0)
            .setLineWidth(wallWidth)
            .setStrokeStyle(wallWidth, wallColour);

        // Bottom (curved wall)
        const curve = new Phaser.Curves.QuadraticBezier(
            new Phaser.Math.Vector2(0, 0),  // left point
            new Phaser.Math.Vector2(config.width / 2, 2 * wallCurveHeight),  // mid point (twice the needed height)
            new Phaser.Math.Vector2(config.width, 0)); // right point

        const wall = this.add.curve(config.width / 2, wallTop + wallHeight + wallCurveHeight + sideWidth, curve)
            .setStrokeStyle(wallWidth * 2, wallColour);

        const points = curve.getPoints(11).concat([ // Number of points must be odd (e.g 11), to keep the convex body symetrical.
            new Phaser.Math.Vector2(config.width, 2 * wallCurveHeight),
            new Phaser.Math.Vector2(0 , 2 * wallCurveHeight),
        ]);

        this.matter.add.gameObject(wall, {
            isStatic: true,
            label: 'wall_bottom',
            shape: { // https://cubap.github.io/phaser3-docs/physics_matter-js_components_SetBody.js.html
                type: 'fromVerts', // https://brm.io/matter-js/docs/classes/Bodies.html#method_fromVertices
                verts: points,
            },
            render: {
                // To understand offsets read https://github.com/photonstorm/phaser/issues/4067
                sprite: {
                    xOffset: 0,
                    yOffset: 0.5, // Mid point because `points`` is twice the height of `wall`.
                }
            },
            collisionFilter: {
                category: COLLISION_CAT.GAME_OBJECT,
                mask: COLLISION_CAT.BALL_INPLAY | COLLISION_CAT.BALL_WAITING,
            }
        });

        // Top (invisible)
    }

    // Create a slide. It is made up of a single line, and two bodies.
    // One body is above the line, stopping in-play balls escaping, and the other
    // is below the line, stopping out of play balls entering.
    createSlide(x, y, slope) {
        const start = slope.getStartPoint();
        const end = slope.getEndPoint();

        const slide = this.add.curve(0, 0, slope)
            .setStrokeStyle(wallWidth * 2, wallColour);

        // Draw a triangle for bottom half
        const points = [
           new Phaser.Math.Vector2(start.x, start.y),
           new Phaser.Math.Vector2(end.x, end.y),
           new Phaser.Math.Vector2(start.x, end.y),
        ];

        this.matter.add.gameObject(slide, {
            isStatic: true,
            label: 'slide',
            shape: { 
                type: 'fromVerts',
                verts: points,
            },
            collisionFilter: {
                category: COLLISION_CAT.BALL_WAITING,
                mask: COLLISION_CAT.BALL_WAITING,
            },
        });

        // Nudge the position buy the centerOfMass (to align it correctly :/)
        slide.setPosition(
            x + slide.centerOfMass.x,
            y + slide.centerOfMass.y
        );

        return slide;
    }

    createCeiling(x, y, slope) {
        const start = slope.getStartPoint();
        const end = slope.getEndPoint();

        const ceiling = this.add.zone(x, y, Math.abs(end.x - start.x), Math.abs(end.y - start.y)); // Invisible object
        
        // Draw the triangle for the top half
        const points = [
           new Phaser.Math.Vector2(start.x, start.y),
           new Phaser.Math.Vector2(end.x, end.y),
           new Phaser.Math.Vector2(end.x, start.y),
        ];

        this.matter.add.gameObject(ceiling, {
            isStatic: true,
            label: 'slide',
            shape: { 
                type: 'fromVerts',
                verts: points,
            },
            collisionFilter: {
                category: COLLISION_CAT.GAME_OBJECT,
                mask: COLLISION_CAT.BALL_INPLAY,
            },
        });

        // Nudge the position buy the centerOfMass (to align it correctly :/)
        ceiling.setPosition(
            x + ceiling.centerOfMass.x,
            y + ceiling.centerOfMass.y
        );

        return ceiling;
    }

    // Create the slides at the top that the balls hang out in
    createSlides() {
        const left  = sideWidth;
        const right = config.width - sideWidth;
        const slideWidth = (right - left - slideOpening) / 2;

        const leftSlope = new Phaser.Curves.Line(
            new Phaser.Math.Vector2(0, 0),
            new Phaser.Math.Vector2(slideWidth, slideHeight));

        const leftSlide = this.createSlide(left, wallTop, leftSlope);
        const leftCeiling = this.createCeiling(left, wallTop, leftSlope);

        const rightSlope = new Phaser.Curves.Line(
            new Phaser.Math.Vector2(0, 0),
            new Phaser.Math.Vector2(-slideWidth, slideHeight));

        const rightSlide = this.createSlide(right - slideWidth, wallTop, rightSlope);
        const rightCeiling = this.createCeiling(right - slideWidth, wallTop, rightSlope);
    }

    createShooter() {
        // The ceiling area that stops a ball re-entering the slide area
        const ceiling = this.add.zone(
            config.width/2, wallTop + slideHeight - slideOpening/4,
            2*slideOpening, slideOpening/2);
        this.matter.add.gameObject(ceiling, {
            isStatic: true,
            label: 'ceiling',
            collisionFilter: {
                category: COLLISION_CAT.GAME_OBJECT,
                mask: COLLISION_CAT.BALL_INPLAY,
            },
        });

        // The area that shoots the ball down
        this.shooterBox = this.add.zone(
            config.width/2, wallTop + slideHeight + slideOpening/4,
            2*slideOpening, slideOpening/2);
        this.matter.add.gameObject(this.shooterBox, {
            isStatic: true,
            label: 'shooter',
            collisionFilter: {
                category: COLLISION_CAT.BALL_WAITING,
                mask: COLLISION_CAT.BALL_WAITING,
            },
        });

        // The shooter arrow
        this.shooter = this.add.line(
            this.shooterBox.x, this.shooterBox.y,
            0, 0, 0, 0,
            0xffffff);

    }
 
    createBall() {
        const ball = new Ball(this, config.width/2, wallTop);

        this.add.existing(ball);
        this.matter.add.gameObject(ball, {
            shape: {
                type: 'circle',
            },
        });

        ball.body.label = 'ball';
        ball.setBounce(1);
        ball.setFriction(0.5, 0, 0);
        ball.setState(BALL_STATE.WAITING);

        this.ballsWaiting++; // TODO maybe move that into update state (or just get rid of it)
        this.balls.push(ball);
    }

    // Create many rows of shapes.
    createShapes() {
        let y = 500;
        for (let j = 0; j < 9; j++) {
            let x = sideWidth + wallWidth + shapeSpacing;

            const cols = (j % 2 == 0) ? 6 : 5;
            if (cols == 5) {
                x += shapeSpacing;
            }

            for (let i = 0; i < cols; i++) {
                const sides = Phaser.Math.Between(2, 5);
                const rotation = Phaser.Math.FloatBetween(0, 2 * Math.PI);
                const strength = Phaser.Math.Between(1, 3);

                const radius = shapeRadius[sides - 2];

                let shape;
                if (sides === 2) {
                    // A two sided polygon doesn't exist, lets use a circle instead.
                    shape = new Shape(this, x, y, rotation, 1, strength, radius);

                    // TODO Should the following be moved into the Shape class?
                    this.matter.add.gameObject(shape, {
                        isStatic: true,
                        shape: { // https://cubap.github.io/phaser3-docs/physics_matter-js_components_SetBody.js.html
                            type: 'circle',
                            radius: shape.width / 2,
                        },
                        collisionFilter: {
                            category: COLLISION_CAT.GAME_OBJECT,
                            mask: COLLISION_CAT.BALL_INPLAY,
                        }
                    });
                } else {
                    shape = new Shape(this, x, y, rotation, sides, strength, radius);
                    this.matter.add.gameObject(shape, {
                        isStatic: true,
                        shape: {
                            // API Documented here: https://cubap.github.io/phaser3-docs/physics_matter-js_components_SetBody.js.html
                            type: 'fromVerts',
                            verts: shape.pathData,
                        },
                        collisionFilter: {
                            category: COLLISION_CAT.GAME_OBJECT,
                            mask: COLLISION_CAT.BALL_INPLAY,
                        }
                    });
                }

                this.add.existing(shape);
                shape.body.label = 'shape';
                this.shapes.push(shape);

                // TODO Ensure the shapes don't overlap or touch the wall.
                x += 2 * shapeSpacing;
            }

            y += 2 * shapeSpacing;
        }
    }

    get score() {
        return this._score;
    }

    set score(x) {
        this._score = x;
        this.scoreText.setText('Score: ' + this._score);
    }

    // Returns if all the balls are waiting.
    allBallsWaiting() {
        return this.balls.every((ball) => ball.state === BALL_STATE.WAITING);
    }

    // Progress to the next level, raising the shapes, and loading the shooter
    nextLevel() {
        console.assert(this.allBallsWaiting());

        // TODO Move all shapes up
        // TODO Check if shape hit the top (aka game over)

        this.loadBall();
    }

    // Called when a ball falls out of play
    ballFell(ball) {
        // Float the ball back to the top of the screen.
        let path = new Phaser.Curves.Path();

        const y_bottom = config.height - ball.y - wallBottom + sideWidth / 2;
        const y_top = -ball.y;

        // TODO maybe make it go up the side it was moving in.
        if (ball.x < config.width / 2) {
            // On the left
            const x = -ball.x + sideWidth / 2;
            path
                .lineTo(x, y_bottom) // TODO Turn this into a curve
                .lineTo(x, y_top)
                .lineTo(-ball.x + config.width / 4, y_top);

        } else {
            // On the right
            const x = -ball.x + config.width - sideWidth / 2;
            path
                .lineTo(x, y_bottom) // TODO Turn this into a curve
                .lineTo(x, y_top)
                .lineTo(-ball.x + 3 * config.width / 4, y_top);
        }

        ball.setState(BALL_STATE.MOVING_TO_WAITING);
        ball.setPath(path, {
            callbackScope: this,
            onComplete: function() {
                ball.setState(BALL_STATE.WAITING);

                if (this.allBallsWaiting()) {
                    this.nextLevel();
                }
            },
        });
    }

    // The shape and the ball hit
    shapeHit (shape, ball)
    {
        shape.hit(ball);
        this.score += ball.strength;

        // If the ball has stopped bouncing sideways, randomly nudge it.
        if (Math.abs(ball.body.velocity.x) < 1) {
            const nudge = Phaser.Math.FloatBetween(1, 2)
            if (ball.body.velocity.x > 0) {
                ball.setVelocityX(nudge);
            } else {
                ball.setVelocityX(-nudge);
            }
        };


        if (shape.lives <= 0) {
            shape
                .setActive(false)
                .setVisible(false)
                .body.destroy();

            // TODO Should this be a map of some kind?
            this.shapes.splice( this.shapes.indexOf(shape), 1 );

            if (this.shapes.length == 0) {
                // Do something
            }
        }
    }
}


const config = { // https://photonstorm.github.io/phaser3-docs/Phaser.Types.Core.html#.GameConfig
    type: Phaser.AUTO, // Phaser.CANVAS or Phaser.WEBGL
    width:  1080, // 288, // 1440,   1080
    height: 1920, // 512, // 2560,  1920
    // TODO (this resolution is 0.75 of the original)
    zoom: 0.45, //0.75x
    render: { // https://photonstorm.github.io/phaser3-docs/Phaser.Types.Core.html#.RenderConfig
        antialias: false,
    },
    audio: {
        noAudio: true,
    },
    physics: {
        default: 'matter',
        matter: { // https://photonstorm.github.io/phaser3-docs/Phaser.Types.Physics.Matter.html#.MatterWorldConfig
            debug: DEBUG,
            debugShowInternalEdges: true,
            debugShowConvexHulls: true,
        }
    },
    scene: [ // First scene is always started
        GameScene,
    ],
};

var game = new Phaser.Game(config);

    