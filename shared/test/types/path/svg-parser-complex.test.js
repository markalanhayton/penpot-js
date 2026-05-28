import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as svgParser from '../../../src/types/path/svg_parser.js';

describe('types/path/svg-parser — complex paths', () => {

  describe('quadratic bezier (Q/q)', () => {
    it('parses absolute quadratic bezier', () => {
      const result = svgParser.parseSvgPath('M 0 0 Q 50 0 100 50');
      assert.equal(result.length, 2);
      assert.equal(result[0].command, 'move-to');
      assert.equal(result[1].command, 'curve-to');
    });

    it('parses relative quadratic bezier', () => {
      const result = svgParser.parseSvgPath('M 10 20 q 30 0 60 10');
      assert.equal(result.length, 2);
      assert.equal(result[0].command, 'move-to');
      assert.equal(result[1].command, 'curve-to');
    });

    it('converts Q to cubic bezier with correct control points', () => {
      const result = svgParser.parseSvgPath('M 0 0 Q 25 0 50 50');
      assert.equal(result.length, 2);
      assert.equal(result[1].command, 'curve-to');
      const seg = result[1].params;
      const eps = 0.01;
      assert.ok(Math.abs(seg.x - 50) < eps, `endpoint x: expected 50, got ${seg.x}`);
      assert.ok(Math.abs(seg.y - 50) < eps, `endpoint y: expected 50, got ${seg.y}`);
      assert.ok(Math.abs(seg.c1x - (0 + 2 * (25 - 0) / 3)) < eps, `c1x: expected ~16.67, got ${seg.c1x}`);
      assert.ok(Math.abs(seg.c1y - 0) < eps, `c1y: expected 0, got ${seg.c1y}`);
      assert.ok(Math.abs(seg.c2x - (50 + 2 * (25 - 50) / 3)) < eps, `c2x: expected ~33.33, got ${seg.c2x}`);
      assert.ok(Math.abs(seg.c2y - (50 + 2 * (0 - 50) / 3)) < eps, `c2y: expected ~16.67, got ${seg.c2y}`);
    });
  });

  describe('smooth cubic bezier (S/s)', () => {
    it('parses smooth cubic after explicit cubic', () => {
      const result = svgParser.parseSvgPath('M 0 0 C 10 20 30 40 50 60 S 70 80 90 100');
      assert.equal(result.length, 3);
      assert.equal(result[0].command, 'move-to');
      assert.equal(result[1].command, 'curve-to');
      assert.equal(result[2].command, 'curve-to');
    });

    it('resolves implicit control point for S command', () => {
      const result = svgParser.parseSvgPath('M 0 0 C 10 20 30 40 50 60 S 70 80 90 100');
      assert.equal(result.length, 3);
      assert.equal(result[2].params.c1x, 70);
      assert.equal(result[2].params.c2x, 70);
      assert.equal(result[2].params.x, 90);
    });
  });

  describe('smooth quadratic bezier (T/t)', () => {
    it('parses smooth quadratic after explicit Q', () => {
      const result = svgParser.parseSvgPath('M 0 0 Q 50 0 100 50 T 150 100');
      assert.equal(result.length, 3);
      assert.equal(result[2].command, 'curve-to');
    });

    it('parses relative smooth quadratic', () => {
      const result = svgParser.parseSvgPath('M 0 0 Q 50 0 100 50 t 20 10');
      assert.ok(result.length >= 3);
    });
  });

  describe('arc commands (A/a)', () => {
    it('parses absolute arc command', () => {
      const result = svgParser.parseSvgPath('M 0 0 A 30 20 0 1 1 100 50');
      assert.ok(result.length >= 2);
      assert.equal(result[0].command, 'move-to');
      const lastCmd = result[result.length - 1];
      assert.equal(lastCmd.command, 'curve-to');
    });

    it('parses relative arc command', () => {
      const result = svgParser.parseSvgPath('M 10 10 a 20 15 30 0 1 40 20');
      assert.ok(result.length >= 2);
    });

    it('parses multiple arc parameters', () => {
      const result = svgParser.parseSvgPath('M 0 0 A 25 25 0 0 1 50 25 A 25 25 0 0 1 50 75');
      assert.ok(result.length >= 3);
    });
  });

  describe('horizontal and vertical lines (H/h, V/v)', () => {
    it('parses H command as line-to', () => {
      const result = svgParser.parseSvgPath('M 0 0 H 100');
      assert.equal(result.length, 2);
      assert.equal(result[1].command, 'line-to');
      assert.equal(result[1].params.x, 100);
      assert.equal(result[1].params.y, 0);
    });

    it('parses V command as line-to', () => {
      const result = svgParser.parseSvgPath('M 0 0 V 50');
      assert.equal(result.length, 2);
      assert.equal(result[1].command, 'line-to');
      assert.equal(result[1].params.x, 0);
      assert.equal(result[1].params.y, 50);
    });

    it('parses relative h and v commands', () => {
      const result = svgParser.parseSvgPath('M 10 20 h 30 v 40');
      assert.equal(result.length, 3);
      assert.equal(result[1].command, 'line-to');
      assert.equal(result[1].params.x, 40);
      assert.equal(result[1].params.y, 20);
      assert.equal(result[2].command, 'line-to');
      assert.equal(result[2].params.x, 40);
      assert.equal(result[2].params.y, 60);
    });
  });

  describe('error handling', () => {
    it('parses null input gracefully', () => {
      const result = svgParser.parseSvgPath(null);
      assert.equal(result.length, 0);
    });

    it('parses undefined input gracefully', () => {
      const result = svgParser.parseSvgPath(undefined);
      assert.equal(result.length, 0);
    });

    it('parses malformed path gracefully', () => {
      const result = svgParser.parseSvgPath('M 0 0 XYZ 10 10');
      assert.ok(result.length >= 1);
      assert.equal(result[0].command, 'move-to');
    });

    it('parses path with extra spaces', () => {
      const result = svgParser.parseSvgPath('M  0  0  L  10  10');
      assert.equal(result.length, 2);
      assert.equal(result[1].params.x, 10);
      assert.equal(result[1].params.y, 10);
    });

    it('parses path with commas', () => {
      const result = svgParser.parseSvgPath('M 0,0 L 10,10');
      assert.equal(result.length, 2);
      assert.equal(result[1].params.x, 10);
    });

    it('parses path with negative numbers', () => {
      const result = svgParser.parseSvgPath('M -10 -20 L 30 40');
      assert.equal(result.length, 2);
      assert.equal(result[0].params.x, -10);
      assert.equal(result[0].params.y, -20);
    });

    it('parses path with decimal numbers', () => {
      const result = svgParser.parseSvgPath('M 0.5 1.5 L 10.25 20.75');
      assert.equal(result.length, 2);
      assert.equal(result[1].params.x, 10.25);
      assert.equal(result[1].params.y, 20.75);
    });

    it('parses path with scientific notation', () => {
      const result = svgParser.parseSvgPath('M 1e2 2e1 L 3E1 4E0');
      assert.ok(result.length >= 2);
    });
  });

  describe('complex real-world paths', () => {
    it('parses a rectangle path', () => {
      const result = svgParser.parseSvgPath('M 0 0 L 100 0 L 100 50 L 0 50 Z');
      assert.equal(result.length, 5);
      assert.equal(result[0].command, 'move-to');
      assert.equal(result[4].command, 'close-path');
    });

    it('parses rounded rectangle path', () => {
      const result = svgParser.parseSvgPath('M 10 0 L 90 0 A 10 10 0 0 1 100 10 L 100 40 A 10 10 0 0 1 90 50 L 10 50 A 10 10 0 0 1 0 40 L 0 10 A 10 10 0 0 1 10 0 Z');
      assert.ok(result.length >= 9);
    });

    it('parses a circle path', () => {
      const result = svgParser.parseSvgPath('M 50 0 A 50 50 0 0 1 50 100 A 50 50 0 0 1 50 0 Z');
      assert.ok(result.length >= 3);
    });

    it('parses a triangle path', () => {
      const result = svgParser.parseSvgPath('M 50 0 L 100 100 L 0 100 Z');
      assert.equal(result.length, 4);
      assert.equal(result[0].command, 'move-to');
      assert.equal(result[1].command, 'line-to');
      assert.equal(result[2].command, 'line-to');
      assert.equal(result[3].command, 'close-path');
    });

    it('parses path with implicit line-to after move', () => {
      const result = svgParser.parseSvgPath('M 0 0 10 10');
      assert.equal(result.length, 2);
      assert.equal(result[1].command, 'line-to');
      assert.equal(result[1].params.x, 10);
      assert.equal(result[1].params.y, 10);
    });

    it('parses repeated commands with implicit line-to', () => {
      const result = svgParser.parseSvgPath('M 0 0 L 10 0 20 0 30 0');
      assert.equal(result.length, 4);
    });
  });
});