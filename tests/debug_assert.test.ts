import {ASSERTIONS_ENABLED, debugAssert} from '../private/debug_assert.ts';
import {assert} from 'jsr:@std/assert@1.0.7/assert';

Deno.test
(	'debugAssert',
	() =>
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
