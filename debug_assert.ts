// deno-lint-ignore-file

export const ASSERTIONS_ENABLED = true;

export function debugAssert(expr: unknown): asserts expr
{	if (ASSERTIONS_ENABLED && !expr)
	{	let stackFrame = new Error().stack?.split('\n')?.[2]?.match(/ \(.*/)?.[0] || '';
		throw new Error('Assertion failed'+stackFrame);
	}
}
