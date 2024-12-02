import {debugAssert} from './debug_assert.ts';
import {SqlMode, SqlSettings} from './sql_settings.ts';
import {dateEncodeInto} from './quote.ts';

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
const C_S_CAP = 'S'.charCodeAt(0);
const C_S = 's'.charCodeAt(0);
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
	QUOTE_AND_QUALIFY_COLUMN_NAME,
	QUOTE_COLUMN_NAME,
}

// deno-lint-ignore no-explicit-any
type Any = any;

export class Sql
{	estimatedByteLength: number;

	protected strings: string[];
	protected params: unknown[];

	constructor(public sqlSettings: SqlSettings, strings?: string[], params?: unknown[])
	{	if (!strings)
		{	strings = [''];
		}
		if (!params)
		{	params = [];
		}
		if (strings.length != params.length+1)
		{	throw new Error('Please, pass arguments from a string template');
		}
		this.strings = strings;
		this.params = params;
		let len = 0;
		for (const s of strings)
		{	len += s.length + GUESS_STRING_BYTE_LEN_LONGER; // if byte length of s is longer than s.length+GUESS_STRING_BYTE_LEN_LONGER, will realloc later
		}
		for (let i=0, iEnd=params.length; i<iEnd; i++)
		{	const param = params[i];
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
			else if ((param as Any).buffer instanceof ArrayBuffer)
			{	const view = param instanceof Uint8Array ? param : new Uint8Array((param as Uint8Array).buffer, (param as Uint8Array).byteOffset, (param as Uint8Array).byteLength);
				len += view.byteLength*2 + 3; // like x'01020304'
			}
			else if (param instanceof ReadableStream || typeof((param as Any).read)=='function')
			{	// assume, will use `putParamsTo`
			}
			else
			{	const prevString = strings[i];
				const paramTypeDescriminator = prevString.charCodeAt(prevString.length-1);
				if (paramTypeDescriminator==C_APOS || (paramTypeDescriminator==C_QUOT || paramTypeDescriminator==C_BACKTICK) && strings[i+1]?.charCodeAt(0)==paramTypeDescriminator)
				{	const str = JSON.stringify(param);
					len += str.length + GUESS_STRING_BYTE_LEN_LONGER; // if byte length of param is longer than param.length+GUESS_STRING_BYTE_LEN_LONGER, will realloc later
					params[i] = str;
				}
				else
				{	len += 30; // just guess
				}
			}
		}
		this.estimatedByteLength = (len | 7) + 1;
	}

	concat(other: Sql)
	{	const sql: Sql = new (this.constructor as Any)(this.sqlSettings);
		Object.assign(sql, this);
		sql.strings = sql.strings.slice();
		sql.params = sql.params.slice();
		sql.append(other);
		return sql;
	}

	append(other: Sql)
	{	const {strings, params} = this;
		strings[strings.length-1] += other.strings[0];
		for (let i=1, iEnd=other.strings.length, j=strings.length; i<iEnd; i++, j++)
		{	strings[j] = other.strings[i];
		}
		for (let i=0, iEnd=other.params.length, j=params.length; i<iEnd; i++, j++)
		{	params[j] = other.params[i];
		}
		this.estimatedByteLength += other.estimatedByteLength - GUESS_STRING_BYTE_LEN_LONGER;
		debugAssert(this.estimatedByteLength >= GUESS_STRING_BYTE_LEN_LONGER);
		return this;
	}

