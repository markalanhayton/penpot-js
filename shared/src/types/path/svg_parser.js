const VALID_COMMANDS = new Set('ZzMmLlCcQqAaHhVvSsTt');

function isSpace(ch) {
  return ch <= ' ' && (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '\f');
}

class Parser {
  constructor(string) {
    this._string = string;
    this._currentIndex = 0;
    this._endIndex = string.length;
    this._prevCommand = null;
    this._skipOptionalSpaces();
  }

  [Symbol.iterator]() {
    return this;
  }

  next() {
    if (!this.hasNext()) return { done: true };
    return { done: false, value: this.parseSegment() };
  }

  hasNext() {
    if (this._currentIndex === 0) {
      const ch = this._string[this._currentIndex];
      return this._currentIndex < this._endIndex && (ch === 'M' || ch === 'm');
    }
    return this._currentIndex < this._endIndex;
  }

  parseSegment() {
    let ch = this._string[this._currentIndex];
    let command = VALID_COMMANDS.has(ch) ? ch : null;

    if (command === null) {
      if (this._prevCommand === null) return null;
      if ((ch === '+' || ch === '-' || ch === '.' || (ch >= '0' && ch <= '9')) && this._prevCommand !== 'Z') {
        command = this._prevCommand === 'M' ? 'L' : this._prevCommand === 'm' ? 'l' : this._prevCommand;
      } else {
        return null;
      }
    } else {
      this._currentIndex += 1;
    }

    this._prevCommand = command;
    const cmd = command.toUpperCase();
    let params = null;

    if (cmd === 'H' || cmd === 'V') {
      params = [this._parseNumber()];
    } else if (cmd === 'M' || cmd === 'L' || cmd === 'T') {
      params = [this._parseNumber(), this._parseNumber()];
    } else if (cmd === 'S' || cmd === 'Q') {
      params = [this._parseNumber(), this._parseNumber(), this._parseNumber(), this._parseNumber()];
    } else if (cmd === 'C') {
      params = [this._parseNumber(), this._parseNumber(), this._parseNumber(), this._parseNumber(), this._parseNumber(), this._parseNumber()];
    } else if (cmd === 'A') {
      params = [this._parseNumber(), this._parseNumber(), this._parseNumber(), this._parseArcFlag(), this._parseArcFlag(), this._parseNumber(), this._parseNumber()];
    } else if (cmd === 'Z') {
      this._skipOptionalSpaces();
      params = [];
    }

    if (params === null || params.indexOf(null) >= 0) return null;
    return { command, params };
  }

  _skipOptionalSpaces() {
    while (this._currentIndex < this._endIndex && isSpace(this._string[this._currentIndex])) {
      this._currentIndex += 1;
    }
    return this._currentIndex < this._endIndex;
  }

  _skipOptionalSpacesOrDelimiter() {
    if (this._currentIndex < this._endIndex && !isSpace(this._string[this._currentIndex]) && this._string[this._currentIndex] !== ',') {
      return false;
    }
    if (this._skipOptionalSpaces()) {
      if (this._currentIndex < this._endIndex && this._string[this._currentIndex] === ',') {
        this._currentIndex += 1;
        this._skipOptionalSpaces();
      }
    }
    return this._currentIndex < this._endIndex;
  }

