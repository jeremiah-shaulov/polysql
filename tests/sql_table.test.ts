import {INLINE_STRING_MAX_LEN, Sql} from '../private/sql.ts';
import {SqlTable} from '../private/sql_table.ts';
import {SqlSettings, SqlMode} from '../private/sql_settings.ts';
import {mysql, mysqlOnly, pgsql, pgsqlOnly, sqlite, sqliteOnly, mssql, mssqlOnly} from '../private/sql_factory.ts';
import {assertEquals} from 'jsr:@std/assert@1.0.7/equals';

// deno-lint-ignore no-explicit-any
type Any = any;

Deno.test
(	'Table name must be string',
	() =>
	{	let error: Error|undefined;
		try
		{	mysql[Symbol.iterator as Any];
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Table name must be string");

		error = undefined;
		try
		{	mysqlOnly[Symbol.iterator as Any];
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Table name must be string");

		error = undefined;
		try
		{	pgsql[Symbol.iterator as Any];
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Table name must be string");

		error = undefined;
		try
		{	pgsqlOnly[Symbol.iterator as Any];
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Table name must be string");

		error = undefined;
		try
		{	sqlite[Symbol.iterator as Any];
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Table name must be string");

		error = undefined;
		try
		{	sqliteOnly[Symbol.iterator as Any];
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Table name must be string");

		error = undefined;
		try
		{	mssql[Symbol.iterator as Any];
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Table name must be string");

		error = undefined;
		try
		{	mssqlOnly[Symbol.iterator as Any];
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Table name must be string");
	}
);

Deno.test
(	'Test sqlTables.select()',
	() =>
	{	const TABLE = 'Hello `All`!';
		assertEquals(mysql[TABLE].tableName, TABLE);

		let s = mysql[TABLE].where("id=1").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `H`.col1*2, Count(*) FROM `Hello ``All``!` AS `H` WHERE (`H`.id=1)");
		assertEquals(s+'', "SELECT `H`.col1*2, Count(*) FROM `Hello ``All``!` AS `H` WHERE (`H`.id=1)");

		s = mysql[TABLE].where(mysql`name = '${'Untitled'}'`).select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `H`.col1*2, Count(*) FROM `Hello ``All``!` AS `H` WHERE (`H`.name = 'Untitled')");
		assertEquals(s+'', "SELECT `H`.col1*2, Count(*) FROM `Hello ``All``!` AS `H` WHERE (`H`.name = 'Untitled')");

		s = mysql[TABLE].where("").select(mysql`col1*2, Count(*)`);
		assertEquals(s+'', "SELECT `H`.col1*2, Count(*) FROM `Hello ``All``!` AS `H`");
		assertEquals(s+'', "SELECT `H`.col1*2, Count(*) FROM `Hello ``All``!` AS `H`");

		s = mysql[TABLE].where("").select(['a', 'b b']);
		assertEquals(s+'', "SELECT `H`.`a`, `H`.`b b` FROM `Hello ``All``!` AS `H`");
		assertEquals(s+'', "SELECT `H`.`a`, `H`.`b b` FROM `Hello ``All``!` AS `H`");

		s = mysql[TABLE].join('more').where("").select(['a', 'b b']);
		assertEquals(s+'', "SELECT `H`.`a`, `H`.`b b` FROM `Hello ``All``!` AS `H` CROSS JOIN `more`");
		assertEquals(s+'', "SELECT `H`.`a`, `H`.`b b` FROM `Hello ``All``!` AS `H` CROSS JOIN `more`");

		{	const a = 'a'.repeat(INLINE_STRING_MAX_LEN+1);
			const b = 'b'.repeat(INLINE_STRING_MAX_LEN+1);
			const params: unknown[] = [];
			const str = mysql.t_log.where(pgsql`a='${a}'`).select(pgsql`b+'${b}'`).toString(params);
			assertEquals(str, "SELECT `t`.b+? FROM `t_log` AS `t` WHERE (`t`.a=?)");
			assertEquals(params, [b, a]);
		}

		let error: Error|undefined;
		try
		{	mysql[TABLE].select("col1*2, Count(*)") + '';
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Please, call where() first");

		s = mysql.t_log.where('id IN (1, 2)').where("name <> ''").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `t`.col1*2, Count(*) FROM `t_log` AS `t` WHERE (`t`.id IN( 1, 2)) AND (`t`.name <> '')");

		error = undefined;
		try
		{	mysql.t_log.where('id IN (1, 2)').join('hello');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "join() can be called before where()");

		error = undefined;
		try
		{	mysql.t_log.leftJoin('a', 'aa', '');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `No condition in LEFT JOIN`);

		error = undefined;
		try
		{	mysql.t_log.groupBy('').join('a', 'aa', '');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `join() can be called before groupBy()`);

		error = undefined;
		try
		{	mysql.t_log.groupBy('').where('1');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `where() can be called before groupBy()`);

		error = undefined;
		try
		{	mysql.t_log.groupBy('').groupBy('1');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `groupBy() can be called only once`);

		s = mysql.t_log.join('meta', 'm', 'meta_id = m.id').where("").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `t`.col1*2, Count(*) FROM `t_log` AS `t` INNER JOIN `meta` AS `m` ON (`t`.meta_id = `m`.id)");

		s = mysql.t_log.join('meta', '', 'meta_id = meta.id').where("").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `t`.col1*2, Count(*) FROM `t_log` AS `t` INNER JOIN `meta` ON (`t`.meta_id = `meta`.id)");

		s = mysql.t_log.leftJoin('meta', 'm', 'meta_id = m.id').where("").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `t`.col1*2, Count(*) FROM `t_log` AS `t` LEFT JOIN `meta` AS `m` ON (`t`.meta_id = `m`.id)");

		s = mysql.t_log.leftJoin('meta', '', 'meta_id = meta.id').where("").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `t`.col1*2, Count(*) FROM `t_log` AS `t` LEFT JOIN `meta` ON (`t`.meta_id = `meta`.id)");

		s = mysql.t_log.leftJoin('meta', 't', 'meta_id = t.id').where("").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `t_`.col1*2, Count(*) FROM `t_log` AS `t_` LEFT JOIN `meta` AS `t` ON (`t_`.meta_id = `t`.id)");

		s = mysql.t_log.join('t').join('t_').where("").select();
		assertEquals(s+'', "SELECT * FROM `t_log` AS `t_l` CROSS JOIN `t` CROSS JOIN `t_`");

		s = mysql.t_log.join('t').join('t_').join('hello', 't_l').where("").select();
		assertEquals(s+'', "SELECT * FROM `t_log` AS `t_lo` CROSS JOIN `t` CROSS JOIN `t_` CROSS JOIN `hello` AS `t_l`");

		s = mysql.t_log.where("").groupBy('g1, g2').select();
		assertEquals(s+'', "SELECT * FROM `t_log` AS `t` GROUP BY `t`.g1, `t`.g2");

		s = mysql.t_log.where("").groupBy(['g1', 'g2']).select();
		assertEquals(s+'', "SELECT * FROM `t_log` AS `t` GROUP BY `t`.`g1`, `t`.`g2`");

		s = mysql.t_log.where("").groupBy('g1, g2', 'hello IS NULL').select();
		assertEquals(s+'', "SELECT * FROM `t_log` AS `t` GROUP BY `t`.g1, `t`.g2 HAVING (`hello` IS NULL)");

		s = mysql.t_log.join('meta', '', 'meta_id = meta.id').where("").groupBy(mysql`g1, meta.g2`, mysql`hello IS NULL`).select();
		assertEquals(s+'', "SELECT * FROM `t_log` AS `t` INNER JOIN `meta` ON (`t`.meta_id = `meta`.id) GROUP BY `t`.g1, `meta`.g2 HAVING (`hello` IS NULL)");

		s = mysql.t_log.where("").select("col1*2, Count(*)", "position_major DESC, position_minor");
		assertEquals(s+'', "SELECT `t`.col1*2, Count(*) FROM `t_log` AS `t` ORDER BY `position_major` DESC, `position_minor`");

		s = mysql.t_log.where("").select(mysql`col1*2, Count(*)`, mysql`position_major DESC, position_minor`);
		assertEquals(s+'', "SELECT `t`.col1*2, Count(*) FROM `t_log` AS `t` ORDER BY `position_major` DESC, `position_minor`");

		s = mysql.t_log.where("").select(mysql`col1*2, Count(*)`, {columns: ['position_major', 'position_minor']});
		assertEquals(s+'', "SELECT `t`.col1*2, Count(*) FROM `t_log` AS `t` ORDER BY `position_major`, `position_minor`");

		s = mysql.t_log.where("").select(mysql`col1*2, Count(*)`, {columns: ['position_major', 'position_minor'], desc: false});
		assertEquals(s+'', "SELECT `t`.col1*2, Count(*) FROM `t_log` AS `t` ORDER BY `position_major`, `position_minor`");

		s = mysql.t_log.where("").select(mysql`col1*2, Count(*)`, {columns: ['position_major', 'position_minor'], desc: true});
		assertEquals(s+'', "SELECT `t`.col1*2, Count(*) FROM `t_log` AS `t` ORDER BY `position_major` DESC, `position_minor` DESC");

		s = mysqlOnly.t_log.where("").select("", "", 0, 10);
		assertEquals(s+'', "SELECT * FROM `t_log` AS `t` LIMIT 10");

		s = mysqlOnly.t_log.where("").select("", "", 1, 11);
		assertEquals(s+'', "SELECT * FROM `t_log` AS `t` LIMIT 11 OFFSET 1");

		s = mysqlOnly.t_log.where("").select("", "", 10);
		assertEquals(s+'', "SELECT * FROM `t_log` AS `t` LIMIT 2147483647 OFFSET 10");

		s = pgsqlOnly.t_log.where("").select("", "", 0, 10);
		assertEquals(s+'', `SELECT * FROM "t_log" AS "t" LIMIT 10`);

		s = pgsqlOnly.t_log.where("").select("", "", 1, 11);
		assertEquals(s+'', `SELECT * FROM "t_log" AS "t" LIMIT 11 OFFSET 1`);

		s = pgsqlOnly.t_log.where("").select("", "", 10);
		assertEquals(s+'', `SELECT * FROM "t_log" AS "t" OFFSET 10`);

		s = sqliteOnly.t_log.where("").select("", "", 0, 10);
		assertEquals(s+'', `SELECT * FROM "t_log" AS "t" LIMIT 10`);

		s = sqliteOnly.t_log.where("").select("", "", 1, 11);
		assertEquals(s+'', `SELECT * FROM "t_log" AS "t" LIMIT 11 OFFSET 1`);

		s = sqliteOnly.t_log.where("").select("", "", 10);
		assertEquals(s+'', `SELECT * FROM "t_log" AS "t" LIMIT 2147483647 OFFSET 10`);

		s = mssql.t_log.where("").select("", "id", 0, 10);
		assertEquals(s+'', `SELECT * FROM "t_log" AS "t" ORDER BY "id" OFFSET 0 ROWS FETCH FIRST 10 ROWS ONLY`);

		s = mssql.t_log.where("").select("", "id", 1, 11);
		assertEquals(s+'', `SELECT * FROM "t_log" AS "t" ORDER BY "id" OFFSET 1 ROWS FETCH FIRST 11 ROWS ONLY`);

		s = mssql.t_log.where("").select("", "id", 10);
		assertEquals(s+'', `SELECT * FROM "t_log" AS "t" ORDER BY "id" OFFSET 10 ROWS`);

		error = undefined;
		try
		{	mysql.t_log.where("").select("", "", 0, 10) + '';
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'SELECT with LIMIT but without ORDER BY is not supported across all engines. Please use mysqlOnly`...`');

		error = undefined;
		try
		{	pgsql.t_log.where("").select("", "", 0, 10) + '';
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'SELECT with LIMIT but without ORDER BY is not supported across all engines. Please use pgsqlOnly`...`');

		error = undefined;
		try
		{	sqlite.t_log.where("").select("", "", 0, 10) + '';
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'SELECT with LIMIT but without ORDER BY is not supported across all engines. Please use sqliteOnly`...`');

		error = undefined;
		try
		{	mssql.t_log.where("").select("", "", 0, 10) + '';
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'SELECT with LIMIT but without ORDER BY is not supported on MS SQL');

		error = undefined;
		try
		{	mssqlOnly.t_log.where("").select("", "", 0, 10) + '';
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'SELECT with LIMIT but without ORDER BY is not supported on MS SQL');

		error = undefined;
		try
		{	mysql.t_log.where("").select("", "", 10) + '';
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'SELECT with OFFSET but without ORDER BY is not supported across all engines. Please use mysqlOnly`...`');

		error = undefined;
		try
		{	pgsql.t_log.where("").select("", "", 10) + '';
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'SELECT with OFFSET but without ORDER BY is not supported across all engines. Please use pgsqlOnly`...`');

		error = undefined;
		try
		{	sqlite.t_log.where("").select("", "", 10) + '';
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'SELECT with OFFSET but without ORDER BY is not supported across all engines. Please use sqliteOnly`...`');

		error = undefined;
		try
		{	mssql.t_log.where("").select("", "", 10) + '';
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'SELECT with OFFSET but without ORDER BY is not supported on MS SQL');

		error = undefined;
		try
		{	mssqlOnly.t_log.where("").select("", "", 10) + '';
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'SELECT with OFFSET but without ORDER BY is not supported on MS SQL');
	}
);

Deno.test
(	'Test sqlTables.update()',
	() =>
	{	// Simple:

		let s = mysql.t_log.where("id=1").update({message: "Message '1'"});
		assertEquals(s+'', "UPDATE `t_log` AS `t` SET `t`.`message`='Message ''1''' WHERE (`t`.id=1)");
		assertEquals(s+'', "UPDATE `t_log` AS `t` SET `t`.`message`='Message ''1''' WHERE (`t`.id=1)");

		// One INNER JOIN:

		s = mysql.t_log.join('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `t` INNER JOIN `more` ON (`t`.more_id = `more`.id) SET `t`.`message`='Message 1' WHERE (`t`.id=1)");
		assertEquals(s+'', "UPDATE `t_log` AS `t` INNER JOIN `more` ON (`t`.more_id = `more`.id) SET `t`.`message`='Message 1' WHERE (`t`.id=1)");

		s = pgsql.t_log.join('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "t" SET "message"='Message 1' FROM "more" WHERE ("t".id=1) AND ("t".more_id = "more".id)`);
		assertEquals(s+'', `UPDATE "t_log" AS "t" SET "message"='Message 1' FROM "more" WHERE ("t".id=1) AND ("t".more_id = "more".id)`);

		s = sqlite.t_log.join('more', 'm', 'more_id = m.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "t" SET "message"='Message 1' FROM "more" AS "m" WHERE ("t"."id"=1) AND ("t"."more_id" = "m"."id")`);
		assertEquals(s+'', `UPDATE "t_log" AS "t" SET "message"='Message 1' FROM "more" AS "m" WHERE ("t"."id"=1) AND ("t"."more_id" = "m"."id")`);

		s = mssql.t_log.join('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "t" INNER JOIN "more" ON ("t"."more_id" = "more"."id") WHERE ("t"."id"=1)`);
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "t" INNER JOIN "more" ON ("t"."more_id" = "more"."id") WHERE ("t"."id"=1)`);

		// One LEFT JOIN:

		s = mysqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `t` LEFT JOIN `more` ON (`t`.more_id = `more`.id) SET `t`.`message`='Message 1' WHERE (`t`.id=1)");

		s = sqliteOnly.t_log.leftJoin('more', 'm', 'more_id = m.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "s" SET "message"='Message 1' FROM "t_log" AS "t" LEFT JOIN "more" AS "m" ON ("t"."more_id" = "m"."id") WHERE ("t"."id"=1) AND "s".rowid = "t".rowid`);

		s = sqliteOnly.t_log.leftJoin('more', 'm', 'more_id = m.id').where('').update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "s" SET "message"='Message 1' FROM "t_log" AS "t" LEFT JOIN "more" AS "m" ON ("t"."more_id" = "m"."id") WHERE "s".rowid = "t".rowid`);

		s = sqliteOnly.t_log.leftJoin('more', 'm', 'more_id = m.id').join('s').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "su" SET "message"='Message 1' FROM "t_log" AS "t" LEFT JOIN "more" AS "m" ON ("t"."more_id" = "m"."id") CROSS JOIN "s" WHERE ("t"."id"=1) AND "su".rowid = "t".rowid`);

		s = sqliteOnly.t_log.leftJoin('more', 'm', 'more_id = m.id').join('s').join('su').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "sub" SET "message"='Message 1' FROM "t_log" AS "t" LEFT JOIN "more" AS "m" ON ("t"."more_id" = "m"."id") CROSS JOIN "s" CROSS JOIN "su" WHERE ("t"."id"=1) AND "sub".rowid = "t".rowid`);

		s = sqliteOnly.t_log.leftJoin('more', 'm', 'more_id = m.id').join('s').join('su').join('sub').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "subj" SET "message"='Message 1' FROM "t_log" AS "t" LEFT JOIN "more" AS "m" ON ("t"."more_id" = "m"."id") CROSS JOIN "s" CROSS JOIN "su" CROSS JOIN "sub" WHERE ("t"."id"=1) AND "subj".rowid = "t".rowid`);

		s = mssqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "t" LEFT JOIN "more" ON ("t"."more_id" = "more"."id") WHERE ("t"."id"=1)`);

		// One LEFT JOIN and one INNER:

		s = mysqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `t` LEFT JOIN `more` ON (`t`.more_id = `more`.id) INNER JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) SET `t`.`message`='Message 1' WHERE (`t`.id=1)");

		s = sqliteOnly.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "s" SET "message"='Message 1' FROM "t_log" AS "t" LEFT JOIN "more" ON ("t"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("t"."id"=1) AND "s".rowid = "t".rowid`);

		s = mssqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "t" LEFT JOIN "more" ON ("t"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("t"."id"=1)`);

		// Two INNER JOINs:

		s = mysql.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `t` INNER JOIN `more` ON (`t`.more_id = `more`.id) INNER JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) SET `t`.`message`='Message 1' WHERE (`t`.id=1)");

		s = pgsql.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "t" SET "message"='Message 1' FROM "more" INNER JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) WHERE ("t".id=1) AND ("t".more_id = "more".id)`);

		s = sqlite.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "t" SET "message"='Message 1' FROM "more" INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("t"."id"=1) AND ("t"."more_id" = "more"."id")`);

		s = sqlite.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "t" SET "message"='Message 1' FROM "more" INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("t"."more_id" = "more"."id")`);

		s = mssql.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "t" INNER JOIN "more" ON ("t"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("t"."id"=1)`);

		// One INNER JOIN, one LEFT and one CROSS (and maybe one more INNER):

		s = mysql.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', 'm2', 'more.more2_id = m2.id').join('more3').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `t` INNER JOIN `more` ON (`t`.more_id = `more`.id) LEFT JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) CROSS JOIN `more3` SET `t`.`message`='Message 1' WHERE (`t`.id=1)");

		s = pgsql.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', 'm2', 'more.more2_id = m2.id').join('more3').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "t" SET "message"='Message 1' FROM "more" LEFT JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) CROSS JOIN "more3" WHERE ("t".id=1) AND ("t".more_id = "more".id)`);

		s = sqlite.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', '', 'more.more2_id = more2.id').join('more3', 'm3').join('more4', '', 'm3.more4_id = more4.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "t" SET "message"='Message 1' FROM "more" LEFT JOIN "more2" ON ("more"."more2_id" = "more2"."id") CROSS JOIN "more3" AS "m3" INNER JOIN "more4" ON ("m3"."more4_id" = "more4"."id") WHERE ("t"."id"=1) AND ("t"."more_id" = "more"."id")`);

		s = mssql.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', 'm2', 'more.more2_id = m2.id').join('more3').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "t" INNER JOIN "more" ON ("t"."more_id" = "more"."id") LEFT JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") CROSS JOIN "more3" WHERE ("t"."id"=1)`);

		// Errors:

		let error: Error|undefined;
		try
		{	'' + mysql.t_log.where("id=1").update({});
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "In SQL fragment: 0 values for {${...}}");

		error = undefined;
		try
		{	'' + mysql.t_log.where("id=1").groupBy('').update({a: 1});
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Cannot UPDATE with GROUP BY");

		// leftJoin not supported:

		error = undefined;
		try
		{	'' + mysql.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "UPDATE where the first join is a LEFT JOIN is not supported across all engines. Please use mysqlOnly`...`");

		error = undefined;
		try
		{	'' + pgsql.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "UPDATE where the first join is a LEFT JOIN is not supported on PostgreSQL");

		error = undefined;
		try
		{	'' + pgsqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "UPDATE where the first join is a LEFT JOIN is not supported on PostgreSQL");

		error = undefined;
		try
		{	'' + sqlite.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "UPDATE where the first join is a LEFT JOIN is not supported across all engines. Please use sqliteOnly`...`");

		error = undefined;
		try
		{	'' + mssql.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "UPDATE where the first join is a LEFT JOIN is not supported across all engines. Please use mssqlOnly`...`");
	}
);

Deno.test
(	'Test sqlTables.delete()',
	() =>
	{	// Simple:

		let s = mysql.t_log.where("id=1").delete();
		assertEquals(s+'', "DELETE FROM `t_log` WHERE (`id`=1)");
		assertEquals(s+'', "DELETE FROM `t_log` WHERE (`id`=1)");

		// One INNER JOIN:

		s = mysql.t_log.join('more', '', 'more_id = more.id').where("id=1").delete();
		assertEquals(s+'', "DELETE `t` FROM `t_log` AS `t` INNER JOIN `more` ON (`t`.more_id = `more`.id) WHERE (`t`.id=1)");

		s = pgsql.t_log.join('more', '', 'more_id = more.id').where("id=1").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "t" USING "more" WHERE ("t".id=1) AND ("t".more_id = "more".id)`);

		s = pgsql.t_log.join('more', '', 'more_id = more.id').where("").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "t" USING "more" WHERE ("t".more_id = "more".id)`);

		s = sqlite.t_log.join('more', 'm', 'more_id = m.id').where("id=1").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "s" WHERE rowid IN (SELECT "t".rowid FROM "t_log" AS "t" INNER JOIN "more" AS "m" ON ("t"."more_id" = "m"."id") WHERE ("t"."id"=1))`);
		assertEquals(s+'', `DELETE FROM "t_log" AS "s" WHERE rowid IN (SELECT "t".rowid FROM "t_log" AS "t" INNER JOIN "more" AS "m" ON ("t"."more_id" = "m"."id") WHERE ("t"."id"=1))`);

		s = mssql.t_log.join('more', '', 'more_id = more.id').where("id=1").delete();
		assertEquals(s+'', `DELETE "t" FROM "t_log" AS "t" INNER JOIN "more" ON ("t"."more_id" = "more"."id") WHERE ("t"."id"=1)`);

		// One LEFT JOIN:

		s = mysqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").delete();
		assertEquals(s+'', "DELETE `t` FROM `t_log` AS `t` LEFT JOIN `more` ON (`t`.more_id = `more`.id) WHERE (`t`.id=1)");

		s = sqliteOnly.t_log.leftJoin('more', 'm', 'more_id = m.id').where("id=1").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "s" WHERE rowid IN (SELECT "t".rowid FROM "t_log" AS "t" LEFT JOIN "more" AS "m" ON ("t"."more_id" = "m"."id") WHERE ("t"."id"=1))`);

		// One LEFT JOIN and one INNER:

		s = mysqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").delete();
		assertEquals(s+'', "DELETE `t` FROM `t_log` AS `t` LEFT JOIN `more` ON (`t`.more_id = `more`.id) INNER JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) WHERE (`t`.id=1)");

		s = sqliteOnly.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "s" WHERE rowid IN (SELECT "t".rowid FROM "t_log" AS "t" LEFT JOIN "more" ON ("t"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("t"."id"=1))`);

		s = mssqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").delete();
		assertEquals(s+'', `DELETE "t" FROM "t_log" AS "t" LEFT JOIN "more" ON ("t"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("t"."id"=1)`);

		// Errors:

		let error: Error|undefined;
		try
		{	'' + mysql.t_log.where("id=1").groupBy('').delete();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Cannot DELETE with GROUP BY");

		// leftJoin not supported:

		error = undefined;
		try
		{	'' + mysql.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").delete();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "DELETE where the first join is a LEFT JOIN is not supported across all engines. Please use mysqlOnly`...`");

		error = undefined;
		try
		{	'' + pgsql.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").delete();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "DELETE where the first join is a LEFT JOIN is not supported on PostgreSQL");

		error = undefined;
		try
		{	'' + pgsqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").delete();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "DELETE where the first join is a LEFT JOIN is not supported on PostgreSQL");

		error = undefined;
		try
		{	'' + sqlite.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").delete();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "DELETE where the first join is a LEFT JOIN is not supported across all engines. Please use sqliteOnly`...`");

		error = undefined;
		try
		{	'' + mssql.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").delete();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "DELETE where the first join is a LEFT JOIN is not supported across all engines. Please use mssqlOnly`...`");
	}
);

Deno.test
(	'Test sqlTables.insert()',
	() =>
	{	const ROWS = [{a: 1, b: '2'}, {a: 10, b: '20'}];
		function *itRows(rows: Record<string, unknown>[])
		{	for (const row of rows)
			{	yield row;
			}
		}

		for (let i=0; i<2; i++)
		{	let s = mysql.t_log.insert(i==0 ? ROWS : itRows(ROWS));
			assertEquals(s+'', "INSERT INTO `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20')");

			s = mysqlOnly.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'nothing');
			assertEquals(s+'', "INSERT INTO `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20') ON DUPLICATE KEY UPDATE `t_log`.`a`=`t_log`.`a`");

			s = pgsqlOnly.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'nothing');
			assertEquals(s+'', `INSERT INTO "t_log" ("a", "b") VALUES\n(1,'2'),\n(10,'20') ON CONFLICT DO NOTHING`);

			s = sqliteOnly.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'nothing');
			assertEquals(s+'', `INSERT INTO "t_log" ("a", "b") VALUES\n(1,'2'),\n(10,'20') ON CONFLICT DO NOTHING`);

			s = mysqlOnly.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'replace');
			assertEquals(s+'', "REPLACE `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20')");

			s = sqliteOnly.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'replace');
			assertEquals(s+'', `REPLACE INTO "t_log" ("a", "b") VALUES\n(1,'2'),\n(10,'20')`);

			s = mysqlOnly.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'update');
			assertEquals(s+'', "INSERT INTO `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20') AS excluded ON DUPLICATE KEY UPDATE `a`=excluded.`a`, `b`=excluded.`b`");

			s = mysqlOnly.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'patch');
			assertEquals(s+'', "INSERT INTO `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20') AS excluded ON DUPLICATE KEY UPDATE `a`=CASE WHEN `t_log`.`a` IS NULL OR Cast(`t_log`.`a` AS char) IN ('', '0') THEN excluded.`a` ELSE `t_log`.`a` END, `b`=CASE WHEN `t_log`.`b` IS NULL OR Cast(`t_log`.`b` AS char) IN ('', '0') THEN excluded.`b` ELSE `t_log`.`b` END");

			let error: Error|undefined;
			try
			{	'' + mysql.t_log.join('more').insert(i==0 ? ROWS : itRows(ROWS));
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "Cannot INSERT with JOIN");

			error = undefined;
			try
			{	'' + mysql.t_log.where("id=1").insert(i==0 ? ROWS : itRows(ROWS));
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "Cannot INSERT with WHERE");

			error = undefined;
			try
			{	'' + mysql.t_log.insert(i==0 ? [] : itRows([]));
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "0 rows in <${param}>");

			error = undefined;
			try
			{	'' + mysqlOnly.t_log.insert(i==0 ? [] : itRows([]), 'update');
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "0 rows in <${param}>");

			error = undefined;
			try
			{	'' + mysql.t_log.insert(i==0 ? [{}] : itRows([{}]));
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "No fields for <${param}>");

			error = undefined;
			try
			{	'' + mysql.t_log.groupBy('').insert(i==0 ? ROWS : itRows(ROWS));
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "Cannot INSERT with GROUP BY");

			error = undefined;
			try
			{	'' + mysql.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'nothing');
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use mysqlOnly`...`");

			error = undefined;
			try
			{	'' + pgsql.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'nothing');
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use pgsqlOnly`...`");

			error = undefined;
			try
			{	'' + sqlite.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'nothing');
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use sqliteOnly`...`");

			error = undefined;
			try
			{	'' + mssql.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'nothing');
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported on MS SQL");

			error = undefined;
			try
			{	'' + mysql.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'replace');
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "REPLACE is not supported across all engines. Please use mysqlOnly`...`");

			error = undefined;
			try
			{	'' + sqlite.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'replace');
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "REPLACE is not supported across all engines. Please use sqliteOnly`...`");

			error = undefined;
			try
			{	'' + pgsql.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'replace');
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "REPLACE is not supported on PostgreSQL");

			error = undefined;
			try
			{	'' + mssql.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'replace');
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "REPLACE is not supported on MS SQL");

			error = undefined;
			try
			{	'' + mysql.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'update');
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "ON CONFLICT DO UPDATE is not supported across all engines. Please use mysqlOnly`...`");

			error = undefined;
			try
			{	'' + pgsql.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'update');
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "ON CONFLICT DO UPDATE is not supported on PostgreSQL");

			error = undefined;
			try
			{	'' + sqlite.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'update');
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "ON CONFLICT DO UPDATE is not supported across all engines. Please use sqliteOnly`...`");

			error = undefined;
			try
			{	'' + mssql.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'update');
			}
			catch (e)
			{	error = e instanceof Error ? e : new Error(e+'');
			}
			assertEquals(error?.message, "ON CONFLICT DO UPDATE is not supported on MS SQL");
		}
	}
);