	/**	If `useBuffer` is provided, and it has enough size, will encode to it, and return a `useBuffer.subarray(0, N)`.
		Else, will return a subarray of a new Uint8Array.
		If `useBufferFromPos` is provided, will append to the `useBuffer` after this position.
	 **/
	encode(putParamsTo?: unknown[], mysqlNoBackslashEscapes=false, useBuffer?: Uint8Array, useBufferFromPos=0, defaultParentName?: Uint8Array): Uint8Array
	{	const {strings, params, sqlSettings} = this;
		const {mode} = sqlSettings;
		// 1. Allocate the buffer
		const serializer = new Serializer(putParamsTo, mode!=SqlMode.MYSQL && mode!=SqlMode.MYSQL_ONLY || mysqlNoBackslashEscapes, useBuffer, useBufferFromPos, sqlSettings, this.estimatedByteLength);
		// 2. Append strings and params to the buffer
		let want = Want.NOTHING;
		const iEnd = strings.length - 1;
		for (let i=0; true; i++)
		{	// Append part of string literal
			serializer.appendIntermediateSqlPart(strings[i], want);
			if (i == iEnd)
			{	break;
			}
			let param = params[i];
			// What kind of quote is using
			let qt = serializer.getChar(-1);
			if (qt == C_APOS)
			{	if (strings[i+1].charCodeAt(0) != qt)
				{	throw new Error(`Inappropriately quoted parameter`);
				}
				want = serializer.appendSqlValue(param);
			}
			else if (qt == C_SQUARE_OPEN)
			{	if (strings[i+1].charCodeAt(0) != C_SQUARE_CLOSE)
				{	throw new Error(`Inappropriately enclosed parameter`);
				}
				serializer.setChar(-1, C_PAREN_OPEN); // [ -> (
				serializer.appendIterable(param);
				want = Want.CONVERT_CLOSE_TO_PAREN_CLOSE;
			}
			else if (qt == C_LT)
			{	if (strings[i+1].charCodeAt(0) != C_GT)
				{	throw new Error(`Inappropriately enclosed parameter`);
				}
				serializer.setChar(-1, C_PAREN_OPEN); // '<' -> '('
				serializer.appendNamesValues(param);
				want = Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
			}
			else
			{	// ``, "", {}, () or not enclosed
				// Have parentName?
				let varParentNameLeft: Uint8Array | undefined;
				let varParentName: Uint8Array | undefined;
				const next = strings[i+1];
				if (next?.charCodeAt(0) == C_DOT)
				{	varParentName = encodeParentName(param);
					param = params[++i];
					if (next.length>1 && next.charCodeAt(next.length-1)==C_DOT)
					{	varParentNameLeft = varParentName;
						varParentName = encoder.encode(next.slice(1, -1));
					}
					else if (strings[i+1] == '.')
					{	varParentNameLeft = varParentName;
						varParentName = encodeParentName(param);
						param = params[++i];
					}
				}
				serializer.readParentNamesOnTheLeft(defaultParentName, varParentNameLeft, varParentName);
				qt = serializer.getChar(-1);
				if (qt == C_BRACE_OPEN)
				{	const paramTypeDescriminator = strings[i+1].charCodeAt(0);
					if (paramTypeDescriminator != C_BRACE_CLOSE)
					{	if (paramTypeDescriminator!=C_COMMA && paramTypeDescriminator!=C_AMP && paramTypeDescriminator!=C_PIPE || strings[i+1].charCodeAt(1)!=C_BRACE_CLOSE)
						{	throw new Error(`Inappropriately enclosed parameter`);
						}
					}
					want = serializer.appendEqList(param, paramTypeDescriminator);
				}
				else if (qt==C_BACKTICK || qt==C_QUOT)
				{	const paramTypeDescriminator = strings[i+1].charCodeAt(0);
					if (paramTypeDescriminator == qt)
					{	serializer.appendQuotedIdent(param+'');
						want = Want.CONVERT_QT_ID;
					}
					else
					{	if (paramTypeDescriminator!=C_COMMA && paramTypeDescriminator!=C_TIMES && paramTypeDescriminator!=C_PLUS || strings[i+1].charCodeAt(1)!=qt)
						{	throw new Error(`Inappropriately enclosed parameter`);
						}
						want = serializer.appendQuotedIdents(param, paramTypeDescriminator);
					}
				}
				else
				{	let isExpression = false;
					if (qt == C_PAREN_OPEN)
					{	isExpression = true;
						if (strings[i+1].charCodeAt(0) != C_PAREN_CLOSE)
						{	throw new Error(`Inappropriately enclosed parameter`);
						}
					}
					serializer.appendSafeSqlFragment(param, isExpression);
					want = Want.NOTHING;
				}
			}
		}
		// 3. Done
		return serializer.getResult();
	}

	toString(putParamsTo?: unknown[], mysqlNoBackslashEscapes=false)
	{	return decoder.decode(this.encode(putParamsTo, mysqlNoBackslashEscapes));
	}

	toSqlBytesWithParamsBackslashAndBuffer(putParamsTo: unknown[]|undefined, mysqlNoBackslashEscapes: boolean, useBuffer: Uint8Array)
	{	return this.encode(putParamsTo, mysqlNoBackslashEscapes, useBuffer);
	}
}

class Serializer
{	private result: Uint8Array;
	private pos: number;
	private qtId: number;
	private alwaysQuoteIdents: boolean;
	private bufferForParentName = EMPTY_ARRAY;
	private parentName = EMPTY_ARRAY;
	private parentNameLeft = EMPTY_ARRAY;

	constructor(private putParamsTo: unknown[]|undefined, private noBackslashEscapes: boolean, useBuffer: Uint8Array|undefined, useBufferFromPos: number, private sqlSettings: SqlSettings, estimatedByteLength: number)
	{	if (useBuffer)
		{	this.result = useBuffer;
			this.pos = useBufferFromPos;
		}
		else
		{	this.result = new Uint8Array(estimatedByteLength);
			this.pos = 0;
		}
		this.qtId = sqlSettings.mode==SqlMode.MYSQL || sqlSettings.mode==SqlMode.MYSQL_ONLY ? C_BACKTICK : C_QUOT;
		this.alwaysQuoteIdents = sqlSettings.mode==SqlMode.SQLITE || sqlSettings.mode==SqlMode.SQLITE_ONLY || sqlSettings.mode==SqlMode.MSSQL || sqlSettings.mode==SqlMode.MSSQL_ONLY;
	}

