// deno-lint-ignore-file

const C_A_CAP = 'A'.charCodeAt(0);
const C_A = 'a'.charCodeAt(0);
const C_Z = 'z'.charCodeAt(0);

const RE_S = /\s+/;

const DEFAULT_IDENTS_POLICY = `NOT AND OR XOR BETWEEN SEPARATOR IS NULL DISTINCT LIKE CHAR MATCH AGAINST INTERVAL YEAR MONTH WEEK DAY HOUR MINUTE SECOND MICROSECOND CASE WHEN THEN ELSE END AS ASC DESC`;
const DEFAULT_FUNCTIONS_POLICY = `! SELECT FROM JOIN ON WHERE HAVING LIMIT OFFSET`;

const encoder = new TextEncoder;

export const enum SqlMode
{	MYSQL,
	MYSQL_ONLY,
	PGSQL,
	PGSQL_ONLY,
	SQLITE,
	SQLITE_ONLY,
	MSSQL,
	MSSQL_ONLY,
}

class SqlWordsList
{	def: string;

	private isWhitelist = true;
	private map: Map<number, Uint8Array[]> = new Map;

	constructor(initDef: string)
	{	initDef = initDef.trim();
		if (initDef.charAt(0) == '!')
		{	this.isWhitelist = false;
			initDef = initDef.slice(1).trimStart();
		}
		let initIdentsArr = initDef.split(RE_S);
		let idents = [];
		for (let id of initIdentsArr)
		{	id = id.toUpperCase();
			let word = encoder.encode(id);
			let key = word[0] | (word[1] << 8) | (word[word.length-1] << 16) | (word.length << 24);
			let list = this.map.get(key);
			if (!list)
			{	list = [];
				this.map.set(key, list);
			}
			if (list.findIndex(v => uint8arrayCmp(v, word)==0) == -1)
			{	list.push(word);
				idents.push(id);
			}
		}
		idents.sort();
		this.def = this.isWhitelist ? idents.join(' ') : '!'+idents.join(' ');
	}

	isAllowed(subj: Uint8Array)
	{	let len = subj.length;
		let c0 = subj[0] | 0;
		let c1 = subj[1] | 0;
		let cN = subj[len-1] | 0;
		if (c0>=C_A && c0<=C_Z)
		{	c0 += C_A_CAP - C_A; // to upper case
		}
		if (c1>=C_A && c1<=C_Z)
		{	c1 += C_A_CAP - C_A; // to upper case
		}
		if (cN>=C_A && cN<=C_Z)
		{	cN += C_A_CAP - C_A; // to upper case
		}
		let key = c0 | (c1 << 8) | (cN << 16) | (len << 24);
		let list = this.map.get(key);
		if (list)
		{	len--; // no need to compare the last char, as it's part of key
			// is subj in list?
L:			for (let word of list)
			{	for (let i=2; i<len; i++) // no need to compare the first 2 chars, as they're part of key
				{	let c = subj[i];
					if (c>=C_A && c<=C_Z)
					{	c += C_A_CAP - C_A; // to upper case
					}
					if (word[i] != c)
					{	continue L;
					}
				}
				return this.isWhitelist;
			}
		}
		return !this.isWhitelist;
	}
}

export class SqlSettings
{	private mIdents: SqlWordsList;
	private mFunctions: SqlWordsList;

	constructor(readonly mode: SqlMode, idents?: string, functions?: string)
	{	this.mIdents = new SqlWordsList(idents ?? DEFAULT_IDENTS_POLICY);
		this.mFunctions = new SqlWordsList(functions ?? DEFAULT_FUNCTIONS_POLICY);
	}

	get idents()
	{	return this.mIdents.def;
	}

	get functions()
	{	return this.mFunctions.def;
	}

	isIdentAllowed(subj: Uint8Array)
	{	return this.mIdents.isAllowed(subj);
	}

	isFunctionAllowed(subj: Uint8Array)
	{	return this.mFunctions.isAllowed(subj);
	}
}

function uint8arrayCmp(a: Uint8Array, b: Uint8Array)
{	let len = Math.min(a.length, b.length);
	for (let i=0; i<len; i++)
	{	if (a[i] < b[i])
		{	return -1;
		}
		if (a[i] > b[i])
		{	return +1;
		}
	}
	if (a.length < b.length)
	{	return -1;
	}
	if (a.length > b.length)
	{	return +1;
	}
	return 0;
}

export const DEFAULT_SETTINGS_MYSQL = new SqlSettings(SqlMode.MYSQL);
export const DEFAULT_SETTINGS_MYSQL_ONLY = new SqlSettings(SqlMode.MYSQL_ONLY);
export const DEFAULT_SETTINGS_PGSQL = new SqlSettings(SqlMode.PGSQL);
export const DEFAULT_SETTINGS_PGSQL_ONLY = new SqlSettings(SqlMode.PGSQL_ONLY);
export const DEFAULT_SETTINGS_SQLITE = new SqlSettings(SqlMode.SQLITE);
export const DEFAULT_SETTINGS_SQLITE_ONLY = new SqlSettings(SqlMode.SQLITE_ONLY);
export const DEFAULT_SETTINGS_MSSQL = new SqlSettings(SqlMode.MSSQL);
export const DEFAULT_SETTINGS_MSSQL_ONLY = new SqlSettings(SqlMode.MSSQL_ONLY);
