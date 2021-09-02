import {debug_assert} from "./debug_assert.ts";
import {mysql, Sql} from "./sql.ts";
import
{	SqlSettings,
	SqlMode,
	DEFAULT_SETTINGS_MYSQL, DEFAULT_SETTINGS_MYSQL_ONLY,
	DEFAULT_SETTINGS_PGSQL, DEFAULT_SETTINGS_PGSQL_ONLY,
	DEFAULT_SETTINGS_SQLITE, DEFAULT_SETTINGS_SQLITE_ONLY,
	DEFAULT_SETTINGS_MSSQL, DEFAULT_SETTINGS_MSSQL_ONLY,
} from './sql_settings.ts';

type Join = {table_name: string, alias: string, on_expr: string|Sql, is_left: boolean};
export type OrderBy = string | Sql | {columns: string[], desc?: boolean};

export const mysqlTables: Record<string, SqlTable> = new Proxy
(	{},
	{	get(target, table_name)
		{	if (typeof(table_name) != 'string')
			{	throw new Error("Table name must be a string");
			}
			return new SqlTable(DEFAULT_SETTINGS_MYSQL, table_name);
		}
	}
);

export const mysqlOnlyTables: Record<string, SqlTable> = new Proxy
(	{},
	{	get(target, table_name)
		{	if (typeof(table_name) != 'string')
			{	throw new Error("Table name must be a string");
			}
			return new SqlTable(DEFAULT_SETTINGS_MYSQL_ONLY, table_name);
		}
	}
);

export const pgsqlTables: Record<string, SqlTable> = new Proxy
(	{},
	{	get(target, table_name)
		{	if (typeof(table_name) != 'string')
			{	throw new Error("Table name must be a string");
			}
			return new SqlTable(DEFAULT_SETTINGS_PGSQL, table_name);
		}
	}
);

export const pgsqlOnlyTables: Record<string, SqlTable> = new Proxy
(	{},
	{	get(target, table_name)
		{	if (typeof(table_name) != 'string')
			{	throw new Error("Table name must be a string");
			}
			return new SqlTable(DEFAULT_SETTINGS_PGSQL_ONLY, table_name);
		}
	}
);

export const sqliteTables: Record<string, SqlTable> = new Proxy
(	{},
	{	get(target, table_name)
		{	if (typeof(table_name) != 'string')
			{	throw new Error("Table name must be a string");
			}
			return new SqlTable(DEFAULT_SETTINGS_SQLITE, table_name);
		}
	}
);

export const sqliteOnlyTables: Record<string, SqlTable> = new Proxy
(	{},
	{	get(target, table_name)
		{	if (typeof(table_name) != 'string')
			{	throw new Error("Table name must be a string");
			}
			return new SqlTable(DEFAULT_SETTINGS_SQLITE_ONLY, table_name);
		}
	}
);

export const mssqlTables: Record<string, SqlTable> = new Proxy
(	{},
	{	get(target, table_name)
		{	if (typeof(table_name) != 'string')
			{	throw new Error("Table name must be a string");
			}
			return new SqlTable(DEFAULT_SETTINGS_MSSQL, table_name);
		}
	}
);

export const mssqlOnlyTables: Record<string, SqlTable> = new Proxy
(	{},
	{	get(target, table_name)
		{	if (typeof(table_name) != 'string')
			{	throw new Error("Table name must be a string");
			}
			return new SqlTable(DEFAULT_SETTINGS_MSSQL_ONLY, table_name);
		}
	}
);

export class SqlTable
{	constructor
	(	readonly sqlSettings: SqlSettings,
		readonly table_name: string,
		private joins: Join[] = [],
		private where_exprs: (string | Sql)[] = [],
		private group_by_exprs: string|string[]|Sql|undefined = undefined,
		private having_expr: string|Sql = '',
		private has_b = false,
		private has_base = false,
		private has_base_table = false,
		private has_s = false,
		private has_subj = false,
		private has_subj_table = false
	)
	{	this.table_used(table_name);
	}