  _parseNumber() {
    let exponent = 0, integer = 0, frac = 1, decimal = 0, sign = 1, expsign = 1;
    const startIndex = this._currentIndex;
    this._skipOptionalSpaces();

    if (this._currentIndex < this._endIndex && this._string[this._currentIndex] === '+') {
      this._currentIndex += 1;
    } else if (this._currentIndex < this._endIndex && this._string[this._currentIndex] === '-') {
      this._currentIndex += 1;
      sign = -1;
    }

    if (this._currentIndex === this._endIndex ||
        ((this._string[this._currentIndex] < '0' || this._string[this._currentIndex] > '9') && this._string[this._currentIndex] !== '.')) {
      return null;
    }

    const startIntPartIndex = this._currentIndex;
    while (this._currentIndex < this._endIndex && this._string[this._currentIndex] >= '0' && this._string[this._currentIndex] <= '9') {
      this._currentIndex += 1;
    }
    if (this._currentIndex !== startIntPartIndex) {
      let scanIdx = this._currentIndex - 1;
      let multiplier = 1;
      while (scanIdx >= startIntPartIndex) {
        integer += multiplier * (this._string[scanIdx] - '0');
        scanIdx -= 1;
        multiplier *= 10;
      }
    }

    if (this._currentIndex < this._endIndex && this._string[this._currentIndex] === '.') {
      this._currentIndex += 1;
      if (this._currentIndex >= this._endIndex || this._string[this._currentIndex] < '0' || this._string[this._currentIndex] > '9') return null;
      while (this._currentIndex < this._endIndex && this._string[this._currentIndex] >= '0' && this._string[this._currentIndex] <= '9') {
        frac *= 10;
        decimal += (this._string[this._currentIndex] - '0') / frac;
        this._currentIndex += 1;
      }
    }

    if (this._currentIndex !== startIndex && this._currentIndex + 1 < this._endIndex &&
        (this._string[this._currentIndex] === 'e' || this._string[this._currentIndex] === 'E') &&
        this._string[this._currentIndex + 1] !== 'x' && this._string[this._currentIndex + 1] !== 'm') {
      this._currentIndex += 1;
      if (this._string[this._currentIndex] === '+') { this._currentIndex += 1; }
      else if (this._string[this._currentIndex] === '-') { this._currentIndex += 1; expsign = -1; }
      if (this._currentIndex >= this._endIndex || this._string[this._currentIndex] < '0' || this._string[this._currentIndex] > '9') return null;
      while (this._currentIndex < this._endIndex && this._string[this._currentIndex] >= '0' && this._string[this._currentIndex] <= '9') {
        exponent *= 10;
        exponent += this._string[this._currentIndex] - '0';
        this._currentIndex += 1;
      }
    }

    let number = (integer + decimal) * sign;
    if (exponent) number *= Math.pow(10, expsign * exponent);
    if (startIndex === this._currentIndex) return null;
    this._skipOptionalSpacesOrDelimiter();
    return number;
  }

  _parseArcFlag() {
    if (this._currentIndex >= this._endIndex) return null;
    const flagChar = this._string[this._currentIndex];
    this._currentIndex += 1;
    let flag;
    if (flagChar === '0') flag = 0;
    else if (flagChar === '1') flag = 1;
    else return null;
    this._skipOptionalSpacesOrDelimiter();
    return flag;
  }
}

function absolutizePathData(pdata) {
  let currentX = 0, currentY = 0, subpathX = 0, subpathY = 0;
  for (const segment of pdata) {
    switch (segment.command) {
      case 'M': {
        const [x, y] = segment.params;
        subpathX = x; subpathY = y; currentX = x; currentY = y;
        break;
      }
      case 'm': {
        const x = currentX + segment.params[0];
        const y = currentY + segment.params[1];
        segment.command = 'M';
        segment.params = [x, y];
        subpathX = x; subpathY = y; currentX = x; currentY = y;
        break;
      }
      case 'L': currentX = segment.params[0]; currentY = segment.params[1]; break;
      case 'l': {
        const x = currentX + segment.params[0];
        const y = currentY + segment.params[1];
        segment.command = 'L'; segment.params = [x, y]; currentX = x; currentY = y;
        break;
      }
      case 'C': currentX = segment.params[4]; currentY = segment.params[5]; break;
      case 'c': {
        const [p0, p1, p2, p3, p4, p5] = segment.params;
        segment.command = 'C';
        segment.params = [currentX + p0, currentY + p1, currentX + p2, currentY + p3, currentX + p4, currentY + p5];
        currentX += p4; currentY += p5;
        break;
      }
      case 'Q': currentX = segment.params[2]; currentY = segment.params[3]; break;
      case 'q': {
        segment.command = 'Q';
        segment.params = [currentX + segment.params[0], currentY + segment.params[1], currentX + segment.params[2], currentY + segment.params[3]];
        currentX = segment.params[2]; currentY = segment.params[3];
        break;
      }
      case 'A': currentX = segment.params[5]; currentY = segment.params[6]; break;
      case 'a': {
        segment.params[5] = currentX + segment.params[5];
        segment.params[6] = currentY + segment.params[6];
        segment.command = 'A'; currentX = segment.params[5]; currentY = segment.params[6];
        break;
      }
      case 'H': currentX = segment.params[0]; break;
      case 'h': segment.command = 'H'; segment.params = [currentX + segment.params[0]]; currentX = segment.params[0]; break;
      case 'V': currentY = segment.params[0]; break;
      case 'v': segment.command = 'V'; segment.params = [currentY + segment.params[0]]; currentY = segment.params[0]; break;
      case 'S': currentX = segment.params[2]; currentY = segment.params[3]; break;
      case 's': {
        segment.command = 'S';
        segment.params = [currentX + segment.params[0], currentY + segment.params[1], currentX + segment.params[2], currentY + segment.params[3]];
        currentX = segment.params[2]; currentY = segment.params[3];
        break;
      }
      case 'T': currentX = segment.params[0]; currentY = segment.params[1]; break;
      case 't': {
        segment.command = 'T';
        segment.params = [currentX + segment.params[0], currentY + segment.params[1]];
        currentX = segment.params[0]; currentY = segment.params[1];
        break;
      }
      case 'Z': case 'z':
        segment.command = 'Z'; currentX = subpathX; currentY = subpathY; break;
    }
  }
  return pdata;
}

