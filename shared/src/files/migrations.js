import { defaults } from './defaults.js';

export const version = defaults.version;

export const availableMigrations = new Set();

export function needMigrationQ(file) {
  return file.version == null
    || file.version !== defaults.version
    || hasMissingMigrations(file);
}

function hasMissingMigrations(file) {
  const fileMigrations = file.migrations ?? new Set();
  for (const m of availableMigrations) {
    if (!fileMigrations.has(m)) return true;
  }
  return false;
}

export function migrate(file, libs) {
  if (!needMigrationQ(file)) return file;

  let result = file;
  const currentVersion = file.version ?? 0;
  const targetVersion = defaults.version;

  for (let v = currentVersion + 1; v <= targetVersion; v++) {
    const migrationId = `legacy-${v}`;
    const migrationFn = migrationRegistry[migrationId];
    if (migrationFn) {
      result = migrationFn(result, libs);
    }
  }

  for (const [id, migrationFn] of Object.entries(migrationRegistry)) {
    if (id.startsWith('legacy-')) continue;
    const fileMigrations = result.migrations ?? new Set();
    if (!fileMigrations.has(id) && migrationFn) {
      result = migrationFn(result, libs);
    }
  }

  result = { ...result, version: targetVersion };
  return result;
}

export function migrateFile(file, libs) {
  return migrate(file, libs);
}

export function generateMigrationsFromVersion(v) {
  const result = new Set();
  for (let i = 1; i <= defaults.version; i++) {
    if (i <= v) {
      const id = `legacy-${i}`;
      if (availableMigrations.has(id)) {
        result.add(id);
      }
    }
  }
  return result;
}

const migrationRegistry = {};

export function registerMigration(id, fn) {
  migrationRegistry[id] = fn;
  availableMigrations.add(id);
}