	private appendRawString(s: string)
	{	while (true)
		{	const {read, written} = encoder.encodeInto(s, this.result.subarray(this.pos));
			this.pos += written;
			if (read == s.length)
			{	break;
			}
			s = s.slice(read);
			this.ensureRoom(s.length);
		}
	}

	private ensureRoom(room: number)
	{	if (this.pos+room > this.result.length)
		{	const tmp = new Uint8Array((Math.max(this.result.length*2, this.result.length+Math.max(room, this.result.length/2)) | 7) + 1);
			tmp.set(this.result.subarray(0, this.pos));
			this.result = tmp;
		}
	}

	getChar(offset: number)
	{	return this.result[this.pos + offset];
	}

	setChar(offset: number, value: number)
	{	this.result[this.pos + offset] = value;
	}

	appendRawChar(value: number)
	{	this.ensureRoom(1);
		this.result[this.pos++] = value;
	}

	appendRawBytes(bytes: Uint8Array)
	{	this.ensureRoom(bytes.length);
		this.result.set(bytes, this.pos);
		this.pos += bytes.length;
	}

	/**	Append SQL between params.
	 **/
	appendIntermediateSqlPart(s: string, want: Want)
	{	switch (want)
		{	case Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT:
			{	debugAssert(this.pos > 0);
				const from = --this.pos;
				const c = this.result[from];
				this.appendRawString(s);
				debugAssert(this.result[from]==C_APOS || this.result[from]==C_QUOT || this.result[from]==C_BRACE_CLOSE || this.result[from]==C_GT);
				this.result[from] = c;
				break;
			}
			case Want.REMOVE_A_CHAR_AND_BRACE_CLOSE:
			{	debugAssert(s.charAt(1) == "}");
				this.pos -= 2;
				const from = this.pos;
				const c0 = this.result[from];
				const c1 = this.result[from + 1];
				this.appendRawString(s);
				debugAssert(this.result[from+1] == C_BRACE_CLOSE);
				this.result[from] = c0;
				this.result[from + 1] = c1;
				break;
			}
			case Want.CONVERT_QT_ID:
			{	const from = this.pos;
				this.appendRawString(s);
				debugAssert(this.result[from]==C_QUOT || this.result[from]==C_BACKTICK);
				this.result[from] = this.qtId;
				break;
			}
			case Want.CONVERT_CLOSE_TO_PAREN_CLOSE:
			{	const from = this.pos;
				this.appendRawString(s);
				debugAssert(this.result[from] == C_SQUARE_CLOSE);
				this.result[from] = C_PAREN_CLOSE;
				break;
			}
			case Want.CONVERT_A_CHAR_AND_BRACE_CLOSE_TO_PAREN_CLOSE:
			{	debugAssert(this.pos > 0);
				const from = --this.pos;
				const c = this.result[from];
				this.appendRawString(s);
				debugAssert(this.result[from+1] == C_BRACE_CLOSE);
				this.result[from + 1] = C_PAREN_CLOSE;
				this.result[from] = c;
				break;
			}
			case Want.REMOVE_A_CHAR_AND_QUOT:
			{	debugAssert(s.charCodeAt(1) == C_QUOT);
				this.appendRawString(s.slice(2));
				break;
			}
			default:
			{	debugAssert(want == Want.NOTHING);
				this.appendRawString(s);
			}
		}
	}

	/**	Append a "${param}" or a `${param}`.
		I assume that i'm after opening '"' or '`' char.
	 **/
	appendQuotedIdent(param: string)
	{	const from = this.pos;
		// Append param, as is
		this.appendRawString(param);
		// Escape chars in param
		let {result, pos, qtId} = this;
		let nAdd = 0;
		debugAssert(result[from-1]==C_QUOT || result[from-1]==C_BACKTICK);
		result[from - 1] = qtId;
		for (let j=0, jEnd=param.length; j<jEnd; j++)
		{	if (param.charCodeAt(j) == qtId)
			{	nAdd++;
			}
			else if (param.charCodeAt(j) == 0)
			{	throw new Error("Quoted identifier cannot contain 0-char");
			}
		}
		if (nAdd > 0)
		{	this.ensureRoom(nAdd);
			result = this.result;
			for (let j=pos-1, k=j+nAdd; k!=j; k--, j--)
			{	const c = result[j];
				if (c == qtId)
				{	result[k--] = qtId;
				}
				result[k] = c;
			}
			this.pos = pos + nAdd;
		}
	}

