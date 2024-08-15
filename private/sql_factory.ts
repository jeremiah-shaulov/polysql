import {Sql} from './sql.ts';
import {SqlTable} from './sql_table.ts';
import
{	DEFAULT_SETTINGS_MYSQL, DEFAULT_SETTINGS_MYSQL_ONLY,
	DEFAULT_SETTINGS_PGSQL, DEFAULT_SETTINGS_PGSQL_ONLY,
	DEFAULT_SETTINGS_SQLITE, DEFAULT_SETTINGS_SQLITE_ONLY,
	DEFAULT_SETTINGS_MSSQL, DEFAULT_SETTINGS_MSSQL_ONLY,
} from './sql_settings.ts';

type SqlFactory = {(strings: TemplateStringsArray, ...params: unknown[]): Sql} & Record<string, SqlTable>;

export const mysql = new Proxy
(	function(strings: TemplateStringsArray, ...params: unknown[])
	{	return new Sql(DEFAULT_SETTINGS_MYSQL, [...strings], params);
	} as SqlFactory,
	{	get(_target, tableName)
		{	if (typeof(tableName) != 'string')
			{	throw new Error("Table name must be string");
			}
			return new SqlTable(DEFAULT_SETTINGS_MYSQL, tableName);
		}
	}
);

export const mysqlOnly = new Proxy
(	function(strings: TemplateStringsArray, ...params: unknown[])
	{	return new Sql(DEFAULT_SETTINGS_MYSQL_ONLY, [...strings], params);
	} as SqlFactory,
	{	get(_target, tableName)
		{	if (typeof(tableName) != 'string')
			{	throw new Error("Table name must be string");
			}
			return new SqlTable(DEFAULT_SETTINGS_MYSQL_ONLY, tableName);
		}
	}
);

export const pgsql = new Proxy
(	function(strings: TemplateStringsArray, ...params: unknown[])
	{	return new Sql(DEFAULT_SETTINGS_PGSQL, [...strings], params);
	} as SqlFactory,
	{	get(_target, tableName)
		{	if (typeof(tableName) != 'string')
			{	throw new Error("Table name must be string");
			}
			return new SqlTable(DEFAULT_SETTINGS_PGSQL, tableName);
		}
	}
);

export const pgsqlOnly = new Proxy
(	function(strings: TemplateStringsArray, ...params: unknown[])
	{	return new Sql(DEFAULT_SETTINGS_PGSQL_ONLY, [...strings], params);
	} as SqlFactory,
	{	get(_target, tableName)
		{	if (typeof(tableName) != 'string')
			{	throw new Error("Table name must be string");
			}
			return new SqlTable(DEFAULT_SETTINGS_PGSQL_ONLY, tableName);
		}
	}
);

export const sqlite = new Proxy
(	function(strings: TemplateStringsArray, ...params: unknown[])
	{	return new Sql(DEFAULT_SETTINGS_SQLITE, [...strings], params);
	} as SqlFactory,
	{	get(_target, tableName)
		{	if (typeof(tableName) != 'string')
			{	throw new Error("Table name must be string");
			}
			return new SqlTable(DEFAULT_SETTINGS_SQLITE, tableName);
		}
	}
);

export const sqliteOnly = new Proxy
(	function(strings: TemplateStringsArray, ...params: unknown[])
	{	return new Sql(DEFAULT_SETTINGS_SQLITE_ONLY, [...strings], params);
	} as SqlFactory,
	{	get(_target, tableName)
		{	if (typeof(tableName) != 'string')
			{	throw new Error("Table name must be string");
			}
			return new SqlTable(DEFAULT_SETTINGS_SQLITE_ONLY, tableName);
		}
	}
);

export const mssql = new Proxy
(	function(strings: TemplateStringsArray, ...params: unknown[])
	{	return new Sql(DEFAULT_SETTINGS_MSSQL, [...strings], params);
	} as SqlFactory,
	{	get(_target, tableName)
		{	if (typeof(tableName) != 'string')
			{	throw new Error("Table name must be string");
			}
			return new SqlTable(DEFAULT_SETTINGS_MSSQL, tableName);
		}
	}
);

export const mssqlOnly = new Proxy
(	function(strings: TemplateStringsArray, ...params: unknown[])
	{	return new Sql(DEFAULT_SETTINGS_MSSQL_ONLY, [...strings], params);
	} as SqlFactory,
	{	get(_target, tableName)
		{	if (typeof(tableName) != 'string')
			{	throw new Error("Table name must be string");
			}
			return new SqlTable(DEFAULT_SETTINGS_MSSQL_ONLY, tableName);
		}
	}
);

/**	Use `mysql` instead.
	@deprecated
 **/
export const mysqlTables = mysql;

/**	Use `mysqlOnly` instead.
	@deprecated
 **/
export const mysqlOnlyTables = mysqlOnly;

/**	Use `pgsql` instead.
	@deprecated
 **/
export const pgsqlTables = pgsql;

/**	Use `pgsqlOnly` instead.
	@deprecated
 **/
export const pgsqlOnlyTables = pgsqlOnly;

/**	Use `sqlite` instead.
	@deprecated
 **/
export const sqliteTables = sqlite;

/**	Use `sqliteOnly` instead.
	@deprecated
 **/
export const sqliteOnlyTables = sqliteOnly;

/**	Use `mssql` instead.
	@deprecated
 **/
export const mssqlTables = mssql;

/**	Use `mssqlOnly` instead.
	@deprecated
 **/
export const mssqlOnlyTables = mssqlOnly;
