/**
 * @module rpc/demo
 * @description Demo profile RPC command — mirrors `app.rpc.commands.demo` from the Clojure backend.
 *
 * | Method              | Auth  | Since |
 * |---------------------|:-----:|-------|
 * | `create-demo-profile`| No  | 1.15  |
 */

import { v4 as uuidv4 } from 'uuid';
import { flagEnabled } from '../config/index.js';
import { RpcError } from './dispatcher.js';
import { hashPassword } from '../auth/index.js';

export default function registerDemoCommands(register, pool) {
  register('create-demo-profile', {
    auth: false,
    added: '1.15',
    handler: async (params, ctx) => {
      if (!flagEnabled('demo-users')) {
        throw new RpcError('validation', 'demo-users-not-allowed', 'Demo users are disabled by configuration');
      }

      const now = new Date().toISOString();
      const suffix = Date.now();
      const email = `demo-${suffix}.demo@example.com`;
      const fullname = `Demo User ${suffix}`;
      const password = crypto.randomUUID().replace(/-/g, '').substring(0, 24);
      const passwordHash = await hashPassword(password);

      const profileId = uuidv4();
      const defaultTeamId = pool.get('SELECT id FROM team WHERE is_default = ? AND deleted_at IS NULL LIMIT 1', ['1'])?.id
        || '00000000-0000-0000-0000-000000000001';

      const deletionDelay = parseInt(process.env.PENPOT_DELETION_DELAY || '2592000', 10) * 1000;
      const deletedAt = new Date(Date.now() + deletionDelay).toISOString();

      pool.insertOnConflictDoNothing('profile', {
        id: profileId,
        email,
        fullname,
        password: passwordHash,
        auth_backend: 'password',
        is_active: '1',
        is_demo: '1',
        deleted_at: deletedAt,
        created_at: now,
        modified_at: now,
        props: '{}',
      });

      pool.run(
        `UPDATE team_profile_rel SET is_owner = '1', is_admin = '1', can_edit = '1'
         WHERE team_id = ? AND profile_id = ?`,
        [defaultTeamId, profileId]
      );

      pool.insertOnConflictDoNothing('team_profile_rel', {
        id: uuidv4(),
        team_id: defaultTeamId,
        profile_id: profileId,
        is_owner: '0',
        is_admin: '1',
        can_edit: '1',
        created_at: now,
      });

      return { email, password };
    },
  });
}