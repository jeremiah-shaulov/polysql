import {debugAssert} from './debug_assert.ts';
import {Sql} from './sql.ts';
import {SqlSettings, SqlMode, DEFAULT_SETTINGS_MYSQL} from './sql_settings.ts';

type Join = {tableName: string, alias: string, onExpr: string|Sql, isLeft: boolean};
export type OrderBy = string | Sql | {columns: ReadonlyArray<string>, desc?: boolean};

const decoder = new TextDecoder;

const enum Operation
{	NONE,
	INSERT,
	INSERT_SELECT,
	SELECT,
	UPDATE,
	DELETE,
	TRUNCATE,
}

function sql(strings: readonly string[], ...params: unknown[])
{	return new Sql(DEFAULT_SETTINGS_MYSQL, undefined, strings, params);
}

export class SqlTable extends Sql
{	#tableAlias = '';
	#joins = new Array<Join>;
	#whereExprs = new Array<string|Sql>;
	#whereRawSql = new Array<Sql>;
	#groupByExprs: string|ReadonlyArray<string>|Sql|undefined;
	#havingExpr: string|Sql = '';

	#foreignJoined = new Array<{parentName: string, name: string, refAlias: string}>;
	#buildComplete = false;

	#operation = Operation.NONE;
	#operationInsertRows: Iterable<Record<string, unknown>> | undefined;
	#operationInsertOnConflictDo: ''|'nothing'|'replace'|'update'|'patch' = '';
	#operationInsertNames: ReadonlyArray<string> | undefined;
	#operationInsertSelect: Sql | undefined;
	#operationSelectColumns: string|ReadonlyArray<string>|Sql = '';
	#operationSelectOrderBy: OrderBy = '';
	#operationSelectOffset = 0;
	#operationSelectLimit = 0;
	#operationUpdateRow: Record<string, unknown> | undefined;

