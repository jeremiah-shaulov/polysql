# `class` SqlTable `extends` [Sql](../class.Sql/README.md)

[Documentation Index](../README.md)

```ts
import {SqlTable} from "https://deno.land/x/polysql@v2.0.15/mod.ts"
```

## This class has

- [2 constructors](#-constructorclonefrom-sqltable)
- 13 methods:
[as](#-astablealias-string-this),
[join](#-jointablename-string-alias-string-onexpr-string--sql-this),
[leftJoin](#-leftjointablename-string-alias-string-onexpr-string--sql-this),
[where](#-wherewhereexpr-string--sql-this),
[groupBy](#-groupbygroupbyexprs-string--readonlyarraystring--sql-havingexpr-string--sql-this),
[insert](#-insertrows-iterablerecordstring-unknown-onconflictdo---nothing--replace--update--patch-this),
[insertFrom](#-insertfromnames-readonlyarraystring-select-sql-onconflictdo---nothing--replace-this),
[select](#-selectcolumns-string--readonlyarraystring--sql-orderby-orderby-offset-number0-limit-number0-this),
[update](#-updaterow-recordstring-unknown-this),
[delete](#-delete-this),
[truncate](#-truncate-this),
[encode](#-override-encodeputparamsto-unknown-mysqlnobackslashescapes-booleanfalse-usebuffer-uint8array-usebufferfrompos-number0-defaultparentname-uint8array-uint8arrayarraybufferlike),
[toString](#-override-tostringputparamsto-unknown-mysqlnobackslashescapes-booleanfalse-string)
- 3 protected methods:
[appendTableName](#-protected-appendtablenametablename-string-string),
[genAlias](#-protected-genaliasname-string-string),
[onJoinForeign](#-protected-onjoinforeign_tablename-string-_alias-string-_columnname-string-string)
- 8 inherited members from [Sql](../class.Sql/README.md)


#### 🔧 `constructor`(cloneFrom: [SqlTable](../class.SqlTable/README.md))



#### 🔧 `constructor`(sqlSettings: [SqlSettings](../class.SqlSettings/README.md), tableName: `string`, strings?: readonly `string`\[], params?: `unknown`\[])



#### ⚙ as(tableAlias: `string`): `this`

> Set table alias.



#### ⚙ join(tableName: `string`, alias: `string`="", onExpr: `string` | [Sql](../class.Sql/README.md)=""): `this`

> Adds an INNER (if `onExpr` is given) or a CROSS join (if `onExpr` is blank).
> This method can be called multiple times.
> The method modifies the current object, and returns `this`.



#### ⚙ leftJoin(tableName: `string`, alias: `string`, onExpr: `string` | [Sql](../class.Sql/README.md)): `this`

> Adds a LEFT JOIN.
> This method can be called multiple times.
> The method modifies the current object, and returns `this`.



#### ⚙ where(whereExpr: `string` | [Sql](../class.Sql/README.md)): `this`

> Adds WHERE condition for SELECT, UPDATE and DELETE queries.
> The method returns a new `SqlTable` object that has everything from the original object, plus the new condition.
> You can call `sqlTable.select()`, `sqlTable.update()` and `sqlTable.delete()` only after calling `sqlTable.where()`, or an exception will be thrown.
> To explicitly allow working on the whole table, call `sqlTable.where('')` (with empty condition).



#### ⚙ groupBy(groupByExprs: `string` | ReadonlyArray\<`string`> | [Sql](../class.Sql/README.md), havingExpr: `string` | [Sql](../class.Sql/README.md)=""): `this`

> Adds GROUP BY expressions, and optionally a HAVING expression to the SELECT query.
> If `groupByExprs` is a string or an `Sql` object, it will represent a safe SQL fragment that contains comma-separated list of column expressions.
> If it's `readonly string[]`, it will be treated as array of column names.



#### ⚙ insert(rows: Iterable\<Record\<`string`, `unknown`>>, onConflictDo: <mark>""</mark> | <mark>"nothing"</mark> | <mark>"replace"</mark> | <mark>"update"</mark> | <mark>"patch"</mark>=""): `this`

> Generates an INSERT query.
> - `onConflictDo=='nothing'` is only supported for MySQL, PostgreSQL and SQLite. Ignores (doesn't insert) conflicting rows (if unique constraint fails).
> - `onConflictDo=='replace'` is only supported for MySQL and SQLite.
> - `onConflictDo=='update'` is only supported for MySQL. If duplicate key, updates the existing record with the new values.
> - `onConflictDo=='patch'` is only supported for MySQL If duplicate key, updates **empty** (null, 0 or '') columns of the existing record with the new values.



#### ⚙ insertFrom(names: ReadonlyArray\<`string`>, select: [Sql](../class.Sql/README.md), onConflictDo: <mark>""</mark> | <mark>"nothing"</mark> | <mark>"replace"</mark>=""): `this`

> Generates "INSERT INTO (...) SELECT ..." query.
> 
> import {mysqlTables as sqlTables} from 'https://deno.land/x/polysql/mod.ts';
> 
> let s = sqlTables.t_log.insertFrom(['c1', 'c2'], sqlTables.t_log_bak.where('id<=100').select(['c1', 'c2']));
> console.log('' + s); // prints: INSERT INTO `t_log` (`c1`, `c2`) SELECT `c1`, `c2` FROM `t_log_bak` WHERE (`id`<=100)



#### ⚙ select(columns: `string` | ReadonlyArray\<`string`> | [Sql](../class.Sql/README.md)="", orderBy: [OrderBy](../type.OrderBy/README.md)="", offset: `number`=0, limit: `number`=0): `this`

> Generates a SELECT query.
> If `columns` parameter is a string or an `Sql` object, it will represent columns as a safe SQL fragment.
> If it's `readonly string[]`, it will be treated as array of column names.
> Empty string or array will represent `*`-wildcard (select all columns).
> OFFSET and LIMIT without ORDER BY are not supported on Microsoft SQL Server.



#### ⚙ update(row: Record\<`string`, `unknown`>): `this`

> Generates an UPDATE query. You can update with joins, but if the first join is a LEFT JOIN, such query is not supported by PostgreSQL.
> Columns of the base table (not joined) will be updated.



#### ⚙ delete(): `this`

> Generates a DELETE query. You can delete with joins, but if the first join is a LEFT JOIN, such query is not supported by PostgreSQL.
> Will delete from the base table (not joined).



#### ⚙ truncate(): `this`



#### ⚙ `override` encode(putParamsTo?: `unknown`\[], mysqlNoBackslashEscapes: `boolean`=false, useBuffer?: Uint8Array, useBufferFromPos: `number`=0, defaultParentName?: Uint8Array): Uint8Array\<ArrayBufferLike>

> If `useBuffer` is provided, and it has enough size, will encode to it, and return a `useBuffer.subarray(0, N)`.
> Else, will return a subarray of a new Uint8Array.
> If `useBufferFromPos` is provided, will append to the `useBuffer` after this position.



#### ⚙ `override` toString(putParamsTo?: `unknown`\[], mysqlNoBackslashEscapes: `boolean`=false): `string`



#### ⚙ `protected` appendTableName(tableName: `string`): `string`

> This function is called every time a quoted table name must be appended to the query.
> Subclasses can override this function to convert table names and maybe add schema prefixes.
> The query generation starts when this object is asked to be converted to string or to bytes,
> so this function will not be called before this.
> This function must then return the converted table name without qualifiers.
> Default implementation:
> 
> ```ts
> this.append(sql`"${tableName}"`);
> return tableName;
> ```



#### ⚙ `protected` genAlias(name: `string`): `string`



#### ⚙ `protected` onJoinForeign(\_tableName: `string`, \_alias: `string`, \_columnName: `string`): `string`