	/**	Append a "${param}*", "${param}+" or a `${param},`.
		I assume that i'm after opening '"' or '`' char.
	 **/
	appendQuotedIdents(param: unknown, paramTypeDescriminator: number)
	{	if (param==null || typeof(param)!='object' || !(Symbol.iterator in param))
		{	throw new Error('Parameter for "${...}' + String.fromCharCode(paramTypeDescriminator) + '" must be iterable');
		}
		const it = param as Iterable<unknown>;
		const {qtId, parentName} = this;
		let isNext = false;
		this.pos--; // backspace "
		for (const p of it)
		{	if (!isNext)
			{	isNext = true;
			}
			else
			{	this.appendRawChar(C_COMMA);
				this.appendRawChar(C_SPACE);
			}
			if (parentName.length)
			{	this.appendRawChar(qtId);
				this.appendRawBytes(parentName);
				this.appendRawChar(qtId);
				this.appendRawChar(C_DOT);
			}
			this.appendRawChar(C_BACKTICK);
			this.appendQuotedIdent(p+'');
			this.appendRawChar(qtId);
		}
		if (paramTypeDescriminator == C_TIMES)
		{	if (!isNext)
			{	this.appendRawChar(C_TIMES);
			}
		}
		else if (paramTypeDescriminator == C_PLUS)
		{	if (!isNext)
			{	throw new Error('No names for "${param}+"');
			}
		}
		else
		{	debugAssert(paramTypeDescriminator == C_COMMA);
			if (isNext)
			{	this.appendRawChar(C_COMMA);
			}
		}
		return Want.REMOVE_A_CHAR_AND_QUOT;
	}

	/**	Append a '${param}'.
		I assume that i'm after opening "'" char.
	 **/
	appendSqlValue(param: unknown)
	{	debugAssert(this.result[this.pos-1] == C_APOS);
		if (param == null)
		{	this.pos--; // backspace '
			this.appendRawBytes(LIT_NULL);
			return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
		}
		if (param === false)
		{	const altBooleans = this.sqlSettings.mode == SqlMode.MSSQL || this.sqlSettings.mode == SqlMode.MSSQL_ONLY;
			this.pos--; // backspace '
			if (altBooleans)
			{	this.appendRawChar(C_ZERO);
			}
			else
			{	this.appendRawBytes(LIT_FALSE);
			}
			return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
		}
		if (param === true)
		{	const altBooleans = this.sqlSettings.mode == SqlMode.MSSQL || this.sqlSettings.mode == SqlMode.MSSQL_ONLY;
			this.pos--; // backspace '
			if (altBooleans)
			{	this.appendRawChar(C_ONE);
			}
			else
			{	this.appendRawBytes(LIT_TRUE);
			}
			return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
		}
		if (typeof(param)=='number' || typeof(param)=='bigint')
		{	this.pos--; // backspace '
			this.appendRawString(param+'');
			return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
		}
		if (param instanceof Date)
		{	this.ensureRoom(DATE_ALLOC_CHAR_LEN);
			this.pos += dateEncodeInto(param, this.result.subarray(this.pos));
			return Want.NOTHING;
		}
		if ((param as Any).buffer instanceof ArrayBuffer)
		{	const view = param instanceof Uint8Array ? param : new Uint8Array((param as Uint8Array).buffer, (param as Uint8Array).byteOffset, (param as Uint8Array).byteLength);
			const paramLen = view.byteLength;
			if (this.putParamsTo && this.putParamsTo.length<MAX_PLACEHOLDERS && paramLen>INLINE_BLOB_MAX_LEN)
			{	this.result[this.pos - 1] = C_QUEST; // ' -> ?
				this.putParamsTo.push(view);
				return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
			}
			const {result} = this;
			const altHexLiterals = this.sqlSettings.mode == SqlMode.MSSQL || this.sqlSettings.mode == SqlMode.MSSQL_ONLY;
			this.ensureRoom(paramLen*2 + 1);
			if (altHexLiterals)
			{	// like 0x01020304
				result[this.pos - 1] = C_ZERO; // overwrite '
				result[this.pos++] = C_X;
			}
			else
			{	// like x'01020304'
				result[this.pos - 1] = C_X; // overwrite '
				result[this.pos++] = C_APOS;
			}
			for (let j=0; j<paramLen; j++)
			{	const byte = view[j];
				const high = byte >> 4;
				const low = byte & 0xF;
				result[this.pos++] = high < 10 ? C_ZERO+high : high-10+C_A_CAP;
				result[this.pos++] = low < 10 ? C_ZERO+low : low-10+C_A_CAP;
			}
			return altHexLiterals ? Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT : Want.NOTHING;
		}
		if (param instanceof ReadableStream || typeof((param as Any).read)=='function')
		{	if (this.putParamsTo && this.putParamsTo.length<MAX_PLACEHOLDERS)
			{	this.result[this.pos - 1] = C_QUEST; // ' -> ?
				this.putParamsTo.push(param);
				return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
			}
			throw new Error(param instanceof ReadableStream ? `Cannot stringify ReadableStream` : `Cannot stringify Deno.Reader`);
		}
		// Assume: param is string, Sql, or something else that must be converted to string
		const str = param+'';
		// putParamsTo?
		if (this.putParamsTo && this.putParamsTo.length<MAX_PLACEHOLDERS && str.length>INLINE_STRING_MAX_LEN)
		{	this.result[this.pos - 1] = C_QUEST; // ' -> ?
			this.putParamsTo.push(str);
			return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
		}
		// Append param, as is
		this.appendRawString(str);
		// Escape chars in param
		let {result, pos} = this;
		let nAdd = 0;
		for (let j=0, jEnd=str.length; j<jEnd; j++)
		{	const c = str.charCodeAt(j);
			if (c==C_APOS || c==C_BACKSLASH && !this.noBackslashEscapes)
			{	nAdd++;
			}
		}
		if (nAdd > 0)
		{	this.ensureRoom(nAdd);
			result = this.result;
			for (let j=pos-1, k=j+nAdd; k!=j; k--, j--)
			{	const c = result[j];
				if (c==C_APOS || c==C_BACKSLASH && !this.noBackslashEscapes)
				{	result[k--] = c;
				}
				result[k] = c;
			}
			this.pos = pos + nAdd;
		}
		return Want.NOTHING;
	}

