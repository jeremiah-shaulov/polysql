import {debug_assert} from './debug_assert.ts';
import
{	SqlMode,
	SqlSettings,
	DEFAULT_SETTINGS_MYSQL, DEFAULT_SETTINGS_MYSQL_ONLY,
	DEFAULT_SETTINGS_PGSQL, DEFAULT_SETTINGS_PGSQL_ONLY,
	DEFAULT_SETTINGS_SQLITE, DEFAULT_SETTINGS_SQLITE_ONLY,
	DEFAULT_SETTINGS_MSSQL, DEFAULT_SETTINGS_MSSQL_ONLY,
} from './sql_settings.ts';
import {date_encode_into} from "./quote.ts";

export const INLINE_STRING_MAX_LEN = 60;
export const INLINE_BLOB_MAX_LEN = 40;
const GUESS_STRING_BYTE_LEN_LONGER = 10;

const C_APOS = "'".charCodeAt(0);
const C_QUOT = '"'.charCodeAt(0);
const C_BACKTICK = '`'.charCodeAt(0);
const C_BACKSLASH = '\\'.charCodeAt(0);
const C_SPACE = ' '.charCodeAt(0);
const C_TAB = '\t'.charCodeAt(0);
const C_CR = '\r'.charCodeAt(0);
const C_LF = '\n'.charCodeAt(0);
const C_PLUS = '+'.charCodeAt(0);
const C_MINUS = '-'.charCodeAt(0);
const C_SLASH = '/'.charCodeAt(0);
const C_TIMES = '*'.charCodeAt(0);
const C_DOT = '.'.charCodeAt(0);
const C_ZERO = '0'.charCodeAt(0);
const C_ONE = '1'.charCodeAt(0);
const C_NINE = '9'.charCodeAt(0);
const C_X = 'x'.charCodeAt(0);
const C_A_CAP = 'A'.charCodeAt(0);
const C_A = 'a'.charCodeAt(0);
const C_Z_CAP = 'Z'.charCodeAt(0);
const C_Z = 'z'.charCodeAt(0);
const C_DOLLAR = '$'.charCodeAt(0);
const C_UNDERSCORE = '_'.charCodeAt(0);
const C_SEMICOLON = ';'.charCodeAt(0);
const C_COMMA = ','.charCodeAt(0);
const C_AT = '@'.charCodeAt(0);
const C_HASH = '#'.charCodeAt(0);
const C_AMP = '&'.charCodeAt(0);
const C_PIPE = '|'.charCodeAt(0);
const C_EQ = '='.charCodeAt(0);
const C_QUEST = '?'.charCodeAt(0);
const C_COLON = ':'.charCodeAt(0);
const C_PAREN_OPEN = '('.charCodeAt(0);
const C_PAREN_CLOSE = ')'.charCodeAt(0);
const C_SQUARE_OPEN = '['.charCodeAt(0);
const C_SQUARE_CLOSE = ']'.charCodeAt(0);
const C_BRACE_OPEN = '{'.charCodeAt(0);
const C_BRACE_CLOSE = '}'.charCodeAt(0);
const C_LT = '<'.charCodeAt(0);
const C_GT = '>'.charCodeAt(0);

const NUMBER_ALLOC_CHAR_LEN = Math.max((Number.MIN_SAFE_INTEGER+'').length, (Number.MAX_SAFE_INTEGER+'').length, (Number.MAX_VALUE+'').length, (Number.MIN_VALUE+'').length);
const BIGINT_ALLOC_CHAR_LEN = Math.max((0x8000_0000_0000_0000n+'').length, (0x7FFF_FFFF_FFFF_FFFFn+'').length);
const DATE_ALLOC_CHAR_LEN = '2000-01-01 00:00:00.000'.length;

const EMPTY_ARRAY = new Uint8Array;

const encoder = new TextEncoder;
const decoder = new TextDecoder;

const LIT_NULL = encoder.encode('NULL');
const LIT_FALSE = encoder.encode('FALSE');
const LIT_TRUE = encoder.encode('TRUE');
const DELIM_COMMA = encoder.encode(', ');
const DELIM_AND = encoder.encode(' AND ');
const DELIM_OR = encoder.encode(' OR ');
const DELIM_PAREN_CLOSE_VALUES = encoder.encode(') VALUES\n');

const MAX_PLACEHOLDERS = 2**16 - 1;

const enum Want
{	NOTHING,
	REMOVE_APOS_OR_BRACE_CLOSE_OR_GT,
	REMOVE_A_CHAR_AND_BRACE_CLOSE,
	CONVERT_QT_ID,
	CONVERT_CLOSE_TO_PAREN_CLOSE,
	CONVERT_A_CHAR_AND_BRACE_CLOSE_TO_PAREN_CLOSE,
	REMOVE_A_CHAR_AND_QUOT,
}

const enum Change
{	DOUBLE_BACKSLASH,
	DOUBLE_BACKTICK,
	DOUBLE_QUOT,
	INSERT_PARENT_NAME,
	QUOTE_COLUMN_NAME,
	QUOTE_IDENT,
}

const enum OnConflictDo
{	NOTHING,
	UPDATE,
	FAIL,
}

export class Sql
{	estimatedByteLength: number;

