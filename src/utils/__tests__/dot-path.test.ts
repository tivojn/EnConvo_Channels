import { describe, it, expect } from 'vitest';
import { getByPath, setByPath, unsetByPath, parseValue } from '../dot-path';

describe('getByPath', () => {
  it('gets top-level value', () => {
    expect(getByPath({ foo: 42 }, 'foo')).toBe(42);
  });

  it('gets nested value', () => {
    expect(getByPath({ a: { b: { c: 'deep' } } }, 'a.b.c')).toBe('deep');
  });

  it('returns undefined for missing path', () => {
    expect(getByPath({ a: 1 }, 'b')).toBeUndefined();
  });

  it('returns undefined for path through non-object', () => {
    expect(getByPath({ a: 'string' }, 'a.b')).toBeUndefined();
  });

  it('returns object at intermediate path', () => {
    const obj = { a: { b: 1, c: 2 } };
    expect(getByPath(obj, 'a')).toEqual({ b: 1, c: 2 });
  });

  it('handles null values in path', () => {
    expect(getByPath({ a: null } as any, 'a.b')).toBeUndefined();
  });
});

describe('setByPath', () => {
  it('sets top-level value', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'foo', 42);
    expect(obj.foo).toBe(42);
  });

  it('sets nested value creating intermediates', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'a.b.c', 'deep');
    expect((obj.a as any).b.c).toBe('deep');
  });

  it('overwrites existing value', () => {
    const obj = { a: { b: 1 } };
    setByPath(obj as any, 'a.b', 2);
    expect((obj.a as any).b).toBe(2);
  });

  it('replaces non-object intermediate with object', () => {
    const obj = { a: 'not-object' };
    setByPath(obj as any, 'a.b', 1);
    expect((obj.a as any).b).toBe(1);
  });
});

describe('unsetByPath', () => {
  it('deletes top-level key', () => {
    const obj = { a: 1, b: 2 };
    expect(unsetByPath(obj, 'a')).toBe(true);
    expect(obj).toEqual({ b: 2 });
  });

  it('deletes nested key', () => {
    const obj = { a: { b: 1, c: 2 } };
    expect(unsetByPath(obj as any, 'a.b')).toBe(true);
    expect((obj.a as any).b).toBeUndefined();
    expect((obj.a as any).c).toBe(2);
  });

  it('returns false for missing path', () => {
    expect(unsetByPath({ a: 1 }, 'b')).toBe(false);
  });

  it('returns false for path through non-object', () => {
    expect(unsetByPath({ a: 'string' } as any, 'a.b')).toBe(false);
  });
});

describe('parseValue', () => {
  it('parses booleans', () => {
    expect(parseValue('true')).toBe(true);
    expect(parseValue('false')).toBe(false);
  });

  it('parses null', () => {
    expect(parseValue('null')).toBe(null);
  });

  it('parses integers', () => {
    expect(parseValue('42')).toBe(42);
    expect(parseValue('-7')).toBe(-7);
  });

  it('parses floats', () => {
    expect(parseValue('3.14')).toBe(3.14);
  });

  it('parses JSON arrays', () => {
    expect(parseValue('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('parses JSON objects', () => {
    expect(parseValue('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns string for plain text', () => {
    expect(parseValue('hello')).toBe('hello');
  });

  it('returns string for invalid JSON', () => {
    expect(parseValue('[broken')).toBe('[broken');
  });
});
