---
name: real-code-rules
description: Enforce real implementation over mocks, fakes, stubs, simulations, silent errors, fallbacks, and hardcoded values. Use enums and constants instead of magic values. Throw all real errors. Apply when writing, reviewing, or refactoring code.
---

# Skill: Real Code Rules

Mandatory coding standards for the Penpot JS port. Apply these rules when writing new code, reviewing code, or refactoring existing code.

## 1. No Mock Implementations

**Rule:** Every function must do real work or not exist.

| ❌ Forbidden | ✅ Required |
|---|---|
| Stub functions that return hardcoded data | Real implementations that query, compute, or delegate |
| `// TODO: implement later` with fake returns | Ship the real implementation or don't ship the feature |
| Placeholder RPC handlers that return `{ status: 'ok' }` | Handlers that validate, mutate, and return real results |
| Mock data arrays in production code | Data from DB, API, or config |

**Exception:** Test files may use mocks/fixtures. Production code must not.

## 2. No Silent Errors

**Rule:** Every error must surface. Never swallow exceptions silently.

| ❌ Forbidden | ✅ Required |
|---|---|
| `catch (e) {}` | `catch (e) { console.warn('[module] Context:', e.message); }` |
| `catch (e) { /* ignored */ }` | `catch (e) { console.error('[module] Failed:', e); throw e; }` |
| `.catch(() => {})` (no logging) | `.catch(err => { console.warn('[module] Operation failed:', err.message); })` |
| Silently returning `null` on failure | Throwing `RpcError` or logging + returning a clear sentinel |

**Pattern for recoverable errors in server RPC:**
```js
try {
  await sendEmailNotification(to, subject);
} catch (err) {
  console.warn('[rpc/teams] Email notification failed:', err.message);
  // Continue — email failure should not block the RPC response
}
```

**Pattern for unrecoverable errors:**
```js
try {
  const result = await_criticalOperation();
} catch (err) {
  console.error('[module] Critical failure:', err);
  throw new RpcError('internal', 'operation-failed', err.message);
}
```

## 3. No Fallbacks That Hide Failures

**Rule:** Fallbacks must be intentional and documented, not accidental hiding of missing data.

| ❌ Forbidden | ✅ Required |
|---|---|
| `const name = data.name \|\| 'Unknown'` (masks missing data bugs) | Throw if `name` is required: `if (!data.name) throw RpcError(...)` |
| `try { x } catch { return defaultValue }` (hides the error) | `try { x } catch (e) { console.warn('[module]', e.message); return defaultValue }` — log why fallback used |
| `config.port \|\| 3000` (hides missing config) | `config.port` with env var default in `config/index.js` |

**Allowed fallbacks** (with explicit comment):
```js
// Fallback: thumbnail generation is best-effort; absence doesn't block the user
const thumbnail = await generateThumbnail(shape) ?? null;
```

## 4. No Hardcoded Values

**Rule:** Magic numbers, strings, and URLs belong in constants, config, or enums.

| ❌ Forbidden | ✅ Required |
|---|---|
| `if (role === 'owner')` | `if (role === TEAM_ROLE.OWNER)` |
| `setTimeout(fn, 5000)` | `setTimeout(fn, config.sessionRenewalAge * 1000)` |
| `const MAX_SIZE = 30 * 1024 * 1024` (inline) | `const MAX_SIZE = config.media.maxFileSize` |
| `'http://localhost:6061'` (in RPC code) | `config.exporterUri` from env |
| `['owner', 'admin', 'member']` (inline) | `const TEAM_ROLES = { OWNER: 'owner', ADMIN: 'admin', MEMBER: 'member' }` as enum object |

**Where to put constants:**
- **Config values** → `server/src/config/index.js` (env vars)
- **Feature constants** → `server/src/config/features.js` (feature sets, maps)
- **Shared enums** → `shared/src/constants.js` (role strings, media types, etc.)
- **Module-level constants** → Top of the file with `const` and a clear name