	constructor(private strings: TemplateStringsArray|string[], private params: any[], public sqlSettings: SqlSettings=DEFAULT_SETTINGS_MYSQL)
	{	let len = 0;
		for (let s of strings)
		{	len += s.length + GUESS_STRING_BYTE_LEN_LONGER; // if byte length of s is longer than s.length+GUESS_STRING_BYTE_LEN_LONGER, will realloc later
		}
		for (let i=0, i_end=params.length; i<i_end; i++)
		{	let param = params[i];
			if (param == null)
			{	len += 4; // 'NULL'.length
			}
			else if (typeof(param)=='function' || typeof(param)=='symbol')
			{	len += 4; // 'NULL'.length
				params[i] = null;
			}
			else if (typeof(param) == 'boolean')
			{	len += 5; // 'FALSE'.length
			}
			else if (typeof(param) == 'number')
			{	len += NUMBER_ALLOC_CHAR_LEN;
			}
			else if (typeof(param) == 'bigint')
			{	if (param<-0x8000_0000_0000_0000n || param>0x7FFF_FFFF_FFFF_FFFFn)
				{	throw new Error(`Cannot represent such bigint: ${param}`);
				}
				len += BIGINT_ALLOC_CHAR_LEN;
			}
			else if (typeof(param) == 'string')
			{	len += param.length + GUESS_STRING_BYTE_LEN_LONGER; // if byte length of param is longer than param.length+GUESS_STRING_BYTE_LEN_LONGER, will realloc later
			}
			else if (param instanceof Date)
			{	len += DATE_ALLOC_CHAR_LEN;
			}
			else if (param instanceof Sql)
			{	len += param.estimatedByteLength;
			}
			else if (param.buffer instanceof ArrayBuffer)
			{	len += param.byteLength*2 + 3; // like x'01020304'
			}
			else if (typeof(param.read) == 'function')
			{	// assume, will use "put_params_to"
			}
			else
			{	let prev_string = strings[i];
				let param_type_descriminator = prev_string.charCodeAt(prev_string.length-1);
				if (param_type_descriminator==C_APOS || (param_type_descriminator==C_QUOT || param_type_descriminator==C_BACKTICK) && strings[i+1]?.charCodeAt(0)==param_type_descriminator)
				{	param = JSON.stringify(param);
					len += param.length + GUESS_STRING_BYTE_LEN_LONGER; // if byte length of param is longer than param.length+GUESS_STRING_BYTE_LEN_LONGER, will realloc later
					params[i] = param;
				}
				else
				{	len += 30; // just guess
				}
			}
		}
		this.estimatedByteLength = (len | 7) + 1;
	}

	concat(other: Sql)
	{	let strings = [...this.strings];
		strings[strings.length-1] += other.strings[0];
		for (let i=1, i_end=other.strings.length, j=strings.length; i<i_end; i++, j++)
		{	strings[j] = other.strings[i];
		}
		let sql = new Sql([], []);
		sql.strings = strings;
		sql.params = this.params.concat(other.params);
		sql.sqlSettings = this.sqlSettings;
		sql.estimatedByteLength = this.estimatedByteLength + other.estimatedByteLength - GUESS_STRING_BYTE_LEN_LONGER;
		debug_assert(sql.estimatedByteLength >= GUESS_STRING_BYTE_LEN_LONGER);
		return sql;
	}

	/**	If `useBuffer` is provided, and it has enough size, will encode to it, and return a `useBuffer.subarray(0, N)`.
		Else, will return a subarray of a new Uint8Array.
		If `useBufferFromPos` is provided, will append to the `useBuffer` after this position.
	 **/
	encode(put_params_to?: any[], mysql_no_backslash_escapes=false, use_buffer?: Uint8Array, use_buffer_from_pos=0, default_parent_name?: Uint8Array): Uint8Array
	{	let {strings, params, sqlSettings} = this;
		const {mode} = sqlSettings;
		// 1. Allocate the buffer
		let serializer = new Serializer(put_params_to, mode!=SqlMode.MYSQL && mode!=SqlMode.MYSQL_ONLY || mysql_no_backslash_escapes, use_buffer, use_buffer_from_pos, sqlSettings, this.estimatedByteLength);
		// 2. Append strings and params to the buffer
		let want = Want.NOTHING;
		let i_end = strings.length - 1;
		for (let i=0; true; i++)
		{	// Append part of string literal
			serializer.append_intermediate_sql_part(strings[i], want);
			if (i == i_end)
			{	break;
			}
			let param = params[i];
			// What kind of quote is using
			let qt = serializer.get_char(-1);
			if (qt == C_APOS)
			{	if (strings[i+1].charCodeAt(0) != qt)
				{	throw new Error(`Inappropriately quoted parameter`);
				}
				want = serializer.append_sql_value(param);
			}
			else if (qt == C_SQUARE_OPEN)
			{	if (strings[i+1].charCodeAt(0) != C_SQUARE_CLOSE)
				{	throw new Error(`Inappropriately enclosed parameter`);
				}
				if (param==null || typeof(param)!='object' || !(Symbol.iterator in param))
				{	throw new Error("In SQL fragment: parameter for [${...}] must be iterable");
				}
				serializer.set_char(-1, C_PAREN_OPEN); // [ -> (
				serializer.append_iterable(param);
				want = Want.CONVERT_CLOSE_TO_PAREN_CLOSE;
			}
			else if (qt == C_LT)
			{	if (strings[i+1].charCodeAt(0) != C_GT)
				{	throw new Error(`Inappropriately enclosed parameter`);
				}
				if (param==null || typeof(param)!='object' || !(Symbol.iterator in param))
				{	throw new Error("In SQL fragment: parameter for <${...}> must be iterable");
				}
				serializer.set_char(-1, C_PAREN_OPEN); // '<' -> '('
				serializer.append_names_values(param);
				want = Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
			}
			else
			{	// ``, "", {}, () or not enclosed
				// Have parent_name?
				let var_parent_name_left: Uint8Array | undefined;
				let var_parent_name: Uint8Array | undefined;
				let next = strings[i+1];
				if (next?.charCodeAt(0) == C_DOT)
				{	var_parent_name = encode_parent_name(param);
					param = params[++i];
					if (next.length>1 && next.charCodeAt(next.length-1)==C_DOT)
					{	var_parent_name_left = var_parent_name;
						var_parent_name = encoder.encode(next.slice(1, -1));
					}
					else if (strings[i+1] == '.')
					{	var_parent_name_left = var_parent_name;
						var_parent_name = encode_parent_name(param);
						param = params[++i];
					}
				}
				serializer.read_parent_names_on_the_left(default_parent_name, var_parent_name_left, var_parent_name);
				qt = serializer.get_char(-1);
				if (qt == C_BRACE_OPEN)
				{	let param_type_descriminator = strings[i+1].charCodeAt(0);
					if (param_type_descriminator != C_BRACE_CLOSE)
					{	if (param_type_descriminator!=C_COMMA && param_type_descriminator!=C_AMP && param_type_descriminator!=C_PIPE || strings[i+1].charCodeAt(1)!=C_BRACE_CLOSE)
						{	throw new Error(`Inappropriately enclosed parameter`);
						}
					}
					want = serializer.append_eq_list(param, param_type_descriminator);
				}
				else if (qt==C_BACKTICK || qt==C_QUOT)
				{	let param_type_descriminator = strings[i+1].charCodeAt(0);
					if (param_type_descriminator == qt)
					{	serializer.append_quoted_ident(param+'');
						want = Want.CONVERT_QT_ID;
					}
					else
					{	if (param_type_descriminator!=C_COMMA && param_type_descriminator!=C_TIMES && param_type_descriminator!=C_PLUS || strings[i+1].charCodeAt(1)!=qt)
						{	throw new Error(`Inappropriately enclosed parameter`);
						}
						want = serializer.append_quoted_idents(param, param_type_descriminator);
					}
				}
				else
				{	let is_expression = false;
					if (qt == C_PAREN_OPEN)
					{	is_expression = true;
						if (strings[i+1].charCodeAt(0) != C_PAREN_CLOSE)
						{	throw new Error(`Inappropriately enclosed parameter`);
						}
					}
					serializer.append_safe_sql_fragment(param, is_expression);
					want = Want.NOTHING;
				}
			}
		}
		// 3. Done
		return serializer.get_result();
	}

