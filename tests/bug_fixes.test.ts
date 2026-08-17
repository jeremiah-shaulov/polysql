import {utf8StringLength} from '../private/utf8_string_length.ts';
import {mysql, pgsql, pgsqlOnly, sqlite, mssql, mssqlOnly} from '../private/sql_factory.ts';
import {mysqlQuote, pgsqlQuote, sqliteQuote, mssqlQuote} from '../private/quote.ts';
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
(	'PostgreSQL 16 numeric literals in SQL fragment',
	() =>
	{	// underscore separators and octal literals
		assertEquals(pgsql`SELECT (${'1_000_000'})` + '', 'SELECT (1_000_000)');
		assertEquals(pgsql`SELECT (${'v > 1_000.000_1'})` + '', 'SELECT ("v" > 1_000.000_1)');
		assertEquals(pgsql`SELECT (${'1_0e1_0'})` + '', 'SELECT (1_0e1_0)');
		assertEquals(pgsql`SELECT (${'0b1000_0000'})` + '', 'SELECT (0b1000_0000)');
		assertEquals(pgsql`SELECT (${'0x_FF'})` + '', 'SELECT (0x_FF)');
		assertEquals(pgsql`SELECT (${'0o755'})` + '', 'SELECT (0o755)');
		assertEquals(pgsql`SELECT (${'0O_1_000'})` + '', 'SELECT (0O_1_000)');

		// misplaced underscores make the token an identifier
		assertEquals(pgsql`SELECT (${'1__0'})` + '', 'SELECT ("1__0")');
		assertEquals(pgsql`SELECT (${'1_'})` + '', 'SELECT ("1_")');
		assertEquals(pgsql`SELECT (${'1e_5'})` + '', 'SELECT ("1e_5")');
		assertEquals(pgsql`SELECT (${'0x__F'})` + '', 'SELECT ("0x__F")');
		assertEquals(pgsql`SELECT (${'0xFF_'})` + '', 'SELECT ("0xFF_")');
		assertEquals(pgsql`SELECT (${'0o8'})` + '', 'SELECT ("0o8")');

		// other databases have no such literals, so there the same tokens are identifiers
		assertEquals(mysql`SELECT (${'1_000_000'})` + '', 'SELECT (`1_000_000`)');
		assertEquals(mysql`SELECT (${'0o755'})` + '', 'SELECT (`0o755`)');
		assertEquals(mysql`SELECT (${'0x_FF'})` + '', 'SELECT (`0x_FF`)');
		assertEquals(sqlite`SELECT (${'1_000_000'})` + '', 'SELECT ("1_000_000")');
		assertEquals(mssql`SELECT (${'0o755'})` + '', 'SELECT ("0o755")');
		// ... but hex and binary literals are still recognized everywhere
		assertEquals(mysql`SELECT (${'0xFF'})` + '', 'SELECT (0xFF)');
		assertEquals(sqlite`SELECT (${'0xFF'})` + '', 'SELECT (0xFF)');
	}
);