	/**	Append a [${param}].
		I assume that i'm after opening '[' char, that was converted to '('.
	 **/
	appendIterable(param: unknown, level=0)
	{	if (param==null || typeof(param)!='object' || !(Symbol.iterator in param))
		{	throw new Error("In SQL fragment: parameter for [${...}] must be iterable");
		}
		const it = param as Iterable<unknown>;
		let nItemsAdded = 0;
		for (const p of it)
		{	if (nItemsAdded++ != 0)
			{	this.appendRawChar(C_COMMA);
			}
			if (typeof(p)!='object' && typeof(p)!='function' || (p instanceof Date) || ((p as Any).buffer instanceof ArrayBuffer))
			{	this.appendRawChar(C_APOS);
				if (this.appendSqlValue(p) != Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT)
				{	this.appendRawChar(C_APOS);
				}
			}
			else if (p!=null && Symbol.iterator in p)
			{	switch (this.sqlSettings.mode)
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
				this.appendRawChar(C_PAREN_OPEN);
				this.appendIterable(p, level+1);
				this.appendRawChar(C_PAREN_CLOSE);
			}
			else
			{	this.appendRawBytes(LIT_NULL);
			}
		}
		if (nItemsAdded == 0)
		{	this.appendRawBytes(LIT_NULL);
		}
	}

	/**	Append a <${param}>.
		I assume that i'm after opening '<' char, that was converted to '('.
	 **/
	appendNamesValues(param: unknown)
	{	if (param==null || typeof(param)!='object' || !(Symbol.iterator in param))
		{	throw new Error("In SQL fragment: parameter for <${...}> must be iterable");
		}
		const it = param as Iterable<unknown>;
		const {qtId} = this;
		let names: string[] | undefined;
		for (const row of it)
		{	if (row==null || typeof(row)!='object')
			{	throw new Error("In SQL fragment: parameter for <${...}> must be iterable of objects");
			}
			if (!names)
			{	names = Object.keys(row);
				if (names.length == 0)
				{	throw new Error("No fields for <${param}>");
				}
				this.appendRawChar(qtId);
				this.appendQuotedIdent(names[0]);
				this.appendRawChar(qtId);
				for (let i=1, iEnd=names.length; i<iEnd; i++)
				{	this.appendRawChar(C_COMMA);
					this.appendRawChar(C_SPACE);
					this.appendRawChar(qtId);
					this.appendQuotedIdent(names[i]);
					this.appendRawChar(qtId);
				}
				this.appendRawBytes(DELIM_PAREN_CLOSE_VALUES);
			}
			else
			{	this.appendRawChar(C_PAREN_CLOSE);
				this.appendRawChar(C_COMMA);
				this.appendRawChar(C_LF);
			}
			let delim = C_PAREN_OPEN;
			for (const name of names)
			{	this.appendRawChar(delim);
				this.appendRawChar(C_APOS);
				if (this.appendSqlValue((row as Any)[name]) != Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT)
				{	this.appendRawChar(C_APOS);
				}
				delim = C_COMMA;
			}
		}
		if (!names)
		{	throw new Error("0 rows in <${param}>");
		}
		this.appendRawChar(C_PAREN_CLOSE);
	}