	private get_base_table_alias()
	{	return this.joins.length==0 ? '' : !this.has_b ? 'b' : !this.has_base ? 'base' : !this.has_base_table ? 'base_table' : '_base_table';
	}

	private get_subj_table_alias()
	{	return !this.has_s ? 's' : !this.has_subj ? 'subj' : !this.has_subj_table ? 'subj_table' : '_subj_table';
	}

	private table_used(alias: string)
	{	alias = alias.toLowerCase();
		if (alias == 'b')
		{	this.has_b = true;
		}
		else if (alias == 'base')
		{	this.has_base = true;
		}
		else if (alias == 'base_table')
		{	this.has_base_table = true;
		}
		else if (alias == '_base_table')
		{	throw new Error(`Alias "_base_table" is reserved`);
		}
		else if (alias == 's')
		{	this.has_s = true;
		}
		else if (alias == 'subj')
		{	this.has_subj = true;
		}
		else if (alias == 'subj_table')
		{	this.has_subj_table = true;
		}
		else if (alias == '_subj_table')
		{	throw new Error(`Alias "_subj_table" is reserved`);
		}
	}

	private concat_joins(stmt: Sql, base_table: string)
	{	if (this.joins.length == 0)
		{	return stmt.concat(mysql` "${this.table_name}"`);
		}
		stmt = stmt.concat(mysql` "${this.table_name}" AS "${base_table}"`);
		for (let {table_name, alias, on_expr, is_left} of this.joins)
		{	let join;
			if (!on_expr)
			{	join = !alias ? mysql` CROSS JOIN "${table_name}"` : mysql` CROSS JOIN "${table_name}" AS "${alias}"`;
			}
			else if (!is_left)
			{	join = !alias ? mysql` INNER JOIN "${table_name}" ON (${base_table}.${on_expr})` : mysql` INNER JOIN "${table_name}" AS "${alias}" ON (${base_table}.${on_expr})`;
			}
			else
			{	join = !alias ? mysql` LEFT JOIN "${table_name}" ON (${base_table}.${on_expr})` : mysql` LEFT JOIN "${table_name}" AS "${alias}" ON (${base_table}.${on_expr})`;
			}
			stmt = stmt.concat(join);
		}
		return stmt;
	}

	private concat_joins_except_first(stmt: Sql, base_table: string)
	{	let {table_name, alias} = this.joins[0];
		stmt = !alias ? stmt.concat(mysql` "${table_name}"`) : stmt.concat(mysql` "${table_name}" AS "${alias}"`);
		for (let i=1, i_end=this.joins.length; i<i_end; i++)
		{	let {table_name, alias, on_expr, is_left} = this.joins[i];
			let join;
			if (!on_expr)
			{	join = !alias ? mysql` CROSS JOIN "${table_name}"` : mysql` CROSS JOIN "${table_name}" AS "${alias}"`;
			}
			else if (!is_left)
			{	join = !alias ? mysql` INNER JOIN "${table_name}" ON (${base_table}.${on_expr})` : mysql` INNER JOIN "${table_name}" AS "${alias}" ON (${base_table}.${on_expr})`;
			}
			else
			{	join = !alias ? mysql` LEFT JOIN "${table_name}" ON (${base_table}.${on_expr})` : mysql` LEFT JOIN "${table_name}" AS "${alias}" ON (${base_table}.${on_expr})`;
			}
			stmt = stmt.concat(join);
		}
		return stmt;
	}

	private concat_where_exprs(stmt: Sql, base_table: string)
	{	if (this.where_exprs.length == 0)
		{	throw new Error(`Please, call where() first`);
		}
		let w: Sql | undefined;
		for (let where_expr of this.where_exprs)
		{	if (where_expr)
			{	w = !w ? mysql` WHERE (${base_table}.${where_expr})` : w.concat(mysql` AND (${base_table}.${where_expr})`);
			}
		}
		return !w ? stmt : stmt.concat(w);
	}

	private clone()
	{	return new SqlTable
		(	this.sqlSettings,
			this.table_name,
			this.joins.slice(),
			this.where_exprs.slice(),
			this.group_by_exprs,
			this.having_expr,
			this.has_b,
			this.has_base,
			this.has_base_table,
			this.has_s,
			this.has_subj,
			this.has_subj_table
		);
	}

