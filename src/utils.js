
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
