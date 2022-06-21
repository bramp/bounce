import Phaser from 'phaser';

import constants from './constants';
import COLLISION_CAT from './collision';

// TODO We could implement a custom plugin to make it easy to create balls
// e.g https://labs.phaser.io/edit.html?src=src%5Cplugins%5Ccustom%20game%20object.js
// TODO Make the Ball class also setup the matter body
export class Ball extends Phaser.GameObjects.PathFollower {
  constructor (scene, x, y) {
    super(scene, null, x, y, 'ball');

    this.radius = constants.ballRadius; // TODO Pass this in as a argument (not a constant)
    this.strength = 1;

    // Previous value of isStatic(), and the number of in progress following.
    this._isFollowingCount = 0;
    this._wasStatic = null;
  }

  setState (newState) {
    if (this.state === newState) {
      console.log('Warning: reset to same state: ', this.debugString());
      return;
    }

    // console.log(`State transition ${this.state} -> ${newState}: `, this.debugString());

    if (newState === Ball.STATE_WAITING) {
      this.body.collisionFilter = {
        group: 0,
        category: COLLISION_CAT.BALL_WAITING,
        mask: COLLISION_CAT.BALL_WAITING | COLLISION_CAT.GAME_OBJECT
      };
      this.setTint(0xffff00); // TODO setup constant for this colour.
      this.setStatic(false);
    } else if (newState === Ball.STATE_LOADED) {
      console.assert(this.state === Ball.STATE_WAITING, 'Ball moved to LOADED state from invalid state:', this.state);
      // this.scene.textures.setTexture(this, 'ball_inplay');
      this.setTint(0xffffff);
      this.setStatic(true);
    } else if (newState === Ball.STATE_INPLAY) {
      console.assert(this.state === Ball.STATE_LOADED, 'Ball moved to INPLAY state from invalid state:', this.state);

      this.body.collisionFilter = {
        group: 0,
        category: COLLISION_CAT.BALL_INPLAY,
        mask: COLLISION_CAT.GAME_OBJECT
      };
      this.setTint(0xffffff);
      this.setStatic(false);
    } else if (newState === Ball.STATE_MOVING_TO_WAITING) {
      console.assert(this.state === Ball.STATE_INPLAY, 'Ball moved to MOVING_TO_WAITING state from invalid state:', this.state);
      this.setTint(0xffff00);
      this.setStatic(false);
    } else {
      console.assert(false, 'Invalid new state: ', newState);
    }
    this.state = newState;
  }

  advancePathFollower () {
    let tween = this.pathTween;
    let pathVector = this.pathVector;
    this.path.getPoint(tween.getValue(), pathVector);
    pathVector.add(this.pathOffset);
    this.setPosition(pathVector.x, pathVector.y);
  }

  // TODO turn the following into a MatterPathFollower Mixin, and make the Ball class extend Sprite.
  // TODO Or, change Ball to always pass a onStrt/onComplete callback which just toggles setStatic().
  startFollow (config, startAt) {
    config = config || {};

    // No need to reconfigure this, if we are using the existing config.
    if (config !== this.pathConfig) {
      // Because we override the callbacks, save the original ones (to not break the API).
      const oldOnStart = this.getCallback(config, 'onStart');
      const oldOnComplete = this.getCallback(config, 'onComplete');

      config.onStart = function (...args) {
        if (this._isFollowingCount === 0) {
          this._wasStatic = this.isStatic();

          // Must be static to disable matter.js movement's.
          this.setStatic(true);
        }
        this._isFollowingCount++;

        if (oldOnStart) {
          oldOnStart.func.apply(oldOnStart.scope, args);
        }
      };
      config.onStartScope = this;

      config.onComplete = function (...args) {
        this._isFollowingCount--;

        // Make sure to actually be at the final location (https://github.com/photonstorm/phaser/issues/4950)
        // TODO Remove once the github issue is resolved.
        this.advancePathFollower();

        // Resume matter movement
        if (this._isFollowingCount === 0) {
          // If we are no longer following a path, reset to the pre-following state.
          this.setStatic(this._wasStatic);
        }

        if (oldOnComplete) {
          oldOnComplete.func.apply(oldOnComplete.scope, args);
        }
      };
      config.onCompleteScope = this;
    }

    super.startFollow(config, startAt);
  }

  // Returns callback from the config.
  getCallback (config, name) {
    const callback = Phaser.Utils.Objects.GetValue(config, name, false);
    if (callback) {
      let scope = Phaser.Utils.Objects.GetValue(config, 'callbackScope', null);
      scope = Phaser.Utils.Objects.GetValue(config, name + 'Scope', scope);

      return { func: callback, scope: scope };
    }
    return null;
  }

  debugString () {
    const id = this.body ? this.body.id : null;
    return `Ball(id: ${id} x: ${this.x}, y: ${this.y}, state: ${this.state})`;
  }
}

Ball.GenerateTextures = function (scene) {
  // Draw a single white ball
  const radius = constants.ballRadius;
  const graphics = scene.add.graphics(0, 0)
    .fillStyle(0xffffff, 1.0)
    .fillCircle(radius, radius, radius);

  // A little spot on the ball (to see angular spin)
  if (constants.DEBUG) {
    graphics
      .fillStyle(0xFF0000, 1.0)
      .fillCircle(radius / 2, radius / 2, radius / 2);
  }

  graphics
    .generateTexture('ball', radius * 2, radius * 2)
    .destroy();
};

Ball.STATE_WAITING = 1; // Waiting to be loaded
Ball.STATE_LOADED = 2; // In the process of being loaded to fired.
Ball.STATE_INPLAY = 3; // Bouncing around in play
Ball.STATE_MOVING_TO_WAITING = 4; // Moving back to the top