function unitVectorAngle(ux, uy, vx, vy) {
  const sign = (ux * vy - uy * vx) < 0 ? -1.0 : 1.0;
  let dot = ux * vx + uy * vy;
  dot = dot > 1.0 ? 1.0 : dot < -1.0 ? -1.0 : dot;
  return sign * Math.acos(dot);
}

function getArcCenter(x1, y1, x2, y2, fa, fs, rx, ry, sinPhi, cosPhi) {
  const x1p = cosPhi * ((x1 - x2) / 2) + sinPhi * ((y1 - y2) / 2);
  const y1p = -sinPhi * ((x1 - x2) / 2) + cosPhi * ((y1 - y2) / 2);
  let radicant = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  radicant = Math.sqrt(Math.max(0, radicant) / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)) * (fa === fs ? -1 : 1);
  const cxp = radicant * (rx / ry) * y1p;
  const cyp = radicant * (-ry / rx) * x1p;
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
  const v1x = (x1p - cxp) / rx, v1y = (y1p - cyp) / ry;
  const v2x = (-x1p - cxp) / rx, v2y = (-y1p - cyp) / ry;
  let theta1 = unitVectorAngle(1, 0, v1x, v1y);
  let dtheta = unitVectorAngle(v1x, v1y, v2x, v2y);
  if (fs === 0 && dtheta > 0) dtheta -= Math.PI * 2;
  if (fs === 1 && dtheta < 0) dtheta += Math.PI * 2;
  return [cx, cy, theta1, dtheta];
}

function approximateUnitArc(theta1, dtheta) {
  const alpha = (4.0 / 3.0) * Math.tan(dtheta / 4);
  const x1 = Math.cos(theta1), y1 = Math.sin(theta1);
  const x2 = Math.cos(theta1 + dtheta), y2 = Math.sin(theta1 + dtheta);
  return [x1, y1, x1 - y1 * alpha, y1 + x1 * alpha, x2 + y2 * alpha, y2 - x2 * alpha, x2, y2];
}

function processCurve(curve, cx, cy, rx, ry, sinPhi, cosPhi) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = curve.map((v, i) => {
    const scaled = i % 2 === 0 ? v * rx : v * ry;
    return scaled;
  });
  curve[0] = cosPhi * x0 - sinPhi * y0 + cx;
  curve[1] = sinPhi * x0 + cosPhi * y0 + cy;
  curve[2] = cosPhi * x1 - sinPhi * y1 + cx;
  curve[3] = sinPhi * x1 + cosPhi * y1 + cy;
  curve[4] = cosPhi * x2 - sinPhi * y2 + cx;
  curve[5] = sinPhi * x2 + cosPhi * y2 + cy;
  curve[6] = cosPhi * x3 - sinPhi * y3 + cx;
  curve[7] = sinPhi * x3 + cosPhi * y3 + cy;
}

export function arcToBeziers(x1, y1, x2, y2, fa, fs, rx, ry, phi) {
  const tau = Math.PI * 2;
  const phiTau = (phi * tau) / 360;
  const sinPhi = Math.sin(phiTau), cosPhi = Math.cos(phiTau);
  const x1p = (cosPhi * (x1 - x2)) / 2 + (sinPhi * (y1 - y2)) / 2;
  const y1p = (-sinPhi * (x1 - x2)) / 2 + (cosPhi * (y1 - y2)) / 2;
  if (x1p === 0 && y1p === 0) return [];
  if (rx === 0 || ry === 0) return [];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
  const cc = getArcCenter(x1, y1, x2, y2, fa, fs, rx, ry, sinPhi, cosPhi);
  const [cx, cy, theta1, dtheta0] = cc;
  const segments = Math.max(Math.ceil(Math.abs(dtheta0) / (tau / 4)), 1);
  const dtheta = dtheta0 / segments;
  const result = [];
  let currentTheta = theta1;
  for (let i = 0; i < segments; i++) {
    const curve = approximateUnitArc(currentTheta, dtheta);
    processCurve(curve, cx, cy, rx, ry, sinPhi, cosPhi);
    result.push({ command: 'C', params: curve.slice(2) });
    currentTheta += dtheta;
  }
  return result;
}

