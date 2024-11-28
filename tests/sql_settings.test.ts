import {SqlMode, SqlSettings} from '../private/sql_settings.ts';
import {assertEquals} from 'jsr:@std/assert@1.0.7/equals';

const encoder = new TextEncoder;

Deno.test
(	'Basic',
	() =>
	{	const policy = new SqlSettings(SqlMode.MYSQL, 'abcd ABCD abYd abAd abZd', '!abcd ABCD abYd abAd abZd');
		assertEquals(policy.idents, 'ABAD ABCD ABYD ABZD');
		assertEquals(policy.functions, '!ABAD ABCD ABYD ABZD');

		assertEquals(policy.isIdentAllowed(encoder.encode('abcd')), true);
		assertEquals(policy.isIdentAllowed(encoder.encode('abzd')), true);
		assertEquals(policy.isIdentAllowed(encoder.encode('abc')), false);
		assertEquals(policy.isIdentAllowed(encoder.encode('abcde')), false);

		assertEquals(policy.isFunctionAllowed(encoder.encode('abcd')), false);
		assertEquals(policy.isFunctionAllowed(encoder.encode('abzd')), false);
		assertEquals(policy.isFunctionAllowed(encoder.encode('abc')), true);
		assertEquals(policy.isFunctionAllowed(encoder.encode('abcde')), true);
	}
);
