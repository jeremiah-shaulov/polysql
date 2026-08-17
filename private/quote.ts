import {debugAssert} from './debug_assert.ts';
import {Sql} from './sql.ts';
import {utf8StringLength} from './utf8_string_length.ts';

const BUFFER_FOR_DATE = new Uint8Array(25); // enough for '2000-01-01 00:00:00.000' with the enclosing apostrophes

const C_ZERO = '0'.charCodeAt(0);
const C_ONE = '1'.charCodeAt(0);
const C_TWO = '2'.charCodeAt(0);
const C_THREE = '3'.charCodeAt(0);
const C_A_CAP = 'A'.charCodeAt(0);
const C_N_CAP = 'N'.charCodeAt(0);
const C_X = 'x'.charCodeAt(0);
const C_APOS = "'".charCodeAt(0);
const C_COLON = ':'.charCodeAt(0);
const C_MINUS = '-'.charCodeAt(0);
const C_SPACE = ' '.charCodeAt(0);
const C_DOT = '.'.charCodeAt(0);
const C_BACKSLASH = '\\'.charCodeAt(0);

const encoder = new TextEncoder;
const decoder = new TextDecoder;
const decoderLatin1 = new TextDecoder('latin1');

// deno-lint-ignore no-explicit-any
type Any = any;

export function mysqlQuote(value: unknown, noBackslashEscapes=false)
{	return quote(value, noBackslashEscapes, false);
}

export function pgsqlQuote(value: unknown, _unused=false)
{	return quote(value, true, false, true);
}

export function sqliteQuote(value: unknown, _unused=false)
{	return quote(value, true, false);
}

export function mssqlQuote(value: unknown, _unused=false)
{	return quote(value, true, true);
}

export function dateEncodeInto(date: Date, buffer: Uint8Array)
{	let year = date.getFullYear();
	if (!(year>=0 && year<=9999)) // also handles NaN (invalid Date)
	{	throw new Error(`Cannot represent such date: ${date}`);
	}
	const month = date.getMonth() + 1;
	const day = date.getDate();
	const hours = date.getHours();
	const minutes = date.getMinutes();
	const seconds = date.getSeconds();
	let millis = date.getMilliseconds();
	// year
	buffer[3] = C_ZERO + year % 10;
	year = Math.floor(year / 10);
	buffer[2] = C_ZERO + year % 10;
	year = Math.floor(year / 10);
	buffer[1] = C_ZERO + year % 10;
	year = Math.floor(year / 10);
	buffer[0] = C_ZERO + year % 10;
	// delimiter
	buffer[4] = C_MINUS;
	// month
	buffer[5] = month<10 ? C_ZERO : C_ONE;
	buffer[6] = month<10 ? C_ZERO+month : C_ZERO+month-10;
	// delimiter
	buffer[7] = C_MINUS;
	// day
	buffer[8] = day<10 ? C_ZERO : day<20 ? C_ONE : day<30 ? C_TWO : C_THREE;
	buffer[9] = day<10 ? C_ZERO+day : day<20 ? C_ZERO+day-10 : day<30 ? C_ZERO+day-20 : C_ZERO+day-30;
	if (millis+seconds+minutes+hours == 0)
	{	return 10;
	}
	// delimiter
	buffer[10] = C_SPACE;
	// hours
	buffer[11] = hours<10 ? C_ZERO : hours<20 ? C_ONE : C_TWO;
	buffer[12] = hours<10 ? C_ZERO+hours : hours<20 ? C_ZERO+hours-10 : C_ZERO+hours-20;
	// delimiter
	buffer[13] = C_COLON;
	// minutes
	buffer[14] = C_ZERO + Math.floor(minutes / 10);
	buffer[15] = C_ZERO + minutes % 10;
	// delimiter
	buffer[16] = C_COLON;
	// seconds
	buffer[17] = C_ZERO + Math.floor(seconds / 10);
	buffer[18] = C_ZERO + seconds % 10;
	if (millis == 0)
	{	// no millis
		return 19;
	}
	// delimiter
	buffer[19] = C_DOT;
	// millis
	buffer[22] = C_ZERO + millis % 10;
	millis = Math.floor(millis / 10);
	buffer[21] = C_ZERO + millis % 10;
	millis = Math.floor(millis / 10);
	buffer[20] = C_ZERO + millis % 10;
	return 23;
}

