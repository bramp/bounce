
    // Returns true iff the point (x,y) lies inside the polygon.
    // The polygon is a array of points in the form [x0, y0, x1, y1, ..., x0, y0]
    // https://www.jeffreythompson.org/collision-detection/poly-point.php
    function pointOnPolygon(x, y, polygon)
    {
        let collision = false;

        for (var i = 3; i < polygon.length; i += 2) {
            let currentX = polygon[i - 3];
            let currentY = polygon[i - 2];

            let nextX = polygon[i - 1];
            let nextY = polygon[i];

            // https://www.jeffreythompson.org/collision-detection/poly-point.php
            if ( ((currentY > y) != (nextY > y)) && (x < (nextX-currentX) * (y-currentY) / (nextY-currentY) + currentX) ) {
              collision = !collision;
            }
        }

        return collision;
    }

    // https://www.jeffreythompson.org/collision-detection/poly-circle.php
    function circleOnPolygon(cx, cy, cr, polygon)
    {
        for (var i = 3; i < polygon.length; i += 2) {
            let currentX = polygon[i - 3];
            let currentY = polygon[i - 2];

            let nextX = polygon[i - 1];
            let nextY = polygon[i];

            // check for collision between the circle and
            // a line formed between the two vertices.
            let collision = circleOnLine(cx, cy, cr, currentX, currentY, nextX, nextY);
            if (collision) return true;
        }

        // the above algorithm only checks if the circle
        // is touching the edges of the polygon – in most
        // cases this is enough, but the following also
        // test if the center of the circle is inside the
        // polygon.
        return pointOnPolygon(cx, cy, polygon);
    }

    // https://www.jeffreythompson.org/collision-detection/line-circle.php
    function circleOnLine(cx, cy, cr, x1, y1, x2, y2) {
      // is either end INSIDE the circle?
      // if so, return true immediately
      const inside1 = pointOnCircle(x1, y1, cx, cy, cr);
      const inside2 = pointOnCircle(x2, y2, cx, cy, cr);
      if (inside1 || inside2) return true;

      // get length of the line
      const len = Phaser.Math.Distance.Between(x1, y1, x2, y2);

      // get dot product of the line and circle
      const dot = ( ((cx-x1)*(x2-x1)) + ((cy-y1)*(y2-y1)) ) / (len * len);

      // find the closest point on the line
      const closestX = x1 + (dot * (x2-x1));
      const closestY = y1 + (dot * (y2-y1));

      // is this point actually on the line segment?
      // if so keep going, but if not, return false
      const onSegment = pointOnLine(closestX, closestY, x1, y1, x2, y2);
      if (!onSegment) return false;

      // get distance to closest point
      const distance = Phaser.Math.Distance.Between(closestX, closestY, cx, cy);

      // is the circle on the line?
      return distance <= cr;
    }

    // https://www.jeffreythompson.org/collision-detection/line-point.php
    function pointOnLine(x, y, x1, y1, x2, y2) {
      // get distance from the point to the two ends of the line
      const d1 = Phaser.Math.Distance.Between(x, y, x1, y1);
      const d2 = Phaser.Math.Distance.Between(x, y, x2, y2);

      // get the length of the line
      const lineLen = Phaser.Math.Distance.Between(x1, y1, x2, y2);

      return Math.abs(d1 + d2 - lineLen) < Number.EPSILON;
    }

    // https://www.jeffreythompson.org/collision-detection/point-circle.php
    function pointOnCircle(x, y, cx, cy, cr) {
      const dX = x - cx;
      const dY = y - cy;

      return (dX * dX) + (dY * dY) <= (cr * cr);
    }
