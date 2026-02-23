# `class` SqlSettings

[Documentation Index](../README.md)

```ts
import {SqlSettings} from "https://deno.land/x/polysql@v2.0.18/mod.ts"
```

## This class has

- [constructor](#-constructormode-sqlmode-usearrow-booleanfalse-idents-string-functions-string)
- 4 properties:
[mode](#-readonly-mode-sqlmode),
[useArrow](#-usearrow-boolean),
[idents](#-get-idents-string),
[functions](#-get-functions-string)
- 2 methods:
[isIdentAllowed](#-isidentallowedsubj-uint8array-boolean),
[isFunctionAllowed](#-isfunctionallowedsubj-uint8array-boolean)


#### 🔧 `constructor`(mode: [SqlMode](../enum.SqlMode/README.md), useArrow: `boolean`=false, idents?: `string`, functions?: `string`)



#### 📄 `readonly` mode: [SqlMode](../enum.SqlMode/README.md)



#### 📄 useArrow: `boolean`



#### 📄 `get` idents(): `string`



#### 📄 `get` functions(): `string`



#### ⚙ isIdentAllowed(subj: Uint8Array): `boolean`



#### ⚙ isFunctionAllowed(subj: Uint8Array): `boolean`



