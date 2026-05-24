import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateOutboundUrl } from '../src/middleware/auth.js';

describe('validateOutboundUrl (SSRF protection)', () => {
  it('allows https URLs', () => {
    const result = validateOutboundUrl('https://example.com/webhook');
    assert.equal(result.safe, true);
  });

  it('allows http URLs', () => {
    const result = validateOutboundUrl('http://example.com/path');
    assert.equal(result.safe, true);
  });

  it('blocks non-HTTP schemes', () => {
    const result1 = validateOutboundUrl('ftp://example.com');
    assert.equal(result1.safe, false);

    const result2 = validateOutboundUrl('file:///etc/passwd');
    assert.equal(result2.safe, false);
  });

  it('blocks loopback addresses by default', () => {
    assert.equal(validateOutboundUrl('http://127.0.0.1/webhook').safe, false);
    assert.equal(validateOutboundUrl('http://localhost/webhook').safe, false);
  });

  it('blocks link-local addresses', () => {
    assert.equal(validateOutboundUrl('http://169.254.169.254/latest/meta-data/').safe, false);
  });

  it('blocks private network addresses', () => {
    assert.equal(validateOutboundUrl('http://10.0.0.1/').safe, false);
    assert.equal(validateOutboundUrl('http://172.16.0.1/').safe, false);
    assert.equal(validateOutboundUrl('http://192.168.1.1/').safe, false);
  });

  it('rejects invalid URLs', () => {
    const result = validateOutboundUrl('not-a-url');
    assert.equal(result.safe, false);
  });

  it('rejects empty string', () => {
    const result = validateOutboundUrl('');
    assert.equal(result.safe, false);
  });
});