	toString(put_params_to?: any[], mysql_no_backslash_escapes=false)
	{	return decoder.decode(this.encode(put_params_to, mysql_no_backslash_escapes));
	}
}

export function mysql(strings: TemplateStringsArray, ...params: any[])
{	return new Sql(strings, params, DEFAULT_SETTINGS_MYSQL);
}

export function pgsql(strings: TemplateStringsArray, ...params: any[])
{	return new Sql(strings, params, DEFAULT_SETTINGS_PGSQL);
}

export function sqlite(strings: TemplateStringsArray, ...params: any[])
{	return new Sql(strings, params, DEFAULT_SETTINGS_SQLITE);
}

export function mssql(strings: TemplateStringsArray, ...params: any[])
{	return new Sql(strings, params, DEFAULT_SETTINGS_MSSQL);
}

export function mysqlOnly(strings: TemplateStringsArray, ...params: any[])
{	return new Sql(strings, params, DEFAULT_SETTINGS_MYSQL_ONLY);
}

export function pgsqlOnly(strings: TemplateStringsArray, ...params: any[])
{	return new Sql(strings, params, DEFAULT_SETTINGS_PGSQL_ONLY);
}

export function sqliteOnly(strings: TemplateStringsArray, ...params: any[])
{	return new Sql(strings, params, DEFAULT_SETTINGS_SQLITE_ONLY);
}

export function mssqlOnly(strings: TemplateStringsArray, ...params: any[])
{	return new Sql(strings, params, DEFAULT_SETTINGS_MSSQL_ONLY);
}

class Serializer
{	private result: Uint8Array;
	private pos: number;
	private qt_id: number;
	private always_quote_idents: boolean;
	private buffer_for_parent_name = EMPTY_ARRAY;
	private parent_name = EMPTY_ARRAY;
	private parent_name_left = EMPTY_ARRAY;

	constructor(private put_params_to: any[]|undefined, private no_backslash_escapes: boolean, use_buffer: Uint8Array|undefined, use_buffer_from_pos: number, private sql_settings: SqlSettings, estimated_byte_length: number)
	{	if (use_buffer)
		{	this.result = use_buffer;
			this.pos = use_buffer_from_pos;
		}
		else
		{	this.result = new Uint8Array(estimated_byte_length);
			this.pos = 0;
		}
		this.qt_id = sql_settings.mode==SqlMode.MYSQL || sql_settings.mode==SqlMode.MYSQL_ONLY ? C_BACKTICK : C_QUOT;
		this.always_quote_idents = sql_settings.mode==SqlMode.SQLITE || sql_settings.mode==SqlMode.SQLITE_ONLY || sql_settings.mode==SqlMode.MSSQL || sql_settings.mode==SqlMode.MSSQL_ONLY;
	}

	private append_raw_string(s: string)
	{	while (true)
		{	let {read, written} = encoder.encodeInto(s, this.result.subarray(this.pos));
			this.pos += written;
			if (read == s.length)
			{	break;
			}
			s = s.slice(read);
			this.ensure_room(s.length);
		}
	}

	private ensure_room(room: number)
	{	if (this.pos+room > this.result.length)
		{	let tmp = new Uint8Array((Math.max(this.result.length*2, this.result.length+Math.max(room, this.result.length/2)) | 7) + 1);
			tmp.set(this.result.subarray(0, this.pos));
			this.result = tmp;
		}
	}

	get_char(offset: number)
	{	return this.result[this.pos + offset];
	}