	/**	Read the parent qualifier in (parent.parent.${param}) or {parent.parent.${param}}.
		I assume that i'm after '.' char.
	 **/
	readParentNamesOnTheLeft(defaultParentName: Uint8Array|undefined, varParentNameLeft: Uint8Array|undefined, varParentName: Uint8Array|undefined)
	{	let {result, pos} = this;
		if (varParentNameLeft && varParentName)
		{	this.parentNameLeft = varParentNameLeft;
			this.parentName = varParentName;
			return;
		}
		if (result[pos-1] != C_DOT)
		{	this.parentName = varParentName ?? defaultParentName ?? EMPTY_ARRAY;
			this.parentNameLeft = this.parentName;
			return;
		}
		// parentName
		const from = --pos; // from '.'
		let c = result[--pos];
		while (c>=C_A && c<=C_Z || c>=C_A_CAP && c<=C_Z_CAP || c>=C_ZERO && c<=C_NINE || c==C_UNDERSCORE || c>=0x80)
		{	c = result[--pos];
		}
		const parentNameLen = from - pos - 1;
		// parentNameLeft
		let fromLeft = -1;
		if (c==C_DOT && !varParentName)
		{	fromLeft = pos; // from '.'
			c = result[--pos];
			while (c>=C_A && c<=C_Z || c>=C_A_CAP && c<=C_Z_CAP || c>=C_ZERO && c<=C_NINE || c==C_UNDERSCORE || c>=0x80)
			{	c = result[--pos];
			}
		}
		//
		pos++; // to the first letter of the parent name
		this.pos = pos;
		const bothLen = from - pos; // name of "left.right"
		if (this.bufferForParentName.length < bothLen)
		{	this.bufferForParentName = new Uint8Array((bothLen|7) + 1);
		}
		this.bufferForParentName.set(result.subarray(pos, from));
		if (fromLeft == -1)
		{	this.parentNameLeft = this.bufferForParentName.subarray(0, parentNameLen);
			this.parentName = varParentName ?? this.parentNameLeft;
		}
		else
		{	this.parentNameLeft = this.bufferForParentName.subarray(0, fromLeft-pos);
			this.parentName = this.bufferForParentName.subarray(fromLeft-pos+1, fromLeft-pos+1+parentNameLen);
		}
	}