**Enum pattern for JS:**
```js
export const TEAM_ROLE = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
});
```

## 5. Throw All Real Errors

**Rule:** Every error path must propagate or log. No `try/catch` without handling.

| ❌ Forbidden | ✅ Required |
|---|---|
| `catch (e) {}` | `catch (e) { console.error('[module]', e); throw e; }` — rethrow |
| `catch (e) { return null }` | `catch (e) { console.warn('[module]', e.message); return null }` — log + sentinel |
| Swallowing `RpcError` in middleware | Let `RpcError` propagate to the error handler |
| `try { await x } catch {}` | `try { await x } catch (e) { console.warn('[module] Non-critical:', e.message) }` |

**RpcError pattern** — always include type, code, and hint:
```js
throw new RpcError('validation', 'email-domain-not-allowed', 'Email domain is not allowed');
throw new RpcError('authorization', 'registration-disabled', 'Registration is disabled');
throw new RpcError('not-found', 'object-not-found', 'File not found');
```

## 6. No Simulation or Fake Data in Production

**Rule:** Production code never serves fake data to users.

| ❌ Forbidden | ✅ Required |
|---|---|
| Hardcoded template arrays in RPC handlers | Templates loaded from resource files or DB |
| `return { files: [{ name: 'Test File' }] }` placeholders | Real data from DB queries |
| Mock auth responses | Real auth via JWE tokens and Argon2id |
| `console.log('Would send email')` in production | Real email via nodemailer (or no-op when SMTP disabled) |

**Exception:** When an external dependency is genuinely unavailable (SMTP disabled, exporter offline), log a warning and return a clear "not available" response — don't fake success.

## 7. Test Code Exemptions

These rules apply to **production code** (`src/`, `public/`, `shared/src/`). Test code (`test/`, `*.test.js`) may freely use:
- Mock functions and stub implementations
- Hardcoded test data (fixtures, UUIDs, test strings)
- Silent catches when testing error paths
- Fake timers and network mocks

## 8. Code Review Checklist

When reviewing code, check for:

- [ ] No empty `catch {}` blocks without logging
- [ ] No `|| defaultValue` that masks missing required data
- [ ] No hardcoded URLs, ports, or magic numbers
- [ ] No stub functions returning fake data
- [ ] String literals used as enums are extracted to constants
- [ ] All `RpcError` calls include type, code, and hint
- [ ] Error messages include `[module]` prefix for log searchability

## References

- Server AGENTS.md: `server/AGENTS.md`
- Client functional audit: `docs/migration/tracking.md` §"Verification Audit"
- Shared constants: `shared/src/constants.js`

## Porting Lessons (Clojure → JS)

From the SC-1 `types/file.js` port, these patterns are important for future Clojure → JS ports:

### Avoid `Object.assign` for Metadata Attachment

Clojure's `with-meta`/`meta` attaches context without mutation. In JS, never use `Object.assign(shape, { _fileCtx, _containerCtx })` — this mutates the source object, corrupting shared data. Always use spread: `{ ...shape, _fileCtx, _containerCtx }`.

### Argument Order Differences

Clojure's `(seek coll pred)` → JS `seek(pred, coll)` in `data.js`. The predicate comes first. Always verify argument order when porting Clojure collection operations.

### Text Content Detachment

When detaching external references (`detachExternalReferences`), text shapes must **always** have their content processed — not only when other shape-level properties change. The upstream `(= :text (:type shape))` check applies `detach-text` unconditionally.

### Multimethod → Switch

Clojure's `defmulti`/`defmethod` pattern (e.g., `uses-asset?`) maps to a `switch` statement on the dispatch value in JS.

### Private Function Visibility

Clojure's private functions (e.g., `transform-nodes` in `typography.cljc`) may need to be exported in JS if they're needed by other modules. Check for `(defn- ...)` or absence of `defn` export before assuming a function is internal-only.