	set_char(offset: number, value: number)
	{	this.result[this.pos + offset] = value;
	}

	append_raw_char(value: number)
	{	this.ensure_room(1);
		this.result[this.pos++] = value;
	}

	append_raw_bytes(bytes: Uint8Array)
	{	this.ensure_room(bytes.length);
		this.result.set(bytes, this.pos);
		this.pos += bytes.length;
	}

	/**	Append SQL between params.
	 **/
	append_intermediate_sql_part(s: string, want: Want)
	{	switch (want)
		{	case Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT:
			{	debug_assert(this.pos > 0);
				let from = --this.pos;
				let c = this.result[from];
				this.append_raw_string(s);
				debug_assert(this.result[from]==C_APOS || this.result[from]==C_QUOT || this.result[from]==C_BRACE_CLOSE || this.result[from]==C_GT);
				this.result[from] = c;
				break;
			}
			case Want.REMOVE_A_CHAR_AND_BRACE_CLOSE:
			{	debug_assert(s.charAt(1) == "}");
				this.pos -= 2;
				let from = this.pos;
				let c0 = this.result[from];
				let c1 = this.result[from + 1];
				this.append_raw_string(s);
				debug_assert(this.result[from+1] == C_BRACE_CLOSE);
				this.result[from] = c0;
				this.result[from + 1] = c1;
				break;
			}
			case Want.CONVERT_QT_ID:
			{	let from = this.pos;
				this.append_raw_string(s);
				debug_assert(this.result[from]==C_QUOT || this.result[from]==C_BACKTICK);
				this.result[from] = this.qt_id;
				break;
			}
			case Want.CONVERT_CLOSE_TO_PAREN_CLOSE:
			{	let from = this.pos;
				this.append_raw_string(s);
				debug_assert(this.result[from] == C_SQUARE_CLOSE);
				this.result[from] = C_PAREN_CLOSE;
				break;
			}
			case Want.CONVERT_A_CHAR_AND_BRACE_CLOSE_TO_PAREN_CLOSE:
			{	debug_assert(this.pos > 0);
				let from = --this.pos;
				let c = this.result[from];
				this.append_raw_string(s);
				debug_assert(this.result[from+1] == C_BRACE_CLOSE);
				this.result[from + 1] = C_PAREN_CLOSE;
				this.result[from] = c;
				break;
			}
			case Want.REMOVE_A_CHAR_AND_QUOT:
			{	debug_assert(s.charCodeAt(1) == C_QUOT);
				this.append_raw_string(s.slice(2));
				break;
			}
			default:
			{	this.append_raw_string(s);
			}
		}
	}

	/**	Append a "${param}" or a `${param}`.
		I assume that i'm after opening '"' or '`' char.
	 **/
	append_quoted_ident(param: string)
	{	let from = this.pos;
		// Append param, as is
		this.append_raw_string(param);
		// Escape chars in param
		let {result, pos, qt_id} = this;
		let n_add = 0;
		debug_assert(result[from-1]==C_QUOT || result[from-1]==C_BACKTICK);
		result[from - 1] = qt_id;
		for (let j=0, j_end=param.length; j<j_end; j++)
		{	if (param.charCodeAt(j) == qt_id)
			{	n_add++;
			}
			else if (param.charCodeAt(j) == 0)
			{	throw new Error("Quoted identifier cannot contain 0-char");
			}
		}
		if (n_add > 0)
		{	this.ensure_room(n_add);
			result = this.result;
			for (let j=pos-1, k=j+n_add; k!=j; k--, j--)
			{	let c = result[j];
				if (c == qt_id)
				{	result[k--] = qt_id;
				}
				result[k] = c;
			}
			this.pos = pos + n_add;
		}
	}

	/**	Append a "${param}*", "${param}+" or a `${param},`.
		I assume that i'm after opening '"' or '`' char.
	 **/
	append_quoted_idents(param: any, param_type_descriminator: number)
	{	if (param==null || typeof(param)!='object' || !(Symbol.iterator in param))
		{	throw new Error('Parameter for "${...}' + String.fromCharCode(param_type_descriminator) + '" must be iterable');
		}
		let {qt_id, parent_name} = this;
		let is_next = false;
		this.pos--; // backspace "
		for (let p of param)
		{	if (!is_next)
			{	is_next = true;
			}
			else
			{	this.append_raw_char(C_COMMA);
				this.append_raw_char(C_SPACE);
			}
			if (parent_name.length)
			{	this.append_raw_char(qt_id);
				this.append_raw_bytes(parent_name);
				this.append_raw_char(qt_id);
				this.append_raw_char(C_DOT);
			}
			this.append_raw_char(C_BACKTICK);
			this.append_quoted_ident(p+'');
			this.append_raw_char(qt_id);
		}
		if (param_type_descriminator == C_TIMES)
		{	if (!is_next)
			{	this.append_raw_char(C_TIMES);
			}
		}
		else if (param_type_descriminator == C_PLUS)
		{	if (!is_next)
			{	throw new Error('No names for "${param}+"');
			}
		}
		else
		{	debug_assert(param_type_descriminator == C_COMMA);
			if (is_next)
			{	this.append_raw_char(C_COMMA);
			}
		}
		return Want.REMOVE_A_CHAR_AND_QUOT;
	}