	constructor(cloneFrom: SqlTable);
	constructor(sqlSettings: SqlSettings, tableName: string, strings?: readonly string[], params?: unknown[]);
	constructor(cloneFromOrSqlSettings: SqlTable|SqlSettings, public tableName='', strings?: readonly string[], params?: unknown[])
	{	const sqlSettings = cloneFromOrSqlSettings instanceof SqlTable ? cloneFromOrSqlSettings.sqlSettings : cloneFromOrSqlSettings;
		super
		(	sqlSettings,
			!sqlSettings.useArrow ? undefined : (parentName, name) =>
			{	const joined = this.#foreignJoined.find
				(	j =>
					(	j.parentName.localeCompare(parentName, undefined, {sensitivity: 'base'})==0 &&
						j.name.localeCompare(name, undefined, {sensitivity: 'base'})==0
					)
				);
				if (joined)
				{	return joined.refAlias;
				}
				const table = !parentName ? {tableName: this.tableName, alias: this.#getTableAlias()} : this.#joins.find(j => parentName.localeCompare(j.alias || j.tableName, undefined, {sensitivity: 'base'}) == 0);
				if (!table)
				{	throw new Error(`Unknown column: ${!parentName ? name : parentName+'.'+name}`);
				}
				const refAlias = this.onJoinForeign(table.tableName, table.alias, name);
				if (!refAlias)
				{	throw new Error(`Foreign key not known when joining by column: ${table.tableName+'.'+name}`);
				}
				this.#foreignJoined.push({parentName, name, refAlias});
				return refAlias;
			},
			strings,
			params
		);
		if (cloneFromOrSqlSettings instanceof SqlTable)
		{	this.tableName = cloneFromOrSqlSettings.tableName;
			this.#tableAlias = cloneFromOrSqlSettings.#tableAlias;
			this.#joins = cloneFromOrSqlSettings.#joins.slice();
			this.#whereExprs = cloneFromOrSqlSettings.#whereExprs.slice();
			this.#whereRawSql = cloneFromOrSqlSettings.#whereRawSql.slice();
			this.#groupByExprs = cloneFromOrSqlSettings.#groupByExprs;
			this.#havingExpr = cloneFromOrSqlSettings.#havingExpr;
			this.#foreignJoined = cloneFromOrSqlSettings.#foreignJoined.slice();
		}
	}

	/**	Set table alias.
	 **/
	as(tableAlias: string)
	{	if (this.#tableAlias)
		{	throw new Error(`as() can be called only once`);
		}
		if (this.#joins.length+this.#whereExprs.length+this.#whereRawSql.length || this.#groupByExprs!=undefined)
		{	throw new Error(`as() must be first call after table name`);
		}
		this.#tableAlias = tableAlias;
		return this;
	}

	#getTableAlias()
	{	if (!this.#tableAlias)
		{	this.#tableAlias = this.genAlias(this.tableName);
		}
		return this.#tableAlias;
	}

	#appendJoins(baseTable: string)
	{	this.strings[this.strings.length - 1] += ' ';
		this.estimatedByteLength++;
		this.appendTableName(this.tableName);
		this.append(sql` AS "${baseTable}"`);
		for (let i=0, iEnd=this.#joins.length; i<iEnd; i++)
		{	this.#appendJoin(baseTable, i);
		}
	}

	#appendJoinsExceptFirst(baseTable: string)
	{	const {tableName, alias} = this.#joins[0];
		this.append(!alias ? sql` "${tableName}"` : sql` "${tableName}" AS "${alias}"`);
		for (let i=1, iEnd=this.#joins.length; i<iEnd; i++)
		{	this.#appendJoin(baseTable, i);
		}
	}

	#appendJoin(baseTable: string, i: number)
	{	const {tableName, alias, onExpr, isLeft} = this.#joins[i];
		if (!onExpr)
		{	this.strings[this.strings.length - 1] += ' CROSS JOIN ';
			this.estimatedByteLength += 12;
			this.appendTableName(tableName);
			if (alias)
			{	this.append(sql` AS "${alias}"`);
			}
		}
		else if (!isLeft)
		{	this.strings[this.strings.length - 1] += ' INNER JOIN ';
			this.estimatedByteLength += 12;
			this.appendTableName(tableName);
			this.append(!alias ? sql` ON (${baseTable}.${onExpr})` : sql` AS "${alias}" ON (${baseTable}.${onExpr})`);
		}
		else
		{	this.strings[this.strings.length - 1] += ' LEFT JOIN ';
			this.estimatedByteLength += 11;
			this.appendTableName(tableName);
			this.append(!alias ? sql` ON (${baseTable}.${onExpr})` : sql` AS "${alias}" ON (${baseTable}.${onExpr})`);
		}
	}

	#appendWhereExprs(baseTable: string)
	{	if (this.#whereExprs.length+this.#whereRawSql.length == 0)
		{	throw new Error(`Please, call where() first`);
		}
		let hasWhere = false;
		for (const whereExpr of this.#whereExprs)
		{	if (whereExpr)
			{	this.append(!hasWhere ? sql` WHERE (${baseTable}.${whereExpr})` : sql` AND (${baseTable}.${whereExpr})`);
				hasWhere = true;
			}
		}
		for (const whereExpr of this.#whereRawSql)
		{	this.append(!hasWhere ? sql` WHERE (` : sql` AND (`);
			this.append(whereExpr);
			this.append(sql`)`);
			hasWhere = true;
		}
		return hasWhere;
	}

	#someJoin(tableName: string, alias: string, onExpr: string|Sql, isLeft: boolean)
	{	if (!this.#buildComplete)
		{	if (this.#whereExprs.length+this.#whereRawSql.length != 0)
			{	throw new Error(`join() can be called before where()`);
			}
			if (this.#groupByExprs != undefined)
			{	throw new Error(`join() can be called before groupBy()`);
			}
		}
		this.#joins.push({tableName, alias, onExpr, isLeft});
	}

	/**	Adds an INNER (if `onExpr` is given) or a CROSS join (if `onExpr` is blank).
		This method can be called multiple times.
		The method modifies the current object, and returns `this`.
	 **/
	join(tableName: string, alias='', onExpr: string|Sql='')
	{	this.#someJoin(tableName, alias, onExpr, false);
		return this;
	}

	/**	Adds a LEFT JOIN.
		This method can be called multiple times.
		The method modifies the current object, and returns `this`.
	 **/
	leftJoin(tableName: string, alias: string, onExpr: string|Sql)
	{	if (!onExpr)
		{	throw new Error(`No condition in LEFT JOIN`);
		}
		this.#someJoin(tableName, alias, onExpr, true);
		return this;
	}

	/**	Adds WHERE condition for SELECT, UPDATE and DELETE queries.
		The method returns a new `SqlTable` object that has everything from the original object, plus the new condition.
		You can call `sqlTable.select()`, `sqlTable.update()` and `sqlTable.delete()` only after calling `sqlTable.where()`, or an exception will be thrown.
		To explicitly allow working on the whole table, call `sqlTable.where('')` (with empty condition).
	 **/
	where(whereExpr: string|Sql)
	{	if (this.#groupByExprs != undefined)
		{	throw new Error(`where() can be called before groupBy()`);
		}
		this.#whereExprs.push(whereExpr);
		return this;
	}

	/**	Like {@link SqlTable.where()}, but adds an unsafe raw SQL condition.
	 **/
	whereRawSql(whereRawSql: Sql)
	{	if (this.#groupByExprs != undefined)
		{	throw new Error(`whereRawSql() can be called before groupBy()`);
		}
		this.#whereRawSql.push(whereRawSql);
		return this;
	}

	/**	Adds GROUP BY expressions, and optionally a HAVING expression to the SELECT query.
		If `groupByExprs` is a string or an `Sql` object, it will represent a safe SQL fragment that contains comma-separated list of column expressions.
		If it's `readonly string[]`, it will be treated as array of column names.
	 **/
	groupBy(groupByExprs: string|ReadonlyArray<string>|Sql, havingExpr: string|Sql='')
	{	if (this.#groupByExprs != undefined)
		{	throw new Error(`groupBy() can be called only once`);
		}
		this.#groupByExprs = groupByExprs;
		this.#havingExpr = havingExpr;
		return this;
	}

	/**	Generates an INSERT query.
		- `onConflictDo=='nothing'` is only supported for MySQL, PostgreSQL and SQLite. Ignores (doesn't insert) conflicting rows (if unique constraint fails).
		- `onConflictDo=='replace'` is only supported for MySQL and SQLite.
		- `onConflictDo=='update'` is only supported for MySQL. If duplicate key, updates the existing record with the new values.
		- `onConflictDo=='patch'` is only supported for MySQL If duplicate key, updates **empty** (null, 0 or '') columns of the existing record with the new values.
	 **/
	insert(rows: Iterable<Record<string, unknown>>, onConflictDo: ''|'nothing'|'replace'|'update'|'patch' = '')
	{	if (this.#joins.length)
		{	throw new Error(`Cannot INSERT with JOIN`);
		}
		if (this.#whereExprs.length+this.#whereRawSql.length != 0)
		{	throw new Error(`Cannot INSERT with WHERE`);
		}
		if (this.#groupByExprs != undefined)
		{	throw new Error(`Cannot INSERT with GROUP BY`);
		}
		this.#operation = Operation.INSERT;
		this.#operationInsertRows = rows;
		this.#operationInsertOnConflictDo = onConflictDo;
		return this;
	}

	/**	Generates "INSERT INTO (...) SELECT ..." query.

		import {mysqlTables as sqlTables} from 'https://deno.land/x/polysql/mod.ts';

		let s = sqlTables.t_log.insertFrom(['c1', 'c2'], sqlTables.t_log_bak.where('id<=100').select(['c1', 'c2']));
		console.log('' + s); // prints: INSERT INTO `t_log` (`c1`, `c2`) SELECT `c1`, `c2` FROM `t_log_bak` WHERE (`id`<=100)
	 **/
	insertFrom(names: ReadonlyArray<string>, select: Sql, onConflictDo: ''|'nothing'|'replace' = '')
	{	if (this.#joins.length)
		{	throw new Error(`Cannot INSERT with JOIN`);
		}
		if (this.#whereExprs.length+this.#whereRawSql.length != 0)
		{	throw new Error(`Cannot INSERT with WHERE`);
		}
		if (this.#groupByExprs != undefined)
		{	throw new Error(`Cannot INSERT with GROUP BY`);
		}
		this.#operation = Operation.INSERT_SELECT;
		this.#operationInsertNames = names;
		this.#operationInsertSelect = select;
		this.#operationInsertOnConflictDo = onConflictDo;
		return this;
	}

	/**	Generates a SELECT query.
		If `columns` parameter is a string or an `Sql` object, it will represent columns as a safe SQL fragment.
		If it's `readonly string[]`, it will be treated as array of column names.
		Empty string or array will represent `*`-wildcard (select all columns).
		OFFSET and LIMIT without ORDER BY are not supported on Microsoft SQL Server.
	 **/
	select(columns: string|ReadonlyArray<string>|Sql='', orderBy: OrderBy='', offset=0, limit=0)
	{	this.#operation = Operation.SELECT;
		this.#operationSelectColumns = columns;
		this.#operationSelectOrderBy = orderBy;
		this.#operationSelectOffset = offset;
		this.#operationSelectLimit = limit;
		return this;
	}

	/**	Generates an UPDATE query. You can update with joins, but if the first join is a LEFT JOIN, such query is not supported by PostgreSQL.
		Columns of the base table (not joined) will be updated.
	 **/
	update(row: Record<string, unknown>)
	{	if (this.#groupByExprs != undefined)
		{	throw new Error(`Cannot UPDATE with GROUP BY`);
		}
		this.#operation = Operation.UPDATE;
		this.#operationUpdateRow = row;
		return this;
	}

	/**	Generates a DELETE query. You can delete with joins, but if the first join is a LEFT JOIN, such query is not supported by PostgreSQL.
		Will delete from the base table (not joined).
	 **/
	delete()
	{	if (this.#groupByExprs != undefined)
		{	throw new Error(`Cannot DELETE with GROUP BY`);
		}
		this.#operation = Operation.DELETE;
		return this;
	}

	truncate()
	{	if (this.#joins.length)
		{	throw new Error(`Cannot TRUNCATE with JOIN`);
		}
		if (this.#whereExprs.length+this.#whereRawSql.length != 0)
		{	throw new Error(`Cannot TRUNCATE with WHERE`);
		}
		if (this.#groupByExprs != undefined)
		{	throw new Error(`Cannot TRUNCATE with GROUP BY`);
		}
		this.#operation = Operation.TRUNCATE;
		return this;
	}

	override encode(putParamsTo?: unknown[], mysqlNoBackslashEscapes=false, useBuffer?: Uint8Array, useBufferFromPos=0, defaultParentName?: Uint8Array)
	{	this.#buildComplete = true;
		const operation = this.#operation;
		const {mode} = this.sqlSettings;
		const {hasWhere, modNString, modStringPos} = this.#appendOperation();
		let nJoins = this.#joins.length;
		let result = super.encode(putParamsTo, mysqlNoBackslashEscapes, useBuffer, useBufferFromPos, defaultParentName);
		if (modNString>=0 && this.#joins.length>nJoins) // if a join added during serialization (probably by `onArrow()`)
		{	const tableAlias = this.#getTableAlias();
			const {strings, params} = this;
			let endNString = strings.length - 1;
			let endStringPos = strings[endNString].length;
			if (nJoins==0 && operation==Operation.UPDATE)
			{	const {isLeft, onExpr} = this.#joins[0];
				if (isLeft)
				{	this.#complainOnLeftJoinInUpdate();
				}
				if (mode==SqlMode.PGSQL || mode==SqlMode.PGSQL_ONLY || mode==SqlMode.SQLITE || mode==SqlMode.SQLITE_ONLY)
				{	if (isLeft)
					{	debugAssert(mode == SqlMode.SQLITE_ONLY);
						const subj = this.genAlias('subjtable');
						this.append(hasWhere ? sql` AND "${subj}".rowid = "${tableAlias}".rowid` : sql` WHERE "${subj}".rowid = "${tableAlias}".rowid`);
						endNString = strings.length - 1;
						endStringPos = strings[endNString].length;
						strings[strings.length - 1] += ' FROM ';
						this.estimatedByteLength += 6;
						this.appendTableName(this.tableName);
						this.append(sql` AS "${subj}"`);
					}
					else
					{	this.append(hasWhere ? sql` AND (${tableAlias}.${onExpr})` : sql` WHERE (${tableAlias}.${onExpr})`);
						endNString = strings.length - 1;
						endStringPos = strings[endNString].length;
						strings[strings.length - 1] += ' FROM ';
						this.estimatedByteLength += 6;
						const {tableName, alias} = this.#joins[0];
						this.append(!alias ? sql`"${tableName}"` : sql`"${tableName}" AS "${alias}"`);
						nJoins = 1;
					}
				}
				else if (mode==SqlMode.MSSQL || mode==SqlMode.MSSQL_ONLY)
				{	strings[strings.length - 1] += ' FROM ';
					this.estimatedByteLength += 6;
					this.appendTableName(this.tableName);
					this.append(sql` AS "${tableAlias}"`);
				}
			}
			for (let i=nJoins, iEnd=this.#joins.length; i<iEnd; i++)
			{	this.#appendJoin(tableAlias, i);
			}
			debugAssert(modNString != endNString);
			// strings: A ab B bc C -> A ac Cb B b
			// params:   P  Q R  S  ->  P  S  Q R
			// replace strings
			const replacePart = strings.splice(endNString+1, strings.length - (endNString+1)); // get C and delete it from array (now: A ab B bc)
			const replaceBegin = strings[endNString].slice(endStringPos); // get c
			strings[endNString] = strings[endNString].slice(0, endStringPos); // bc -> b (now: A ab B b)
			const tail = strings[modNString].slice(modStringPos); // get first b
			strings[modNString] = strings[modNString].slice(0, modStringPos) + replaceBegin; // ab -> ac (now: A ac B b)
			replacePart[replacePart.length - 1] += tail; // C -> Cb
			strings.splice(modNString+1, 0, ...replacePart); // (now: A ac Cb B b)
			// replace params
			const mid = params.splice(modNString, endNString-modNString);
			params.splice(params.length, 0, ...mid);
			// redo encode
			result = super.encode(putParamsTo, mysqlNoBackslashEscapes, useBuffer, useBufferFromPos, defaultParentName);
		}
		return result;
	}

	#appendOperation()
	{	let hasWhere = false;
		let modNString = -1;
		let modStringPos = 0;

		const {mode} = this.sqlSettings;

		switch (this.#operation)
		{	case Operation.INSERT:
			{	const rows = this.#operationInsertRows!;
				const onConflictDo = this.#operationInsertOnConflictDo;
				if (!onConflictDo)
				{	this.strings[this.strings.length - 1] += 'INSERT INTO ';
					this.estimatedByteLength += 12;
					this.appendTableName(this.tableName);
					this.append(sql` <${rows}>`);
				}
				else if (onConflictDo == 'nothing')
				{	switch (mode)
					{	case SqlMode.MYSQL:
							throw new Error("ON CONFLICT DO NOTHING is not supported across all engines. Please use mysqlOnly`...`");

						case SqlMode.PGSQL:
							throw new Error("ON CONFLICT DO NOTHING is not supported across all engines. Please use pgsqlOnly`...`");

						case SqlMode.SQLITE:
							throw new Error("ON CONFLICT DO NOTHING is not supported across all engines. Please use sqliteOnly`...`");

						case SqlMode.MSSQL:
						case SqlMode.MSSQL_ONLY:
							throw new Error("ON CONFLICT DO NOTHING is not supported on MS SQL");

						case SqlMode.MYSQL_ONLY:
						{	const {names, rows: rowsW} = wrapRowsIterator(rows);
							this.strings[this.strings.length - 1] += 'INSERT INTO ';
							this.estimatedByteLength += 12;
							const tableNameConv = this.appendTableName(this.tableName);
							this.append(sql` <${rowsW}> ON DUPLICATE KEY UPDATE "${tableNameConv}"."${names[0]}"="${tableNameConv}"."${names[0]}"`);
							break;
						}

						default:
							debugAssert(mode==SqlMode.PGSQL_ONLY || mode==SqlMode.SQLITE_ONLY);
							this.strings[this.strings.length - 1] += 'INSERT INTO ';
							this.estimatedByteLength += 12;
							this.appendTableName(this.tableName);
							this.append(sql` <${rows}> ON CONFLICT DO NOTHING`);
					}
				}
				else if (onConflictDo == 'replace')
				{	switch (mode)
					{	case SqlMode.MYSQL:
							throw new Error("REPLACE is not supported across all engines. Please use mysqlOnly`...`");

						case SqlMode.SQLITE:
							throw new Error("REPLACE is not supported across all engines. Please use sqliteOnly`...`");

						case SqlMode.PGSQL:
						case SqlMode.PGSQL_ONLY:
							throw new Error("REPLACE is not supported on PostgreSQL");

						case SqlMode.MSSQL:
						case SqlMode.MSSQL_ONLY:
							throw new Error("REPLACE is not supported on MS SQL");

						case SqlMode.MYSQL_ONLY:
							this.strings[this.strings.length - 1] += 'REPLACE ';
							this.estimatedByteLength += 8;
							this.appendTableName(this.tableName);
							this.append(sql` <${rows}>`);
							break;

						default:
							debugAssert(mode == SqlMode.SQLITE_ONLY);
							this.strings[this.strings.length - 1] += 'REPLACE INTO ';
							this.estimatedByteLength += 13;
							this.appendTableName(this.tableName);
							this.append(sql` <${rows}>`);
					}
				}
				else
				{	debugAssert(onConflictDo=='update' || onConflictDo=='patch');
					const isPatch = onConflictDo == 'patch';
					switch (mode)
					{	case SqlMode.MYSQL:
							throw new Error("ON CONFLICT DO UPDATE is not supported across all engines. Please use mysqlOnly`...`");

						case SqlMode.SQLITE:
							throw new Error("ON CONFLICT DO UPDATE is not supported across all engines. Please use sqliteOnly`...`");

						case SqlMode.PGSQL:
						case SqlMode.PGSQL_ONLY:
							throw new Error("ON CONFLICT DO UPDATE is not supported on PostgreSQL");

						case SqlMode.MSSQL:
						case SqlMode.MSSQL_ONLY:
							throw new Error("ON CONFLICT DO UPDATE is not supported on MS SQL");

						default:
						{	debugAssert(mode==SqlMode.MYSQL_ONLY || mode==SqlMode.SQLITE_ONLY);
							const {names, rows: rowsW} = wrapRowsIterator(rows);
							this.strings[this.strings.length - 1] += 'INSERT INTO ';
							this.estimatedByteLength += 12;
							const tableNameConv = this.appendTableName(this.tableName);
							if (mode==SqlMode.MYSQL_ONLY)
							{	this.append(sql` <${rowsW}> AS excluded ON DUPLICATE KEY UPDATE `);
							}
							else
							{	this.append(sql` <${rowsW}> ON CONFLICT DO UPDATE SET `);
							}
							let wantComma = false;
							for (const name of names)
							{	if (wantComma)
								{	this.append(sql`, `);
								}
								wantComma = true;
								if (!isPatch)
								{	this.append(sql`"${name}"=excluded."${name}"`);
								}
								else
								{	this.append(sql`"${name}"=CASE WHEN "${tableNameConv}"."${name}" IS NULL OR Cast("${tableNameConv}"."${name}" AS char) IN ('', '0') THEN excluded."${name}" ELSE "${tableNameConv}"."${name}" END`);
								}
							}
							break;
						}
					}
				}
				break;
			}

			case Operation.INSERT_SELECT:
			{	const names = this.#operationInsertNames!;
				const select = this.#operationInsertSelect!;
				const onConflictDo = this.#operationInsertOnConflictDo;
				let afterSelect: Sql | undefined;
				if (!onConflictDo)
				{	this.strings[this.strings.length - 1] += 'INSERT INTO ';
					this.estimatedByteLength += 12;
					this.appendTableName(this.tableName);
				}
				else if (onConflictDo == 'nothing')
				{	switch (mode)
					{	case SqlMode.MYSQL:
							throw new Error("ON CONFLICT DO NOTHING is not supported across all engines. Please use mysqlOnly`...`");

						case SqlMode.PGSQL:
							throw new Error("ON CONFLICT DO NOTHING is not supported across all engines. Please use pgsqlOnly`...`");

						case SqlMode.SQLITE:
							throw new Error("ON CONFLICT DO NOTHING is not supported across all engines. Please use sqliteOnly`...`");

						case SqlMode.MSSQL:
						case SqlMode.MSSQL_ONLY:
							throw new Error("ON CONFLICT DO NOTHING is not supported on MS SQL");

						case SqlMode.MYSQL_ONLY:
						{	this.strings[this.strings.length - 1] += 'INSERT INTO ';
							this.estimatedByteLength += 12;
							const tableNameConv = this.appendTableName(this.tableName);
							afterSelect = sql` ON DUPLICATE KEY UPDATE "${tableNameConv}"."${names[0]}"="${tableNameConv}"."${names[0]}"`;
							break;
						}

						default:
							debugAssert(mode==SqlMode.PGSQL_ONLY || mode==SqlMode.SQLITE_ONLY);
							this.strings[this.strings.length - 1] += 'INSERT INTO ';
							this.estimatedByteLength += 12;
							this.appendTableName(this.tableName);
							afterSelect = sql` ON CONFLICT DO NOTHING`;
					}
				}
				else
				{	debugAssert(onConflictDo == 'replace');
					switch (mode)
					{	case SqlMode.MYSQL:
							throw new Error("REPLACE is not supported across all engines. Please use mysqlOnly`...`");

						case SqlMode.SQLITE:
							throw new Error("REPLACE is not supported across all engines. Please use sqliteOnly`...`");

						case SqlMode.PGSQL:
						case SqlMode.PGSQL_ONLY:
							throw new Error("REPLACE is not supported on PostgreSQL");

						case SqlMode.MSSQL:
						case SqlMode.MSSQL_ONLY:
							throw new Error("REPLACE is not supported on MS SQL");

						case SqlMode.MYSQL_ONLY:
							this.strings[this.strings.length - 1] += 'REPLACE ';
							this.estimatedByteLength += 8;
							this.appendTableName(this.tableName);
							break;

						default:
							debugAssert(mode == SqlMode.SQLITE_ONLY);
							this.strings[this.strings.length - 1] += 'REPLACE INTO ';
							this.estimatedByteLength += 13;
							this.appendTableName(this.tableName);
					}
				}
				this.append(sql` ("${names}+") `);
				if (select instanceof SqlTable)
				{	if (select.#operation != Operation.NONE)
					{	if (select.#operation != Operation.SELECT)
						{	throw new Error("Must be SELECT query in insertFrom()");
						}
						select.#appendOperation();
					}
				}
				this.append(select);
				if (afterSelect)
				{	this.append(afterSelect);
				}
				break;
			}

			case Operation.SELECT:
			{	const columns = this.#operationSelectColumns;
				const orderBy = this.#operationSelectOrderBy;
				const offset = this.#operationSelectOffset;
				const limit = this.#operationSelectLimit;
				const tableAlias = this.#getTableAlias();
				if (!columns)
				{	this.append(sql`SELECT * FROM`);
				}
				else if (Array.isArray(columns))
				{	this.append(sql`SELECT "${tableAlias}.${columns}*" FROM`);
				}
				else
				{	this.append(sql`SELECT ${tableAlias}.${columns} FROM`);
				}
				this.#appendJoins(tableAlias);
				modNString = this.strings.length - 1;
				modStringPos = this.strings[modNString].length;
				this.#appendWhereExprs(tableAlias);
				if (this.#groupByExprs)
				{	if (!Array.isArray(this.#groupByExprs))
					{	this.append(sql` GROUP BY ${tableAlias}.${this.#groupByExprs}`);
					}
					else if (this.#groupByExprs.length)
					{	this.append(sql` GROUP BY "${tableAlias}.${this.#groupByExprs}+"`);
					}
					if (this.#havingExpr)
					{	this.append(sql` HAVING (${this.#havingExpr})`);
					}
				}
				let hasOrderBy = false;
				if (orderBy)
				{	if (typeof(orderBy)=='string' || (orderBy instanceof Sql))
					{	this.append(sql` ORDER BY ${orderBy}`);
						hasOrderBy = true;
					}
					else
					{	const {columns, desc} = orderBy;
						const nColumns = columns.length;
						hasOrderBy = nColumns != 0;
						if (hasOrderBy)
						{	if (!desc)
							{	this.append(sql` ORDER BY "${columns}+"`);
							}
							else
							{	this.append(sql` ORDER BY "${columns[0]}" DESC`);
								for (let i=1; i<nColumns; i++)
								{	this.append(sql`, "${columns[i]}" DESC`);
								}
							}
						}
					}
				}
				if (limit > 0)
				{	switch (mode)
					{	case SqlMode.MYSQL:
							if (!hasOrderBy)
							{	throw new Error("SELECT with LIMIT but without ORDER BY is not supported across all engines. Please use mysqlOnly`...`");
							}
							// fallthrough
						case SqlMode.MYSQL_ONLY:
							this.append(offset>0 ? sql` LIMIT '${limit}' OFFSET '${offset}'` : sql` LIMIT '${limit}'`);
							break;

						case SqlMode.PGSQL:
							if (!hasOrderBy)
							{	throw new Error("SELECT with LIMIT but without ORDER BY is not supported across all engines. Please use pgsqlOnly`...`");
							}
							// fallthrough
						case SqlMode.PGSQL_ONLY:
							this.append(offset>0 ? sql` LIMIT '${limit}' OFFSET '${offset}'` : sql` LIMIT '${limit}'`);
							break;

						case SqlMode.SQLITE:
							if (!hasOrderBy)
							{	throw new Error("SELECT with LIMIT but without ORDER BY is not supported across all engines. Please use sqliteOnly`...`");
							}
							// fallthrough
						case SqlMode.SQLITE_ONLY:
							this.append(offset>0 ? sql` LIMIT '${limit}' OFFSET '${offset}'` : sql` LIMIT '${limit}'`);
							break;

						default:
							debugAssert(mode==SqlMode.MSSQL || mode==SqlMode.MSSQL_ONLY);
							if (!hasOrderBy)
							{	throw new Error("SELECT with LIMIT but without ORDER BY is not supported on MS SQL");
							}
							this.append(sql` OFFSET '${offset}' ROWS FETCH FIRST '${limit}' ROWS ONLY`);
					}
				}
				else if (offset > 0)
				{	switch (mode)
					{	case SqlMode.MYSQL:
							if (!hasOrderBy)
							{	throw new Error("SELECT with OFFSET but without ORDER BY is not supported across all engines. Please use mysqlOnly`...`");
							}
							// fallthrough
						case SqlMode.MYSQL_ONLY:
							this.append(sql` LIMIT 2147483647 OFFSET '${offset}'`);
							break;

						case SqlMode.PGSQL:
							if (!hasOrderBy)
							{	throw new Error("SELECT with OFFSET but without ORDER BY is not supported across all engines. Please use pgsqlOnly`...`");
							}
							// fallthrough
						case SqlMode.PGSQL_ONLY:
							this.append(sql` OFFSET '${offset}'`);
							break;

						case SqlMode.SQLITE:
							if (!hasOrderBy)
							{	throw new Error("SELECT with OFFSET but without ORDER BY is not supported across all engines. Please use sqliteOnly`...`");
							}
							// fallthrough
						case SqlMode.SQLITE_ONLY:
							this.append(sql` LIMIT 2147483647 OFFSET '${offset}'`);
							break;

						default:
							debugAssert(mode==SqlMode.MSSQL || mode==SqlMode.MSSQL_ONLY);
							if (!hasOrderBy)
							{	throw new Error("SELECT with OFFSET but without ORDER BY is not supported on MS SQL");
							}
							this.append(sql` OFFSET '${offset}' ROWS`);
					}
				}
				break;
			}

			case Operation.UPDATE:
			{	const row = this.#operationUpdateRow!;
				const tableAlias = this.#getTableAlias();
				const isLeft = this.#joins[0]?.isLeft;
				if (isLeft)
				{	this.#complainOnLeftJoinInUpdate();
				}
				switch (mode)
				{	case SqlMode.MYSQL:
					case SqlMode.MYSQL_ONLY:
					{	this.strings[this.strings.length - 1] += 'UPDATE';
						this.estimatedByteLength += 6;
						this.#appendJoins(tableAlias);
						modNString = this.strings.length - 1;
						modStringPos = this.strings[modNString].length;
						this.append(sql` SET {${tableAlias}.${row}}`);
						this.#appendWhereExprs(tableAlias);
						break;
					}

					case SqlMode.SQLITE_ONLY:
					{	if (isLeft)
						{	const subj = this.genAlias('subjtable');
							this.strings[this.strings.length - 1] += 'UPDATE ';
							this.estimatedByteLength += 7;
							this.appendTableName(this.tableName);
							this.append(sql` AS "${subj}" SET {.${tableAlias}.${row}} FROM`);
							this.#appendJoins(tableAlias);
							modNString = this.strings.length - 1;
							modStringPos = this.strings[modNString].length;
							hasWhere = this.#appendWhereExprs(tableAlias);
							this.append(hasWhere ? sql` AND "${subj}".rowid = "${tableAlias}".rowid` : sql` WHERE "${subj}".rowid = "${tableAlias}".rowid`);
							break;
						}
					}
					// fallthrough

					case SqlMode.PGSQL:
					case SqlMode.PGSQL_ONLY:
					case SqlMode.SQLITE:
					{	this.strings[this.strings.length - 1] += 'UPDATE ';
						this.estimatedByteLength += 7;
						this.appendTableName(this.tableName);
						this.append(sql` AS "${tableAlias}" SET {.${tableAlias}.${row}}`);
						const nJoins = this.#joins.length;
						if (nJoins > 0)
						{	this.append(sql` FROM`);
							this.#appendJoinsExceptFirst(tableAlias);
						}
						modNString = this.strings.length - 1;
						modStringPos = this.strings[modNString].length;
						hasWhere = this.#appendWhereExprs(tableAlias);
						if (nJoins > 0)
						{	const {onExpr} = this.#joins[0];
							this.append(hasWhere ? sql` AND (${tableAlias}.${onExpr})` : sql` WHERE (${tableAlias}.${onExpr})`);
						}
						break;
					}

					default:
					{	debugAssert(mode==SqlMode.MSSQL || mode==SqlMode.MSSQL_ONLY);
						this.strings[this.strings.length - 1] += 'UPDATE ';
						this.estimatedByteLength += 7;
						this.appendTableName(this.tableName);
						this.append(sql` SET {.${tableAlias}.${row}}`);
						const nJoins = this.#joins.length;
						if (nJoins > 0)
						{	this.append(sql` FROM`);
							this.#appendJoins(tableAlias);
						}
						modNString = this.strings.length - 1;
						modStringPos = this.strings[modNString].length;
						this.#appendWhereExprs(tableAlias);
					}
				}
				break;
			}

			case Operation.DELETE:
			{	if (this.#joins.length == 0)
				{	this.strings[this.strings.length - 1] += 'DELETE FROM ';
					this.estimatedByteLength += 12;
					this.appendTableName(this.tableName);
					modNString = this.strings.length - 1;
					modStringPos = this.strings[modNString].length;
					this.#appendWhereExprs('');
				}
				else
				{	const tableAlias = this.#getTableAlias();
					const [{onExpr, isLeft}] = this.#joins;
					if (isLeft)
					{	this.#complainOnLeftJoinInDelete();
					}
					switch (mode)
					{	case SqlMode.MYSQL:
						case SqlMode.MYSQL_ONLY:
						case SqlMode.MSSQL:
						case SqlMode.MSSQL_ONLY:
						{	this.append(sql`DELETE "${tableAlias}" FROM`);
							this.#appendJoins(tableAlias);
							modNString = this.strings.length - 1;
							modStringPos = this.strings[modNString].length;
							this.#appendWhereExprs(tableAlias);
							break;
						}

						case SqlMode.PGSQL:
						case SqlMode.PGSQL_ONLY:
						{	this.strings[this.strings.length - 1] += 'DELETE FROM ';
							this.estimatedByteLength += 12;
							this.appendTableName(this.tableName);
							this.append(sql` AS "${tableAlias}" USING`);
							this.#appendJoinsExceptFirst(tableAlias);
							modNString = this.strings.length - 1;
							modStringPos = this.strings[modNString].length;
							hasWhere = this.#appendWhereExprs(tableAlias);
							this.append(hasWhere ? sql` AND (${tableAlias}.${onExpr})` : sql` WHERE (${tableAlias}.${onExpr})`);
							break;
						}

						default:
						{	debugAssert(mode==SqlMode.SQLITE || mode==SqlMode.SQLITE_ONLY);
							const subj = this.genAlias('subjtable');
							this.strings[this.strings.length - 1] += 'DELETE FROM ';
							this.estimatedByteLength += 12;
							this.appendTableName(this.tableName);
							this.append(sql` AS "${subj}" WHERE rowid IN (SELECT "${tableAlias}".rowid FROM`);
							this.#appendJoins(tableAlias);
							modNString = this.strings.length - 1;
							modStringPos = this.strings[modNString].length;
							this.#appendWhereExprs(tableAlias);
							this.append(sql`)`);
						}
					}
				}
				break;
			}

			case Operation.TRUNCATE:
			{	switch (mode)
				{	case SqlMode.MYSQL:
					case SqlMode.MYSQL_ONLY:
					case SqlMode.PGSQL:
					case SqlMode.PGSQL_ONLY:
					case SqlMode.MSSQL:
					case SqlMode.MSSQL_ONLY:
						this.strings[this.strings.length - 1] += 'TRUNCATE TABLE ';
						this.estimatedByteLength += 15;
						this.appendTableName(this.tableName);
						break;

					default:
						debugAssert(mode == SqlMode.SQLITE || mode == SqlMode.SQLITE_ONLY);
						this.strings[this.strings.length - 1] += 'DELETE FROM ';
						this.estimatedByteLength += 12;
						this.appendTableName(this.tableName);
				}
				break;
			}
		}
		this.#operation = Operation.NONE;
		this.#operationSelectColumns = '';
		this.#operationSelectOrderBy = '';
		this.#operationSelectOffset = 0;
		this.#operationSelectLimit = 0;
		this.#operationUpdateRow = undefined;
		this.#operationInsertRows = undefined;
		this.#operationInsertOnConflictDo = '';
		this.#operationInsertNames = undefined;
		this.#operationInsertSelect = undefined;

		return {hasWhere, modNString, modStringPos};
	}

	override toString(putParamsTo?: unknown[], mysqlNoBackslashEscapes=false)
	{	return decoder.decode(this.encode(putParamsTo, mysqlNoBackslashEscapes));
	}

	#complainOnLeftJoinInUpdate()
	{	switch (this.sqlSettings.mode)
		{	case SqlMode.MYSQL:
				throw new Error("UPDATE where the first join is a LEFT JOIN is not supported across all engines. Please use mysqlOnly`...`");
			case SqlMode.SQLITE:
				throw new Error("UPDATE where the first join is a LEFT JOIN is not supported across all engines. Please use sqliteOnly`...`");
			case SqlMode.MSSQL:
				throw new Error("UPDATE where the first join is a LEFT JOIN is not supported across all engines. Please use mssqlOnly`...`");
			case SqlMode.PGSQL:
			case SqlMode.PGSQL_ONLY:
				throw new Error("UPDATE where the first join is a LEFT JOIN is not supported on PostgreSQL");
		}
	}

	#complainOnLeftJoinInDelete()
	{	switch (this.sqlSettings.mode)
		{	case SqlMode.MYSQL:
				throw new Error("DELETE where the first join is a LEFT JOIN is not supported across all engines. Please use mysqlOnly`...`");
			case SqlMode.SQLITE:
				throw new Error("DELETE where the first join is a LEFT JOIN is not supported across all engines. Please use sqliteOnly`...`");
			case SqlMode.MSSQL:
				throw new Error("DELETE where the first join is a LEFT JOIN is not supported across all engines. Please use mssqlOnly`...`");
			case SqlMode.PGSQL:
			case SqlMode.PGSQL_ONLY:
				throw new Error("DELETE where the first join is a LEFT JOIN is not supported on PostgreSQL");
		}
	}

	/**	This function is called every time a quoted table name must be appended to the query.
		Subclasses can override this function to convert table names and maybe add schema prefixes.
		The query generation starts when this object is asked to be converted to string or to bytes,
		so this function will not be called before this.
		This function must then return the converted table name without qualifiers.
		Default implementation:

		```
		this.append(sql`"${tableName}"`);
		return tableName;
		```
	 **/
	protected appendTableName(tableName: string)
	{	this.append(sql`"${tableName}"`);
		return tableName;
	}

	protected genAlias(name: string)
	{	for (let i=1, iEnd=name.length; i<iEnd; i++)
		{	const n = name.slice(0, i);
			if (n != this.#tableAlias && n != this.tableName && this.#joins.findIndex(j => (j.alias || j.tableName) == n) == -1)
			{	return n;
			}
		}
		for (let i=2; true; i++)
		{	const n = name + '_' + i;
			if (n != this.#tableAlias && n != this.tableName && this.#joins.findIndex(j => (j.alias || j.tableName) == n) == -1)
			{	return n;
			}
		}
	}

	protected onJoinForeign(_tableName: string, _alias: string, _columnName: string): string|undefined
	{	return undefined;
	}
}

function wrapRowsIterator(rows: Iterable<Record<string, unknown>>)
{	let names;
	if (Array.isArray(rows))
	{	if (rows.length == 0)
		{	throw new Error("0 rows in <${param}>");
		}
		names = Object.keys(rows[0]);
	}
	else
	{	const itInner = rows[Symbol.iterator]();
		const {value, done} = itInner.next();
		if (done || !value)
		{	throw new Error("0 rows in <${param}>");
		}
		let firstRow: Record<string, unknown>|undefined = value;
		names = Object.keys(firstRow);
		// deno-lint-ignore no-inner-declarations
		function *itOuter()
		{	while (true)
			{	if (firstRow)
				{	yield firstRow;
					firstRow = undefined;
				}
				else
				{	const {value, done} = itInner.next();
					if (done || !value)
					{	break;
					}
					yield value;
				}
			}
		}
		rows = itOuter();
	}
	return {names, rows};
}
