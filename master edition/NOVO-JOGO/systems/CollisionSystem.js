export class CollisionSystem {
  distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  overlaps(a, b, padding = 0) {
    return this.distance(a, b) <= a.radius + b.radius + padding;
  }
}
