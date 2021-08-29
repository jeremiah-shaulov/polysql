import {debug_assert} from './debug_assert.ts';
import {Sql} from "./sql.ts";
import {utf8_string_length} from "./utf8_string_length.ts";

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
const decoder_latin1 = new TextDecoder('latin1');

export function mysqlQuote(param: any, no_backslash_escapes=false)
{	return quote(param, no_backslash_escapes, false);
}

export function pgsqlQuote(param: any, unused=false)
{	return quote(param, true, false);
}

export function sqliteQuote(param: any, unused=false)
{	return quote(param, true, false);
}

export function mssqlQuote(param: any, no_backslash_escapes=false)
{	return quote(param, no_backslash_escapes, true);
}

export function date_encode_into(date: Date, buffer: Uint8Array)
{	let year = date.getFullYear();
	let month = date.getMonth() + 1;
	let day = date.getDate();
	let hours = date.getHours();
	let minutes = date.getMinutes();
	let seconds = date.getSeconds();
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

function quote(value: any, no_backslash_escapes=false, is_mssql=false)
{	if (value==null || typeof(value)=='function' || typeof(value)=='symbol')
	{	return 'NULL';
	}
	if (value === false)
	{	return is_mssql ? '0' : 'FALSE';
	}
	if (value === true)
	{	return is_mssql ? '1' : 'TRUE';
	}
	if (typeof(value)=='number' || typeof(value)=='bigint')
	{	return value+'';
	}
	if (value instanceof Date)
	{	let len = date_encode_into(value, BUFFER_FOR_DATE);
		return decoder_latin1.decode(BUFFER_FOR_DATE.subarray(0, len));
	}
	if (value.buffer instanceof ArrayBuffer)
	{	let param_len = value.byteLength;
		let result;
		if (is_mssql)
		{	result = new Uint8Array(param_len*2 + 2); // like 0x01020304
			result[0] = C_ZERO;
			result[1] = C_X;
		}
		else
		{	result = new Uint8Array(param_len*2 + 3); // like x'01020304'
			result[0] = C_X;
			result[1] = C_APOS;
		}
		let pos = 2;
		for (let j=0; j<param_len; j++)
		{	let byte = value[j];
			let high = byte >> 4;
			let low = byte & 0xF;
			result[pos++] = high < 10 ? C_ZERO+high : high-10+C_A_CAP;
			result[pos++] = low < 10 ? C_ZERO+low : low-10+C_A_CAP;
		}
		if (!is_mssql)
		{	result[pos] = C_APOS;
		}
		return decoder_latin1.decode(result);
	}
	if (typeof(value.read) == 'function')
	{	throw new Error(`Cannot stringify Deno.Reader`);
	}
	// Assume: value is string
	if (typeof(value)=='object' && !(value instanceof Sql))
	{	value = JSON.stringify(value);
	}
	else
	{	value += '';
	}
	let n_add = 0;
	for (let j=0, j_end=value.length; j<j_end; j++)
	{	let c = value.charCodeAt(j);
		if (c==C_APOS || c==C_BACKSLASH && !no_backslash_escapes)
		{	n_add++;
		}
	}
	if (n_add == 0)
	{	return "'" + value + "'";
	}
	let result = new Uint8Array(2 + utf8_string_length(value) + n_add);
	let {read, written} = encoder.encodeInto(value, result.subarray(1));
	debug_assert(read == value.length);
	result[0] = C_APOS;
	for (let j=written, k=j+n_add; k!=j; k--, j--)
	{	let c = result[j];
		if (c==C_APOS || c==C_BACKSLASH && !no_backslash_escapes)
		{	result[k--] = c;
		}
		result[k] = c;
	}
	result[1 + written + n_add] = C_APOS;
	return decoder.decode(result);
}
