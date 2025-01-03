import {debugAssert} from './debug_assert.ts';
import {Sql} from './sql.ts';
import {utf8StringLength} from './utf8_string_length.ts';

const BUFFER_FOR_DATE = new Uint8Array(23);

const C_ZERO = '0'.charCodeAt(0);
const C_ONE = '1'.charCodeAt(0);
const C_TWO = '2'.charCodeAt(0);
const C_THREE = '3'.charCodeAt(0);
const C_A_CAP = 'A'.charCodeAt(0);
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
{	return quote(value, true, false);
}

export function sqliteQuote(value: unknown, _unused=false)
{	return quote(value, true, false);
}

export function mssqlQuote(value: unknown, _unused=false)
{	return quote(value, true, true);
}

export function dateEncodeInto(date: Date, buffer: Uint8Array)
{	let year = date.getFullYear();
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

function quote(value: unknown, noBackslashEscapes=false, isMssql=false)
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
	{	return value+'';
	}
	if (value instanceof Date)
	{	const len = dateEncodeInto(value, BUFFER_FOR_DATE);
		return decoderLatin1.decode(BUFFER_FOR_DATE.subarray(0, len));
	}
	if ((value as Any).buffer instanceof ArrayBuffer)
	{	const view = value instanceof Uint8Array ? value : new Uint8Array((value as Uint8Array).buffer, (value as Uint8Array).byteOffset, (value as Uint8Array).byteLength);
		const paramLen = view.byteLength;
		let result;
		if (isMssql)
		{	result = new Uint8Array(paramLen*2 + 2); // like 0x01020304
			result[0] = C_ZERO;
			result[1] = C_X;
		}
		else
		{	result = new Uint8Array(paramLen*2 + 3); // like x'01020304'
			result[0] = C_X;
			result[1] = C_APOS;
		}
		let pos = 2;
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
	for (let j=0, jEnd=str.length; j<jEnd; j++)
	{	const c = str.charCodeAt(j);
		if (c==C_APOS || c==C_BACKSLASH && !noBackslashEscapes)
		{	nAdd++;
		}
	}
	if (nAdd == 0)
	{	return "'" + str + "'";
	}
	const result = new Uint8Array(2 + utf8StringLength(str) + nAdd);
	const {read, written} = encoder.encodeInto(str, result.subarray(1));
	debugAssert(read == str.length);
	result[0] = C_APOS;
	for (let j=written, k=j+nAdd; k!=j; k--, j--)
	{	const c = result[j];
		if (c==C_APOS || c==C_BACKSLASH && !noBackslashEscapes)
		{	result[k--] = c;
		}
		result[k] = c;
	}
	result[1 + written + nAdd] = C_APOS;
	return decoder.decode(result);
}
