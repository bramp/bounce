import Geom from 'phaser/src/geom';

function distanceSquared (x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  return dx * dx + dy * dy;
}

// Returns the nearest object in objects, to the coordinates (x,y).
export function findNearest (objects, x, y) {
  if (objects.length === 0) {
    return;
  }

  let closest = 0;
  let closestDistance = distanceSquared(x, y, objects[0].x, objects[0].y);

  // Find nearest ball to the shooter, and move it.
  for (let i = 1; i < objects.length; i++) {
    const d = distanceSquared(x, y, objects[i].x, objects[i].y);
    if (d < closestDistance) {
      closest = i;
      closestDistance = d;
    }
  }

  return objects[closest];
}

// Returns the coordinates of the corners of a N sided regular polygon.
// In the format of [{x: x, y: y}, ...]".
// The center of the polygon will be at 0,0.
export function regularPolygonPoints (sides, radius) {
  console.assert(sides >= 3, sides);
  console.assert(radius >= 1, radius);

  const rotation = Math.PI / sides; // Rotate so the shapes are orientated more conventionally.
  let points = [];
  for (let i = 0; i < sides; i++) {
    const angle = 2 * Math.PI * i / sides + rotation;

    points.push({
      x: Math.sin(angle) * radius,
      y: Math.cos(angle) * radius,
    });
  }

  return points;
}

// Calculates the centroid of this polygon.
// https://en.wikipedia.org/wiki/Centroid#Of_a_polygon
// TODO Send PR to add to Phaser.Geom.Polygon()
export function centroid (points) {
  let p = new Geom.Polygon(points);

  let cx = 0;
  let cy = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const factor = (p1.x * p2.y - p2.x * p1.y);

    cx += (p1.x + p2.x) * factor;
    cy += (p1.y + p2.y) * factor;
  }

  const p1 = points[0];
  const p2 = points[points.length - 1];

  const factor = (p1.x * p2.y - p2.x * p1.y);

  cx += (p1.x + p2.x) * factor;
  cy += (p1.y + p2.y) * factor;

  return {
    x: cx / (6 * p.area),
    y: cy / (6 * p.area)
  };
}
