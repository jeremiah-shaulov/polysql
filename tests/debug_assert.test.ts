// deno-lint-ignore-file

import {ASSERTIONS_ENABLED, debugAssert} from '../private/debug_assert.ts';
import {assert} from 'https://deno.land/std@0.224.0/assert/assert.ts';

Deno.test
(	'debugAssert',
	async () =>
	{	debugAssert(true);
		let error;
		try
		{	debugAssert(false);
		}
		catch (e)
		{	error = e;
		}
		assert(!ASSERTIONS_ENABLED || error);
	}
);
