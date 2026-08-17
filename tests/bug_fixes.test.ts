import {utf8StringLength} from '../private/utf8_string_length.ts';
import {mysql, pgsql, sqlite, mssql} from '../private/sql_factory.ts';
import {mysqlQuote, pgsqlQuote} from '../private/quote.ts';
import {assertEquals} from 'jsr:@std/assert@1.0.7/equals';
import {assertThrows} from 'jsr:@std/assert@1.0.7/throws';

Deno.test
(	'utf8StringLength: lone surrogates',
	() =>
	{	const encoder = new TextEncoder;

		const strs =
		[	'\uD800', // lone high surrogate at the end
			'\uDC00', // lone low surrogate
			'\uD800A', // lone high surrogate + ASCII
			'\uD800é', // lone high surrogate + 2-byte char
			'\uD800中', // lone high surrogate + 3-byte char
			'\uD800𐀀', // lone high surrogate + valid pair
			'𐀀', // valid pair
			"'\uD800é",
		];

		for (const str of strs)
		{	assertEquals(utf8StringLength(str), encoder.encode(str).length);
		}
	}
);

Deno.test
(	'Quote string with lone surrogate',
	() =>
	{	// a lone surrogate is encoded as the replacement char; the closing apostrophe must not be lost
		assertEquals(mysqlQuote("it's \uD800é"), "'it''s �é'");
		assertEquals(pgsqlQuote("it's \uD800é"), "'it''s �é'");
		assertEquals(pgsqlQuote("it's \uD800"), "'it''s �'");
	}
);

Deno.test
(	'Doubled quote in quoted identifier in SQL fragment',
	() =>
	{	assertEquals(mysql`SELECT (${'"a""b"'})` + '', 'SELECT (`a"b`)');
		assertEquals(mysql`SELECT (${'Count("a""b")'})` + '', 'SELECT (Count(`a"b`))');
		assertEquals(mysql`SELECT ${'"a""b", "c""d"'}` + '', 'SELECT `a"b`, `c"d`');
		assertEquals(mysql`SELECT (${`"a""b" = 'x'`}) FROM t WHERE c=0` + '', "SELECT (`a\"b` = 'x') FROM t WHERE c=0");
		assertEquals(pgsql`SELECT (${'`a``b`'})` + '', 'SELECT ("a`b")');
	}
);

Deno.test
(	'Numeric literals in SQL fragment',
	() =>
	{	// decimal literals must not be treated as parent-qualified column names
		assertEquals(sqlite`SELECT (${'price > 0.5'})` + '', 'SELECT ("price" > 0.5)');
		assertEquals(mssql`SELECT (${'price > 0.5'})` + '', 'SELECT ("price" > 0.5)');
		assertEquals(mysql`SELECT (${'price > 0.5'})` + '', 'SELECT (`price` > 0.5)');
		assertEquals(sqlite`SELECT (${'price > .5'})` + '', 'SELECT ("price" > .5)');
		assertEquals(sqlite.products.where('price > 0.5').select() + '', 'SELECT * FROM "products" AS "p" WHERE ("p"."price" > 0.5)');

		// scientific notation, hex and binary literals must not be quoted as identifiers
		assertEquals(mysql`SELECT (${'1e3'})` + '', 'SELECT (1e3)');
		assertEquals(mysql`SELECT (${'1E+3'})` + '', 'SELECT (1E+3)');
		assertEquals(sqlite`SELECT (${'v > 1.5e-3'})` + '', 'SELECT ("v" > 1.5e-3)');
		assertEquals(mysql`SELECT (${'0x1F'})` + '', 'SELECT (0x1F)');
		assertEquals(mysql`SELECT (${'0b101'})` + '', 'SELECT (0b101)');

		// tokens that only start with digits are still identifiers
		assertEquals(mysql`SELECT (${'1e'})` + '', 'SELECT (`1e`)');
		assertEquals(mysql`SELECT (${'123abc'})` + '', 'SELECT (`123abc`)');
		assertEquals(mysql`SELECT (${'1e + 3'})` + '', 'SELECT (`1e` + 3)');
	}
);

Deno.test
(	'SqlTable concat() and append()',
	() =>
	{	const expected = 'SELECT * FROM `t_log` AS `t` WHERE (`t`.id=1) FOR UPDATE';

		const s = mysql.t_log.where('id=1').select();
		const s2 = s.concat(mysql` FOR UPDATE`);
		assertEquals(s2 + '', expected);
		// the original object must not be affected by concat()
		assertEquals(s + '', 'SELECT * FROM `t_log` AS `t` WHERE (`t`.id=1)');

		const s3 = mysql.t_log.where('id=1').select();
		s3.append(mysql` FOR UPDATE`);
		assertEquals(s3 + '', expected);
	}
);

Deno.test
(	'Nonfinite numbers are rejected',
	() =>
	{	assertThrows(() => mysql`SELECT '${NaN}'` + '', Error, 'Cannot represent such number: NaN');
		assertThrows(() => mysql`SELECT '${Infinity}'` + '', Error, 'Cannot represent such number: Infinity');
		assertThrows(() => mysql`SELECT '${-Infinity}'` + '', Error, 'Cannot represent such number: -Infinity');
		assertThrows(() => mysqlQuote(NaN), Error, 'Cannot represent such number: NaN');
	}
);

Deno.test
(	'Unrepresentable dates are rejected',
	() =>
	{	assertThrows(() => mysqlQuote(new Date(99999, 0, 1)), Error, 'Cannot represent such date');
		assertThrows(() => mysqlQuote(new Date(NaN)), Error, 'Cannot represent such date');
		const d = new Date(2000, 0, 1);
		d.setFullYear(999);
		assertEquals(mysqlQuote(d), "'0999-01-01'");
	}
);

Deno.test
(	'HAVING without GROUP BY',
	() =>
	{	assertThrows(() => mysql.t_log.where('').groupBy([], 'x > 1'), Error, 'HAVING cannot be used without GROUP BY expressions');
		assertThrows(() => mysql.t_log.where('').groupBy('', 'x > 1'), Error, 'HAVING cannot be used without GROUP BY expressions');
		assertEquals(mysql.t_log.where('').groupBy(['a'], 'x > 1').select() + '', 'SELECT * FROM `t_log` AS `t` GROUP BY `t`.`a` HAVING (`x` > 1)');
	}
);