	private some_join(table_name: string, alias: string, on_expr: string|Sql, is_left: boolean)
	{	if (this.where_exprs.length)
		{	throw new Error(`join() can be called before where()`);
		}
		if (this.group_by_exprs != undefined)
		{	throw new Error(`join() can be called before groupBy()`);
		}
		let sql_table = this.clone();
		sql_table.joins.push({table_name, alias, on_expr, is_left});
		sql_table.table_used(alias || table_name);
		return sql_table;
	}

	/**	Adds an INNER (if `onExpr` is given) or a CROSS join (if `onExpr` is blank).
		This method can be called multiple times.
		The method returns a new `SqlTable` object that has everything from the original object, plus the new join.
	 **/
	join(table_name: string, alias='', on_expr: string|Sql='')
	{	return this.some_join(table_name, alias, on_expr, false);
	}

	/**	Adds a LEFT JOIN.
		This method can be called multiple times.
		The method returns a new `SqlTable` object that has everything from the original object, plus the new join.
	 **/
	leftJoin(table_name: string, alias: string, on_expr: string|Sql)
	{	if (!on_expr)
		{	throw new Error(`No condition in LEFT JOIN`);
		}
		return this.some_join(table_name, alias, on_expr, true);
	}

	/**	Adds WHERE condition for SELECT, UPDATE and DELETE queries.
		The method returns a new `SqlTable` object that has everything from the original object, plus the new condition.
		You can call `sqlTable.select()`, `sqlTable.update()` and `sqlTable.delete()` only after calling `sqlTable.where()`, or an exception will be thrown.
		To explicitly allow working on the whole table, call `sqlTable.where('')` (with empty condition).
	 **/
	where(where_expr: string|Sql)
	{	if (this.group_by_exprs != undefined)
		{	throw new Error(`where() can be called before groupBy()`);
		}
		let sql_table = this.clone();
		sql_table.where_exprs.push(where_expr);
		return sql_table;
	}

	/**	Adds GROUP BY expressions, and optionally a HAVING expression to the SELECT query.
		If `groupByExprs` is a string or an `Sql` object, it will represent a safe SQL fragment that contains comma-separated list of column expressions.
		If it's `string[]`, it will be treated as array of column names.
	 **/
	groupBy(group_by_exprs: string|string[]|Sql, having_expr: string|Sql='')
	{	if (this.group_by_exprs != undefined)
		{	throw new Error(`groupBy() can be called only once`);
		}
		let sql_table = this.clone();
		sql_table.group_by_exprs = group_by_exprs;
		sql_table.having_expr = having_expr;
		return sql_table;
	}

