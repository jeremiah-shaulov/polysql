// deno-lint-ignore-file

import {ASSERTIONS_ENABLED, debugAssert} from '../debug_assert.ts';
import {assert} from "https://deno.land/std@0.106.0/testing/asserts.ts";

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