	/**	Append a '${param}'.
		I assume that i'm after opening "'" char.
	 **/
	append_sql_value(param: any)
	{	debug_assert(this.result[this.pos-1] == C_APOS);
		if (param == null)
		{	this.pos--; // backspace '
			this.append_raw_bytes(LIT_NULL);
			return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
		}
		if (param === false)
		{	const alt_booleans = this.sql_settings.mode == SqlMode.MSSQL || this.sql_settings.mode == SqlMode.MSSQL_ONLY;
			this.pos--; // backspace '
			if (alt_booleans)
			{	this.append_raw_char(C_ZERO);
			}
			else
			{	this.append_raw_bytes(LIT_FALSE);
			}
			return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
		}
		if (param === true)
		{	const alt_booleans = this.sql_settings.mode == SqlMode.MSSQL || this.sql_settings.mode == SqlMode.MSSQL_ONLY;
			this.pos--; // backspace '
			if (alt_booleans)
			{	this.append_raw_char(C_ONE);
			}
			else
			{	this.append_raw_bytes(LIT_TRUE);
			}
			return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
		}
		if (typeof(param)=='number' || typeof(param)=='bigint')
		{	this.pos--; // backspace '
			this.append_raw_string(param+'');
			return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
		}
		if (param instanceof Date)
		{	this.ensure_room(DATE_ALLOC_CHAR_LEN);
			this.pos += date_encode_into(param, this.result.subarray(this.pos));
			return Want.NOTHING;
		}
		if (param.buffer instanceof ArrayBuffer)
		{	let param_len = param.byteLength;
			if (this.put_params_to && this.put_params_to.length<MAX_PLACEHOLDERS && param_len>INLINE_BLOB_MAX_LEN)
			{	this.result[this.pos - 1] = C_QUEST; // ' -> ?
				this.put_params_to.push(param);
				return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
			}
			let {result} = this;
			const alt_hex_literals = this.sql_settings.mode == SqlMode.MSSQL || this.sql_settings.mode == SqlMode.MSSQL_ONLY;
			this.ensure_room(param_len*2 + 1);
			if (alt_hex_literals)
			{	// like 0x01020304
				result[this.pos - 1] = C_ZERO; // overwrite '
				result[this.pos++] = C_X;
			}
			else
			{	// like x'01020304'
				result[this.pos - 1] = C_X; // overwrite '
				result[this.pos++] = C_APOS;
			}
			for (let j=0; j<param_len; j++)
			{	let byte = param[j];
				let high = byte >> 4;
				let low = byte & 0xF;
				result[this.pos++] = high < 10 ? C_ZERO+high : high-10+C_A_CAP;
				result[this.pos++] = low < 10 ? C_ZERO+low : low-10+C_A_CAP;
			}
			return alt_hex_literals ? Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT : Want.NOTHING;
		}
		if (typeof(param.read) == 'function')
		{	if (this.put_params_to && this.put_params_to.length<MAX_PLACEHOLDERS)
			{	this.result[this.pos - 1] = C_QUEST; // ' -> ?
				this.put_params_to.push(param);
				return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
			}
			throw new Error(`Cannot stringify Deno.Reader`);
		}
		// Assume: param is string, Sql, or something else that must be converted to string
		param += '';
		// put_params_to?
		if (this.put_params_to && this.put_params_to.length<MAX_PLACEHOLDERS && param.length>INLINE_STRING_MAX_LEN)
		{	this.result[this.pos - 1] = C_QUEST; // ' -> ?
			this.put_params_to.push(param);
			return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
		}
		// Append param, as is
		this.append_raw_string(param);
		// Escape chars in param
		let {result, pos} = this;
		let n_add = 0;
		for (let j=0, j_end=param.length; j<j_end; j++)
		{	let c = param.charCodeAt(j);
			if (c==C_APOS || c==C_BACKSLASH && !this.no_backslash_escapes)
			{	n_add++;
			}
		}
		if (n_add > 0)
		{	this.ensure_room(n_add);
			result = this.result;
			for (let j=pos-1, k=j+n_add; k!=j; k--, j--)
			{	let c = result[j];
				if (c==C_APOS || c==C_BACKSLASH && !this.no_backslash_escapes)
				{	result[k--] = c;
				}
				result[k] = c;
			}
			this.pos = pos + n_add;
		}
		return Want.NOTHING;
	}

	/**	Append a [${param}].
		I assume that i'm after opening '[' char, that was converted to '('.
	 **/
	append_iterable(param: Iterable<any>, level=0)
	{	let n_items_added = 0;
		for (let p of param)
		{	if (n_items_added++ != 0)
			{	this.append_raw_char(C_COMMA);
			}
			if (typeof(p)!='object' && typeof(p)!='function' || (p instanceof Date) || (p.buffer instanceof ArrayBuffer))
			{	this.append_raw_char(C_APOS);
				if (this.append_sql_value(p) != Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT)
				{	this.append_raw_char(C_APOS);
				}
			}
			else if (Symbol.iterator in p)
			{	switch (this.sql_settings.mode)
				{	case SqlMode.MYSQL:
						throw new Error("Multidimensional [${param}] lists are not supported across all engines. Please use mysqlOnly`...`");
					case SqlMode.PGSQL:
						throw new Error("Multidimensional [${param}] lists are not supported across all engines. Please use pgsqlOnly`...`");
					case SqlMode.SQLITE:
					case SqlMode.SQLITE_ONLY:
						throw new Error("Multidimensional [${param}] lists are not supported on SQLite");
					case SqlMode.MSSQL:
					case SqlMode.MSSQL_ONLY:
						throw new Error("Multidimensional [${param}] lists are not supported on MS SQL");
					case SqlMode.PGSQL_ONLY:
						if (level > 0)
						{	throw new Error("More than 2-dimension [${param}] lists are not supported on PostgreSQL");
						}
				}
				this.append_raw_char(C_PAREN_OPEN);
				this.append_iterable(p, level+1);
				this.append_raw_char(C_PAREN_CLOSE);
			}
			else
			{	this.append_raw_bytes(LIT_NULL);
			}
		}
		if (n_items_added == 0)
		{	this.append_raw_bytes(LIT_NULL);
		}
	}

