# `class` Sql

[Documentation Index](../README.md)

```ts
import {Sql} from "https://cdn.jsdelivr.net/gh/jeremiah-shaulov/polysql@v2.0.20/mod.ts"
```

## This class has

- [2 constructors](#-constructorclonefrom-sql)
- 2 properties:
[sqlSettings](#-sqlsettings-sqlsettings),
[estimatedByteLength](#-estimatedbytelength-number)
- 5 methods:
[concat](#-concatother-sql-sql),
[append](#-appendother-sql-this),
[encode](#-encodeputparamsto-unknown-mysqlnobackslashescapes-booleanfalse-usebuffer-uint8array-usebufferfrompos-number0-defaultparentname-uint8array-uint8arrayarraybufferlike),
[toString](#-tostringputparamsto-unknown-mysqlnobackslashescapes-booleanfalse-string),
[toSqlBytesWithParamsBackslashAndBuffer](#-tosqlbyteswithparamsbackslashandbufferputparamsto-unknown--undefined-mysqlnobackslashescapes-boolean-usebuffer-uint8array-uint8arrayarraybufferlike)
- 2 protected properties:
[strings](#-protected-strings-string),
[params](#-protected-params-unknown)


#### 🔧 `constructor`(cloneFrom: [Sql](../class.Sql/README.md))



#### 🔧 `constructor`(sqlSettings: [SqlSettings](../class.SqlSettings/README.md), onArrow?: [OnArrow](../private.type.OnArrow/README.md), strings?: readonly `string`\[], params?: `unknown`\[])



#### 📄 sqlSettings: [SqlSettings](../class.SqlSettings/README.md)



#### 📄 estimatedByteLength: `number`



#### ⚙ concat(other: [Sql](../class.Sql/README.md)): [Sql](../class.Sql/README.md)



#### ⚙ append(other: [Sql](../class.Sql/README.md)): `this`



#### ⚙ encode(putParamsTo?: `unknown`\[], mysqlNoBackslashEscapes: `boolean`=false, useBuffer?: Uint8Array, useBufferFromPos: `number`=0, defaultParentName?: Uint8Array): Uint8Array\<ArrayBufferLike>

> If `useBuffer` is provided, and it has enough size, will encode to it, and return a `useBuffer.subarray(0, N)`.
> Else, will return a subarray of a new Uint8Array.
> If `useBufferFromPos` is provided, will append to the `useBuffer` after this position.



#### ⚙ toString(putParamsTo?: `unknown`\[], mysqlNoBackslashEscapes: `boolean`=false): `string`



#### ⚙ toSqlBytesWithParamsBackslashAndBuffer(putParamsTo: `unknown`\[] | `undefined`, mysqlNoBackslashEscapes: `boolean`, useBuffer: Uint8Array): Uint8Array\<ArrayBufferLike>



#### 📄 `protected` strings: `string`\[]



#### 📄 `protected` params: `unknown`\[]



