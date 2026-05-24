export function validPluginData(data) {
  if (data == null) return true;
  if (typeof data !== 'object') return false;
  for (const [key, val] of Object.entries(data)) {
    if (typeof key !== 'string') return false;
    if (typeof val !== 'object' || val === null) return false;
    for (const [ik, iv] of Object.entries(val)) {
      if (typeof ik !== 'string' || typeof iv !== 'string') return false;
    }
  }
  return true;
}

export function validRegistryEntry(entry) {
  return entry != null &&
    typeof entry['plugin-id'] === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.host === 'string' &&
    typeof entry.code === 'string';
}

export function validPluginRegistry(registry) {
  return registry != null &&
    Array.isArray(registry.ids) &&
    typeof registry.data === 'object';
}