	/**	Append a <${param}>.
		I assume that i'm after opening '<' char, that was converted to '('.
	 **/
	append_names_values(param: Iterable<Record<string, any>>)
	{	let {qt_id} = this;
		let names: string[] | undefined;
		for (let row of param)
		{	if (!names)
			{	names = Object.keys(row);
				if (names.length == 0)
				{	throw new Error("No fields for <${param}>");
				}
				this.append_raw_char(qt_id);
				this.append_quoted_ident(names[0]);
				this.append_raw_char(qt_id);
				for (let i=1, i_end=names.length; i<i_end; i++)
				{	this.append_raw_char(C_COMMA);
					this.append_raw_char(C_SPACE);
					this.append_raw_char(qt_id);
					this.append_quoted_ident(names[i]);
					this.append_raw_char(qt_id);
				}
				this.append_raw_bytes(DELIM_PAREN_CLOSE_VALUES);
			}
			else
			{	this.append_raw_char(C_PAREN_CLOSE);
				this.append_raw_char(C_COMMA);
				this.append_raw_char(C_LF);
			}
			let delim = C_PAREN_OPEN;
			for (let name of names)
			{	this.append_raw_char(delim);
				this.append_raw_char(C_APOS);
				if (this.append_sql_value(row[name]) != Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT)
				{	this.append_raw_char(C_APOS);
				}
				delim = C_COMMA;
			}
		}
		if (!names)
		{	throw new Error("0 rows in <${param}>");
		}
		this.append_raw_char(C_PAREN_CLOSE);
	}

	/**	Read the parent qualifier in (parent.parent.${param}) or {parent.parent.${param}}.
		I assume that i'm after '.' char.
	 **/
	read_parent_names_on_the_left(default_parent_name: Uint8Array|undefined, var_parent_name_left: Uint8Array|undefined, var_parent_name: Uint8Array|undefined)
	{	let {result, pos} = this;
		if (var_parent_name_left && var_parent_name)
		{	this.parent_name_left = var_parent_name_left;
			this.parent_name = var_parent_name;
			return;
		}
		if (result[pos-1] != C_DOT)
		{	this.parent_name = var_parent_name ?? default_parent_name ?? EMPTY_ARRAY;
			this.parent_name_left = this.parent_name;
			return;
		}
		// parent_name
		let from = --pos; // from '.'
		let c = result[--pos];
		while (c>=C_A && c<=C_Z || c>=C_A_CAP && c<=C_Z_CAP || c>=C_ZERO && c<=C_NINE || c==C_UNDERSCORE || c>=0x80)
		{	c = result[--pos];
		}
		let parent_name_len = from - pos - 1;
		// parent_name_left
		let from_left = -1;
		if (c==C_DOT && !var_parent_name)
		{	from_left = pos; // from '.'
			c = result[--pos];
			while (c>=C_A && c<=C_Z || c>=C_A_CAP && c<=C_Z_CAP || c>=C_ZERO && c<=C_NINE || c==C_UNDERSCORE || c>=0x80)
			{	c = result[--pos];
			}
		}
		//
		pos++; // to the first letter of the parent name
		this.pos = pos;
		let both_len = from - pos; // name of "left.right"
		if (this.buffer_for_parent_name.length < both_len)
		{	this.buffer_for_parent_name = new Uint8Array((both_len|7) + 1);
		}
		this.buffer_for_parent_name.set(result.subarray(pos, from));
		if (from_left == -1)
		{	this.parent_name_left = this.buffer_for_parent_name.subarray(0, parent_name_len);
			this.parent_name = var_parent_name ?? this.parent_name_left;
		}
		else
		{	this.parent_name_left = this.buffer_for_parent_name.subarray(0, from_left-pos);
			this.parent_name = this.buffer_for_parent_name.subarray(from_left-pos+1, from_left-pos+1+parent_name_len);
		}
	}

	append_eq_list(param: any, param_type_descriminator: number)
	{	if (param==null || typeof(param)!='object')
		{	throw new Error("In SQL fragment: parameter for {${...}} must be object");
		}
		let {qt_id, parent_name_left} = this;
		let delim;
		if (param_type_descriminator==C_BRACE_CLOSE || param_type_descriminator==C_COMMA)
		{	delim = DELIM_COMMA;
			this.pos--; // backspace {
		}
		else
		{	delim = param_type_descriminator==C_AMP ? DELIM_AND : DELIM_OR;
			this.set_char(-1, C_PAREN_OPEN); // { -> (
		}
		let n_items_added = 0;
		for (let [k, v] of Object.entries(param))
		{	if (n_items_added++ != 0)
			{	this.append_raw_bytes(delim);
			}
			if (parent_name_left.length)
			{	this.append_raw_char(qt_id);
				this.append_raw_bytes(parent_name_left);
				this.append_raw_char(qt_id);
				this.append_raw_char(C_DOT);
			}
			this.append_raw_char(qt_id);
			this.append_quoted_ident(k);
			this.append_raw_char(qt_id);
			this.append_raw_char(C_EQ);
			if (v instanceof Sql)
			{	this.append_safe_sql_fragment(v, true);
			}
			else
			{	this.append_raw_char(C_APOS);
				if (this.append_sql_value(v) != Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT)
				{	this.append_raw_char(C_APOS);
				}
			}
		}
		if (param_type_descriminator == C_COMMA)
		{	if (n_items_added != 0)
			{	this.append_raw_char(C_COMMA);
			}
			return Want.REMOVE_A_CHAR_AND_BRACE_CLOSE;
		}
		else if (param_type_descriminator == C_BRACE_CLOSE)
		{	if (n_items_added == 0)
			{	throw new Error("In SQL fragment: 0 values for {${...}}");
			}
			return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
		}
		else if (n_items_added == 0)
		{	this.pos--; // backspace
			const alt_booleans = this.sql_settings.mode == SqlMode.MSSQL || this.sql_settings.mode == SqlMode.MSSQL_ONLY;
			if (alt_booleans)
			{	this.append_raw_char(param_type_descriminator==C_AMP ? C_ONE : C_ZERO);
			}
			else
			{	this.append_raw_bytes(param_type_descriminator==C_AMP ? LIT_TRUE : LIT_FALSE);
			}
			return Want.REMOVE_A_CHAR_AND_BRACE_CLOSE;
		}
		else
		{	return Want.CONVERT_A_CHAR_AND_BRACE_CLOSE_TO_PAREN_CLOSE;
		}
	}