Deno.test
(	'Test sqlTables.insertFrom()',
	() =>
	{	let s = mysql.t_log.insertFrom(['c1', 'c2'], mysql.t_log_bak.where('').select('cb1, cb2'));
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) SELECT `t`.cb1, `t`.cb2 FROM `t_log_bak` AS `t`");
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) SELECT `t`.cb1, `t`.cb2 FROM `t_log_bak` AS `t`");

		s = mysqlOnly.t_log.insertFrom(['c1', 'c2'], mysql.t_log_bak.where('id<=100').select('cb1, cb2'), 'nothing');
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) SELECT `t`.cb1, `t`.cb2 FROM `t_log_bak` AS `t` WHERE (`t`.id<=100) ON DUPLICATE KEY UPDATE `t_log`.`c1`=`t_log`.`c1`");
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) SELECT `t`.cb1, `t`.cb2 FROM `t_log_bak` AS `t` WHERE (`t`.id<=100) ON DUPLICATE KEY UPDATE `t_log`.`c1`=`t_log`.`c1`");

		s = pgsqlOnly.t_log.insertFrom(['c1', 'c2'], mysql.t_log_bak.where('id<=100').select('cb1, cb2'), 'nothing');
		assertEquals(s+'', `INSERT INTO "t_log" ("c1", "c2") SELECT "t".cb1, "t".cb2 FROM "t_log_bak" AS "t" WHERE ("t".id<=100) ON CONFLICT DO NOTHING`);
		assertEquals(s+'', `INSERT INTO "t_log" ("c1", "c2") SELECT "t".cb1, "t".cb2 FROM "t_log_bak" AS "t" WHERE ("t".id<=100) ON CONFLICT DO NOTHING`);

		s = sqliteOnly.t_log.insertFrom(['c1', 'c2'], mysql.t_log_bak.where('id<=100').select('cb1, cb2'), 'nothing');
		assertEquals(s+'', `INSERT INTO "t_log" ("c1", "c2") SELECT "t"."cb1", "t"."cb2" FROM "t_log_bak" AS "t" WHERE ("t"."id"<=100) ON CONFLICT DO NOTHING`);
		assertEquals(s+'', `INSERT INTO "t_log" ("c1", "c2") SELECT "t"."cb1", "t"."cb2" FROM "t_log_bak" AS "t" WHERE ("t"."id"<=100) ON CONFLICT DO NOTHING`);

		s = mysqlOnly.t_log.insertFrom(['c1', 'c2'], mysql.t_log_bak.where('id<=100').select('cb1, cb2'), 'replace');
		assertEquals(s+'', "REPLACE `t_log` (`c1`, `c2`) SELECT `t`.cb1, `t`.cb2 FROM `t_log_bak` AS `t` WHERE (`t`.id<=100)");
		assertEquals(s+'', "REPLACE `t_log` (`c1`, `c2`) SELECT `t`.cb1, `t`.cb2 FROM `t_log_bak` AS `t` WHERE (`t`.id<=100)");

		s = sqliteOnly.t_log.insertFrom(['c1', 'c2'], mysql.t_log_bak.where('id<=100').select('cb1, cb2'), 'replace');
		assertEquals(s+'', `REPLACE INTO "t_log" ("c1", "c2") SELECT "t"."cb1", "t"."cb2" FROM "t_log_bak" AS "t" WHERE ("t"."id"<=100)`);
		assertEquals(s+'', `REPLACE INTO "t_log" ("c1", "c2") SELECT "t"."cb1", "t"."cb2" FROM "t_log_bak" AS "t" WHERE ("t"."id"<=100)`);

		s = mysql.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`);
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) HELLO ALL");
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) HELLO ALL");

		s = mysqlOnly.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'nothing');
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) HELLO ALL ON DUPLICATE KEY UPDATE `t_log`.`c1`=`t_log`.`c1`");
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) HELLO ALL ON DUPLICATE KEY UPDATE `t_log`.`c1`=`t_log`.`c1`");

		let error: Error|undefined;
		try
		{	'' + mysql.t_log.join('more').insertFrom(['c1', 'c2'], mysql`HELLO ALL`);
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Cannot INSERT with JOIN");

		error = undefined;
		try
		{	'' + mysql.t_log.where("id=1").insertFrom(['c1', 'c2'], mysql`HELLO ALL`);
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Cannot INSERT with WHERE");

		error = undefined;
		try
		{	'' + mysql.t_log.groupBy('').insertFrom(['c1', 'c2'], mysql`HELLO ALL`);
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Cannot INSERT with GROUP BY");

		error = undefined;
		try
		{	'' + mysql.t_log.insertFrom([], mysql`HELLO ALL`);
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, 'No names for "${param}+"');

		error = undefined;
		try
		{	'' + mysql.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'nothing');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use mysqlOnly`...`");

		error = undefined;
		try
		{	'' + pgsql.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'nothing');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use pgsqlOnly`...`");

		error = undefined;
		try
		{	'' + sqlite.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'nothing');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use sqliteOnly`...`");

		error = undefined;
		try
		{	'' + mssql.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'nothing');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported on MS SQL");

		error = undefined;
		try
		{	'' + mssqlOnly.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'nothing');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported on MS SQL");

		error = undefined;
		try
		{	'' + mysql.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'replace');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "REPLACE is not supported across all engines. Please use mysqlOnly`...`");

		error = undefined;
		try
		{	'' + sqlite.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'replace');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "REPLACE is not supported across all engines. Please use sqliteOnly`...`");

		error = undefined;
		try
		{	'' + pgsql.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'replace');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "REPLACE is not supported on PostgreSQL");

		error = undefined;
		try
		{	'' + pgsqlOnly.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'replace');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "REPLACE is not supported on PostgreSQL");

		error = undefined;
		try
		{	'' + mssql.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'replace');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "REPLACE is not supported on MS SQL");

		error = undefined;
		try
		{	'' + mssqlOnly.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'replace');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "REPLACE is not supported on MS SQL");

	}
);

Deno.test
(	'Test sqlTables.truncate()',
	() =>
	{	let s = mysql.t_log.truncate();
		assertEquals(s+'', "TRUNCATE TABLE `t_log`");

		s = s = pgsql.t_log.truncate();
		assertEquals(s+'', `TRUNCATE TABLE "t_log"`);

		s = s = mssql.t_log.truncate();
		assertEquals(s+'', `TRUNCATE TABLE "t_log"`);

		s = s = sqlite.t_log.truncate();
		assertEquals(s+'', `DELETE FROM "t_log"`);

		s = s = sqliteOnly.t_log.truncate();
		assertEquals(s+'', `DELETE FROM "t_log"`);

		let error: Error|undefined;
		try
		{	'' + mysql.t_log.join('more').truncate();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Cannot TRUNCATE with JOIN");

		error = undefined;
		try
		{	'' + mysql.t_log.where("id=1").truncate();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Cannot TRUNCATE with WHERE");

		error = undefined;
		try
		{	'' + mysql.t_log.groupBy('').truncate();
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "Cannot TRUNCATE with GROUP BY");
	}
);

Deno.test
(	'No qualify aliases',
	() =>
	{	let s = '' + mysql.links.join('pages', 'p').select('Length(a) AS "la", Length(b) AS `lb`, Length(c) AS lc').where('id = 1');
		assertEquals(s, "SELECT Length(`l`.a) AS `la`, Length(`l`.b) AS `lb`, Length(`l`.c) AS `lc` FROM `links` AS `l` CROSS JOIN `pages` AS `p` WHERE (`l`.id = 1)");

		s = '' + mysql.new_pages.insertFrom(['pa', 'pb', 'pc'], mysql.links.join('pages', 'p').select('Length(a) AS "la", Length(b) AS `lb`, Length(c) AS lc').where('id = 1'));
		assertEquals(s, "INSERT INTO `new_pages` (`pa`, `pb`, `pc`) SELECT Length(`l`.a) AS `la`, Length(`l`.b) AS `lb`, Length(`l`.c) AS `lc` FROM `links` AS `l` CROSS JOIN `pages` AS `p` WHERE (`l`.id = 1)");
	}
);

Deno.test
(	'Arrow syntax',
	() =>
	{	const SQL_SETTINGS_MYSQL = new SqlSettings(SqlMode.MYSQL, true);

		let lastParentName = '';
		let lastName = '';

		function sql(strings: readonly string[], ...params: unknown[])
		{	return new Sql
			(	SQL_SETTINGS_MYSQL,
				(parentName, name) =>
				{	lastParentName = parentName;
					lastName = name;
					return `${parentName}#${name}`;
				},
				strings,
				params
			);
		}

		assertEquals
		(	sql`SELECT ${'product_id->name'} FROM transactions WHERE id = 1` + '',
			"SELECT `#product_id`.`name` FROM transactions WHERE id = 1"
		);
		assertEquals(lastParentName, '');
		assertEquals(lastName, 'product_id');

		assertEquals
		(	sql`SELECT ${'"product_id"->name'} FROM transactions WHERE id = 1` + '',
			"SELECT `#product_id`.`name` FROM transactions WHERE id = 1"
		);
		assertEquals(lastParentName, '');
		assertEquals(lastName, 'product_id');

		assertEquals
		(	sql`SELECT ${'par.product_id->name'} FROM transactions WHERE id = 1` + '',
			"SELECT `par#product_id`.`name` FROM transactions WHERE id = 1"
		);
		assertEquals(lastParentName, 'par');
		assertEquals(lastName, 'product_id');

		assertEquals
		(	sql`SELECT ${'par."product_id"->name'} FROM transactions WHERE id = 1` + '',
			"SELECT `par#product_id`.`name` FROM transactions WHERE id = 1"
		);
		assertEquals(lastParentName, 'par');
		assertEquals(lastName, 'product_id');

		assertEquals
		(	sql`SELECT ${'"par".product_id->name'} FROM transactions WHERE id = 1` + '',
			"SELECT `par#product_id`.`name` FROM transactions WHERE id = 1"
		);
		assertEquals(lastParentName, 'par');
		assertEquals(lastName, 'product_id');

		assertEquals
		(	sql`SELECT ${'"par"."product_id"->name'} FROM transactions WHERE id = 1` + '',
			"SELECT `par#product_id`.`name` FROM transactions WHERE id = 1"
		);
		assertEquals(lastParentName, 'par');
		assertEquals(lastName, 'product_id');

		assertEquals
		(	sql`SELECT ${'"par"."product_\`id"->name'} FROM transactions WHERE id = 1` + '',
			"SELECT `par#product_``id`.`name` FROM transactions WHERE id = 1"
		);
		assertEquals(lastParentName, 'par');
		assertEquals(lastName, 'product_`id');

		assertEquals
		(	sql`SELECT ${'"par"."product_\`\`id"->name'} FROM transactions WHERE id = 1` + '',
			"SELECT `par#product_````id`.`name` FROM transactions WHERE id = 1"
		);
		assertEquals(lastParentName, 'par');
		assertEquals(lastName, 'product_``id');

		assertEquals
		(	sql`SELECT ${'"par"."product_""id"->name'} FROM transactions WHERE id = 1` + '',
			"SELECT `par#product_\"id`.`name` FROM transactions WHERE id = 1"
		);
		assertEquals(lastParentName, 'par');
		assertEquals(lastName, 'product_"id');

		assertEquals
		(	sql`SELECT ${'"par".\`product_"id\`->name'} FROM transactions WHERE id = 1` + '',
			"SELECT `par#product_\"id`.`name` FROM transactions WHERE id = 1"
		);
		assertEquals(lastParentName, 'par');
		assertEquals(lastName, 'product_"id');

		assertEquals
		(	sql`SELECT ${'"par".\`product_""id\`->name'} FROM transactions WHERE id = 1` + '',
			"SELECT `par#product_\"\"id`.`name` FROM transactions WHERE id = 1"
		);
		assertEquals(lastParentName, 'par');
		assertEquals(lastName, 'product_""id');

		assertEquals
		(	sql`SELECT ${'"par".`product_``id`->name'} FROM transactions WHERE id = 1` + '',
			"SELECT `par#product_``id`.`name` FROM transactions WHERE id = 1"
		);
		assertEquals(lastParentName, 'par');
		assertEquals(lastName, 'product_`id');
	}
);