function simplifyPathData(pdata) {
  const result = [];
  let lastCommand = null, lastControlX = 0, lastControlY = 0;
  let currentX = 0, currentY = 0, subpathX = 0, subpathY = 0;

  for (const segment of pdata) {
    switch (segment.command) {
      case 'M': {
        const [x, y] = segment.params;
        result.push(segment);
        subpathX = x; subpathY = y; currentX = x; currentY = y;
        break;
      }
      case 'C': {
        result.push(segment);
        lastControlX = segment.params[2]; lastControlY = segment.params[3];
        currentX = segment.params[4]; currentY = segment.params[5];
        break;
      }
      case 'L': {
        result.push(segment);
        currentX = segment.params[0]; currentY = segment.params[1];
        break;
      }
      case 'H': {
        segment.command = 'L'; segment.params = [segment.params[0], currentY];
        result.push(segment); currentX = segment.params[0];
        break;
      }
      case 'V': {
        segment.command = 'L'; segment.params = [currentX, segment.params[0]];
        result.push(segment); currentY = segment.params[1];
        break;
      }
      case 'S': {
        const [x2, y2, x, y] = segment.params;
        const cx1 = (lastCommand === 'C' || lastCommand === 'S') ? currentX + (currentX - lastControlX) : currentX;
        const cy1 = (lastCommand === 'C' || lastCommand === 'S') ? currentY + (currentY - lastControlY) : currentY;
        segment.command = 'C'; segment.params = [cx1, cy1, x2, y2, x, y];
        result.push(segment);
        lastControlX = x2; lastControlY = y2; currentX = x; currentY = y;
        break;
      }
      case 'T': {
        const [x, y] = segment.params;
        const x1 = (lastCommand === 'Q' || lastCommand === 'T') ? currentX + (currentX - lastControlX) : currentX;
        const y1 = (lastCommand === 'Q' || lastCommand === 'T') ? currentY + (currentY - lastControlY) : currentY;
        const cx1 = currentX + 2 * (x1 - currentX) / 3;
        const cy1 = currentY + 2 * (y1 - currentY) / 3;
        const cx2 = x + 2 * (x1 - x) / 3;
        const cy2 = y + 2 * (y1 - y) / 3;
        segment.command = 'C'; segment.params = [cx1, cy1, cx2, cy2, x, y];
        result.push(segment);
        lastControlX = x1; lastControlY = y1; currentX = x; currentY = y;
        break;
      }
      case 'Q': {
        const [x1, y1, x, y] = segment.params;
        const cx1 = currentX + 2 * (x1 - currentX) / 3;
        const cy1 = currentY + 2 * (y1 - currentY) / 3;
        const cx2 = x + 2 * (x1 - x) / 3;
        const cy2 = y + 2 * (y1 - y) / 3;
        segment.command = 'C'; segment.params = [cx1, cy1, cx2, cy2, x, y];
        result.push(segment);
        lastControlX = x1; lastControlY = y1; currentX = x; currentY = y;
        break;
      }
      case 'A': {
        const rx = Math.abs(segment.params[0]), ry = Math.abs(segment.params[1]);
        const phi = segment.params[2], fa = segment.params[3], fs = segment.params[4];
        const x = segment.params[5], y = segment.params[6];
        if (rx === 0 || ry === 0) {
          result.push({ command: 'C', params: [currentX, currentY, x, y, x, y] });
          currentX = x; currentY = y;
        } else if (currentX !== x || currentY !== y) {
          const arcs = arcToBeziers(currentX, currentY, x, y, fa, fs, rx, ry, phi);
          result.push(...arcs);
          currentX = x; currentY = y;
        }
        break;
      }
      case 'Z': {
        result.push(segment);
        currentX = subpathX; currentY = subpathY;
        break;
      }
    }
    lastCommand = segment.command;
  }
  return result;
}

export function parseSvgPath(string) {
  if (!string || string.length === 0) return [];
  try {
    const source = new Parser(string);
    let result = Array.from(source).filter(s => s !== null);
    result = absolutizePathData(result);
    result = simplifyPathData(result);
    return result.map(seg => {
      switch (seg.command) {
        case 'M': return { command: 'move-to', params: { x: seg.params[0], y: seg.params[1] } };
        case 'L': return { command: 'line-to', params: { x: seg.params[0], y: seg.params[1] } };
        case 'C': return { command: 'curve-to', params: { c1x: seg.params[0], c1y: seg.params[1], c2x: seg.params[2], c2y: seg.params[3], x: seg.params[4], y: seg.params[5] } };
        case 'Z': return { command: 'close-path', params: {} };
        default: return null;
      }
    }).filter(s => s !== null);
  } catch {
    return [];
  }
}