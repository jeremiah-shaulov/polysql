import {debugAssert} from './debug_assert.ts';
import {Sql} from './sql.ts';
import {SqlSettings, SqlMode, DEFAULT_SETTINGS_MYSQL} from './sql_settings.ts';

type Join = {tableName: string, alias: string, onExpr: string|Sql, isLeft: boolean};
export type OrderBy = string | Sql | {columns: string[], desc?: boolean};

const enum Operation
{	NONE,
	INSERT,
	INSERT_SELECT,
	SELECT,
	UPDATE,
	DELETE,
	TRUNCATE,
}

function sql(strings: TemplateStringsArray, ...params: unknown[])
{	return new Sql(DEFAULT_SETTINGS_MYSQL, [...strings], params);
}

export class SqlTable extends Sql
{	#tableAlias = '';
	#joins: Join[] = [];
	#whereExprs: (string | Sql)[] = [];
	#groupByExprs: string|string[]|Sql|undefined;
	#havingExpr: string|Sql = '';
	#isEncoding = false;

	#operation = Operation.NONE;
	#operationInsertRows: Iterable<Record<string, unknown>> | undefined;
	#operationInsertOnConflictDo: ''|'nothing'|'replace'|'update'|'patch' = '';
	#operationInsertNames: string[] | undefined;
	#operationInsertSelect: Sql | undefined;
	#operationSelectColumns: string|string[]|Sql = '';
	#operationSelectOrderBy: OrderBy = '';
	#operationSelectOffset = 0;
	#operationSelectLimit = 0;
	#operationUpdateRow: Record<string, unknown> | undefined;

	protected get joins(): readonly Join[]
	{	return this.#joins;
	}