Deno.test
(	'Arrow schema',
	() =>
	{	type TableInfo =
		{	foreignKeys?: Record<string, {refTable: string, onExpr: (baseAlias: string, refAlias: string) => string}>;
		};

		const SCHEMA: Record<string, TableInfo|undefined> =
		{	users: undefined,
			categories: undefined,
			products:
			{	foreignKeys:
				{	category_id: {refTable: 'categories', onExpr: (b, r) => `${b}.category_id = ${r}.id`}
				}
			},
			transactions:
			{	foreignKeys:
				{	product_id: {refTable: 'products', onExpr: (b, r) => `${b}.product_id = ${r}.id`}
				}
			}
		};

		class SqlTableCustom extends SqlTable
		{	protected override appendTableName(tableName: string)
			{	if (!(tableName in SCHEMA))
				{	throw new Error(`Unknown table: ${tableName}`);
				}
				return super.appendTableName(tableName);
			}

			protected override onJoinForeign(tableName: string, alias: string, columnName: string)
			{	const ref = SCHEMA[tableName.toLocaleLowerCase()]?.foreignKeys?.[columnName.toLocaleLowerCase()];
				if (ref)
				{	const {refTable, onExpr} = ref;
					const refAlias = this.genAlias(refTable);
					this.leftJoin(refTable, refAlias, onExpr(alias, refAlias));
					return refAlias;
				}
			}
		}

		function getSql(mode: SqlMode)
		{	const settings = new SqlSettings(mode, true);
			return new Proxy
			(	function sql(strings: readonly string[], ...params: unknown[])
				{	return new SqlTableCustom(settings, '', strings, params);
				} as Record<string, SqlTableCustom> & {(strings: readonly string[], ...params: unknown[]): SqlTableCustom},
				{	get(_target, table_name)
					{	if (typeof(table_name) != 'string')
						{	throw new Error("Table name must be string");
						}
						return new SqlTableCustom(settings, table_name);
					}
				}
			);
		}

		const mysqlOnly = getSql(SqlMode.MYSQL_ONLY);
		const sqliteOnly = getSql(SqlMode.SQLITE_ONLY);
		const pgsqlOnly = getSql(SqlMode.PGSQL_ONLY);
		const mssqlOnly = getSql(SqlMode.MSSQL_ONLY);

		assertEquals
		(	mysqlOnly.transactions.where(`product_id->name = 'prod1'`).select("time") + "",
			"SELECT `t`.time FROM `transactions` AS `t` LEFT JOIN `products` AS `p` ON (`t`.product_id = `p`.id) WHERE (`p`.`name` = 'prod1')"
		);
		assertEquals
		(	sqliteOnly.transactions.where(`product_id->name = 'prod1'`).select("time") + "",
			`SELECT "t"."time" FROM "transactions" AS "t" LEFT JOIN "products" AS "p" ON ("t"."product_id" = "p"."id") WHERE ("p"."name" = 'prod1')`
		);
		assertEquals
		(	pgsqlOnly.transactions.where(`product_id->name = 'prod1'`).select("time") + "",
			`SELECT "t".time FROM "transactions" AS "t" LEFT JOIN "products" AS "p" ON ("t".product_id = "p".id) WHERE ("p"."name" = 'prod1')`
		);
		assertEquals
		(	mssqlOnly.transactions.where(`product_id->name = 'prod1'`).select("time") + "",
			`SELECT "t"."time" FROM "transactions" AS "t" LEFT JOIN "products" AS "p" ON ("t"."product_id" = "p"."id") WHERE ("p"."name" = 'prod1')`
		);

		assertEquals
		(	mysqlOnly.transactions.where(`product_id->name = 'prod1'`).update({time: '1999-01-01'}) + "",
			"UPDATE `transactions` AS `t` LEFT JOIN `products` AS `p` ON (`t`.product_id = `p`.id) SET `t`.`time`='1999-01-01' WHERE (`p`.`name` = 'prod1')"
		);
		assertEquals
		(	sqliteOnly.transactions.where(`product_id->name = 'prod1'`).update({time: '1999-01-01'}) + "",
			`UPDATE "transactions" AS "t" SET "time"='1999-01-01' FROM "transactions" AS "s" LEFT JOIN "products" AS "p" ON ("t"."product_id" = "p"."id") WHERE ("p"."name" = 'prod1') AND "s".rowid = "t".rowid`
		);
		assertEquals
		(	mssqlOnly.transactions.where(`product_id->name = 'prod1'`).update({time: '1999-01-01'}) + "",
			`UPDATE "transactions" SET "time"='1999-01-01' FROM "transactions" AS "t" LEFT JOIN "products" AS "p" ON ("t"."product_id" = "p"."id") WHERE ("p"."name" = 'prod1')`
		);

		assertEquals
		(	mysqlOnly.users.join("transactions", "t", "id = t.user_id").where(`u.name='user1' AND t.product_id->name = 'prod1'`).select("t.time") + "",
			"SELECT `t`.time FROM `users` AS `u` INNER JOIN `transactions` AS `t` ON (`u`.id = `t`.user_id) LEFT JOIN `products` AS `p` ON (`t`.product_id = `p`.id) WHERE (`u`.name='user1' AND `p`.`name` = 'prod1')"
		);

		assertEquals
		(	mysqlOnly.users.join("transactions", "t", "id = t.user_id").where(`u.name='user1' AND t.product_id->name = 'prod1'`).update({flag: 1}) + "",
			"UPDATE `users` AS `u` INNER JOIN `transactions` AS `t` ON (`u`.id = `t`.user_id) LEFT JOIN `products` AS `p` ON (`t`.product_id = `p`.id) SET `u`.`flag`=1 WHERE (`u`.name='user1' AND `p`.`name` = 'prod1')"
		);

		assertEquals
		(	mysqlOnly.transactions.where(`id = 1`).select('product_id->name, product_id->category_id->name') + "",
			"SELECT `p`.`name`, `c`.`name` FROM `transactions` AS `t` LEFT JOIN `products` AS `p` ON (`t`.product_id = `p`.id) LEFT JOIN `categories` AS `c` ON (`p`.category_id = `c`.id) WHERE (`t`.id = 1)"
		);
		assertEquals
		(	mysqlOnly.transactions.where(`id = 1`).select('product_id->name, product_id -> category_id -> name') + "",
			"SELECT `p`.`name`, `c`. `name` FROM `transactions` AS `t` LEFT JOIN `products` AS `p` ON (`t`.product_id = `p`.id) LEFT JOIN `categories` AS `c` ON (`p`.category_id = `c`.id) WHERE (`t`.id = 1)"
		);
		assertEquals
		(	mysqlOnly.transactions.where(`id = 1`).select('product_id->name, `product_id`->category_id->name') + "",
			"SELECT `p`.`name`, `c`.`name` FROM `transactions` AS `t` LEFT JOIN `products` AS `p` ON (`t`.product_id = `p`.id) LEFT JOIN `categories` AS `c` ON (`p`.category_id = `c`.id) WHERE (`t`.id = 1)"
		);
		assertEquals
		(	mysqlOnly.transactions.where(`id = 1`).select('product_id->name, product_id->`category_id`->name') + "",
			"SELECT `p`.`name`, `c`.`name` FROM `transactions` AS `t` LEFT JOIN `products` AS `p` ON (`t`.product_id = `p`.id) LEFT JOIN `categories` AS `c` ON (`p`.category_id = `c`.id) WHERE (`t`.id = 1)"
		);
		assertEquals
		(	mysqlOnly.transactions.where(`id = 1`).select('product_id->name, `product_id`->`category_id`->name') + "",
			"SELECT `p`.`name`, `c`.`name` FROM `transactions` AS `t` LEFT JOIN `products` AS `p` ON (`t`.product_id = `p`.id) LEFT JOIN `categories` AS `c` ON (`p`.category_id = `c`.id) WHERE (`t`.id = 1)"
		);
		assertEquals
		(	mysqlOnly.transactions.where(`id = 1`).select('product_id->name, `product_id`->`category_id`->`name`') + "",
			"SELECT `p`.`name`, `c`.`name` FROM `transactions` AS `t` LEFT JOIN `products` AS `p` ON (`t`.product_id = `p`.id) LEFT JOIN `categories` AS `c` ON (`p`.category_id = `c`.id) WHERE (`t`.id = 1)"
		);
		assertEquals
		(	mysqlOnly.transactions.where(`id = 1`).select('product_id->name, `product_id`->category_id->`name`') + "",
			"SELECT `p`.`name`, `c`.`name` FROM `transactions` AS `t` LEFT JOIN `products` AS `p` ON (`t`.product_id = `p`.id) LEFT JOIN `categories` AS `c` ON (`p`.category_id = `c`.id) WHERE (`t`.id = 1)"
		);
		assertEquals
		(	mysqlOnly.transactions.where(`id = 1`).select('product_id->name, `product_id` -> category_id -> `name`') + "",
			"SELECT `p`.`name`, `c`. `name` FROM `transactions` AS `t` LEFT JOIN `products` AS `p` ON (`t`.product_id = `p`.id) LEFT JOIN `categories` AS `c` ON (`p`.category_id = `c`.id) WHERE (`t`.id = 1)"
		);
		assertEquals
		(	mysqlOnly.transactions.where(`id = 1`).select('product_id->name, `product_id` -> `category_id` -> `name`') + "",
			"SELECT `p`.`name`, `c`. `name` FROM `transactions` AS `t` LEFT JOIN `products` AS `p` ON (`t`.product_id = `p`.id) LEFT JOIN `categories` AS `c` ON (`p`.category_id = `c`.id) WHERE (`t`.id = 1)"
		);
	}
);