	appendEqList(param: unknown, paramTypeDescriminator: number)
	{	if (param==null || typeof(param)!='object')
		{	throw new Error("In SQL fragment: parameter for {${...}} must be object");
		}
		const {qtId, parentNameLeft} = this;
		let delim;
		if (paramTypeDescriminator==C_BRACE_CLOSE || paramTypeDescriminator==C_COMMA)
		{	delim = DELIM_COMMA;
			this.pos--; // backspace {
		}
		else
		{	delim = paramTypeDescriminator==C_AMP ? DELIM_AND : DELIM_OR;
			this.setChar(-1, C_PAREN_OPEN); // { -> (
		}
		let nItemsAdded = 0;
		for (const [k, v] of Object.entries(param))
		{	if (nItemsAdded++ != 0)
			{	this.appendRawBytes(delim);
			}
			if (parentNameLeft.length)
			{	this.appendRawChar(qtId);
				this.appendRawBytes(parentNameLeft);
				this.appendRawChar(qtId);
				this.appendRawChar(C_DOT);
			}
			this.appendRawChar(qtId);
			this.appendQuotedIdent(k);
			this.appendRawChar(qtId);
			this.appendRawChar(C_EQ);
			if (v instanceof Sql)
			{	this.appendSafeSqlFragment(v, true);
			}
			else
			{	this.appendRawChar(C_APOS);
				if (this.appendSqlValue(v) != Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT)
				{	this.appendRawChar(C_APOS);
				}
			}
		}
		if (paramTypeDescriminator == C_COMMA)
		{	if (nItemsAdded != 0)
			{	this.appendRawChar(C_COMMA);
			}
			return Want.REMOVE_A_CHAR_AND_BRACE_CLOSE;
		}
		else if (paramTypeDescriminator == C_BRACE_CLOSE)
		{	if (nItemsAdded == 0)
			{	throw new Error("In SQL fragment: 0 values for {${...}}");
			}
			return Want.REMOVE_APOS_OR_BRACE_CLOSE_OR_GT;
		}
		else if (nItemsAdded == 0)
		{	this.pos--; // backspace
			const altBooleans = this.sqlSettings.mode == SqlMode.MSSQL || this.sqlSettings.mode == SqlMode.MSSQL_ONLY;
			if (altBooleans)
			{	this.appendRawChar(paramTypeDescriminator==C_AMP ? C_ONE : C_ZERO);
			}
			else
			{	this.appendRawBytes(paramTypeDescriminator==C_AMP ? LIT_TRUE : LIT_FALSE);
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
	appendSafeSqlFragment(param: unknown, isExpression=false)
	{	// Remember end position before appending
		const from = this.pos;
		// Append param, as is
		if (param instanceof Sql)
		{	const tmp = param.sqlSettings;
			param.sqlSettings = this.sqlSettings;
			try
			{	const newResult = param.encode(this.putParamsTo, this.noBackslashEscapes, this.result, this.pos, this.parentName);
				this.pos = newResult.length;
				if (newResult.buffer != this.result.buffer)
				{	this.result = new Uint8Array(newResult.buffer);
				}
			}
			finally
			{	param.sqlSettings = tmp;
			}
		}
		else
		{	const str = param+'';
			param = str;
			this.appendRawString(str);
		}
		// Escape chars in param
		// 1. Find how many bytes to add
		let {result, pos, qtId, alwaysQuoteIdents, parentName} = this;
		let parenLevel = 0;
		const changes = new Array<{change: Change, changeFrom: number, changeTo: number}>;
		let nAdd = 0;
		let lastAsAt = 0;
L:		for (let j=from; j<pos; j++)
		{	let c = result[j];
			switch (c)
			{	case C_COMMA:
					if (parenLevel==0 && isExpression)
					{	throw new Error(`Comma in SQL fragment: ${param}`);
					}
					break;
				case C_APOS:
					while (++j < pos)
					{	c = result[j];
						if (c == C_BACKSLASH)
						{	if (!this.noBackslashEscapes)
							{	changes[changes.length] = {change: Change.DOUBLE_BACKSLASH, changeFrom: j, changeTo: j};
								nAdd++;
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
				{	const qt = c;
					const jFrom = j;
					const changesPos = changes.length;
					if (qt == qtId)
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
					{	result[j] = qtId;
						while (++j < pos)
						{	c = result[j];
							if (c == qt)
							{	if (result[j+1]!=qt || j+1>=pos)
								{	result[j] = qtId;
									break;
								}
								result.copyWithin(j+1, j+2, pos--); // undouble the quote
							}
							else if (c == qtId)
							{	changes[changes.length] = {change: qtId==C_BACKTICK ? Change.DOUBLE_BACKTICK : Change.DOUBLE_QUOT, changeFrom: j, changeTo: j};
								nAdd++;
							}
						}
					}
					if (j >= pos)
					{	throw new Error(`Unterminated quoted identifier in SQL fragment: ${param}`);
					}
					if (lastAsAt!=jFrom && parentName.length) // if not after AS keyword, and there's `parentName`
					{	while (++j < pos)
						{	c = result[j];
							if (c!=C_SPACE && c!=C_TAB && c!=C_CR && c!=C_LF)
							{	break;
							}
						}
						if (c!=C_PAREN_OPEN && c!=C_DOT)
						{	changes.splice(changesPos, 0, {change: Change.INSERT_PARENT_NAME, changeFrom: jFrom-1, changeTo: jFrom-1});
							nAdd += parentName.length + 3; // plus ``.
						}
						j--; // will j++ on next iter
					}
					break;
				}
				case C_PAREN_OPEN:
					parenLevel++;
					break;
				case C_PAREN_CLOSE:
					if (parenLevel-- <= 0)
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
								const changeFrom = j;
								j--;
								while (++j < pos)
								{	c = result[j];
									if (!(c>=C_A && c<=C_Z || c>=C_A_CAP && c<=C_Z_CAP || c>=C_ZERO && c<=C_NINE || c==C_UNDERSCORE || c>=0x80))
									{	break;
									}
								}
								if (alwaysQuoteIdents && j!=changeFrom)
								{	changes[changes.length] = {change: Change.QUOTE_COLUMN_NAME, changeFrom, changeTo: j-1};
									nAdd += 2; // ``
								}
								break;
							}
						}
					}
					j--; // will j++ on next iter
					break;
				case 0:
				case C_SEMICOLON:
				case C_AT:
				case C_DOLLAR:
				case C_HASH:
				case C_COLON:
				case C_SQUARE_OPEN:
				case C_SQUARE_CLOSE:
				case C_BRACE_OPEN:
				case C_BRACE_CLOSE:
					throw new Error(`Invalid character in SQL fragment: ${param}`);
				case C_QUEST:
					if (!(param instanceof Sql))
					{	throw new Error(`Invalid character in SQL fragment: ${param}`);
					}
					// fallthrough
				default:
				{	let hasNondigit = c>=C_A && c<=C_Z || c>=C_A_CAP && c<=C_Z_CAP || c==C_UNDERSCORE || c>=0x80;
					if (hasNondigit || c>=C_ZERO && c<=C_NINE)
					{	const changeFrom = j;
						while (++j < pos)
						{	c = result[j];
							if (c>=C_A && c<=C_Z || c>=C_A_CAP && c<=C_Z_CAP || c==C_UNDERSCORE || c>=0x80)
							{	hasNondigit = true;
								continue;
							}
							if (c>=C_ZERO && c<=C_NINE)
							{	continue;
							}
							break;
						}
						if (hasNondigit)
						{	// skip space following this identifier
							const jAfterIdent = j--;
							while (++j < pos)
							{	c = result[j];
								if (c!=C_SPACE && c!=C_TAB && c!=C_CR && c!=C_LF)
								{	break;
								}
							}
							// is allowed?
							const name = result.subarray(changeFrom, jAfterIdent);
							if (c == C_PAREN_OPEN) // if is function
							{	if (!this.sqlSettings.isFunctionAllowed(name))
								{	changes[changes.length] = {change: Change.QUOTE_COLUMN_NAME, changeFrom, changeTo: jAfterIdent-1};
									nAdd += 2; // ``
								}
								else if (jAfterIdent < j)
								{	// put '(' right after function name
									debugAssert(result[j] == C_PAREN_OPEN);
									result[j] = result[jAfterIdent];
									result[jAfterIdent] = C_PAREN_OPEN;
									parenLevel++;
								}
							}
							else if (c == C_DOT) // if is parent qualifier
							{	changes[changes.length] = {change: Change.QUOTE_COLUMN_NAME, changeFrom, changeTo: jAfterIdent-1};
								nAdd += 2; // ``
							}
							else if (!this.sqlSettings.isIdentAllowed(name))
							{	if (lastAsAt!=changeFrom && parentName.length) // if not after AS keyword, and there's `parentName`
								{	changes[changes.length] = {change: Change.QUOTE_AND_QUALIFY_COLUMN_NAME, changeFrom, changeTo: jAfterIdent-1};
									nAdd += !alwaysQuoteIdents ? parentName.length+3 : parentName.length+5; // !alwaysQuoteIdents ? ``. : ``.``
								}
								else
								{	changes[changes.length] = {change: Change.QUOTE_COLUMN_NAME, changeFrom, changeTo: jAfterIdent-1};
									nAdd += 2; // ``
								}
							}
							else if (name.length==2 && (name[0]==C_A_CAP || name[0]==C_A) && (name[1]==C_S_CAP || name[1]==C_S))
							{	lastAsAt = j;
							}
						}
						j--; // will j++ on next iter
					}
				}
			}
		}
		if (parenLevel > 0)
		{	throw new Error(`Unbalanced parenthesis in SQL fragment: ${param}`);
		}
		// 2. Add needed bytes
		if (nAdd > 0)
		{	this.ensureRoom(nAdd);
			result = this.result;
			let nChange = changes.length;
			// deno-lint-ignore no-inner-declarations no-var
			var {change, changeFrom, changeTo} = changes[--nChange];
			for (let j=pos-1, k=j+nAdd; true; k--, j--)
			{	const c = result[j];
				if (j == changeTo)
				{	// take actions
					switch (change)
					{	case Change.DOUBLE_BACKSLASH:
							// backslash to double
							debugAssert(c == C_BACKSLASH);
							result[k--] = C_BACKSLASH;
							result[k] = C_BACKSLASH;
							break;
						case Change.DOUBLE_BACKTICK:
							// backtick to double
							debugAssert(c == C_BACKTICK);
							result[k--] = C_BACKTICK;
							result[k] = C_BACKTICK;
							break;
						case Change.DOUBLE_QUOT:
							// qout to double
							debugAssert(c == C_QUOT);
							result[k--] = C_QUOT;
							result[k] = C_QUOT;
							break;
						case Change.INSERT_PARENT_NAME:
							result[k--] = C_DOT;
							result[k--] = qtId;
							for (let p=parentName.length-1; p>=0; p--)
							{	result[k--] = parentName![p];
							}
							result[k--] = qtId;
							result[k] = c;
							break;
						case Change.QUOTE_COLUMN_NAME:
							result[k--] = qtId;
							while (j >= changeFrom)
							{	result[k--] = result[j--];
							}
							result[k] = qtId;
							j++; // will k--, j-- on next iter
							break;
						default:
							debugAssert(change == Change.QUOTE_AND_QUALIFY_COLUMN_NAME);
							// column name to quote
							if (alwaysQuoteIdents)
							{	result[k--] = qtId;
							}
							while (j >= changeFrom)
							{	result[k--] = result[j--];
							}
							if (alwaysQuoteIdents)
							{	result[k--] = qtId;
							}
							result[k--] = C_DOT;
							result[k--] = qtId;
							for (let p=parentName.length-1; p>=0; p--)
							{	result[k--] = parentName[p];
							}
							result[k] = qtId;
							j++; // will k--, j-- on next iter
							break;
					}
					if (nChange <= 0)
					{	break;
					}
					// deno-lint-ignore no-inner-declarations no-var no-redeclare
					var {change, changeFrom, changeTo} = changes[--nChange];
				}
				else
				{	// copy char
					result[k] = c;
				}
			}
			this.pos = pos + nAdd;
		}
	}

	/**	Done serializing. Get the produced result.
	 **/
	getResult()
	{	return this.result.subarray(0, this.pos);
	}
}

function encodeParentName(param: unknown)
{	if (param == null)
	{	return EMPTY_ARRAY;
	}
	if (typeof(param) != 'string')
	{	throw new Error(`Parent qualifier name must be string`);
	}
	return encoder.encode(param);
}