function quote(value: unknown, noBackslashEscapes=false, isMssql=false, isPgsql=false)
{	if (value==null || typeof(value)=='function' || typeof(value)=='symbol')
	{	return 'NULL';
	}
	if (value === false)
	{	return isMssql ? '0' : 'FALSE';
	}
	if (value === true)
	{	return isMssql ? '1' : 'TRUE';
	}
	if (typeof(value)=='number' || typeof(value)=='bigint')
	{	if (typeof(value)=='number' && !Number.isFinite(value))
		{	throw new Error(`Cannot represent such number: ${value}`);
		}
		return value+'';
	}
	if (value instanceof Date)
	{	const len = dateEncodeInto(value, BUFFER_FOR_DATE.subarray(1));
		BUFFER_FOR_DATE[0] = C_APOS;
		BUFFER_FOR_DATE[1 + len] = C_APOS;
		return decoderLatin1.decode(BUFFER_FOR_DATE.subarray(0, len+2));
	}
	if ((value as Any).buffer instanceof ArrayBuffer)
	{	const view = value instanceof Uint8Array ? value : new Uint8Array((value as Uint8Array).buffer, (value as Uint8Array).byteOffset, (value as Uint8Array).byteLength);
		const paramLen = view.byteLength;
		let result;
		let pos = 2;
		if (isMssql)
		{	result = new Uint8Array(paramLen*2 + 2); // like 0x01020304
			result[0] = C_ZERO;
			result[1] = C_X;
		}
		else if (isPgsql)
		{	result = new Uint8Array(paramLen*2 + 4); // like '\x01020304' - bytea hex format
			result[0] = C_APOS;
			result[1] = C_BACKSLASH;
			result[2] = C_X;
			pos = 3;
		}
		else
		{	result = new Uint8Array(paramLen*2 + 3); // like x'01020304'
			result[0] = C_X;
			result[1] = C_APOS;
		}
		for (let j=0; j<paramLen; j++)
		{	const byte = view[j];
			const high = byte >> 4;
			const low = byte & 0xF;
			result[pos++] = high < 10 ? C_ZERO+high : high-10+C_A_CAP;
			result[pos++] = low < 10 ? C_ZERO+low : low-10+C_A_CAP;
		}
		if (!isMssql)
		{	result[pos] = C_APOS;
		}
		return decoderLatin1.decode(result);
	}
	if (value instanceof ReadableStream)
	{	throw new Error(`Cannot stringify ReadableStream`);
	}
	if (typeof((value as Any).read) == 'function')
	{	throw new Error(`Cannot stringify Deno.Reader`);
	}
	// Convert value to string
	let str;
	if (typeof(value)=='object' && !(value instanceof Sql))
	{	str = JSON.stringify(value);
	}
	else
	{	str = value+'';
	}
	let nAdd = 0;
	let hasNonAscii = false;
	for (let j=0, jEnd=str.length; j<jEnd; j++)
	{	const c = str.charCodeAt(j);
		if (c==C_APOS || c==C_BACKSLASH && !noBackslashEscapes)
		{	nAdd++;
		}
		else if (c > 0x7F)
		{	hasNonAscii = true;
		}
	}
	// On MS SQL an unprefixed literal is `varchar`, so the server converts it to the database collation, losing chars that this collation cannot represent. The `N` prefix makes the literal `nvarchar`
	const nPrefix = isMssql && hasNonAscii;
	if (nAdd == 0)
	{	return nPrefix ? "N'"+str+"'" : "'"+str+"'";
	}
	const prefixLen = nPrefix ? 2 : 1; // "N'" or "'"
	const result = new Uint8Array(prefixLen + utf8StringLength(str) + nAdd + 1);
	const {read, written} = encoder.encodeInto(str, result.subarray(prefixLen));
	debugAssert(read == str.length);
	if (nPrefix)
	{	result[0] = C_N_CAP;
	}
	result[prefixLen - 1] = C_APOS;
	for (let j=prefixLen+written-1, k=j+nAdd; k!=j; k--, j--)
	{	const c = result[j];
		if (c==C_APOS || c==C_BACKSLASH && !noBackslashEscapes)
		{	result[k--] = c;
		}
		result[k] = c;
	}
	result[prefixLen + written + nAdd] = C_APOS;
	return decoder.decode(result);
}
