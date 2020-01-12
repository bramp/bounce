
    // Given three points, determine the center and radius of a circle.
    // Returns a Phaser.Geom.Circle, or false if no circle exists.
    // TODO reorganse the points if the gradient is zero for line a or b.
    // http://paulbourke.net/geometry/circlesphere/
    function circleFromThreePoints(x1, y1, x2, y2, x3, y3) {
        // Two lines can be formed through 2 pairs of the three points.
        // A passes through the first two points (x1,y1) and (x2,y2).
        // B passes through the next two points (x2,y2) and (x3,y3).
        const dx_a = x2 - x1;
        const dy_a = y2 - y1;
        const dx_b = x3 - x2;
        const dy_b = y3 - y2;

        // Gradients
        const m_a = dy_a / dx_a;
        const m_b = dy_b / dx_b;

        if (Math.abs(m_a - m_b) < 0.00001) {
            // Points are colinear (all three points on same line)
            return false;
        }

        // The centre of the circle is the intersection of the two lines
        // perpendicular to and passing through the midpoints of the lines a and b.
        const x =(m_a * m_b * (y1 - y3) + m_b * (x1 + x2) - m_a * (x2 + x3)) / (2 * (m_b - m_a));
        const y = -1 * (x - (x1+x2)/2) / m_a + (y1+y2)/2;

        // The radius is the distance from the center to one of the points.
        r = Math.sqrt((x1 - x) * (x1 - x) + (y1 - y) * (x1 - y));

        return new Phaser.Geom.Circle(x, y, r);
    }

    function radians_to_degrees(radians) {
        return radians * (180/Math.PI);
    }

    function degrees_to_radians(degrees) {
        return Math.PI * degrees / 180;
    }

    function CircumferencePoints(c, from, to, quantity) {
        console.assert(quantity >= 2);

        let points = [];
        const delta = (to-from);
        
        // Always do one fewer points than needed, so the last point is the "to" angle.
        quantity--;
        for (let i = 0; i < quantity; i++) {
            let p = Phaser.Geom.Circle.CircumferencePoint(c, from + i * delta / quantity);
            points.push(p);
        }

        let p = Phaser.Geom.Circle.CircumferencePoint(c, to);
        points.push(p);

        return points;
    }


  // Calculates the centroid of this polygon.
  // https://en.wikipedia.org/wiki/Centroid#Of_a_polygon
  // TODO Send PR to add to Phaser.Geom.Polygon()
  function centroid(points) {
    let p = new Phaser.Geom.Polygon(points);

    let cx = 0;
    let cy = 0;

    for (let i = 0; i < points.length - 1; i++)
    {
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
      y: cy / (6 * p.area),
    }
  }
