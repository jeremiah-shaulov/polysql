/**	This library assists developers to generate SQL queries for MySQL, PostgreSQL, SQLite and Microsoft SQL Server.
	It's designed for those who's interested in utilizing the true power of relational databases (not a "no-SQL" SQL).
	It tries to make queries safe, and migration to different database engine easier.

	This library can:

	- Quote SQL literals (string, blob, date, ...)
	- Form certain parts in an SQL query, like names-values in INSERT, to generate "WHERE" expressions, etc.
	- Generate SELECT, INSERT, UPDATE, DELETE and TRUNCATE queries from parts

	## Quote SQL literals

	This library provides the following functions:

	{@linkcode mysqlQuote}
	{@linkcode pgsqlQuote}
	{@linkcode sqliteQuote}
	{@linkcode mssqlQuote}

	Usually you need to import only one of these functions into your project.

	```ts
	import {mysqlQuote as sqlQuote} from './mod.ts';

	console.log(sqlQuote(import.meta.url));
	```
	Function `mysqlQuote()` has second parameter called `noBackslashEscapes`.
	If it's true, backslashes in SQL string literals will be assumed not to have special meaning, so `mysqlQuote()` will not double backslashes.
	It's important to provide the correct value to this parameter.
	Remember that the value of this parameter can change during server session, if user executes a query like `SET sql_mode='no_backslash_escapes'`.

	The "value" parameter can be one of the following types:

	- null, undefined, Javascript functions and Symbol objects produce `NULL` literal
	- boolean produces `FALSE` or `TRUE` literals (`0` or `1` for Microsoft SQL Server)
	- number and bigint is printed as is
	- Date produces string like `2021-08-26` or `2021-08-26 10:00:00` or `2021-08-26 10:00:00.123`
	- typed arrays (like Uint8Array) produce literals like `x'00112233'` (`0x00112233` for Microsoft SQL Server)
	- Sql object will print a string with it's query
	- ReadableStream will be rejected with exception
	- other types will be converted to strings and printed as an SQL string literal

	```ts
	// To run this example:
	// deno run example.ts

	import {mysqlQuote as sqlQuote} from './mod.ts';

	console.log(sqlQuote(null)); // prints: NULL
	console.log(sqlQuote(false)); // prints: FALSE
	console.log(sqlQuote(123)); // prints: 123
	console.log(sqlQuote('Message')); // prints: 'Message'
	console.log(sqlQuote('It\'s another message')); // prints: 'It''s another message'
	console.log(sqlQuote(new Date(2000, 0, 1))); // prints: '2000-01-01'
	console.log(sqlQuote(new Uint8Array([1, 2, 3]))); // prints: x'010203'
	console.log(sqlQuote({id: 1, value: 1.5})); // prints: '{"id":1,"value":1.5}'
	```

	## Produce parts of SQL queries

	This library provides the following string-template functions:

	- mysql and mysqlOnly
	- pgsql and pgsqlOnly
	- sqlite and sqliteOnly
	- mssql and mssqlOnly

	Usually you need to import only one of these functions into your project.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	let message = `It's the message`;
	let number = 0.1;
	let column = 'The number';
	console.log('' + sql`SELECT '${message}', '${number}' AS "${column}"`); // prints: SELECT 'It''s the message', 0.1 AS `The number`
	```

	`*Only` allows you to use all the supported features for that SQL dialect, even those that are not supported for other dialects.

	Tags without `*Only` throw exception if you ask a feature that is not supported by all of MySQL, PostgreSQL, Sqlite and Microsoft SQL Server. So you can switch to different dialect later (e.g. from `mysql` to `mssql`).

	You can mark backtick-quoted Javascript strings with the `sql` tag, as in example above, and dollar-brace parameters in this string will be escaped.

	How each parameter is escaped depends on quotes that you used in your SQL string, to quote this parameter (in the example above i quoted `message` and `number` with apostrophes, and `column` with double-quotes).

	### 1. `'${param}'` - Escape an SQL value.

	If the parameter is a string, characters inside it will be properly escaped (if you use `mysql`, a mysqlNoBackslashEscapes argument of {@link Sql.toString()} or {@link Sql.encode()} will be respected - see below).

	If the value is a number, quotes around it will be removed.

	If it's a `null`, or an `undefined`, a Javascript function or a Symbol, it will be substituted with `NULL` literal.

	If it's boolean `false` or `true`, it will be substituted with `FALSE` or `TRUE` (`0` or `1` on Microsoft SQL Server).

	`Date` objects will be printed as SQL dates.

	Typed arrays will be printed like `x'0102...'` (`0x0102...` on Microsoft SQL Server).

	`ReadableStream` objects will be put to `putParamsTo` array, if it's provided to {@link Sql.toString()} or {@link Sql.encode()} - see below, and the value will be replaced with '?' character.
	If `putParamsTo` not provided, exception will be thrown.

	Objects will be JSON-stringified.

	### 2. `"${param}"` or `` \`${param}\` `` - Escape an identifier (column, table or routine name, etc.).

	For MySQL double quotes will be replaced with backticks. For others, backticks (if you used them) will be converted to quotes.

	Identifier cannot contain ASCII 0 characters (required for PostgreSQL).

	### 3. `"${param}*"`, `"${param}+"`, `"${param},"` - Escape a list of identifiers (also can use backticks instead of quotes).

	Generates comma-separated list of quoted identifiers from iterable collection "param".

	`"${param}*"` - if the collection is empty, generates `*` character (as in `SELECT * FROM ...`).

	`"${param}+"` - throws exception if the collection is empty.

	`"${param},"` - doesn't generate any output, if the collection is empty. If it's not empty, prints a comma after the last identifier.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	let noNames: never[] = [];
	let names = ['one', 'two'];

	console.log('' + sql`SELECT "${noNames}*"`); // prints: SELECT *
	console.log('' + sql`SELECT "${names}*"`); // prints: SELECT `one`, `two`
	console.log('' + sql`SELECT "${noNames}," three`); // prints: SELECT  three
	console.log('' + sql`SELECT "${names}," three`); // prints: SELECT `one`, `two`, three
	```

	### 3b. `"parent_name.${param}*"`, `"parent_name.${param}+"`, `"parent_name.${param},"`

	The same as [3], but qualifies each identifier with specified parent name.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	let noNames: never[] = [];
	let names = ['one', 'two'];

	console.log('' + sql`SELECT "t1.${noNames}*"`); // prints: SELECT *
	console.log('' + sql`SELECT "t1.${names}*"`); // prints: SELECT `t1`.`one`, `t1`.`two`
	console.log('' + sql`SELECT "t1.${noNames}," three`); // prints: SELECT  three
	console.log('' + sql`SELECT "t1.${names}," three`); // prints: SELECT `t1`.`one`, `t1`.`two`, three
	```

	### 4. `[${param}]` - Generate list of SQL values.

	Square brackets will be replaced with parentheses. The parameter must be iterable.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	const ids = [10, 11, 12];
	let s = sql`SELECT * FROM articles WHERE id IN [${ids}]`;
	console.log('' + s); // prints: SELECT * FROM articles WHERE id IN (10,11,12)
	```

	If there are no items in the collection, it generates `(NULL)`.

	If items in the collection are also iterable, this will generate multidimensional list.
	2-Dimensional lists are only supported by MySQL and PostgreSQL.
	More than 2 dimensions are only supported by MySQL.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysqlOnly as sql} from './mod.ts';

	const list = [[10, 1], [11, 3], [12, 8]];
	let s = sql
	`	SELECT *
		FROM articles AS a
		INNER JOIN article_versions AS av ON a.id = av.article_id
		WHERE (av.article_id, av.article_version) IN [${list}]
	`;
	console.log('' + s); // prints: ...WHERE (av.article_id, av.article_version) IN ((10,1),(11,3),(12,8))
	```

	### 5. `(${param})` or `(parent_name.${param})` - Embed a safe SQL expression.

	The inserted SQL fragment will be validated, so it doesn't contain the following characters (unless quoted): `@ $ # ? : [ ] { } ;`, `\0`-char, commas except in parentheses, comments, unterminated literals, unbalanced parentheses. Identifiers in this SQL fragment will be quoted according to chosen policy (see below).

	Strings in the SQL fragment are always treated as `mysqlNoBackslashEscapes` (backslash is regular character), so to represent a string with a new line, you need `const expr = "Char_length('Line\n')"`, not `const expr = "Char_length('Line\\n')"`.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	const expr = "Char_length('Line\n')";
	let s = sql`SELECT (${expr})`;
	console.log('' + s);
	```

	It's possible to prefix all unqualified identifiers in the SQL fragment with a parent qualifier:

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	const expr = "article_id = 10 AND `article_version` = 1 AND a.name <> ''";
	let s = sql
	`	SELECT a.name, av.*
		FROM articles AS a
		INNER JOIN article_versions AS av ON a.id = av.article_id
		WHERE (av.${expr})
	`;
	console.log('' + s); // prints ...WHERE (`av`.article_id = 10 AND `av`.`article_version` = 1 AND `a`.name <> '')
	```

	### 6. `${param}` or `parent_name.${param}` (not enclosed) - Like `(${param})`, but allows commas on top level.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	const columns = "name, value";
	let s = sql`SELECT ${columns} FROM something WHERE id=1`;
	console.log('' + s); // prints: SELECT `name`, `value` FROM something WHERE id=1
	```

	### 7. `{parent_name.${param}}`, `{parent_name.${param},}` - Generate equations separated with commas (the `parent_name` is optional).

	The first form throws exception, if there are no fields in the param. The Second form doesn't complain, and prints comma after the last field.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	const row = {name: 'About all', author: 'Johnny'};
	let s = sql`UPDATE articles AS a SET {a.${row}} WHERE id=1`;
	console.log('' + s); // prints: UPDATE articles AS a SET `a`.`name`='About all', `a`.`author`='Johnny' WHERE id=1
	```

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	const row = {name: 'About all', author: 'Johnny'};
	let s = sql`UPDATE articles AS a SET {a.${row},} article_date=Now() WHERE id=1`;
	console.log('' + s); // prints: UPDATE articles AS a SET `a`.`name`='About all', `a`.`author`='Johnny', article_date=Now() WHERE id=1
	```

	If a value is an {@link Sql} object, it's expression will be used.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	const row = {name: 'About all', author: sql`Get_author(id)`};
	let s = sql`UPDATE articles AS a SET {a.${row}} WHERE id=1`;
	console.log('' + s); // prints: UPDATE articles AS a SET `a`.`name`='About all', `a`.`author`=Get_author(`a`.id) WHERE id=1
	```

	### 8. `{parent_name.${param}&}` - Generate equations separated with "AND" operations (the `parent_name` is optional).

	Converts braces to parentheses. If the `param` contains no fields, this will be converted to a `FALSE` literal.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	const row = {name: 'About all', author: sql`Get_author(id)`};
	let s = sql`SELECT * FROM articles AS a WHERE {a.${row}&}`;
	console.log('' + s); // prints: SELECT * FROM articles AS a WHERE (`a`.`name`='About all' AND `a`.`author`=Get_author(`a`.id))
	```

	### 9. `{parent_name.${param}|}` - Generate equations separated with "OR" operations (the `parent_name` is optional).

	Converts braces to parentheses. If the `param` contains no fields, this will be converted to a `TRUE` literal.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	const row = {name: 'About all', author: sql`Get_author(id)`};
	let s = sql`SELECT * FROM articles AS a WHERE {a.${row}|}`;
	console.log('' + s); // prints: SELECT * FROM articles AS a WHERE (`a`.`name`='About all' OR `a`.`author`=Get_author(`a`.id))
	```

	### 10. `{left_parent_name.right_parent_name.${param}}`

	In [7], [8] and [9], you can specify 2 parent qualifiers: one for the left-hand side of the equation, and one for the right. Any of the names can be empty.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	const row = {name: 'About all', author: sql`Get_author(id)`};
	let s = sql`SELECT * FROM articles AS a INNER JOIN article_content AS ac ON a.id = ac.article_id WHERE {a.ac.${row}&}`;
	console.log('' + s); // prints: SELECT * FROM articles AS a INNER JOIN article_content AS ac ON a.id = ac.article_id WHERE (`a`.`name`='About all' AND `a`.`author`=Get_author(`ac`.id))
	```

	Example of left name empty:

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	const row = {name: 'About all', author: sql`Get_author(id)`};
	let s = sql`UPDATE articles AS a SET {.a.${row}} WHERE id=1`;
	console.log('' + s); // prints: UPDATE articles AS a SET `name`='About all', `author`=Get_author(`a`.id) WHERE id=1
	```

	### 11. `<${param}>` - Generate names and values for INSERT statement.

	Parameter must be iterable object that contains rows to insert. Will print column names from the first row. On following rows, only columns from the first row will be used.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	let rows =
	[	{value: 10, name: 'text 1'},
		{value: 11, name: 'text 2'},
	];
	console.log('' + sql`INSERT INTO t_log <${rows}> AS excluded ON DUPLICATE KEY UPDATE t_log.name = excluded.name`);

	// prints:
	// INSERT INTO t_log (`value`, `name`) VALUES
	// (10,'text 1'),
	// (11,'text 2') AS excluded ON DUPLICATE KEY UPDATE t_log.name = excluded.name
	```

	### 12. `"${parent_name}.${param}*"`, `(${parent_name}.${param})`, `${parent_name}.${param}`, `{${parent_name}.${param}}` - Takes the `parent_name` from a variable.

	In [3b], [5], [6], [7], [8], [9] and [10] the parent qualifier name can be taken from a variable.

	## About {@link Sql} object

	`sql` template function returns object of {@link Sql} class.

	```ts
	import {mysql as sql, Sql} from './mod.ts';

	let s: Sql = sql`SELECT 2*2`;
	```

	### {@link Sql.append()} and {@link Sql.concat()}

	{@link Sql} objects can be appended to and concatenated:

	{@linkcode Sql.append}
	{@linkcode Sql.concat}

	[append()]{@link Sql.append} modifies current object, and [concat()]{@link Sql.concat} returns a new one.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	const id = 10;
	const s = sql`SELECT * FROM articles WHERE id='${id}'`;

	const where = `name <> ''`;

	const s2 = s.concat(sql` AND (${where})`); // concat() returns a new object
	console.log('' + s2); // prints: SELECT * FROM articles WHERE id=10 AND (`name` <> '')

	s.append(sql` AND (${where})`); // append() modifies current object
	console.log('' + s); // prints the same
	```

	### {@link Sql.encode()}

	Also {@link Sql} objects can be converted to bytes.

	{@linkcode Sql.encode}

	This function converts the SQL query to `Uint8Array`, that you probably need to pass to your SQL driver.

	You can pass an array to the `putParamsTo` parameter, so long strings and long typed arrays, and `ReadableStream` objects, that appear in quoted `'${value}'` parameters, will be put to this array,
	and their SQL representation will be produced as `?` character.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	const message = 'a'.repeat(100);
	const params: unknown[] = [];
	const writer = Deno.stdout.writable.getWriter();
	try
	{	const sqlBytes = sql`SELECT '${message}'`.encode(params);

		await writer.write(sqlBytes); // prints: SELECT ?
		console.log('');
		console.log(params); // prints: ['aaa...']
	}
	finally
	{	writer.releaseLock();
	}
	```

	If `putParamsTo` is not provided, `ReadableStream` objects will be rejected with exception.

	The `mysqlNoBackslashEscapes` parameter is only respected when using MySQL dialect.
	If it's true, backslashes in SQL string literals will be assumed not to have special meaning, so `` mysql`'${value}'` `` will not double backslashes.
	It's important to provide the correct value to this parameter.
	Remember that the value of this parameter can change during server session, if user executes a query like `SET sql_mode='no_backslash_escapes'`.

	If `useBuffer` parameter is provided, and there's enough space in this buffer, this buffer will be used and a `useBuffer.subarray()` of it will be returned from `sql.encode()`.
	If it's not big enough, a new buffer will be allocated, as usual.

	If `useBufferFromPos` parameter is provided together with the `useBuffer`, so the produced query will be appended after that position in the buffer, and the contents of `useBuffer` before this position will be the part of returned query (even if a new buffer was allocated).

	### {@link Sql.toString()}

	{@link Sql} objects can be stringified.

	{@linkcode Sql.toString}

	This function calls {@link Sql.encode()}, and then converts the result to string.

	### {@link Sql.toSqlBytesWithParamsBackslashAndBuffer()}

	{@linkcode Sql.toSqlBytesWithParamsBackslashAndBuffer}

	This function is the same as `encode()`, but with 3 mandatory parameters.
	This is for optimal support of [this MySQL driver](https://deno.land/x/office_spirit_mysql).

	### {@link Sql.sqlSettings}

	This public property of {@link Sql} object contains the chosen SQL dialect (SqlMode) and quoting policy, that allows to whitelist identifiers in SQL fragments.

	{@linkcode Sql.sqlSettings}

	If you create the {@link Sql} object using `mysql` template function, it's [sqlSettings.mode]{@link SqlSettings.mode} will be set to {@link SqlMode.MYSQL}, for `pgsql` it will be {@link SqlMode.PGSQL}, etc.

	If you assign a different {@link SqlSettings} object before calling {@link Sql.toString()} or {@link Sql.encode()}, that different SQL dialect and policy will be used.

	The quotation policy has either a whitelist or a blacklist of allowed identifiers, that can remain unquoted.
	There're 2 separate lists for functions (any identifier that is followed by a parenthesis is considered to be a function name), and for other identifiers.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql, SqlSettings, SqlMode} from './mod.ts';

	const value1 = "The string is: 'name'. The backslash is: \\";
	const value2 = 123.4;
	const value3 = null;
	const expr1 = "id=10 AND value IS NOT NULL"; // we have 6 raw identifiers here: id, AND, value, IS, NOT, NULL

	let select = sql`SELECT '${value1}', '${value2}', '${value3}' FROM t WHERE (${expr1})`;

	console.log(select+'');                        // SELECT 'The string is: ''name''. The backslash is: \\', 123.4, NULL FROM t WHERE (`id`=10 AND `value` IS NOT NULL)
	console.log(select.toString(undefined, true)); // SELECT 'The string is: ''name''. The backslash is: \', 123.4, NULL FROM t WHERE (`id`=10 AND `value` IS NOT NULL)

	select.sqlSettings = new SqlSettings(SqlMode.MYSQL, false, 'id not'); // in expr1 will quote: AND, value, IS, NULL
	console.log(select+'');                        // SELECT 'The string is: ''name''. The backslash is: \\', 123.4, NULL FROM t WHERE (id=10 `AND` `value` `IS` NOT `NULL`)

	select.sqlSettings = new SqlSettings(SqlMode.PGSQL, false, '!id not'); // in expr1 will quote: id, NOT
	console.log(select+'');                        // SELECT 'The string is: ''name''. The backslash is: \', 123.4, NULL FROM t WHERE ("id"=10 AND value IS "NOT" NULL)
	```

	To create a new {@link SqlSettings} object, that can be assigned to {@link Sql.sqlSettings} property, provide the SQL dialect (SqlMode), the whitelist/blacklist of `idents`, and the same for `functions`.
	If the list starts with `!`-char - it's the blacklist. Identifiers in the list are separated with spaces.

	{@linkcode SqlSettings.constructor}

	If `idents` and/or `functions` argument is omitted or `undefined`, the default value is used.

	For `idents` the default value is: `AGAINST AND AS ASC BETWEEN CASE CHAR DAY DESC DISTINCT ELSE END HOUR INTERVAL IS LIKE MATCH MICROSECOND MINUTE MONTH NOT NULL OR SECOND SEPARATOR THEN WEEK WHEN XOR YEAR`.

	For `functions` is: `! FROM HAVING JOIN LIMIT OFFSET ON SELECT WHERE`.

	To print the default policy, you can do:

	```ts
	// To run this example:
	// deno run example.ts

	import {SqlSettings, SqlMode} from './mod.ts';

	let settings = new SqlSettings(SqlMode.MYSQL);

	console.log('Identifiers: ', settings.idents);
	console.log('Functions: ', settings.functions);
	```

	Please note, that quoting policy is only applied to safe SQL fragments that you embed using `` sql`(${expr})` `` or `` sql`${expr}` ``.

	If you want to use custom policy all the time, you can write your own version of `sql()` function:

	```ts
	// To run this example:
	// deno run example.ts

	import {Sql, SqlSettings, SqlMode, SqlTable} from './mod.ts';

	const DEFAULT_SETTINGS = new SqlSettings(SqlMode.MYSQL, false, '!bad forbidden', 'calc_stats');

	const sql = new Proxy
	(	function sql(strings: readonly string[], ...params: unknown[])
		{	return new Sql(DEFAULT_SETTINGS, undefined, strings, params);
		} as Record<string, SqlTable> & {(strings: readonly string[], ...params: unknown[]): SqlTable},
		{	get(_target, tableName)
			{	if (typeof(tableName) != 'string')
				{	throw new Error("Table name must be string");
				}
				return new SqlTable(DEFAULT_SETTINGS, tableName);
			}
		}
	);

	const expr = "calc_stats(bad, good)";
	const s = sql`CALL ${expr}`;
	console.log('' + s); // prints: CALL calc_stats(`bad`, good)
	console.log('' + sql.messages.where('bad=0 AND good=1').select()); // prints SELECT * FROM `messages` WHERE (`bad`=0 AND good=1)
	```

	It's a good idea to create {@link SqlSettings} object once, and reuse it, because creating new instance takes time (it builds words index).

	## Generate SELECT, INSERT, UPDATE, DELETE and TRUNCATE queries from parts

	As mentioned above there are the following string-template functions:

	- mysql and mysqlOnly
	- pgsql and pgsqlOnly
	- sqlite and sqliteOnly
	- mssql and mssqlOnly

	These are actually fake functions implemented through `Proxy` class. They act as string-template functions, but they're also act like objects from which
	you can ask properties. Each property that you ask from the object returns instance of {@link SqlTable} class that represents a table in your database, and you can
	generate SELECT, INSERT, UPDATE, DELETE and TRUNCATE queries for this table.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	console.log('' + sql.messages.where("id=1").select()); // prints: SELECT * FROM `messages` WHERE (`id`=1)
	```

	{@link SqlTable} class extends {@link Sql}.

	```ts
	let table: SqlTable = sql[tableName];
	```

	{@link SqlTable} class has the following methods:

	- {@link SqlTable.join()}: this
	- {@link SqlTable.leftJoin()}: this
	- {@link SqlTable.where()}: this
	- {@link SqlTable.whereRawSql()}: this
	- {@link SqlTable.groupBy()}: this
	- {@link SqlTable.select()}: this
	- {@link SqlTable.update()}: this
	- {@link SqlTable.delete()}: this
	- {@link SqlTable.insert()}: this
	- {@link SqlTable.insertFrom()}: this
	- {@link SqlTable.truncate()}: this

	All these methods only log what you ask, and the actual query generation will happen when you convert the object to string or bytes.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	let s = sql.messages.join('content', 'c', 'content_id = c.id').where("id=1").select("c.*");
	// Now s is object that remembers what joins, columns and conditions you wanted to generate
	// So, let's convert the object to string to trigger the query generation
	console.log('' + s); // prints: SELECT `c`.* FROM `messages` AS `b` INNER JOIN `content` AS `c` ON (`b`.content_id = `c`.id) WHERE (`b`.id=1)
	```

	### {@link SqlTable.join()}

	{@linkcode SqlTable.join}

	Adds an INNER (if `onExpr` is given) or a CROSS join (if `onExpr` is blank).

	This method can be called multiple times.

	### {@link SqlTable.leftJoin()}

	{@linkcode SqlTable.leftJoin}

	Like [join()]{@link SqlTable.join}, but adds a LEFT JOIN.

	### {@link SqlTable.where()}

	{@linkcode SqlTable.where}

	Adds WHERE condition for SELECT, UPDATE and DELETE queries.

	You can call {@link SqlTable.select()}, {@link SqlTable.update()} and {@link SqlTable.delete()} only after calling {@link SqlTable.where()}, or an exception will be thrown.
	To explicitly allow working on the whole table, call `sqlTable.where('')` (with empty condition).

	### {@link SqlTable.whereRawSql()}

	{@linkcode SqlTable.whereRawSql}

	Like {@link SqlTable.where()}, but adds an unsafe raw SQL condition.

	### {@link SqlTable.groupBy()}

	{@linkcode SqlTable.groupBy}

	Adds GROUP BY expressions, and optionally a HAVING expression to the SELECT query.

	If `groupByExprs` is a string or an `Sql` object, it will represent a safe SQL fragment that contains comma-separated list of column expressions.

	If it's `string[]`, it will be treated as array of column names.

	### {@link SqlTable.select()}

	{@linkcode SqlTable.select}

	Generates a SELECT query.

	If `columns` parameter is a string or an `Sql` object, it will represent columns as a safe SQL fragment.

	If it's `string[]`, it will be treated as array of column names.

	Empty string or array will represent `*`-wildcard (select all columns).

	OFFSET and LIMIT without ORDER BY are not supported on Microsoft SQL Server.

	### {@link SqlTable.update()}

	{@linkcode SqlTable.update}

	Generates an UPDATE query. You can update with joins, but if the first join is a LEFT JOIN, such query is not supported by PostgreSQL.
	Columns of the base table (not joined) will be updated.

	### {@link SqlTable.delete()}

	{@linkcode SqlTable.delete}

	Generates a DELETE query. You can delete with joins, but if the first join is a LEFT JOIN, such query is not supported by PostgreSQL.
	Will delete from the base table (not joined).

	### {@link SqlTable.insert()}

	{@linkcode SqlTable.insert}

	Generates an INSERT query.

	- `onConflictDo=='nothing'` is only supported for MySQL, PostgreSQL and SQLite. Ignores (doesn't insert) conflicting rows (if unique constraint fails).
	- `onConflictDo=='replace'` is only supported for MySQL and SQLite. If duplicate key, deletes the whole conflicting row, and inserts new in place of it.
	- `onConflictDo=='update'` is only supported for MySQL and SQLite. If duplicate key, updates the existing record with the new values.
	- `onConflictDo=='patch'` is only supported for MySQL. If duplicate key, updates only **empty** (null, 0 or '') columns of the existing record with the new values.

	### {@link SqlTable.insertFrom()}

	{@linkcode SqlTable.insertFrom}

	Generates "INSERT INTO (...) SELECT ..." query.

	```ts
	// To run this example:
	// deno run example.ts

	import {mysql as sql} from './mod.ts';

	let s = sql.t_log.insertFrom(['c1', 'c2'], sql.t_log_bak.where('id<=100').select(['c1', 'c2']));
	console.log('' + s); // prints: INSERT INTO `t_log` (`c1`, `c2`) SELECT `c1`, `c2` FROM `t_log_bak` WHERE (`id`<=100)
	```

	### {@link SqlTable.truncate()}

	{@linkcode SqlTable.truncate}

	Generates TRUNCATE TABLE query where supported (all but SQLite), and for others generates "DELETE FROM".

	### Extending SqlTable

	{@link SqlTable} class extends {@link Sql}. You can also extend {@link SqlTable} itself in order to add your own custom methods.
	One practical reason for this is to override it's protected method called [appendTableName()]{@link SqlTable.appendTableName}.
	This method controls how table names are generated in the queries.
	In this method you can for example add prefixes to each table name, or to qualify some or all tables with schema prefix.

	The default implementation in {@link SqlTable} class looks like this:

	```ts
	protected appendTableName(tableName: string)
	{	this.append(sql`"${tableName}"`);
		return tableName;
	}
	```

	This method is called every time a quoted table name must be appended to the query.

	After this function appended the (converted) table name, it must then return this name without qualifiers.

	The default implementation shown above doesn't change the name, and doesn't add qualifiers.

	The following implementation will convert table names.
	In this implementation i redefine the `sql` proxy object in the same way that this library does.

	```ts
	// To run this example:
	// deno run example.ts

	import {SqlSettings, SqlMode, SqlTable} from './mod.ts';

	const SQL_SETTINGS_MYSQL = new SqlSettings(SqlMode.MYSQL);

	class SqlTableCustom extends SqlTable
	{	private schema = 'sc';

		protected override appendTableName(tableName: string)
		{	tableName = 't_' + tableName;
			this.append(!this.schema ? sql`"${tableName}"` : sql`"${this.schema}"."${tableName}"`);
			return tableName;
		}
	}

	const sql = new Proxy
	(	function sql(strings: readonly string[], ...params: unknown[])
		{	return new SqlTableCustom(SQL_SETTINGS_MYSQL, '', strings, params);
		} as Record<string, SqlTableCustom> & {(strings: readonly string[], ...params: unknown[]): SqlTableCustom},
		{	get(_target, table_name)
			{	if (typeof(table_name) != 'string')
				{	throw new Error("Table name must be string");
				}
				return new SqlTableCustom(SQL_SETTINGS_MYSQL, table_name);
			}
		}
	);

	console.log('' + sql.messages.where('id=1').select()); // prints: SELECT * FROM `sc`.`t_messages` WHERE (`id`=1)
	```

	Another reason for adding custom methods to {@link SqlTable} is to add a `query()` method that will cooperate with your database driver.

	```ts
	// To run this example:
	// deno run example.ts

	import {SqlSettings, SqlMode, SqlTable} from './mod.ts';

	const DEFAULT_SETTINGS = new SqlSettings(SqlMode.MYSQL);

	// Class for communication with database server (through your preferred driver)
	class Connection
	{	constructor(private dsn: string)
		{	// TODO: Lazy connect to server
			console.log(`Connecting to ${this.dsn}`);
		}

		async query(sql: string, params: unknown[])
		{	// TODO: Make actual query to the server
			console.log(`Querying on ${this.dsn}: ${sql} -- `, params);
		}

		async close()
		{	// TODO: disconnect
			console.log(`Disconnecting from ${this.dsn}`);
		}
	}

	// Extend `SqlTable` to add custom methods
	class SqlTableCustom extends SqlTable
	{	constructor(private connection: Connection, sqlSettings: SqlSettings, tableName: string, strings?: readonly string[], params?: unknown[])
		{	super(sqlSettings, tableName, strings, params);
		}

		// My custom method on `SqlTable`
		query()
		{	const putParamsTo: unknown[] = [];
			return this.connection.query(this.toString(putParamsTo), putParamsTo);
		}
	}

	// Connect to the database, and return object for querying it.
	// `dsn` - "Data Source Name" (usually server host, port and database name)
	function connect(dsn: string)
	{	const connection = new Connection(dsn);
		return new Proxy
		(	function(strings: readonly string[], ...params: unknown[])
			{	return new SqlTableCustom(connection, DEFAULT_SETTINGS, '', strings, params);
			} as
			Record<string, SqlTableCustom> &
			{	(strings: readonly string[], ...params: unknown[]): SqlTableCustom;
				[Symbol.asyncDispose](): Promise<void>;
			},
			{	get(_target, tableName)
				{	if (typeof(tableName) != 'string')
					{	if (tableName == Symbol.asyncDispose)
						{	return () => connection.close();
						}
						throw new Error("Table name must be string");
					}
					return new SqlTableCustom(connection, DEFAULT_SETTINGS, tableName);
				}
			}
		);
	}

	// Get connection
	await using sql = connect('localhost:3306');

	// Query
	await sql`SELECT * FROM links WHERE url='${import.meta.url}'`.query(); // prints: Querying on localhost:3306: SELECT * FROM links WHERE url='...'
	await sql.messages.where('id=1').select().query(); // prints: Querying on localhost:3306: SELECT * FROM `messages` WHERE (`id`=1)
	```

	### Arrow (`->`) operator

	MySQL 8 uses arrow operator to access JSON objects. However this library offers you to utilize this operator (not only on MySQL) for accessing columns from foreign tables.
	To opt-in to this feature, create {@link SqlSettings} object with second argument `true`.

	```ts
	const settings = new SqlSettings(SqlMode.MYSQL_ONLY, true);
	```

	Then override {@link SqlTable.onJoinForeign()} method that will call {@link SqlTable.leftJoin()} (or {@link SqlTable.join()}).

	```sql
	CREATE TABLE products
	(	id integer PRIMARY KEY AUTO_INCREMENT,
		name varchar(100),
		price float
	);

	CREATE TABLE transactions
	(	id integer PRIMARY KEY AUTO_INCREMENT,
		product_id integer,
		time datetime,
		FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
	);
	```

	```ts
	// To run this example:
	// deno run example.ts

	import {SqlSettings, SqlMode, SqlTable} from './mod.ts';

	type TableInfo =
	{	foreignKeys?: Record<string, {refTable: string, onExpr: (baseAlias: string, refAlias: string) => string}>;
	};

	const SCHEMA: Record<string, TableInfo|undefined> =
	{	users: undefined,
		products: undefined,
		transactions:
		{	foreignKeys:
			{	product_id: {refTable: 'products', onExpr: (b, r) => `${b}.product_id = ${r}.id`}
			}
		}
	};

	class SqlTableCustom extends SqlTable
	{	protected override appendTableName(tableName: string)
		{	if (!(tableName in SCHEMA))
			{	throw new Error(`Unknown table: ${tableName}`);
			}
			return super.appendTableName(tableName);
		}

		protected override onJoinForeign(tableName: string, alias: string, columnName: string)
		{	const ref = SCHEMA[tableName.toLocaleLowerCase()]?.foreignKeys?.[columnName.toLocaleLowerCase()];
			if (ref)
			{	const {refTable, onExpr} = ref;
				const refAlias = this.genAlias(refTable);
				this.leftJoin(refTable, refAlias, onExpr(alias, refAlias));
				return refAlias;
			}
		}
	}

	const SQL_SETTINGS_MYSQL = new SqlSettings(SqlMode.MYSQL_ONLY, true);

	const sql = new Proxy
	(	function sql(strings: readonly string[], ...params: unknown[])
		{	return new SqlTableCustom(SQL_SETTINGS_MYSQL, '', strings, params);
		} as Record<string, SqlTableCustom> & {(strings: readonly string[], ...params: unknown[]): SqlTableCustom},
		{	get(_target, table_name)
			{	if (typeof(table_name) != 'string')
				{	throw new Error("Table name must be string");
				}
				return new SqlTableCustom(SQL_SETTINGS_MYSQL, table_name);
			}
		}
	);

	console.log('' + sql.transactions.where(`id = 1`).select('product_id->name, product_id->price'));
	// prints: SELECT `p`.`name`, `p`.`price` FROM `transactions` AS `t` LEFT JOIN `products` AS `p` ON (`t`.product_id = `p`.id) WHERE (`t`.id = 1)
	```

	@module
	@summary polysql
 **/

export {Sql} from './private/sql.ts';
export {SqlTable, type OrderBy} from './private/sql_table.ts';
export {SqlSettings, SqlMode} from './private/sql_settings.ts';

export
{	mysqlQuote,
	pgsqlQuote,
	sqliteQuote,
	mssqlQuote,
} from './private/quote.ts';

export
{	mysql, mysqlOnly,
	pgsql, pgsqlOnly,
	sqlite, sqliteOnly,
	mssql, mssqlOnly,

	mysqlTables, mysqlOnlyTables,
	pgsqlTables, pgsqlOnlyTables,
	sqliteTables, sqliteOnlyTables,
	mssqlTables, mssqlOnlyTables,
} from './private/sql_factory.ts';
