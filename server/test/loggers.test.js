import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { logger, createLogger } from '../src/loggers/index.js';

describe('logger', () => {
  it('has all log level methods', () => {
    assert.equal(typeof logger.trace, 'function');
    assert.equal(typeof logger.debug, 'function');
    assert.equal(typeof logger.info, 'function');
    assert.equal(typeof logger.warn, 'function');
    assert.equal(typeof logger.error, 'function');
    assert.equal(typeof logger.fatal, 'function');
  });

  it('info does not throw', () => {
    logger.info('test message', { key: 'value' });
  });

  it('warn does not throw', () => {
    logger.warn('test warning');
  });

  it('error does not throw with err object', () => {
    logger.error('test error', { code: 'E1' }, new Error('boom'));
  });

  it('trace does not throw', () => {
    logger.trace('trace msg');
  });

  it('debug does not throw', () => {
    logger.debug('debug msg');
  });

  it('fatal does not throw', () => {
    logger.fatal('fatal msg');
  });
});

describe('createLogger', () => {
  it('creates a child logger with module prefix', () => {
    const child = createLogger('rpc');
    assert.equal(typeof child.info, 'function');
    assert.equal(typeof child.warn, 'function');
    assert.equal(typeof child.error, 'function');
  });

  it('child logger methods do not throw', () => {
    const child = createLogger('test-mod');
    child.info('hello');
    child.warn('warning');
    child.error('error', {}, new Error('test'));
  });
});