	/**	Generates a SELECT query.
		If `columns` parameter is a string or an `Sql` object, it will represent columns as a safe SQL fragment.
		If it's `string[]`, it will be treated as array of column names.
		Empty string, Sql or array will represent `*`-wildcard (select all columns).
		OFFSET and LIMIT without ORDER BY are not supported on Microsoft SQL Server.
	 **/
	select(columns: string|string[]|Sql='', order_by: OrderBy='', offset=0, limit=0)
	{	let base_table = this.get_base_table_alias();
		let stmt = !columns ? mysql`SELECT * FROM` : Array.isArray(columns) ? mysql`SELECT "${base_table}.${columns}*" FROM` : mysql`SELECT ${base_table}.${columns} FROM`;
		stmt = this.concat_joins(stmt, base_table);
		stmt = this.concat_where_exprs(stmt, base_table);
		if (this.group_by_exprs)
		{	if (!Array.isArray(this.group_by_exprs))
			{	stmt = stmt.concat(mysql` GROUP BY ${base_table}.${this.group_by_exprs}`);
			}
			else if (this.group_by_exprs.length)
			{	stmt = stmt.concat(mysql` GROUP BY "${base_table}.${this.group_by_exprs}+"`);
			}
			if (this.having_expr)
			{	stmt = stmt.concat(mysql` HAVING (${this.having_expr})`);
			}
		}
		let has_order_by = false;
		if (order_by)
		{	if (typeof(order_by)=='string' || (order_by instanceof Sql))
			{	stmt = stmt.concat(mysql` ORDER BY ${order_by}`);
				has_order_by = true;
			}
			else
			{	let {columns, desc} = order_by;
				let n_columns = columns.length;
				has_order_by = n_columns != 0;
				if (has_order_by)
				{	if (!desc)
					{	stmt = stmt.concat(mysql` ORDER BY "${columns}+"`);
					}
					else
					{	stmt = stmt.concat(mysql` ORDER BY "${columns[0]}" DESC`);
						for (let i=1; i<n_columns; i++)
						{	stmt = stmt.concat(mysql`, "${columns[i]}" DESC`);
						}
					}
				}
			}
		}
		if (limit > 0)
		{	switch (this.sqlSettings.mode)
			{	case SqlMode.MYSQL:
					if (!has_order_by)
					{	throw new Error("SELECT with LIMIT but without ORDER BY is not supported across all engines. Please use mysqlOnly`...`");
					}
				case SqlMode.MYSQL_ONLY:
					stmt = stmt.concat(offset>0 ? mysql` LIMIT '${limit}' OFFSET '${offset}'` : mysql` LIMIT '${limit}'`);
					break;

				case SqlMode.PGSQL:
					if (!has_order_by)
					{	throw new Error("SELECT with LIMIT but without ORDER BY is not supported across all engines. Please use pgsqlOnly`...`");
					}
				case SqlMode.PGSQL_ONLY:
					stmt = stmt.concat(offset>0 ? mysql` LIMIT '${limit}' OFFSET '${offset}'` : mysql` LIMIT '${limit}'`);
					break;

				case SqlMode.SQLITE:
					if (!has_order_by)
					{	throw new Error("SELECT with LIMIT but without ORDER BY is not supported across all engines. Please use sqliteOnly`...`");
					}
				case SqlMode.SQLITE_ONLY:
					stmt = stmt.concat(offset>0 ? mysql` LIMIT '${limit}' OFFSET '${offset}'` : mysql` LIMIT '${limit}'`);
					break;

				default:
					debug_assert(this.sqlSettings.mode==SqlMode.MSSQL || this.sqlSettings.mode==SqlMode.MSSQL_ONLY);
					if (!has_order_by)
					{	throw new Error("SELECT with LIMIT but without ORDER BY is not supported on MS SQL");
					}
					stmt = stmt.concat(mysql` OFFSET '${offset}' ROWS FETCH FIRST '${limit}' ROWS ONLY`);
			}
		}
		else if (offset > 0)
		{	switch (this.sqlSettings.mode)
			{	case SqlMode.MYSQL:
					if (!has_order_by)
					{	throw new Error("SELECT with OFFSET but without ORDER BY is not supported across all engines. Please use mysqlOnly`...`");
					}
				case SqlMode.MYSQL_ONLY:
					stmt = stmt.concat(mysql` LIMIT 2147483647 OFFSET '${offset}'`);
					break;

				case SqlMode.PGSQL:
					if (!has_order_by)
					{	throw new Error("SELECT with OFFSET but without ORDER BY is not supported across all engines. Please use pgsqlOnly`...`");
					}
				case SqlMode.PGSQL_ONLY:
					stmt = stmt.concat(mysql` OFFSET '${offset}'`);
					break;

				case SqlMode.SQLITE:
					if (!has_order_by)
					{	throw new Error("SELECT with OFFSET but without ORDER BY is not supported across all engines. Please use sqliteOnly`...`");
					}
				case SqlMode.SQLITE_ONLY:
					stmt = stmt.concat(mysql` LIMIT 2147483647 OFFSET '${offset}'`);
					break;

				default:
					debug_assert(this.sqlSettings.mode==SqlMode.MSSQL || this.sqlSettings.mode==SqlMode.MSSQL_ONLY);
					if (!has_order_by)
					{	throw new Error("SELECT with OFFSET but without ORDER BY is not supported on MS SQL");
					}
					stmt = stmt.concat(mysql` OFFSET '${offset}' ROWS`);
			}
		}
		stmt.sqlSettings = this.sqlSettings;
		return stmt;
	}

