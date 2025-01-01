# `class` Sql

[Documentation Index](../README.md)

```ts
import {Sql} from "https://deno.land/x/polysql@v2.0.9/mod.ts"
```

## This class has

- [constructor](#-constructorsqlsettings-sqlsettings-onarrow-onarrow-strings-string-params-unknown)
- 2 properties:
[estimatedByteLength](#-estimatedbytelength-number),
[sqlSettings](#-sqlsettings-sqlsettings)
- 5 methods:
[concat](#-concatother-sql-sql),
[append](#-appendother-sql-this),
[encode](#-encodeputparamsto-unknown-mysqlnobackslashescapes-booleanfalse-usebuffer-uint8array-usebufferfrompos-number0-defaultparentname-uint8array-uint8array),
[toString](#-tostringputparamsto-unknown-mysqlnobackslashescapes-booleanfalse-string),
[toSqlBytesWithParamsBackslashAndBuffer](#-tosqlbyteswithparamsbackslashandbufferputparamsto-unknown--undefined-mysqlnobackslashescapes-boolean-usebuffer-uint8array-uint8array)
- 2 protected properties:
[strings](#-protected-strings-string),
[params](#-protected-params-unknown)


#### 🔧 `constructor`(sqlSettings: [SqlSettings](../class.SqlSettings/README.md), onArrow?: [OnArrow](../private.type.OnArrow/README.md), strings?: `string`\[], params?: `unknown`\[])



#### 📄 estimatedByteLength: `number`



#### 📄 sqlSettings: [SqlSettings](../class.SqlSettings/README.md)



#### ⚙ concat(other: [Sql](../class.Sql/README.md)): [Sql](../class.Sql/README.md)



#### ⚙ append(other: [Sql](../class.Sql/README.md)): `this`



#### ⚙ encode(putParamsTo?: `unknown`\[], mysqlNoBackslashEscapes: `boolean`=false, useBuffer?: Uint8Array, useBufferFromPos: `number`=0, defaultParentName?: Uint8Array): Uint8Array

> If `useBuffer` is provided, and it has enough size, will encode to it, and return a `useBuffer.subarray(0, N)`.
> Else, will return a subarray of a new Uint8Array.
> If `useBufferFromPos` is provided, will append to the `useBuffer` after this position.



#### ⚙ toString(putParamsTo?: `unknown`\[], mysqlNoBackslashEscapes: `boolean`=false): `string`



#### ⚙ toSqlBytesWithParamsBackslashAndBuffer(putParamsTo: `unknown`\[] | `undefined`, mysqlNoBackslashEscapes: `boolean`, useBuffer: Uint8Array): Uint8Array



#### 📄 `protected` strings: `string`\[]



#### 📄 `protected` params: `unknown`\[]



