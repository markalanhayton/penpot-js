import * as gpt from './point.js';

export function lineValue(line, point) {
  const [linePoint, lineDir] = line;
  const px = linePoint.x ?? linePoint[0];
  const py = linePoint.y ?? linePoint[1];
  const vx = lineDir.x ?? lineDir[0];
  const vy = lineDir.y ?? lineDir[1];
  const { x, y } = point;
  const a = vy;
  const b = -vx;
  const c = vy * px - vx * py;
  return a * x + b * y + c;
}

export function isInsideLinesQ(line1, line2, pos) {
  return lineValue(line1, pos) * lineValue(line2, pos) < 0;
}