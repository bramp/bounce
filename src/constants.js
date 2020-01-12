const factor = 0.75; // Scaling factor TODO Remove this

export default {
  DEBUG: true,

  sideWidth: 94 * factor,

  wallTop: 130 * factor, // Distance from top of screen
  wallBottom: 230 * factor, // Distance from bottom of screen
  wallWidth: 6 * factor,
  wallCurveHeight: 120 * factor,
  wallColour: 0xffffff,
  wallThickness: 128 * factor, // TODO actually use this for the walls.

  slideHeight: 240 * factor,
  slideOpening: 94 * factor,

  ballRadius: 24 * factor,
  ballFireVelociy: 40 * factor,

  shapesRows: 9,
  shapesPerRow: 6,
  shapeStrokeWidth: 4 * factor,
  shapeRadius: [
    72 * factor, // Circle
    90 * factor, // Triangle
    90 * factor, // Square
    80 * factor // Pentagon
  ]
};
