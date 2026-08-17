<!--
	This file is generated with the following command:
	deno run --allow-all https://raw.githubusercontent.com/jeremiah-shaulov/tsa/v0.0.57/tsa.ts doc-md --outFile=README.md --outUrl=https://raw.githubusercontent.com/jeremiah-shaulov/polysql/v2.1.0/README.md --importUrl=https://cdn.jsdelivr.net/gh/jeremiah-shaulov/polysql@v2.1.0/mod.ts mod.ts
-->

# polysql

[Documentation Index](generated-doc/README.md)

This library assists developers to generate SQL queries for MySQL, PostgreSQL, SQLite and Microsoft SQL Server.
It's designed for those who's interested in utilizing the true power of relational databases (not a "no-SQL" SQL).
It tries to make queries safe, and migration to different database engine easier.

This library can:

- Quote SQL literals (string, blob, date, ...)
- Form certain parts in an SQL query, like names-values in INSERT, to generate "WHERE" expressions, etc.
- Generate SELECT, INSERT, UPDATE, DELETE and TRUNCATE queries from parts

## Quote SQL literals

This library provides the following functions:

> `function` [mysqlQuote](generated-doc/function.mysqlQuote/README.md)(value: `unknown`, noBackslashEscapes: `boolean`=false): `string`<br>
> `function` [pgsqlQuote](generated-doc/function.pgsqlQuote/README.md)(value: `unknown`, \_unused: `boolean`=false): `string`<br>
> `function` [sqliteQuote](generated-doc/function.sqliteQuote/README.md)(value: `unknown`, \_unused: `boolean`=false): `string`<br>
> `function` [mssqlQuote](generated-doc/function.mssqlQuote/README.md)(value: `unknown`, \_unused: `boolean`=false): `string`

Usually you need to import only one of these functions into your project.

```ts
import {mysqlQuote as sqlQuote} from 'https://cdn.jsdelivr.net/gh/jeremiah-shaulov/polysql@v2.1.0/mod.ts';

console.log(sqlQuote(import.meta.url));
```
Function `mysqlQuote()` has second parameter called `noBackslashEscapes`.
If it's true, backslashes in SQL string literals will be assumed not to have special meaning, so `mysqlQuote()` will not double backslashes.
It's important to provide the correct value to this parameter.
Remember that the value of this parameter can change during server session, if user executes a query like `SET sql_mode='no_backslash_escapes'`.

The "value" parameter can be one of the following types:

- null, undefined, Javascript functions and Symbol objects produce `NULL` literal
- boolean produces `FALSE` or `TRUE` literals (`0` or `1` for Microsoft SQL Server)
- number and bigint is printed as is (`NaN`, `Infinity` and `-Infinity` are rejected with exception)
- Date produces string like `2021-08-26` or `2021-08-26 10:00:00` or `2021-08-26 10:00:00.123` (invalid dates, and dates before year 0 or after year 9999, are rejected with exception)
- typed arrays (like Uint8Array) produce literals like `x'00112233'` (`0x00112233` for Microsoft SQL Server)
- Sql object will print a string with it's query
- ReadableStream will be rejected with exception
- other types will be converted to strings and printed as an SQL string literal

String literals that contain non-ASCII characters are printed with the `N` prefix for Microsoft SQL Server (like `N'Ünicode'`), so the server treats them as `nvarchar`,
and doesn't convert them to the database collation (which would corrupt the characters that this collation cannot represent).

```ts
// To download and run this example:
// curl 'https://raw.githubusercontent.com/jeremiah-shaulov/polysql/v2.1.0/README.md' | perl -ne 's/^> //; $y=$1 if /^```(.)?/; print $_ if $y&&$m; $m=$y&&$m+/<example-p9mn>/' > /tmp/example-p9mn.ts
// deno run /tmp/example-p9mn.ts

import {mysqlQuote as sqlQuote} from 'https://cdn.jsdelivr.net/gh/jeremiah-shaulov/polysql@v2.1.0/mod.ts';

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
// To download and run this example:
// curl 'https://raw.githubusercontent.com/jeremiah-shaulov/polysql/v2.1.0/README.md' | perl -ne 's/^> //; $y=$1 if /^```(.)?/; print $_ if $y&&$m; $m=$y&&$m+/<example-65ya>/' > /tmp/example-65ya.ts
// deno run /tmp/example-65ya.ts