	constructor
	(	sqlSettings: SqlSettings,
		public tableName: string,
		strings?: string[],
		params?: unknown[]
	)
	{	super(sqlSettings, strings, params);
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
	{	if (this.#whereExprs.length == 0)
		{	throw new Error(`Please, call where() first`);
		}
		let hasWhere = false;
		for (const whereExpr of this.#whereExprs)
		{	if (whereExpr)
			{	this.append(!hasWhere ? sql` WHERE (${baseTable}.${whereExpr})` : sql` AND (${baseTable}.${whereExpr})`);
				hasWhere = true;
			}
		}
		return hasWhere;
	}

	#someJoin(tableName: string, alias: string, onExpr: string|Sql, isLeft: boolean)
	{	if (!this.#isEncoding)
		{	if (this.#whereExprs.length)
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
		The method returns a new `SqlTable` object that has everything from the original object, plus the new join.
	 **/
	join(tableName: string, alias='', onExpr: string|Sql='')
	{	this.#someJoin(tableName, alias, onExpr, false);
		return this;
	}

	/**	Adds a LEFT JOIN.
		This method can be called multiple times.
		The method returns a new `SqlTable` object that has everything from the original object, plus the new join.
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

	/**	Adds GROUP BY expressions, and optionally a HAVING expression to the SELECT query.
		If `groupByExprs` is a string or an `Sql` object, it will represent a safe SQL fragment that contains comma-separated list of column expressions.
		If it's `string[]`, it will be treated as array of column names.
	 **/
	groupBy(groupByExprs: string|string[]|Sql, havingExpr: string|Sql='')
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
		if (this.#whereExprs.length)
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
	insertFrom(names: string[], select: Sql, onConflictDo: ''|'nothing'|'replace' = '')
	{	if (this.#joins.length)
		{	throw new Error(`Cannot INSERT with JOIN`);
		}
		if (this.#whereExprs.length)
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
		If it's `string[]`, it will be treated as array of column names.
		Empty string or array will represent `*`-wildcard (select all columns).
		OFFSET and LIMIT without ORDER BY are not supported on Microsoft SQL Server.
	 **/
	select(columns: string|string[]|Sql='', orderBy: OrderBy='', offset=0, limit=0)
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
		if (this.#whereExprs.length)
		{	throw new Error(`Cannot TRUNCATE with WHERE`);
		}
		if (this.#groupByExprs != undefined)
		{	throw new Error(`Cannot TRUNCATE with GROUP BY`);
		}
		this.#operation = Operation.TRUNCATE;
		return this;
	}

	override encode(putParamsTo?: unknown[], mysqlNoBackslashEscapes=false, useBuffer?: Uint8Array, useBufferFromPos=0, defaultParentName?: Uint8Array): Uint8Array
	{	let afterSelect: Sql | undefined;

		let data = useBuffer ?? new Uint8Array(this.estimatedByteLength);
		let pos = useBufferFromPos;
		const encodePart = () =>
		{	if (data.buffer == useBuffer?.buffer)
			{	data = useBuffer;
			}
			data = super.encode(putParamsTo, mysqlNoBackslashEscapes, data, pos, defaultParentName);
			pos = data.length;
			this.strings = [''];
			this.params = [];
			this.estimatedByteLength = 0;
		};

		let nJoins = 0;
		let afterJoinsPos = 0;
		this.#isEncoding = true;

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
				{	const {mode} = this.sqlSettings;
					switch (mode)
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
							this.appendTableName(this.tableName);
							this.append(sql` <${rowsW}> ON DUPLICATE KEY UPDATE "${names[0]}"="${names[0]}"`);
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
				{	const {mode} = this.sqlSettings;
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
					const {mode} = this.sqlSettings;
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
							const tableName = this.appendTableName(this.tableName);
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
								{	this.append(sql`"${name}"=CASE WHEN "${tableName}"."${name}" IS NULL OR Cast("${tableName}"."${name}" AS char) IN ('', '0') THEN excluded."${name}" ELSE "${tableName}"."${name}" END`);
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
				if (!onConflictDo)
				{	this.strings[this.strings.length - 1] += 'INSERT INTO ';
					this.estimatedByteLength += 12;
				}
				else if (onConflictDo == 'nothing')
				{	const {mode} = this.sqlSettings;
					switch (mode)
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
							this.strings[this.strings.length - 1] += 'INSERT INTO ';
							this.estimatedByteLength += 12;
							afterSelect = sql` ON DUPLICATE KEY UPDATE "${names[0]}"="${names[0]}"`;
							break;

						default:
							debugAssert(mode==SqlMode.PGSQL_ONLY || mode==SqlMode.SQLITE_ONLY);
							this.strings[this.strings.length - 1] += 'INSERT INTO ';
							this.estimatedByteLength += 12;
							afterSelect = sql` ON CONFLICT DO NOTHING`;
					}
				}
				else
				{	debugAssert(onConflictDo == 'replace');
					switch (this.sqlSettings.mode)
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
							break;

						default:
							debugAssert(this.sqlSettings.mode == SqlMode.SQLITE_ONLY);
							this.strings[this.strings.length - 1] += 'REPLACE INTO ';
							this.estimatedByteLength += 13;
					}
				}
				this.appendTableName(this.tableName);
				this.append(sql` ("${names}+") `);
				if (!(select instanceof SqlTable) || select.#operation!=Operation.SELECT)
				{	this.append(select);
					if (afterSelect)
					{	this.append(afterSelect);
					}
					break;
				}
				this.tableName = select.tableName;
				this.#joins = select.#joins;
				this.#whereExprs = select.#whereExprs;
				this.#groupByExprs = select.#groupByExprs;
				this.#havingExpr = select.#havingExpr;
				this.#operationSelectColumns = select.#operationSelectColumns;
				this.#operationSelectOrderBy = select.#operationSelectOrderBy;
				this.#operationSelectOffset = select.#operationSelectOffset;
				this.#operationSelectLimit = select.#operationSelectLimit;
			}
			// fallthrough to Operation.SELECT

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
				nJoins = this.#joins.length;
				encodePart();
				afterJoinsPos = pos;
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
				{	switch (this.sqlSettings.mode)
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
							debugAssert(this.sqlSettings.mode==SqlMode.MSSQL || this.sqlSettings.mode==SqlMode.MSSQL_ONLY);
							if (!hasOrderBy)
							{	throw new Error("SELECT with LIMIT but without ORDER BY is not supported on MS SQL");
							}
							this.append(sql` OFFSET '${offset}' ROWS FETCH FIRST '${limit}' ROWS ONLY`);
					}
				}
				else if (offset > 0)
				{	switch (this.sqlSettings.mode)
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
							debugAssert(this.sqlSettings.mode==SqlMode.MSSQL || this.sqlSettings.mode==SqlMode.MSSQL_ONLY);
							if (!hasOrderBy)
							{	throw new Error("SELECT with OFFSET but without ORDER BY is not supported on MS SQL");
							}
							this.append(sql` OFFSET '${offset}' ROWS`);
					}
				}
				if (afterSelect)
				{	this.append(afterSelect);
				}
				break;
			}

			case Operation.UPDATE:
			{	const row = this.#operationUpdateRow!;
				const {mode} = this.sqlSettings;
				if (this.#joins.length == 0)
				{	this.strings[this.strings.length - 1] += 'UPDATE ';
					this.estimatedByteLength += 7;
					this.appendTableName(this.tableName);
					this.append(sql` SET {${row}}`);
					this.#appendWhereExprs('');
				}
				else
				{	const tableAlias = this.#getTableAlias();
					const [{onExpr, isLeft}] = this.#joins;
					if (isLeft)
					{	switch (mode)
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
					switch (mode)
					{	case SqlMode.MYSQL:
						case SqlMode.MYSQL_ONLY:
						{	this.strings[this.strings.length - 1] += 'UPDATE';
							this.estimatedByteLength += 6;
							this.#appendJoins(tableAlias);
							nJoins = this.#joins.length;
							encodePart();
							afterJoinsPos = pos;
							this.append(sql` SET {${tableAlias}.${row}}`);
							this.#appendWhereExprs(tableAlias);
							break;
						}

						case SqlMode.SQLITE_ONLY:
							if (isLeft)
							{	const subj = this.genAlias('subj_table');
								this.strings[this.strings.length - 1] += 'UPDATE ';
								this.estimatedByteLength += 7;
								this.appendTableName(this.tableName);
								this.append(sql` AS "${subj}" SET {.${tableAlias}.${row}} FROM`);
								this.#appendJoins(tableAlias);
								nJoins = this.#joins.length;
								encodePart();
								afterJoinsPos = pos;
								const hasWhere = this.#appendWhereExprs(tableAlias);
								this.append(hasWhere ? sql` AND "${subj}".rowid = "${tableAlias}".rowid` : sql` WHERE "${subj}".rowid = "${tableAlias}".rowid`);
								break;
							}
							// fallthrough

						case SqlMode.PGSQL:
						case SqlMode.PGSQL_ONLY:
						case SqlMode.SQLITE:
						{	this.strings[this.strings.length - 1] += 'UPDATE ';
							this.estimatedByteLength += 7;
							this.appendTableName(this.tableName);
							this.append(sql` AS "${tableAlias}" SET {.${tableAlias}.${row}} FROM`);
							this.#appendJoinsExceptFirst(tableAlias);
							nJoins = this.#joins.length;
							encodePart();
							afterJoinsPos = pos;
							const hasWhere = this.#appendWhereExprs(tableAlias);
							this.append(hasWhere ? sql` AND (${tableAlias}.${onExpr})` : sql` WHERE (${tableAlias}.${onExpr})`);
							break;
						}

						default:
						{	debugAssert(mode==SqlMode.MSSQL || mode==SqlMode.MSSQL_ONLY);
							this.strings[this.strings.length - 1] += 'UPDATE ';
							this.estimatedByteLength += 7;
							this.appendTableName(this.tableName);
							this.append(sql` SET {.${tableAlias}.${row}} FROM`);
							this.#appendJoins(tableAlias);
							nJoins = this.#joins.length;
							encodePart();
							afterJoinsPos = pos;
							this.#appendWhereExprs(tableAlias);
						}
					}
				}
				break;
			}

			case Operation.DELETE:
			{	const {mode} = this.sqlSettings;
				if (this.#joins.length == 0)
				{	this.strings[this.strings.length - 1] += 'DELETE FROM ';
					this.estimatedByteLength += 12;
					this.appendTableName(this.tableName);
					this.#appendWhereExprs('');
				}
				else
				{	const tableAlias = this.#getTableAlias();
					const [{onExpr, isLeft}] = this.#joins;
					if (isLeft)
					{	switch (mode)
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
					switch (mode)
					{	case SqlMode.MYSQL:
						case SqlMode.MYSQL_ONLY:
						case SqlMode.MSSQL:
						case SqlMode.MSSQL_ONLY:
						{	this.append(sql`DELETE "${tableAlias}" FROM`);
							this.#appendJoins(tableAlias);
							nJoins = this.#joins.length;
							encodePart();
							afterJoinsPos = pos;
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
							nJoins = this.#joins.length;
							encodePart();
							afterJoinsPos = pos;
							const hasWhere = this.#appendWhereExprs(tableAlias);
							this.append(hasWhere ? sql` AND (${tableAlias}.${onExpr})` : sql` WHERE (${tableAlias}.${onExpr})`);
							break;
						}

						default:
						{	debugAssert(mode==SqlMode.SQLITE || mode==SqlMode.SQLITE_ONLY);
							const subj = this.genAlias('subj_table');
							this.strings[this.strings.length - 1] += 'DELETE FROM ';
							this.estimatedByteLength += 12;
							this.appendTableName(this.tableName);
							this.append(sql` AS "${subj}" WHERE rowid IN (SELECT "${tableAlias}".rowid FROM`);
							this.#appendJoins(tableAlias);
							nJoins = this.#joins.length;
							encodePart();
							afterJoinsPos = pos;
							this.#appendWhereExprs(tableAlias);
							this.append(sql`)`);
						}
					}
				}
				break;
			}

			case Operation.TRUNCATE:
			{	switch (this.sqlSettings.mode)
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
						debugAssert(this.sqlSettings.mode == SqlMode.SQLITE || this.sqlSettings.mode == SqlMode.SQLITE_ONLY);
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
		encodePart();
		if (afterJoinsPos>0 && this.#joins.length>nJoins) // if a join added during serialization (probably by `onArrow()`)
		{	const tableAlias = this.#getTableAlias();
			for (let i=nJoins, iEnd=this.#joins.length; i<iEnd; i++)
			{	this.#appendJoin(tableAlias, i);
			}
			const endPos = pos;
			encodePart();
			const tailLen = pos - endPos;
			if (data.buffer != useBuffer?.buffer)
			{	useBuffer = new Uint8Array(data.buffer, data.byteOffset);
			}
			if (pos+tailLen <= useBuffer.length)
			{	useBuffer.copyWithin(afterJoinsPos+tailLen, afterJoinsPos, pos);
				useBuffer.copyWithin(afterJoinsPos, endPos+tailLen, pos+tailLen);
			}
			else
			{	const tail = data.slice(endPos);
				useBuffer.copyWithin(afterJoinsPos+tailLen, afterJoinsPos, endPos);
				useBuffer.set(tail, afterJoinsPos);
			}
		}
		this.#isEncoding = false;
		return data;
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
			if (this.#joins.findIndex(j => (j.alias || j.tableName) == n) == -1)
			{	return n;
			}
		}
		for (let i=2; true; i++)
		{	const n = name + '_' + i;
			if (this.#joins.findIndex(j => (j.alias || j.tableName) == n) == -1)
			{	return n;
			}
		}
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
