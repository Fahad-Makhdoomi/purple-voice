import { z } from 'zod';

/**
 * Zod 4 reworded its built-in messages ("Required" became "Invalid input:
 * expected string, received undefined", and so on). API clients show
 * `error.message` / `details[].message` to people, so keep the plainer zod 3
 * wording for the built-in checks. Messages written on a schema
 * (e.g. `.min(10, 'At least 10 characters')`) always win over this map.
 */
function received(input: unknown): string {
  if (input === null) return 'null';
  if (Array.isArray(input)) return 'array';
  if (input instanceof Date) return 'date';
  if (typeof input === 'number' && Number.isNaN(input)) return 'nan';
  return typeof input;
}

const zod3Messages: z.core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.input === undefined) return 'Required';
      return `Expected ${issue.expected}, received ${received(issue.input)}`;
    case 'too_small': {
      const { origin, minimum, inclusive, exact } = issue;
      if (origin === 'string')
        return `String must contain ${exact ? 'exactly' : inclusive ? 'at least' : 'over'} ${minimum} character(s)`;
      if (origin === 'array' || origin === 'set')
        return `Array must contain ${exact ? 'exactly' : inclusive ? 'at least' : 'more than'} ${minimum} element(s)`;
      if (origin === 'number' || origin === 'int' || origin === 'bigint')
        return `Number must be ${exact ? 'exactly equal to ' : inclusive ? 'greater than or equal to ' : 'greater than '}${minimum}`;
      return undefined;
    }
    case 'too_big': {
      const { origin, maximum, inclusive, exact } = issue;
      if (origin === 'string')
        return `String must contain ${exact ? 'exactly' : inclusive ? 'at most' : 'under'} ${maximum} character(s)`;
      if (origin === 'array' || origin === 'set')
        return `Array must contain ${exact ? 'exactly' : inclusive ? 'at most' : 'less than'} ${maximum} element(s)`;
      if (origin === 'number' || origin === 'int' || origin === 'bigint')
        return `Number must be ${exact ? 'exactly equal to ' : inclusive ? 'less than or equal to ' : 'less than '}${maximum}`;
      return undefined;
    }
    case 'invalid_format':
      if (issue.format === 'regex') return 'Invalid';
      if (issue.format === 'starts_with' && 'prefix' in issue)
        return `Invalid input: must start with "${String(issue.prefix)}"`;
      if (issue.format === 'ends_with' && 'suffix' in issue)
        return `Invalid input: must end with "${String(issue.suffix)}"`;
      if (issue.format === 'includes' && 'includes' in issue)
        return `Invalid input: must include "${String(issue.includes)}"`;
      return `Invalid ${issue.format}`;
    case 'invalid_value':
      if (issue.values.length === 1)
        return `Invalid literal value, expected ${JSON.stringify(issue.values[0])}`;
      return `Invalid enum value. Expected ${issue.values.map((v) => `'${String(v)}'`).join(' | ')}, received '${String(issue.input)}'`;
    case 'not_multiple_of':
      return `Number must be a multiple of ${issue.divisor}`;
    case 'unrecognized_keys':
      return `Unrecognized key(s) in object: ${issue.keys.map((k) => `'${k}'`).join(', ')}`;
    default:
      return undefined; // fall back to zod's own wording
  }
};

z.config({ customError: zod3Messages });