import {mysql as sql} from 'https://cdn.jsdelivr.net/gh/jeremiah-shaulov/polysql@v2.1.0/mod.ts';

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

If the parameter is a string, characters inside it will be properly escaped (if you use `mysql`, a mysqlNoBackslashEscapes argument of [Sql.toString()](generated-doc/class.Sql/README.md#-tostringputparamsto-unknown-mysqlnobackslashescapes-booleanfalse-string) or [Sql.encode()](generated-doc/class.Sql/README.md#-encodeputparamsto-unknown-mysqlnobackslashescapes-booleanfalse-usebuffer-uint8array-usebufferfrompos-number0-defaultparentname-uint8array-uint8arrayarraybufferlike) will be respected - see below).

If the value is a number, quotes around it will be removed.

If it's a `null`, or an `undefined`, a Javascript function or a Symbol, it will be substituted with `NULL` literal.

If it's boolean `false` or `true`, it will be substituted with `FALSE` or `TRUE` (`0` or `1` on Microsoft SQL Server).

`Date` objects will be printed as SQL dates.

Typed arrays will be printed like `x'0102...'` (`0x0102...` on Microsoft SQL Server, and `'\x0102...'` bytea hex format on PostgreSQL).

`ReadableStream` objects will be put to `putParamsTo` array, if it's provided to [Sql.toString()](generated-doc/class.Sql/README.md#-tostringputparamsto-unknown-mysqlnobackslashescapes-booleanfalse-string) or [Sql.encode()](generated-doc/class.Sql/README.md#-encodeputparamsto-unknown-mysqlnobackslashescapes-booleanfalse-usebuffer-uint8array-usebufferfrompos-number0-defaultparentname-uint8array-uint8arrayarraybufferlike) - see below, and the value will be replaced with '?' character.
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
// To download and run this example:
// curl 'https://raw.githubusercontent.com/jeremiah-shaulov/polysql/v2.1.0/README.md' | perl -ne 's/^> //; $y=$1 if /^```(.)?/; print $_ if $y&&$m; $m=$y&&$m+/<example-pf4z>/' > /tmp/example-pf4z.ts
// deno run /tmp/example-pf4z.ts

import {mysql as sql} from 'https://cdn.jsdelivr.net/gh/jeremiah-shaulov/polysql@v2.1.0/mod.ts';

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
// To download and run this example:
// curl 'https://raw.githubusercontent.com/jeremiah-shaulov/polysql/v2.1.0/README.md' | perl -ne 's/^> //; $y=$1 if /^```(.)?/; print $_ if $y&&$m; $m=$y&&$m+/<example-ksv8>/' > /tmp/example-ksv8.ts
// deno run /tmp/example-ksv8.ts

import {mysql as sql} from 'https://cdn.jsdelivr.net/gh/jeremiah-shaulov/polysql@v2.1.0/mod.ts';

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
// To download and run this example:
// curl 'https://raw.githubusercontent.com/jeremiah-shaulov/polysql/v2.1.0/README.md' | perl -ne 's/^> //; $y=$1 if /^```(.)?/; print $_ if $y&&$m; $m=$y&&$m+/<example-rlut>/' > /tmp/example-rlut.ts
// deno run /tmp/example-rlut.ts

import {mysql as sql} from 'https://cdn.jsdelivr.net/gh/jeremiah-shaulov/polysql@v2.1.0/mod.ts';

const ids = [10, 11, 12];
let s = sql`SELECT * FROM articles WHERE id IN [${ids}]`;
console.log('' + s); // prints: SELECT * FROM articles WHERE id IN (10,11,12)
```

If there are no items in the collection, it generates `(NULL)`.

If items in the collection are also iterable, this will generate multidimensional list.
2-Dimensional lists are only supported by MySQL and PostgreSQL.
More than 2 dimensions are only supported by MySQL.

```ts
// To download and run this example:
// curl 'https://raw.githubusercontent.com/jeremiah-shaulov/polysql/v2.1.0/README.md' | perl -ne 's/^> //; $y=$1 if /^```(.)?/; print $_ if $y&&$m; $m=$y&&$m+/<example-ajdy>/' > /tmp/example-ajdy.ts
// deno run /tmp/example-ajdy.ts

import {mysqlOnly as sql} from 'https://cdn.jsdelivr.net/gh/jeremiah-shaulov/polysql@v2.1.0/mod.ts';

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
In `pgsqlOnly` mode the characters `# ?