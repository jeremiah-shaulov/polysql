import {Sql, INLINE_STRING_MAX_LEN, INLINE_BLOB_MAX_LEN} from '../private/sql.ts';
import {mysql, mysqlOnly, pgsql, pgsqlOnly, sqlite, sqliteOnly, mssql, mssqlOnly} from '../private/sql_factory.ts';
import {mysqlQuote, pgsqlQuote, sqliteQuote, mssqlQuote} from '../private/quote.ts';
import {SqlSettings, SqlMode} from '../private/sql_settings.ts';
import {assert} from 'jsr:@std/assert@1.0.7/assert';
import {assertEquals} from 'jsr:@std/assert@1.0.7/equals';

const decoder = new TextDecoder;

Deno.test
(	'Basic',
	() =>
	{	assertEquals(mysql`'${''}'` + '', `''`);
		assertEquals(mysql`'${'A\nB'}'` + '', `'A\nB'`);
		assertEquals(mysql`'${'A\\B'}'` + '', `'A\\\\B'`);
		assertEquals(mysql`'${"A'B"}'` + '', `'A''B'`);

		assertEquals(mysql`'${123.4}'` + '', `123.4`);

		assertEquals(mysql`'${-1234n}' * '${-0.1}'` + '', `-1234 * -0.1`);

		assertEquals(mysql`'${null}'` + '', `NULL`);
		assertEquals(mysql`'${undefined}'` + '', `NULL`);
		assertEquals(mysql`'${() => {}}'` + '', `NULL`);
		assertEquals(mysql`'${Symbol.asyncIterator}'` + '', `NULL`);

		assertEquals(mysql`'${true}'` + '', `TRUE`);
		assertEquals(mysql`'${false}'` + '', `FALSE`);

		assertEquals(mssql`'${true}'` + '', `1`);
		assertEquals(mssql`'${false}'` + '', `0`);

		assertEquals(mysql`'${new Uint8Array([1, 2, 3, 4])}'` + '', `x'01020304'`);

		assertEquals(mysql`'${new Date(2000, 0, 3)}'` + '', `'2000-01-03'`);
		assertEquals(mysql`'${new Date(2000, 0, 13, 0, 0, 0, 10)}'` + '', `'2000-01-13 00:00:00.010'`);
		assertEquals(mysql`'${new Date(2000, 11, 20, 0, 12, 45)}'` + '', `'2000-12-20 00:12:45'`);
		assertEquals(mysql`'${new Date(1970, 0, 31, 11, 2, 5, 7)}'` + '', `'1970-01-31 11:02:05.007'`);
		assertEquals(mysql`'${new Date(2000, 0, 31, 22, 2, 5, 100)}'` + '', `'2000-01-31 22:02:05.100'`);

		assertEquals(mysql`'${new Uint8Array([1, 2, 10, 254])}'` + '', `x'01020AFE'`);
		assertEquals(pgsql`'${new Uint8Array([1, 2, 10, 254])}'` + '', `x'01020AFE'`);
		assertEquals(sqlite`'${new Uint8Array([1, 2, 10, 254])}'` + '', `x'01020AFE'`);
		assertEquals(mssql`'${new Uint8Array([1, 2, 10, 254])}'` + '', `0x01020AFE`);

		assertEquals(mysql`"${null}"` + '', '`null`');
		assertEquals(mysql`"${'One"Two"'}"` + '', '`One"Two"`');
		assertEquals(mysql`"${'One`Two`'}"` + '', '`One``Two```');

		assertEquals(sqlite`\`${null}\`` + '', '"null"');
		assertEquals(sqlite`\`${'One"Two"'}\`` + '', '"One""Two"""');
		assertEquals(sqlite`\`${'One`Two`'}\`` + '', '"One`Two`"');

		assertEquals(mysql`"${'ф'.repeat(100)}"` + '', '`'+'ф'.repeat(100)+'`'); // many 2-byte chars cause buffer of guessed size to realloc

		assertEquals(mysql`"${['a', 'b b']}*"` + '', '`a`, `b b`');
		assertEquals(mysql`"${[]}*"` + '', '*');

		assertEquals(mysql`"${['a', 'b b']}+"` + '', '`a`, `b b`');

		assertEquals(mysql`"${['a', 'b b']},"` + '', '`a`, `b b`,');
		assertEquals(mysql`"${[]},"` + '', '');

		assertEquals(mysql`"par.${['a', 'b b']}*"` + '', '`par`.`a`, `par`.`b b`');
		assertEquals(mysql`"par.${[]}*"` + '', '*');

		assertEquals(mysql`"par.${['a', 'b b']}+"` + '', '`par`.`a`, `par`.`b b`');

		assertEquals(mysql`"par.${['a', 'b b']},"` + '', '`par`.`a`, `par`.`b b`,');
		assertEquals(mysql`"par.${[]},"` + '', '');
		assertEquals(mysql`"par.${[]},"c` + '', 'c');

		assertEquals(mysql`"${'par'}.${['a', 'b b']}*"` + '', '`par`.`a`, `par`.`b b`');
		assertEquals(mysql`"${'par'}.${[]}*"` + '', '*');

		let s = mysql`фффффффффффффффффффффффффффффффффффффф "${'``'}"`;
		assertEquals(s+'', "фффффффффффффффффффффффффффффффффффффф ``````");

		s = mysql`2*2`;
		assertEquals('' + mysql`(${s})`, `(2*2)`);

		assertEquals('' + mysql`(t1.${'a * "t2".b'})`, '(`t1`.a * `t2`.b)');
		assertEquals('' + pgsql`(t1.${'a * "t2".b'})`, '("t1".a * "t2".b)');
		assertEquals('' + sqlite`(t1.${'a * "t2".b'})`, '("t1"."a" * "t2"."b")');
		assertEquals('' + mssql`(t1.${'a * "t2".b'})`, '("t1"."a" * "t2"."b")');

		assertEquals('' + mysql`(t1.${'`my "quoted" ``backticked`` name`'})`, '(`t1`.`my "quoted" ``backticked`` name`)');
		assertEquals('' + mysql`(t1.${'"my ""quoted"" `backticked` name"'})`, '(`t1`.`my "quoted" ``backticked`` name`)');

		assertEquals('' + pgsql`(t1.${'`my "quoted" ``backticked`` name`'})`, '("t1"."my ""quoted"" `backticked` name")');
		assertEquals('' + pgsql`(t1.${'"my ""quoted"" `backticked` name"'})`, '("t1"."my ""quoted"" `backticked` name")');

		s = mysql`a * "t2".b`;
		assertEquals('' + mysql`(t1.${s})`, "(`t1`.a * `t2`.b)");

		s = mysql`a * (${'b'}) * (t2.${'c'})`;
		assertEquals('' + mysql`(t1.${s})`, "(`t1`.a * (`t1`.b) * (`t2`.c))");

		// json
		const value = {a: 1, b: 'the b'};
		const str = mysql`'${value}'` + '';
		assertEquals(JSON.parse(str.slice(1, -1)), value);

		let error: Error|undefined;
		try
		{	mysql`'${2n ** 64n}'`.toString();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Cannot represent such bigint: ${2n ** 64n}`);

		error = undefined;
		try
		{	mysql`'${new ReadableStream}'`.toString();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Cannot stringify ReadableStream`);

		error = undefined;
		try
		{	mysql`'${{read() {}}}'`.toString();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Cannot stringify Deno.Reader`);

		error = undefined;
		try
		{	mysql`'${1}"`.toString();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Inappropriately quoted parameter`);

		error = undefined;
		try
		{	mysql`"par.${1}/"`.toString();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Inappropriately enclosed parameter`);

		error = undefined;
		try
		{	mysql`"par.${1}`.toString();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Inappropriately enclosed parameter`);

		error = undefined;
		try
		{	mysql`"${'\0'}"`.toString();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Quoted identifier cannot contain 0-char`);

		error = undefined;
		try
		{	assertEquals(mysql`"${[]}+"` + '', '*');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'No names for "${param}+"');

		error = undefined;
		try
		{	assertEquals(mysql`"${null}+"` + '', '*');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'Parameter for "${...}+" must be iterable');

		error = undefined;
		try
		{	new Sql(new SqlSettings(SqlMode.MYSQL), [], []);
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'Please, pass arguments from a string template');

	}
);

Deno.test
(	'SQL (${param})',
	() =>
	{	let expr = `The string - 'It''s string \\'`;
		let s = mysql`A.(${expr}).B`;
		assertEquals(s+'', `A.(\`The\` \`string\` - 'It''s string \\\\').B`);
		assertEquals(s.toString(undefined, true), `A.(\`The\` \`string\` - 'It''s string \\').B`);

		expr = `EXISTS(SELECT 1)`;
		s = mysql`SELECT (${expr})`;
		assertEquals(s+'', `SELECT (EXISTS(\`SELECT\` 1))`);
		assertEquals(s.toString(undefined, true), `SELECT (EXISTS(\`SELECT\` 1))`);

		s.sqlSettings = new SqlSettings(SqlMode.MYSQL, undefined, '!EXISTS');
		assertEquals(s+'', `SELECT (\`EXISTS\`(\`SELECT\` 1))`);
		s.sqlSettings = new SqlSettings(SqlMode.MYSQL, 'on select', '! EXISTS');
		assertEquals(s+'', `SELECT (\`EXISTS\`(SELECT 1))`);

		expr = `EXISTS(SELECT (1))`;
		s = mysql`SELECT (${expr})`;
		assertEquals(s+'', `SELECT (EXISTS(\`SELECT\` (1)))`);
		s.sqlSettings = new SqlSettings(SqlMode.MYSQL, undefined, '!HELLO');
		assertEquals(s+'', `SELECT (EXISTS(SELECT( 1)))`);

		expr = `Count (*)`;
		s = mysql`SELECT (${expr})`;
		assertEquals(s+'', `SELECT (Count( *))`);
		s.sqlSettings = new SqlSettings(SqlMode.MYSQL, undefined, '!Count');
		assertEquals(s+'', `SELECT (\`Count\` (*))`);

		expr = "id=10 AND value IS NOT NULL";
		s = mysql`SELECT '${null}' (${expr})`;
		assertEquals(s+'', `SELECT NULL (\`id\`=10 AND \`value\` IS NOT NULL)`);

		expr = `name AND Count(*)`;
		s = mysql`SELECT (${expr})`;
		s.sqlSettings = new SqlSettings(SqlMode.MYSQL, 'and');
		assertEquals(s+'', `SELECT (\`name\` AND Count(*))`);
		s.sqlSettings = new SqlSettings(SqlMode.MYSQL, '', 'count');
		assertEquals(s+'', `SELECT (\`name\` \`AND\` Count(*))`);
		s.sqlSettings = new SqlSettings(SqlMode.MYSQL, 'name', 'count');
		assertEquals(s+'', `SELECT (name \`AND\` Count(*))`);
		s.sqlSettings = new SqlSettings(SqlMode.MYSQL, 'name', '');
		assertEquals(s+'', `SELECT (name \`AND\` \`Count\`(*))`);
		s.sqlSettings = new SqlSettings(SqlMode.MYSQL, 'name name name', '');
		assertEquals(s+'', `SELECT (name \`AND\` \`Count\`(*))`);
		s.sqlSettings = new SqlSettings(SqlMode.MYSQL, '!name');
		assertEquals(s+'', `SELECT (\`name\` AND Count(*))`);

		expr = `name AND \`Count\`(*)`;
		s = mysql`SELECT (${expr})`;
		assertEquals(s+'', `SELECT (\`name\` AND \`Count\`(*))`);

		expr = `name AND "Count"(*)`;
		s = mysql`SELECT (${expr})`;
		assertEquals(s+'', `SELECT (\`name\` AND \`Count\`(*))`);

		expr = `name AND \`Count(\`\`*\`\`)\`(*)`;
		s = mysql`SELECT (${expr})`;
		assertEquals(s+'', `SELECT (\`name\` AND \`Count(\`\`*\`\`)\`(*))`);

		expr = `name AND "Count(""*"")"(*)`;
		s = mysql`SELECT (${expr})`;
		assertEquals(s+'', `SELECT (\`name\` AND \`Count("*")\`(*))`);

		s = mysql`SELECT (${'"The `90s"'})`;
		assertEquals(s+'', "SELECT (`The ``90s`)");

		expr = `name AND \`Count\`(*) OR Sum(a=1)>10`;
		s = mysql`SELECT (ta.${expr})`;
		assertEquals(s+'', "SELECT (`ta`.name AND `Count`(*) OR Sum(`ta`.a=1)>10)");

		expr = `"name" AND "Count"(*) OR Sum(\`a\` = 1)>10`;
		s = mysql`SELECT (ta.${expr})`;
		assertEquals(s+'', "SELECT (`ta`.`name` AND `Count`(*) OR Sum(`ta`.`a` = 1)>10)");

		let error: Error|undefined;
		try
		{	'' + mysql`SELECT (${`A ' B`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Unterminated string literal in SQL fragment: A ' B`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${"A ` B"})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Unterminated quoted identifier in SQL fragment: A ` B");

		error = undefined;
		try
		{	'' + mysql`SELECT (${`'abc'"def`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Unterminated quoted identifier in SQL fragment: 'abc'"def`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`"abc"(def`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Unbalanced parenthesis in SQL fragment: "abc"(def`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`A -- B`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Comment in SQL fragment: A -- B`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`A /* B`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Comment in SQL fragment: A /* B`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`A # B`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Invalid character in SQL fragment: A # B`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`Char_length(@var)`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Invalid character in SQL fragment: Char_length(@var)`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`10/3; DROP ALL`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Invalid character in SQL fragment: 10/3; DROP ALL`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`name[0`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Invalid character in SQL fragment: name[0`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`0]`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Invalid character in SQL fragment: 0]`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`name{0`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Invalid character in SQL fragment: name{0`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`0}`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Invalid character in SQL fragment: 0}`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`$$Hello$$`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Invalid character in SQL fragment: $$Hello$$`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`\0`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Invalid character in SQL fragment: \0`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`?`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Invalid character in SQL fragment: ?`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`:par`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Invalid character in SQL fragment: :par`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`Count(* + 1`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Unbalanced parenthesis in SQL fragment: Count(* + 1`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`Count(*) - 1)`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Unbalanced parenthesis in SQL fragment: Count(*) - 1)`);

		error = undefined;
		try
		{	'' + mysql`SELECT (${`name, Count(*)`})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Comma in SQL fragment: name, Count(*)`);

		error = undefined;
		try
		{	'' + mysql`SELECT "${null})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Inappropriately enclosed parameter`);

		error = undefined;
		try
		{	'' + mysql`SELECT \`${null})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Inappropriately enclosed parameter`);

		error = undefined;
		try
		{	'' + mysql`SELECT [${null})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Inappropriately enclosed parameter`);

		error = undefined;
		try
		{	'' + mysql`SELECT [${null}]`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'In SQL fragment: parameter for [${...}] must be iterable');

		error = undefined;
		try
		{	'' + mysql`SELECT <${null})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Inappropriately enclosed parameter`);

		error = undefined;
		try
		{	'' + mysql`SELECT <${null}>`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'In SQL fragment: parameter for <${...}> must be iterable');

		error = undefined;
		try
		{	'' + mysql`SELECT {${null})`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Inappropriately enclosed parameter`);

		error = undefined;
		try
		{	'' + mysql`SELECT {${null}}`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'In SQL fragment: parameter for {${...}} must be object');

		error = undefined;
		try
		{	'' + mysql`SELECT (${`name, Count(*)`}`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Inappropriately enclosed parameter`);

		assertEquals('' + mysql`SELECT (${`Count(name, "value")`})`, `SELECT (Count(\`name\`, \`value\`))`);

		expr = `a.and and b. or or c .col_1_ф`;
		s = mysql`SELECT (${expr})`;
		assertEquals(s+'', "SELECT (`a`.and and `b`. or or `c` .col_1_ф)");

		expr = `select(col)`;
		s = mysql`SELECT (al.${expr})`;
		assertEquals(s+'', "SELECT (`select`(`al`.col))");

		expr = `"a\`b"`;
		s = mysql`SELECT (al.${expr})`;
		assertEquals(s+'', "SELECT (`al`.`a``b`)");

		expr = `"a\`b"`;
		let alias = 'the alias';
		s = mysql`SELECT (${alias}.${expr})`;
		assertEquals(s+'', "SELECT (`the alias`.`a``b`)");

		expr = `"a\`b"`;
		alias = '';
		s = mysql`SELECT (${alias}.${expr})`;
		assertEquals(s+'', "SELECT (`a``b`)");

		expr = `"a\`b"`;
		s = mysql`SELECT (${null}.${expr})`;
		assertEquals(s+'', "SELECT (`a``b`)");

		const expr2 = mysql`a || 'фффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффф'`;
		s = mysql`S (${expr2})`;
		assertEquals(s+'', "S (`a` || 'фффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффффф')");

		expr = 'a + b.c + d.e.f';
		s = mysql`SELECT (p.${expr})`;
		assertEquals(s+'', "SELECT (`p`.a + `b`.c + `d`.e.f)");
		s = mssql`SELECT (p.${expr})`;
		assertEquals(s+'', `SELECT ("p"."a" + "b"."c" + "d"."e"."f")`);
	}
);

Deno.test
(	'SQL ${param}',
	() =>
	{	let expr = `The string - 'It''s string \\'`;
		let s = mysql`A-${expr}-B`;
		assertEquals(s+'', `A-\`The\` \`string\` - 'It''s string \\\\'-B`);
		assertEquals(s.toString(undefined, true), `A-\`The\` \`string\` - 'It''s string \\'-B`);

		expr = "col1, `col2`, 3.0";
		s = mysql`A-${expr}-B`;
		assertEquals(s+'', "A-`col1`, `col2`, 3.0-B");

		expr = "col1, `col2`, 3.0";
		s = mysql`A-tab.${expr}-B`;
		assertEquals(s+'', "A-`tab`.col1, `tab`.`col2`, 3.0-B");

		expr = "col1, `col2`, 3.0, fn()";
		let alias = 'the_alias';
		const alias2 = 'the_alias 2!';
		s = mysql`A-${alias}.${expr}-${alias2}.${expr}-B`;
		assertEquals(s+'', "A-`the_alias`.col1, `the_alias`.`col2`, 3.0, fn()-`the_alias 2!`.col1, `the_alias 2!`.`col2`, 3.0, fn()-B");

		expr = "col1, `col2`, 3.0, fn()";
		alias = '';
		s = mysql`A-${alias}.${expr}-B`;
		assertEquals(s+'', "A-`col1`, `col2`, 3.0, fn()-B");

		let error: Error|undefined;
		try
		{	'' + mysql`A-${0}.${expr}-B`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Parent qualifier name must be string");
	}
);

Deno.test
(	'SQL [${param}]',
	() =>
	{	const list = [12.5, 'ABC\'D\'EF', new Date(2000, 0, 1)];
		let s = mysql`A[${list}]B`;
		assertEquals(s+'', `A(12.5,'ABC''D''EF','2000-01-01')B`);

		const list2 = [[12.5, 13], ['ABC\'D\'EF'], new Date(2000, 0, 1)];
		s = mysqlOnly`A[${list2}]B`;
		assertEquals(s+'', `A((12.5,13),('ABC''D''EF'),'2000-01-01')B`);

		s = mysql`A[${[]}]B`;
		assertEquals(s+'', `A(NULL)B`);

		const list3 = [[1, {}, () => {}]];
		s = mysqlOnly`A[${list3}]B`;
		assertEquals(s+'', `A((1,NULL,NULL))B`);

		let error: Error|undefined;
		try
		{	'' + mysql`A[${list3}]B`
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Multidimensional [${param}] lists are not supported across all engines. Please use mysqlOnly`...`");

		error = undefined;
		try
		{	'' + pgsql`A[${list3}]B`
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Multidimensional [${param}] lists are not supported across all engines. Please use pgsqlOnly`...`");

		error = undefined;
		try
		{	'' + sqlite`A[${list3}]B`
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Multidimensional [${param}] lists are not supported on SQLite");

		error = undefined;
		try
		{	'' + sqliteOnly`A[${list3}]B`
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Multidimensional [${param}] lists are not supported on SQLite");

		error = undefined;
		try
		{	'' + mssql`A[${list3}]B`
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Multidimensional [${param}] lists are not supported on MS SQL");

		error = undefined;
		try
		{	'' + mssqlOnly`A[${list3}]B`
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Multidimensional [${param}] lists are not supported on MS SQL");

		error = undefined;
		try
		{	'' + pgsqlOnly`A[${[list3]}]B`
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "More than 2-dimension [${param}] lists are not supported on PostgreSQL");
	}
);

Deno.test
(	'SQL put_params_to',
	() =>
	{	let value = "*".repeat(INLINE_STRING_MAX_LEN+1);
		let s = mysql`A'${value}'B`;
		let putParamsTo: unknown[] = [];
		assertEquals(s.toString(putParamsTo, false), `A?B`);
		assertEquals(putParamsTo, [value]);

		value = value.slice(1);
		s = mysql`A'${value}'B`;
		putParamsTo = [];
		assertEquals(s.toString(putParamsTo, false), `A'${value}'B`);
		assertEquals(putParamsTo, []);

		let data = new Uint8Array(INLINE_BLOB_MAX_LEN+1);
		data.fill('a'.charCodeAt(0));
		s = mysql`A'${data}'B`;
		putParamsTo = [];
		assertEquals(s.toString(putParamsTo, false), `A?B`);
		assertEquals(putParamsTo, [data]);

		data = data.subarray(1);
		s = mysql`A'${data}'B`;
		putParamsTo = [];
		assertEquals(s.toString(putParamsTo, false), `Ax'${data[0].toString(16).repeat(data.length)}'B`);
		assertEquals(putParamsTo, []);

		const reader = new ReadableStream;
		s = mysql`A'${reader}'B`;
		putParamsTo = [];
		assertEquals(s.toString(putParamsTo, false), `A?B`);
		assertEquals(putParamsTo, [reader]);
	}
);

Deno.test
(	'Sql.concat(), Sql.append(), Sql.toSqlBytesWithParamsBackslashAndBuffer()',
	() =>
	{	const s = mysql`A, '${'B'}', C`;
		let s2 = s.concat(mysql`, '${'D'}'`).concat(mysql`.`).concat(mysql``);
		assertEquals(s2+'', `A, 'B', C, 'D'.`);
		assert(s != s2);

		s2 = s.append(mysql`, '${'D'}'`).append(mysql`.`).append(mysql``);
		assertEquals(s2+'', `A, 'B', C, 'D'.`);
		assertEquals(s, s2);

		const expectedResult = "`id` = ?";
		const putParamsTo: unknown[] = [];
		const buffer = new Uint8Array(expectedResult.length);
		const param = 'a'.repeat(INLINE_STRING_MAX_LEN+1);
		const buffer2 = mysql`"${'id'}" = '${param}'`.toSqlBytesWithParamsBackslashAndBuffer(putParamsTo, false, buffer);
		assert(buffer2.buffer == buffer.buffer);
		assertEquals(decoder.decode(buffer2), expectedResult);
		assertEquals(putParamsTo[0], param);
	}
);

Deno.test
(	'SQL <${param}>',
	() =>
	{	const rows =
		[	{value: 10, name: 'text 1'},
			{value: 11, name: 'text 2', junk: 'j'},
		];
		const s = mysql`INSERT INTO t_log <${rows}>`;
		assertEquals(s+'', "INSERT INTO t_log (`value`, `name`) VALUES\n(10,'text 1'),\n(11,'text 2')");

		let error: Error|undefined;
		try
		{	'' + mysql`INSERT INTO t_log <${[{}]}>`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "No fields for <${param}>");
	}
);

Deno.test
(	'SQL {${param}}',
	() =>
	{	let row = {a: 10, val: 'text 1'};
		let s = mysql`SET {${row}}`;
		assertEquals(s+'', "SET `a`=10, `val`='text 1'");

		row = {a: 10, val: 'text 1'};
		s = mysql`SET {ta.${row}}`;
		assertEquals(s+'', "SET `ta`.`a`=10, `ta`.`val`='text 1'");

		s = mysql`SET {${'ta'}.${row}}`;
		assertEquals(s+'', "SET `ta`.`a`=10, `ta`.`val`='text 1'");

		row = {a: 10, val: 'text 1'};
		s = mysql`SET {${row},}`;
		assertEquals(s+'', "SET `a`=10, `val`='text 1',");

		row = {a: 10, val: 'text 1'};
		s = mysql`SET {ta.${row},}`;
		assertEquals(s+'', "SET `ta`.`a`=10, `ta`.`val`='text 1',");

		let error: Error|undefined;
		try
		{	'' + mysql`SET {${{}}}`;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "In SQL fragment: 0 values for {${...}}");

		let row2 = {};
		s = mysql`SET {ta.${row2},}`;
		assertEquals(s+'', "SET ");

		row = {a: 10, val: 'text 1'};
		s = mysql`SET {ta.${row}&}`;
		assertEquals(s+'', "SET (`ta`.`a`=10 AND `ta`.`val`='text 1')");

		row = {a: 10, val: 'text 1'};
		s = mysql`SET {ta.${row}|}`;
		assertEquals(s+'', "SET (`ta`.`a`=10 OR `ta`.`val`='text 1')");

		row = {a: 10, val: 'text 1'};
		s = mysql`SET {ta.${row}|} SET {tab.${row}|}`;
		assertEquals(s+'', "SET (`ta`.`a`=10 OR `ta`.`val`='text 1') SET (`tab`.`a`=10 OR `tab`.`val`='text 1')");

		row2 = {};
		s = mysql`SET {ta.${row2}&}`;
		assertEquals(s+'', "SET TRUE");

		row2 = {};
		s = mysql`SET {ta.${row2}|}`;
		assertEquals(s+'', "SET FALSE");

		row2 = {};
		s = mssql`SET {ta.${row2}&}`;
		assertEquals(s+'', "SET 1");

		row2 = {};
		s = mssql`SET {ta.${row2}|}`;
		assertEquals(s+'', "SET 0");

		const row3 = {one: 1.1, two: mysql`a + f(b)`};
		s = mysql`SET {t1.${row3}}`;
		assertEquals(s+'', "SET `t1`.`one`=1.1, `t1`.`two`=`t1`.a + f(`t1`.b)");

		s = mysql`SET {t1.t2.${row3}}`;
		assertEquals(s+'', "SET `t1`.`one`=1.1, `t1`.`two`=`t2`.a + f(`t2`.b)");

		s = mysql`SET {.t2.${row3}}`;
		assertEquals(s+'', "SET `one`=1.1, `two`=`t2`.a + f(`t2`.b)");

		s = mysql`SET {t1..${row3}}`;
		assertEquals(s+'', "SET `t1`.`one`=1.1, `t1`.`two`=`a` + f(`b`)");

		s = mysql`SET {${'t1'}.${'t2'}.${row3}}`;
		assertEquals(s+'', "SET `t1`.`one`=1.1, `t1`.`two`=`t2`.a + f(`t2`.b)");

		s = mysql`SET {${'t1'}.t2.${row3}}`;
		assertEquals(s+'', "SET `t1`.`one`=1.1, `t1`.`two`=`t2`.a + f(`t2`.b)");

		s = mysql`SET {t1.${'t2'}.${row3}}`;
		assertEquals(s+'', "SET `t1`.`one`=1.1, `t1`.`two`=`t2`.a + f(`t2`.b)");

		s = mysql`SET {.${'t2'}.${row3}}`;
		assertEquals(s+'', "SET `one`=1.1, `two`=`t2`.a + f(`t2`.b)");

		s = mysql`SET {${'t1'}..${row3}}`;
		assertEquals(s+'', "SET `t1`.`one`=1.1, `t1`.`two`=`a` + f(`b`)");
	}
);

Deno.test
(	'SQL sqlQuote()',
	() =>
	{	assertEquals(mysqlQuote(null), "NULL");
		assertEquals(mysqlQuote(false), "FALSE");
		assertEquals(mysqlQuote(true), "TRUE");
		assertEquals(mssqlQuote(false), "0");
		assertEquals(mssqlQuote(true), "1");
		assertEquals(mysqlQuote(0.0), "0");
		assertEquals(mysqlQuote(12.5), "12.5");
		assertEquals(mysqlQuote(-13n), "-13");

		assertEquals(mysqlQuote("Message 'One'"), "'Message ''One'''");
		assertEquals(mysqlQuote("Message 'One'", true), "'Message ''One'''");
		assertEquals(pgsqlQuote("Message 'One'"), "'Message ''One'''");
		assertEquals(sqliteQuote("Message 'One'"), "'Message ''One'''");

		assertEquals(mysqlQuote("This char \\ is backslash"), "'This char \\\\ is backslash'");
		assertEquals(mysqlQuote("This char \\ is backslash", true), "'This char \\ is backslash'");
		assertEquals(pgsqlQuote("This char \\ is backslash"), "'This char \\ is backslash'");
		assertEquals(sqliteQuote("This char \\ is backslash"), "'This char \\ is backslash'");

		assertEquals(mysqlQuote(new Date(2000, 0, 1)), "2000-01-01");
		assertEquals(mysqlQuote(new Date(2000, 0, 1, 2)), "2000-01-01 02:00:00");
		assertEquals(mysqlQuote(new Date(2000, 0, 1, 2, 3, 4, 567)), "2000-01-01 02:03:04.567");

		assertEquals(mysqlQuote(new Uint8Array([1, 2, 254, 255])), "x'0102FEFF'");
		assertEquals(mssqlQuote(new Uint8Array([1, 2, 254, 255])), "0x0102FEFF");

		assertEquals(mysqlQuote([{id: 10, value: 'Val 10'}]), `'[{"id":10,"value":"Val 10"}]'`);

		let error: Error|undefined;
		try
		{	mysqlQuote({async read() {}});
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Cannot stringify Deno.Reader");

		error = undefined;
		try
		{	mysqlQuote(new ReadableStream);
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Cannot stringify ReadableStream");
	}
);