	/**	Generates an UPDATE query. You can update with joins, but if the first join is a LEFT JOIN, such query is not supported by PostgreSQL.
		Columns of the base table (not joined) will be updated.
	 **/
	update(row: Record<string, any>)
	{	if (this.group_by_exprs != undefined)
		{	throw new Error(`Cannot UPDATE with GROUP BY`);
		}
		let stmt;
		let {mode} = this.sqlSettings;
		if (this.joins.length == 0)
		{	stmt = mysql`UPDATE "${this.table_name}" SET {${row}}`;
			stmt = this.concat_where_exprs(stmt, '');
		}
		else
		{	let base_table = this.get_base_table_alias();
			let [{on_expr, is_left}] = this.joins;
			if (is_left)
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
				{	stmt = mysql`UPDATE`;
					stmt = this.concat_joins(stmt, base_table);
					stmt = stmt.concat(mysql` SET {${base_table}.${row}}`);
					stmt = this.concat_where_exprs(stmt, base_table);
					break;
				}

				case SqlMode.SQLITE_ONLY:
					if (is_left)
					{	let subj = this.get_subj_table_alias();
						stmt = mysql`UPDATE "${this.table_name}" AS "${subj}" SET {.${base_table}.${row}} FROM`;
						stmt = this.concat_joins(stmt, base_table);
						let orig_stmt = stmt;
						stmt = this.concat_where_exprs(stmt, base_table);
						let has_where = stmt != orig_stmt;
						stmt = stmt.concat(has_where ? mysql` AND "${subj}".rowid = "${base_table}".rowid` : mysql` WHERE "${subj}".rowid = "${base_table}".rowid`);
						break;
					}
					// fallthrough

				case SqlMode.PGSQL:
				case SqlMode.PGSQL_ONLY:
				case SqlMode.SQLITE:
				{	stmt = mysql`UPDATE "${this.table_name}" AS "${base_table}" SET {.${base_table}.${row}} FROM`;
					stmt = this.concat_joins_except_first(stmt, base_table);
					let orig_stmt = stmt;
					stmt = this.concat_where_exprs(stmt, base_table);
					let has_where = stmt != orig_stmt;
					stmt = stmt.concat(has_where ? mysql` AND (${base_table}.${on_expr})` : mysql` WHERE (${base_table}.${on_expr})`);
					break;
				}

				default:
				{	debug_assert(mode==SqlMode.MSSQL || mode==SqlMode.MSSQL_ONLY);
					stmt = mysql`UPDATE "${this.table_name}" SET {.${base_table}.${row}} FROM`;
					stmt = this.concat_joins(stmt, base_table);
					stmt = this.concat_where_exprs(stmt, base_table);
				}
			}
		}
		stmt.sqlSettings = this.sqlSettings;
		return stmt;
	}

	/**	Generates a DELETE query. You can delete with joins, but if the first join is a LEFT JOIN, such query is not supported by PostgreSQL.
		Will delete from the base table (not joined).
	 **/
	delete()
	{	if (this.group_by_exprs != undefined)
		{	throw new Error(`Cannot DELETE with GROUP BY`);
		}
		let stmt;
		let {mode} = this.sqlSettings;
		if (this.joins.length == 0)
		{	stmt = this.concat_where_exprs(mysql`DELETE FROM "${this.table_name}"`, '');
		}
		else
		{	let base_table = this.get_base_table_alias();
			let [{on_expr, is_left}] = this.joins;
			if (is_left)
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
				{	stmt = mysql`DELETE "${base_table}" FROM`;
					stmt = this.concat_joins(stmt, base_table);
					stmt = this.concat_where_exprs(stmt, base_table);
					break;
				}

				case SqlMode.PGSQL:
				case SqlMode.PGSQL_ONLY:
				{	stmt = mysql`DELETE FROM "${this.table_name}" AS "${base_table}" USING`;
					stmt = this.concat_joins_except_first(stmt, base_table);
					let orig_stmt = stmt;
					stmt = this.concat_where_exprs(stmt, base_table);
					let has_where = stmt != orig_stmt;
					stmt = stmt.concat(has_where ? mysql` AND (${base_table}.${on_expr})` : mysql` WHERE (${base_table}.${on_expr})`);
					break;
				}

				default:
				{	debug_assert(mode==SqlMode.SQLITE || mode==SqlMode.SQLITE_ONLY);
					let subj = this.get_subj_table_alias();
					stmt = mysql`DELETE FROM "${this.table_name}" AS "${subj}" WHERE rowid IN (SELECT "${base_table}".rowid FROM`;
					stmt = this.concat_joins(stmt, base_table);
					stmt = this.concat_where_exprs(stmt, base_table);
					stmt = stmt.concat(mysql`)`);
				}
			}
		}
		stmt.sqlSettings = this.sqlSettings;
		return stmt;
	}

	/**	Generates an INSERT query.
		- `onConflictDo=='nothing'` is only supported for MySQL, PostgreSQL and SQLite. Ignores (doesn't insert) conflicting rows (if unique constraint fails).
		- `onConflictDo=='replace'` is only supported for MySQL and SQLite.
		- `onConflictDo=='update'` is only supported for MySQL. If duplicate key, updates the existing record with the new values.
		- `onConflictDo=='patch'` is only supported for MySQL If duplicate key, updates **empty** (null, 0 or '') columns of the existing record with the new values.
	 **/
	insert(rows: Iterable<Record<string, any>>, on_conflict_do: ''|'nothing'|'replace'|'update'|'patch' = '')
	{	if (this.joins.length)
		{	throw new Error(`Cannot INSERT with JOIN`);
		}
		if (this.where_exprs.length)
		{	throw new Error(`Cannot INSERT with WHERE`);
		}
		if (this.group_by_exprs != undefined)
		{	throw new Error(`Cannot INSERT with GROUP BY`);
		}
		let stmt: Sql;
		if (!on_conflict_do)
		{	stmt = mysql`INSERT INTO "${this.table_name}" <${rows}>`;
		}
		else if (on_conflict_do == 'nothing')
		{	let {mode} = this.sqlSettings;
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
				{	let {names, rows: rows_w} = wrap_rows_iterator(rows);
					stmt = mysql`INSERT INTO "${this.table_name}" <${rows_w}> ON DUPLICATE KEY UPDATE "${names[0]}"="${names[0]}"`;
					break;
				}

				default:
					debug_assert(mode==SqlMode.PGSQL_ONLY || mode==SqlMode.SQLITE_ONLY);
					stmt = mysql`INSERT INTO "${this.table_name}" <${rows}> ON CONFLICT DO NOTHING`;
			}
		}
		else if (on_conflict_do == 'replace')
		{	switch (this.sqlSettings.mode)
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
					stmt = mysql`REPLACE "${this.table_name}" <${rows}>`;
					break;

				default:
					debug_assert(this.sqlSettings.mode == SqlMode.SQLITE_ONLY);
					stmt = mysql`REPLACE INTO "${this.table_name}" <${rows}>`;
			}
		}
		else
		{	debug_assert(on_conflict_do=='update' || on_conflict_do=='patch');
			let is_patch = on_conflict_do == 'patch';
			switch (this.sqlSettings.mode)
			{	case SqlMode.MYSQL:
					throw new Error("ON CONFLICT DO UPDATE is not supported across all engines. Please use mysqlOnly`...`");

				case SqlMode.SQLITE:
				case SqlMode.SQLITE_ONLY:
					throw new Error("ON CONFLICT DO UPDATE is not supported on SQLite");

				case SqlMode.PGSQL:
				case SqlMode.PGSQL_ONLY:
					throw new Error("ON CONFLICT DO UPDATE is not supported on PostgreSQL");

				case SqlMode.MSSQL:
				case SqlMode.MSSQL_ONLY:
					throw new Error("ON CONFLICT DO UPDATE is not supported on MS SQL");

				default:
				{	debug_assert(this.sqlSettings.mode == SqlMode.MYSQL_ONLY);
					let {names, rows: rows_w} = wrap_rows_iterator(rows);
					stmt = mysql`INSERT INTO "${this.table_name}" <${rows_w}> AS excluded ON DUPLICATE KEY UPDATE `;
					let want_comma = false;
					for (let name of names)
					{	if (want_comma)
						{	stmt = stmt.concat(mysql`, `);
						}
						want_comma = true;
						if (!is_patch)
						{	stmt = stmt.concat(mysql`"${name}"=excluded."${name}"`);
						}
						else
						{	stmt = stmt.concat(mysql`"${name}"=CASE WHEN excluded."${name}" IS NOT NULL AND ("${this.table_name}"."${name}" IS NULL OR Cast(excluded."${name}" AS char) NOT IN ('', '0') OR Cast("${this.table_name}"."${name}" AS char) IN ('', '0')) THEN excluded."${name}" ELSE "${this.table_name}"."${name}" END`);
						}
					}
					break;
				}
			}
		}
		stmt.sqlSettings = this.sqlSettings;
		return stmt;
	}

	/**	Generates "INSERT INTO (...) SELECT ..." query.

		import {mysqlTables as sqlTables} from 'https://deno.land/x/polysql/mod.ts';

		let s = sqlTables.t_log.insertFrom(['c1', 'c2'], sqlTables.t_log_bak.where('id<=100').select(['c1', 'c2']));
		console.log('' + s); // prints: INSERT INTO `t_log` (`c1`, `c2`) SELECT `c1`, `c2` FROM `t_log_bak` WHERE (`id`<=100)
	 **/
	insertFrom(names: string[], select: Sql, on_conflict_do: ''|'nothing'|'replace' = '')
	{	if (this.joins.length)
		{	throw new Error(`Cannot INSERT with JOIN`);
		}
		if (this.where_exprs.length)
		{	throw new Error(`Cannot INSERT with WHERE`);
		}
		if (this.group_by_exprs != undefined)
		{	throw new Error(`Cannot INSERT with GROUP BY`);
		}
		let stmt: Sql;
		if (!on_conflict_do)
		{	stmt = mysql`INSERT INTO "${this.table_name}" ("${names}+") `.concat(select);
		}
		else if (on_conflict_do == 'nothing')
		{	let {mode} = this.sqlSettings;
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
					stmt = mysql`INSERT INTO "${this.table_name}" ("${names}+") `.concat(select).concat(mysql` ON DUPLICATE KEY UPDATE "${names[0]}"="${names[0]}"`);
					break;

				default:
					debug_assert(mode==SqlMode.PGSQL_ONLY || mode==SqlMode.SQLITE_ONLY);
					stmt =  mysql`INSERT INTO "${this.table_name}" ("${names}+") `.concat(select).concat(mysql` ON CONFLICT DO NOTHING`);
			}
		}
		else
		{	debug_assert(on_conflict_do == 'replace');
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
					stmt = mysql`REPLACE "${this.table_name}" ("${names}+") `.concat(select);
					break;

				default:
					debug_assert(this.sqlSettings.mode == SqlMode.SQLITE_ONLY);
					stmt = mysql`REPLACE INTO "${this.table_name}" ("${names}+") `.concat(select);
			}
		}
		stmt.sqlSettings = this.sqlSettings;
		return stmt;
	}
}

function wrap_rows_iterator(rows: Iterable<Record<string, any>>)
{	let names;
	if (Array.isArray(rows))
	{	if (rows.length == 0)
		{	throw new Error("0 rows in <${param}>");
		}
		names = Object.keys(rows[0]);
	}
	else
	{	let it_inner = rows[Symbol.iterator]();
		let {value, done} = it_inner.next();
		if (done || !value)
		{	throw new Error("0 rows in <${param}>");
		}
		let first_row = value;
		names = Object.keys(first_row);
		function *it_outer()
		{	while (true)
			{	if (first_row)
				{	yield first_row;
					first_row = undefined;
				}
				else
				{	let {value, done} = it_inner.next();
					if (done || !value)
					{	break;
					}
					yield value;
				}
			}
		}
		rows = it_outer();
	}
	return {names, rows};
}