Deno.test
(	'PostgreSQL JSON operators and dollar-quoted strings in SQL fragment',
	() =>
	{	// jsonb operators that contain `#`
		assertEquals(pgsqlOnly`SELECT (${"data #> '{a}'"})` + '', `SELECT ("data" #> '{a}')`);
		assertEquals(pgsqlOnly`SELECT (${"data #>> '{a,b}'"})` + '', `SELECT ("data" #>> '{a,b}')`);
		assertEquals(pgsqlOnly`SELECT (${"data #- '{a}'"})` + '', `SELECT ("data" #- '{a}')`);

		// jsonb operators that contain `?`
		assertEquals(pgsqlOnly`SELECT (${"data ? 'key'"})` + '', `SELECT ("data" ? 'key')`);
		assertEquals(pgsqlOnly`SELECT (${"data ?| '{a,b}'"})` + '', `SELECT ("data" ?| '{a,b}')`);
		assertEquals(pgsqlOnly`SELECT (${"data ?& '{a,b}'"})` + '', `SELECT ("data" ?& '{a,b}')`);

		// operators that contain `@`
		assertEquals(pgsqlOnly`SELECT (${`data @> '{"a":1}'`})` + '', `SELECT ("data" @> '{"a":1}')`);
		assertEquals(pgsqlOnly`SELECT (${`data <@ '{"a":1}'`})` + '', `SELECT ("data" <@ '{"a":1}')`);
		assertEquals(pgsqlOnly`SELECT (${"data @? '$.a[*]'"})` + '', `SELECT ("data" @? '$.a[*]')`);
		assertEquals(pgsqlOnly`SELECT (${"data @@ '$.a > 1'"})` + '', `SELECT ("data" @@ '$.a > 1')`);

		// identifiers around the operators are qualified as usual
		assertEquals(pgsqlOnly`SELECT (t.${"data #>> '{a}' = 'x'"})` + '', `SELECT ("t".data #>> '{a}' = 'x')`);

		// dollar-quoted string literals: the contents (identifiers, quotes, special chars) must be passed through as is
		assertEquals(pgsqlOnly`SELECT (${'$$Hello$$'})` + '', 'SELECT ($$Hello$$)');
		assertEquals(pgsqlOnly`SELECT (${"$$It's$$"})` + '', "SELECT ($$It's$$)");
		assertEquals(pgsqlOnly`SELECT (${'$$ @ $ # ? ; [ { ( -- $$'})` + '', 'SELECT ($$ @ $ # ? ; [ { ( -- $$)');
		assertEquals(pgsqlOnly`SELECT (${'$tag$ nested $$ quotes $tag$'})` + '', 'SELECT ($tag$ nested $$ quotes $tag$)');
		assertEquals(pgsqlOnly`SELECT (${'$$a$$ = $$b$$'})` + '', 'SELECT ($$a$$ = $$b$$)');
		assertEquals(pgsqlOnly`SELECT (${'$$$$'})` + '', 'SELECT ($$$$)');

		// unterminated or mismatched dollar quotes
		assertThrows(() => pgsqlOnly`SELECT (${'$$Hello'})` + '', Error, 'Unterminated string literal in SQL fragment: $$Hello');
		assertThrows(() => pgsqlOnly`SELECT (${'$$'})` + '', Error, 'Unterminated string literal in SQL fragment: $$');
		assertThrows(() => pgsqlOnly`SELECT (${'$tag$Hello$other$'})` + '', Error, 'Unterminated string literal in SQL fragment: $tag$Hello$other$');

		// `$` that doesn't open a dollar-quoted string (like a positional parameter) is still invalid
		assertThrows(() => pgsqlOnly`SELECT (${'$1'})` + '', Error, 'Invalid character in SQL fragment: $1');
		assertThrows(() => pgsqlOnly`SELECT (${'a = $'})` + '', Error, 'Invalid character in SQL fragment: a = $');

		// the portable `pgsql` mode still rejects PostgreSQL-specific chars
		assertThrows(() => pgsql`SELECT (${"data #>> '{a,b}'"})` + '', Error, "Invalid character in SQL fragment: data #>> '{a,b}'");
		assertThrows(() => pgsql`SELECT (${"data ? 'key'"})` + '', Error, "Invalid character in SQL fragment: data ? 'key'");
		assertThrows(() => pgsql`SELECT (${`data @> '{"a":1}'`})` + '', Error, `Invalid character in SQL fragment: data @> '{"a":1}'`);
		assertThrows(() => pgsql`SELECT (${'$$Hello$$'})` + '', Error, 'Invalid character in SQL fragment: $$Hello$$');
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
(	'MS SQL Unicode string literals',
	() =>
	{	// non-ASCII literals must be `nvarchar` (N-prefixed), or the server converts them to the database collation
		assertEquals(mssqlQuote('Ünicode'), "N'Ünicode'");
		assertEquals(mssqlQuote("Привет 'Мир'"), "N'Привет ''Мир'''"); // escaping still works with the prefix
		assertEquals(mssqlQuote('日本\\語'), "N'日本\\語'");
		assertEquals(mssqlQuote({a: 'Ü'}), `N'{"a":"Ü"}'`); // objects are converted to JSON, then quoted
		assertEquals(mssqlQuote('ф'.repeat(100)), "N'"+'ф'.repeat(100)+"'"); // many 2-byte chars cause buffer of guessed size to realloc

		// ASCII-only literals stay `varchar`, so they don't lose index seeks on `varchar` columns
		assertEquals(mssqlQuote('ascii'), "'ascii'");
		assertEquals(mssqlQuote("ascii 'only'"), "'ascii ''only'''");

		// other engines are not affected
		assertEquals(mysqlQuote('Ünicode'), "'Ünicode'");
		assertEquals(pgsqlQuote('Ünicode'), "'Ünicode'");
		assertEquals(sqliteQuote('Ünicode'), "'Ünicode'");

		// the same for '${param}' in queries
		assertEquals(mssql`SELECT '${'Привет'}'` + '', "SELECT N'Привет'");
		assertEquals(mssql`SELECT '${"Привет 'Мир'"}'` + '', "SELECT N'Привет ''Мир'''");
		assertEquals(mssqlOnly`SELECT '${'ф'.repeat(100)}'` + '', "SELECT N'"+'ф'.repeat(100)+"'");
		assertEquals(mssql`SELECT '${'ascii'}'` + '', "SELECT 'ascii'");
		assertEquals(mysql`SELECT '${'Привет'}'` + '', "SELECT 'Привет'");
		assertEquals(sqlite`SELECT '${'Привет'}'` + '', "SELECT 'Привет'");

		// and in [${list}], <${rows}> and {${assignments}}
		assertEquals(mssql`A[${['Ü', 'ascii']}]B` + '', "A(N'Ü','ascii')B");
		assertEquals(mssql`INSERT INTO t <${[{a: 'Ü', b: 'x'}]}>` + '', `INSERT INTO t ("a", "b") VALUES\n(N'Ü','x')`);
		assertEquals(mssql`SET {${{a: 'Ü', b: 'x'}}}` + '', `SET "a"=N'Ü', "b"='x'`);

		// literals inside SQL fragments
		assertEquals(mssql`SELECT (${"name = 'Привет'"})` + '', `SELECT ("name" = N'Привет')`);
		assertEquals(mssql`SELECT (${"name = 'ascii'"})` + '', `SELECT ("name" = 'ascii')`);
		assertEquals(mssql`SELECT (${"name = 'don''t Ü'"})` + '', `SELECT ("name" = N'don''t Ü')`);
		assertEquals(mssql`SELECT (${"a = 'Ü' AND b = 'Ä' AND c = 'z'"})` + '', `SELECT ("a" = N'Ü' AND "b" = N'Ä' AND "c" = 'z')`);
		assertEquals(mysql`SELECT (${"name = 'Привет'"})` + '', "SELECT (`name` = 'Привет')");

		// an already prefixed literal (like one that a nested `Sql` object produced) must not be prefixed twice, and the N must not be taken for an identifier
		assertEquals(mssql`SELECT (${mssql`a = '${'Привет'}'`})` + '', `SELECT ("a" = N'Привет')`);
		assertEquals(mssql`SELECT (${"a = N'Привет'"})` + '', `SELECT ("a" = N'Привет')`);
		assertEquals(mssql`SELECT (${"a = n'Ü'"})` + '', `SELECT ("a" = n'Ü')`);
		assertEquals(mssql`SELECT (${"a = N'ascii'"})` + '', `SELECT ("a" = N'ascii')`);

		// the N must not be glued to the preceding word
		assertEquals(mssql`SELECT (${"a BETWEEN'Ю'AND'Я'"})` + '', `SELECT ("a" BETWEEN N'Ю'AND N'Я')`);

		// long literals are passed as parameters, and the driver encodes them
		const params = new Array<unknown>;
		assertEquals(mssql`SELECT '${'Ю'.repeat(100)}'`.toString(params), 'SELECT ?');
		assertEquals(params, ['Ю'.repeat(100)]);
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
