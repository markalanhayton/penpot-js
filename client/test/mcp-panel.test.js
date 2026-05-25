/**
 * @module test/mcp-panel.test
 * Unit tests for MCP panel logic (protocol construction, response parsing).
 * Browser-specific tests are in e2e/mcp-panel.spec.js.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function buildMcpRequest(method, params = {}) {
  return {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params,
  };
}

function buildInitializeRequest(clientInfo = {}) {
  return buildMcpRequest('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'penpot-mcp-client', version: '1.0.0', ...clientInfo },
  });
}

function buildToolsListRequest() {
  return buildMcpRequest('tools/list', {});
}

function buildToolsCallRequest(toolName, args = {}) {
  return buildMcpRequest('tools/call', { name: toolName, arguments: args });
}

function buildResourcesListRequest() {
  return buildMcpRequest('resources/list', {});
}

function buildPromptsListRequest() {
  return buildMcpRequest('prompts/list', {});
}

function parseMcpResponse(response) {
  if (!response) {
    return { ok: false, error: { code: -1, message: 'No response' } };
  }
  if (response.error) {
    return { ok: false, error: response.error };
  }
  return { ok: true, result: response.result };
}

function generateFormFields(schema) {
  if (!schema || !schema.properties) return [];
  const fields = [];
  for (const [name, prop] of Object.entries(schema.properties)) {
    fields.push({
      name,
      type: prop.type || 'string',
      description: prop.description || '',
      required: schema.required?.includes(name) ?? false,
    });
  }
  return fields;
}

describe('MCP Protocol', () => {
  describe('request construction', () => {
    it('builds initialize request with protocol version', () => {
      const req = buildInitializeRequest();
      assert.equal(req.method, 'initialize');
      assert.equal(req.jsonrpc, '2.0');
      assert.equal(req.params.protocolVersion, '2025-03-26');
      assert.equal(req.params.clientInfo.name, 'penpot-mcp-client');
    });

    it('builds tools/list request', () => {
      const req = buildToolsListRequest();
      assert.equal(req.method, 'tools/list');
      assert.equal(req.jsonrpc, '2.0');
    });

    it('builds tools/call request with arguments', () => {
      const req = buildToolsCallRequest('my-tool', { input: 'test' });
      assert.equal(req.method, 'tools/call');
      assert.equal(req.params.name, 'my-tool');
      assert.deepEqual(req.params.arguments, { input: 'test' });
    });

    it('builds resources/list request', () => {
      const req = buildResourcesListRequest();
      assert.equal(req.method, 'resources/list');
    });

    it('builds prompts/list request', () => {
      const req = buildPromptsListRequest();
      assert.equal(req.method, 'prompts/list');
    });
  });

  describe('response parsing', () => {
    it('parses success response', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        result: { tools: [{ name: 'tool1' }] },
      };
      const parsed = parseMcpResponse(response);
      assert.equal(parsed.ok, true);
      assert.deepEqual(parsed.result.tools, [{ name: 'tool1' }]);
    });

    it('parses error response', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32600, message: 'Invalid Request' },
      };
      const parsed = parseMcpResponse(response);
      assert.equal(parsed.ok, false);
      assert.equal(parsed.error.code, -32600);
    });

    it('parses null/undefined response as error', () => {
      const parsed = parseMcpResponse(null);
      assert.equal(parsed.ok, false);
    });
  });

  describe('form field generation from input schema', () => {
    it('generates fields from simple schema', () => {
      const schema = {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Input text' },
          count: { type: 'number', description: 'Count' },
          flag: { type: 'boolean', description: 'Flag' },
        },
        required: ['text'],
      };
      const fields = generateFormFields(schema);
      assert.equal(fields.length, 3);
      assert.equal(fields[0].name, 'text');
      assert.equal(fields[0].type, 'string');
      assert.equal(fields[0].required, true);
      assert.equal(fields[1].name, 'count');
      assert.equal(fields[1].type, 'number');
      assert.equal(fields[1].required, false);
    });

    it('returns empty array for null schema', () => {
      const fields = generateFormFields(null);
      assert.equal(fields.length, 0);
    });

    it('returns empty array for schema without properties', () => {
      const fields = generateFormFields({ type: 'object' });
      assert.equal(fields.length, 0);
    });

    it('defaults type to string when not specified', () => {
      const schema = {
        type: 'object',
        properties: {
          field: { description: 'A field' },
        },
      };
      const fields = generateFormFields(schema);
      assert.equal(fields[0].type, 'string');
    });

    it('handles schema with empty required array', () => {
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: [],
      };
      const fields = generateFormFields(schema);
      assert.equal(fields.length, 1);
      assert.equal(fields[0].required, false);
    });

    it('handles schema with no required field', () => {
      const schema = {
        type: 'object',
        properties: { name: { type: 'string' } },
      };
      const fields = generateFormFields(schema);
      assert.equal(fields[0].required, false);
    });
  });

  describe('error handling', () => {
    it('handles malformed JSON-RPC response (missing jsonrpc)', () => {
      const response = { id: 1, result: {} };
      const parsed = parseMcpResponse(response);
      assert.equal(parsed.ok, true);
      assert.deepEqual(parsed.result, {});
    });

    it('handles response with undefined result', () => {
      const response = { jsonrpc: '2.0', id: 1 };
      const parsed = parseMcpResponse(response);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.result, undefined);
    });

    it('handles error response with missing message', () => {
      const response = { jsonrpc: '2.0', id: 1, error: { code: -32600 } };
      const parsed = parseMcpResponse(response);
      assert.equal(parsed.ok, false);
      assert.equal(parsed.error.code, -32600);
    });

    it('handles generateFormFields with extra unknown types', () => {
      const schema = {
        type: 'object',
        properties: {
          data: { type: 'array', description: 'List' },
          nested: { type: 'object', description: 'Config' },
        },
      };
      const fields = generateFormFields(schema);
      assert.equal(fields.length, 2);
      assert.equal(fields[0].type, 'array');
      assert.equal(fields[1].type, 'object');
    });

    it('handles buildMcpRequest with empty params', () => {
      const req = buildMcpRequest('ping');
      assert.equal(req.method, 'ping');
      assert.deepEqual(req.params, {});
      assert.equal(req.jsonrpc, '2.0');
    });

    it('handles parseMcpResponse with empty error object', () => {
      const response = { jsonrpc: '2.0', id: 1, error: {} };
      const parsed = parseMcpResponse(response);
      assert.equal(parsed.ok, false);
      assert.deepEqual(parsed.error, {});
    });
  });
});