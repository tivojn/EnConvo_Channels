/**
 * Get a value from a nested object using a dot-separated path.
 *
 * @example getByPath({ a: { b: 1 } }, 'a.b') // 1
 */
export function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Set a value in a nested object using a dot-separated path.
 * Creates intermediate objects as needed.
 *
 * @example setByPath({}, 'a.b.c', 42) // { a: { b: { c: 42 } } }
 */
export function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}

/**
 * Delete a value from a nested object using a dot-separated path.
 * Returns true if the value existed and was deleted.
 */
export function unsetByPath(obj: Record<string, unknown>, path: string): boolean {
  const keys = path.split('.');
  let current: unknown = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return false;
    }
    current = (current as Record<string, unknown>)[keys[i]];
  }

  if (current === null || current === undefined || typeof current !== 'object') {
    return false;
  }

  const lastKey = keys[keys.length - 1];
  if (lastKey in (current as Record<string, unknown>)) {
    delete (current as Record<string, unknown>)[lastKey];
    return true;
  }

  return false;
}

/**
 * Parse a string value into an appropriate JS type.
 * Handles: numbers, booleans, JSON arrays/objects, strings.
 */
export function parseValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;

  // Try number
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return Number(raw);
  }

  // Try JSON (array or object)
  if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
    try {
      return JSON.parse(raw);
    } catch {
      // Fall through to string
    }
  }

  return raw;
}