	/**	Append a (${param}).
		I assume that i'm after opening '(' char (if enclosed).
	 **/
	append_safe_sql_fragment(param: any, is_expression=false)
	{	// Remember end position before appending
		let from = this.pos;
		// Append param, as is
		if (param instanceof Sql)
		{	let tmp = param.sqlSettings;
			param.sqlSettings = this.sql_settings;
			try
			{	let new_result = param.encode(this.put_params_to, this.no_backslash_escapes, this.result, this.pos, this.parent_name);
				this.pos = new_result.length;
				if (new_result.buffer != this.result.buffer)
				{	this.result = new Uint8Array(new_result.buffer);
				}
			}
			finally
			{	param.sqlSettings = tmp;
			}
		}
		else
		{	param += '';
			this.append_raw_string(param);
		}
		// Escape chars in param
		// 1. Find how many bytes to add
		let {result, pos, qt_id, always_quote_idents, parent_name} = this;
		let paren_level = 0;
		let changes: {change: Change, change_from: number, change_to: number}[] = [];
		let n_add = 0;
L:		for (let j=from; j<pos; j++)
		{	let c = result[j];
			switch (c)
			{	case 0:
				case C_SEMICOLON:
				case C_AT:
				case C_DOLLAR:
				case C_HASH:
				case C_QUEST:
				case C_COLON:
				case C_SQUARE_OPEN:
				case C_SQUARE_CLOSE:
				case C_BRACE_OPEN:
				case C_BRACE_CLOSE:
					throw new Error(`Invalid character in SQL fragment: ${param}`);
				case C_COMMA:
					if (paren_level==0 && is_expression)
					{	throw new Error(`Comma in SQL fragment: ${param}`);
					}
					break;
				case C_APOS:
					while (++j < pos)
					{	c = result[j];
						if (c == C_BACKSLASH)
						{	if (!this.no_backslash_escapes)
							{	changes[changes.length] = {change: Change.DOUBLE_BACKSLASH, change_from: j, change_to: j};
								n_add++;
							}
						}
						else if (c == C_APOS)
						{	if (result[j+1]!=C_APOS || j+1>=pos)
							{	continue L;
							}
							j++;
						}
					}
					throw new Error(`Unterminated string literal in SQL fragment: ${param}`);
				case C_BACKTICK:
				case C_QUOT:
				{	let qt = c;
					let j_from = j;
					let changes_pos = changes.length;
					if (qt == qt_id)
					{	while (++j < pos)
						{	c = result[j];
							if (c == qt)
							{	if (result[j+1] != qt)
								{	break;
								}
								j++;
							}
						}
					}
					else
					{	result[j] = qt_id;
						while (++j < pos)
						{	c = result[j];
							if (c == qt)
							{	if (result[j+1]!=qt || j+1>=pos)
								{	result[j] = qt_id;
									break;
								}
								result.copyWithin(j+1, j+2, pos--); // undouble the quote
							}
							else if (c == qt_id)
							{	changes[changes.length] = {change: qt_id==C_BACKTICK ? Change.DOUBLE_BACKTICK : Change.DOUBLE_QUOT, change_from: j, change_to: j};
								n_add++;
							}
						}
					}
					if (j >= pos)
					{	throw new Error(`Unterminated quoted identifier in SQL fragment: ${param}`);
					}
					if (parent_name.length)
					{	while (++j < pos)
						{	c = result[j];
							if (c!=C_SPACE && c!=C_TAB && c!=C_CR && c!=C_LF)
							{	break;
							}
						}
						if (c!=C_PAREN_OPEN && c!=C_DOT)
						{	changes.splice(changes_pos, 0, {change: Change.INSERT_PARENT_NAME, change_from: j_from-1, change_to: j_from-1});
							n_add += parent_name.length + 3; // plus ``.
						}
						j--; // will j++ on next iter
					}
					break;
				}
				case C_PAREN_OPEN:
					paren_level++;
					break;
				case C_PAREN_CLOSE:
					if (paren_level-- <= 0)
					{	throw new Error(`Unbalanced parenthesis in SQL fragment: ${param}`);
					}
					break;
				case C_SLASH:
					if (result[j+1] == C_TIMES)
					{	throw new Error(`Comment in SQL fragment: ${param}`);
					}
					break;
				case C_MINUS:
					if (result[j+1] == C_MINUS)
					{	throw new Error(`Comment in SQL fragment: ${param}`);
					}
					break;
				case C_DOT:
					while (c == C_DOT)
					{	while (++j < pos)
						{	c = result[j];
							if (c!=C_SPACE && c!=C_TAB && c!=C_CR && c!=C_LF)
							{	// skip identifier that follows this dot
								let change_from = j;
								j--;
								while (++j < pos)
								{	c = result[j];
									if (!(c>=C_A && c<=C_Z || c>=C_A_CAP && c<=C_Z_CAP || c>=C_ZERO && c<=C_NINE || c==C_UNDERSCORE || c>=0x80))
									{	break;
									}
								}
								if (always_quote_idents && j!=change_from)
								{	changes[changes.length] = {change: Change.QUOTE_IDENT, change_from, change_to: j-1};
									n_add += 2; // ``
								}
								break;
							}
						}
					}
					j--; // will j++ on next iter
					break;
				default:
				{	let has_nondigit = c>=C_A && c<=C_Z || c>=C_A_CAP && c<=C_Z_CAP || c==C_UNDERSCORE || c>=0x80;
					if (has_nondigit || c>=C_ZERO && c<=C_NINE)
					{	let change_from = j;
						while (++j < pos)
						{	c = result[j];
							if (c>=C_A && c<=C_Z || c>=C_A_CAP && c<=C_Z_CAP || c==C_UNDERSCORE || c>=0x80)
							{	has_nondigit = true;
								continue;
							}
							if (c>=C_ZERO && c<=C_NINE)
							{	continue;
							}
							break;
						}
						if (has_nondigit)
						{	// skip space following this identifier
							let j_after_ident = j--;
							while (++j < pos)
							{	c = result[j];
								if (c!=C_SPACE && c!=C_TAB && c!=C_CR && c!=C_LF)
								{	break;
								}
							}
							// is allowed?
							let name = result.subarray(change_from, j_after_ident);
							if (c == C_PAREN_OPEN) // if is function
							{	if (!this.sql_settings.isFunctionAllowed(name))
								{	changes[changes.length] = {change: Change.QUOTE_IDENT, change_from, change_to: j_after_ident-1};
									n_add += 2; // ``
								}
								else if (j_after_ident < j)
								{	// put '(' right after function name
									debug_assert(result[j] == C_PAREN_OPEN);
									result[j] = result[j_after_ident];
									result[j_after_ident] = C_PAREN_OPEN;
									paren_level++;
								}
							}
							else if (c == C_DOT) // if is parent qualifier
							{	changes[changes.length] = {change: Change.QUOTE_IDENT, change_from, change_to: j_after_ident-1};
								n_add += 2; // ``
							}
							else
							{	if (!this.sql_settings.isIdentAllowed(name))
								{	changes[changes.length] = {change: Change.QUOTE_COLUMN_NAME, change_from, change_to: j_after_ident-1};
									n_add += !parent_name.length ? 2 : !always_quote_idents ? parent_name.length+3 : parent_name.length+5; // no parent_name ? `` : !always_quote_idents ? ``. : ``.``
								}
							}
						}
						j--; // will j++ on next iter
					}
				}
			}
		}
		if (paren_level > 0)
		{	throw new Error(`Unbalanced parenthesis in SQL fragment: ${param}`);
		}
		// 2. Add needed bytes
		if (n_add > 0)
		{	this.ensure_room(n_add);
			result = this.result;
			let n_change = changes.length;
			var {change, change_from, change_to} = changes[--n_change];
			for (let j=pos-1, k=j+n_add; true; k--, j--)
			{	let c = result[j];
				if (j == change_to)
				{	// take actions
					switch (change)
					{	case Change.DOUBLE_BACKSLASH:
							// backslash to double
							debug_assert(c == C_BACKSLASH);
							result[k--] = C_BACKSLASH;
							result[k] = C_BACKSLASH;
							break;
						case Change.DOUBLE_BACKTICK:
							// backtick to double
							debug_assert(c == C_BACKTICK);
							result[k--] = C_BACKTICK;
							result[k] = C_BACKTICK;
							break;
						case Change.DOUBLE_QUOT:
							// qout to double
							debug_assert(c == C_QUOT);
							result[k--] = C_QUOT;
							result[k] = C_QUOT;
							break;
						case Change.INSERT_PARENT_NAME:
							result[k--] = C_DOT;
							result[k--] = qt_id;
							for (let p=parent_name.length-1; p>=0; p--)
							{	result[k--] = parent_name![p];
							}
							result[k--] = qt_id;
							result[k] = c;
							break;
						case Change.QUOTE_COLUMN_NAME:
							// column name to quote
							if (!parent_name.length)
							{	result[k--] = qt_id;
								while (j >= change_from)
								{	result[k--] = result[j--];
								}
								result[k] = qt_id;
							}
							else
							{	if (always_quote_idents)
								{	result[k--] = qt_id;
								}
								while (j >= change_from)
								{	result[k--] = result[j--];
								}
								if (always_quote_idents)
								{	result[k--] = qt_id;
								}
								result[k--] = C_DOT;
								result[k--] = qt_id;
								for (let p=parent_name.length-1; p>=0; p--)
								{	result[k--] = parent_name[p];
								}
								result[k] = qt_id;
							}
							j++; // will k--, j-- on next iter
							break;
						default:
							debug_assert(change == Change.QUOTE_IDENT);
							// some identifier to quote
							result[k--] = qt_id;
							while (j >= change_from)
							{	result[k--] = result[j--];
							}
							result[k] = qt_id;
							j++; // will k--, j-- on next iter
					}
					if (n_change <= 0)
					{	break;
					}
					var {change, change_from, change_to} = changes[--n_change];
				}
				else
				{	// copy char
					result[k] = c;
				}
			}
			this.pos = pos + n_add;
		}
	}

	/**	Done serializing. Get the produced result.
	 **/
	get_result()
	{	return this.result.subarray(0, this.pos);
	}
}

function encode_parent_name(param: any)
{	if (param == null)
	{	return EMPTY_ARRAY;
	}
	if (typeof(param) != 'string')
	{	throw new Error(`Parent qualifier name must be string`);
	}
	return encoder.encode(param);
}