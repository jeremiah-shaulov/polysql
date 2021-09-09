// deno-lint-ignore-file

import {utf8StringLength} from '../utf8_string_length.ts';
import {assert, assertEquals} from "https://deno.land/std@0.106.0/testing/asserts.ts";

Deno.test
(	'Basic',
	() =>
	{	const encoder = new TextEncoder();

		const strs =
		[	'',
			'String',
			'Строка',
			'מחרוזת',
			'😁'
		];

		for (let str of strs)
		{	assertEquals(utf8StringLength(str), encoder.encode(str).length);
		}
	}
);
