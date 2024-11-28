import {INLINE_STRING_MAX_LEN} from '../private/sql.ts';
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
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `Hello ``All``!` WHERE (`id`=1)");

		s = mysql[TABLE].where(mysql`name = '${'Untitled'}'`).select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `Hello ``All``!` WHERE (`name` = 'Untitled')");

		s = mysql[TABLE].where("").select(mysql`col1*2, Count(*)`);
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `Hello ``All``!`");

		s = mysql[TABLE].where("").select(['a', 'b b']);
		assertEquals(s+'', "SELECT `a`, `b b` FROM `Hello ``All``!`");

		s = mysql[TABLE].join('more').where("").select(['a', 'b b']);
		assertEquals(s+'', "SELECT `b`.`a`, `b`.`b b` FROM `Hello ``All``!` AS `b` CROSS JOIN `more`");

		{	const a = 'a'.repeat(INLINE_STRING_MAX_LEN+1);
			const b = 'b'.repeat(INLINE_STRING_MAX_LEN+1);
			const params: unknown[] = [];
			const str = mysql.t_log.where(pgsql`a='${a}'`).select(pgsql`b+'${b}'`).toString(params);
			assertEquals(str, "SELECT `b`+? FROM `t_log` WHERE (`a`=?)");
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

		const table = mysql.t_log.where('id IN (1, 2)');

		s = table.where("name <> ''").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `t_log` WHERE (`id` IN( 1, 2)) AND (`name` <> '')");

		error = undefined;
		try
		{	table.join('hello');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, "join() can be called before where()");

		error = undefined;
		try
		{	mysql._base_table;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Alias "_base_table" is reserved`);

		error = undefined;
		try
		{	mysql.t_log.join('_base_table');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Alias "_base_table" is reserved`);

		error = undefined;
		try
		{	mysql._subj_table;
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Alias "_subj_table" is reserved`);

		error = undefined;
		try
		{	mysql.t_log.join('_subj_table');
		}
		catch (e)
		{	error = e instanceof Error ? e : new Error(e+'');
		}
		assertEquals(error?.message, `Alias "_subj_table" is reserved`);

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
		assertEquals(s+'', "SELECT `b`.col1*2, Count(*) FROM `t_log` AS `b` INNER JOIN `meta` AS `m` ON (`b`.meta_id = `m`.id)");

		s = mysql.t_log.join('meta', '', 'meta_id = meta.id').where("").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `b`.col1*2, Count(*) FROM `t_log` AS `b` INNER JOIN `meta` ON (`b`.meta_id = `meta`.id)");

		s = mysql.t_log.leftJoin('meta', 'm', 'meta_id = m.id').where("").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `b`.col1*2, Count(*) FROM `t_log` AS `b` LEFT JOIN `meta` AS `m` ON (`b`.meta_id = `m`.id)");

		s = mysql.t_log.leftJoin('meta', '', 'meta_id = meta.id').where("").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `b`.col1*2, Count(*) FROM `t_log` AS `b` LEFT JOIN `meta` ON (`b`.meta_id = `meta`.id)");

		s = mysql.t_log.leftJoin('meta', 'b', 'meta_id = b.id').where("").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `base`.col1*2, Count(*) FROM `t_log` AS `base` LEFT JOIN `meta` AS `b` ON (`base`.meta_id = `b`.id)");

		s = mysql.t_log.join('b').join('base').where("").select();
		assertEquals(s+'', "SELECT * FROM `t_log` AS `base_table` CROSS JOIN `b` CROSS JOIN `base`");

		s = mysql.t_log.join('b').join('base').join('hello', 'base_table').where("").select();
		assertEquals(s+'', "SELECT * FROM `t_log` AS `_base_table` CROSS JOIN `b` CROSS JOIN `base` CROSS JOIN `hello` AS `base_table`");

		s = mysql.t_log.where("").groupBy('g1, g2').select();
		assertEquals(s+'', "SELECT * FROM `t_log` GROUP BY `g1`, `g2`");

		s = mysql.t_log.where("").groupBy(['g1', 'g2']).select();
		assertEquals(s+'', "SELECT * FROM `t_log` GROUP BY `g1`, `g2`");

		s = mysql.t_log.where("").groupBy('g1, g2', 'hello IS NULL').select();
		assertEquals(s+'', "SELECT * FROM `t_log` GROUP BY `g1`, `g2` HAVING (`hello` IS NULL)");

		s = mysql.t_log.join('meta', '', 'meta_id = meta.id').where("").groupBy(mysql`g1, meta.g2`, mysql`hello IS NULL`).select();
		assertEquals(s+'', "SELECT * FROM `t_log` AS `b` INNER JOIN `meta` ON (`b`.meta_id = `meta`.id) GROUP BY `b`.g1, `meta`.g2 HAVING (`hello` IS NULL)");

		s = mysql.t_log.where("").select("col1*2, Count(*)", "position_major DESC, position_minor");
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `t_log` ORDER BY `position_major` DESC, `position_minor`");

		s = mysql.t_log.where("").select(mysql`col1*2, Count(*)`, mysql`position_major DESC, position_minor`);
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `t_log` ORDER BY `position_major` DESC, `position_minor`");

		s = mysql.t_log.where("").select(mysql`col1*2, Count(*)`, {columns: ['position_major', 'position_minor']});
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `t_log` ORDER BY `position_major`, `position_minor`");

		s = mysql.t_log.where("").select(mysql`col1*2, Count(*)`, {columns: ['position_major', 'position_minor'], desc: false});
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `t_log` ORDER BY `position_major`, `position_minor`");

		s = mysql.t_log.where("").select(mysql`col1*2, Count(*)`, {columns: ['position_major', 'position_minor'], desc: true});
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `t_log` ORDER BY `position_major` DESC, `position_minor` DESC");

		s = mysqlOnly.t_log.where("").select("", "", 0, 10);
		assertEquals(s+'', "SELECT * FROM `t_log` LIMIT 10");

		s = mysqlOnly.t_log.where("").select("", "", 1, 11);
		assertEquals(s+'', "SELECT * FROM `t_log` LIMIT 11 OFFSET 1");

		s = mysqlOnly.t_log.where("").select("", "", 10);
		assertEquals(s+'', "SELECT * FROM `t_log` LIMIT 2147483647 OFFSET 10");

		s = pgsqlOnly.t_log.where("").select("", "", 0, 10);
		assertEquals(s+'', `SELECT * FROM "t_log" LIMIT 10`);

		s = pgsqlOnly.t_log.where("").select("", "", 1, 11);
		assertEquals(s+'', `SELECT * FROM "t_log" LIMIT 11 OFFSET 1`);

		s = pgsqlOnly.t_log.where("").select("", "", 10);
		assertEquals(s+'', `SELECT * FROM "t_log" OFFSET 10`);

		s = sqliteOnly.t_log.where("").select("", "", 0, 10);
		assertEquals(s+'', `SELECT * FROM "t_log" LIMIT 10`);

		s = sqliteOnly.t_log.where("").select("", "", 1, 11);
		assertEquals(s+'', `SELECT * FROM "t_log" LIMIT 11 OFFSET 1`);

		s = sqliteOnly.t_log.where("").select("", "", 10);
		assertEquals(s+'', `SELECT * FROM "t_log" LIMIT 2147483647 OFFSET 10`);

		s = mssql.t_log.where("").select("", "id", 0, 10);
		assertEquals(s+'', `SELECT * FROM "t_log" ORDER BY "id" OFFSET 0 ROWS FETCH FIRST 10 ROWS ONLY`);

		s = mssql.t_log.where("").select("", "id", 1, 11);
		assertEquals(s+'', `SELECT * FROM "t_log" ORDER BY "id" OFFSET 1 ROWS FETCH FIRST 11 ROWS ONLY`);

		s = mssql.t_log.where("").select("", "id", 10);
		assertEquals(s+'', `SELECT * FROM "t_log" ORDER BY "id" OFFSET 10 ROWS`);

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
		assertEquals(s+'', "UPDATE `t_log` SET `message`='Message ''1''' WHERE (`id`=1)");

		// One INNER JOIN:

		s = mysql.t_log.join('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `b` INNER JOIN `more` ON (`b`.more_id = `more`.id) SET `b`.`message`='Message 1' WHERE (`b`.id=1)");

		s = pgsql.t_log.join('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" WHERE ("b".id=1) AND ("b".more_id = "more".id)`);

		s = sqlite.t_log.join('more', 'm', 'more_id = m.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" AS "m" WHERE ("b"."id"=1) AND ("b"."more_id" = "m"."id")`);

		s = mssql.t_log.join('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" INNER JOIN "more" ON ("b"."more_id" = "more"."id") WHERE ("b"."id"=1)`);

		// One LEFT JOIN:

		s = mysqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `b` LEFT JOIN `more` ON (`b`.more_id = `more`.id) SET `b`.`message`='Message 1' WHERE (`b`.id=1)");

		s = sqliteOnly.t_log.leftJoin('more', 'm', 'more_id = m.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "s" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b"."more_id" = "m"."id") WHERE ("b"."id"=1) AND "s".rowid = "b".rowid`);

		s = sqliteOnly.t_log.leftJoin('more', 'm', 'more_id = m.id').where('').update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "s" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b"."more_id" = "m"."id") WHERE "s".rowid = "b".rowid`);

		s = sqliteOnly.t_log.leftJoin('more', 'm', 'more_id = m.id').join('s').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "subj" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b"."more_id" = "m"."id") CROSS JOIN "s" WHERE ("b"."id"=1) AND "subj".rowid = "b".rowid`);

		s = sqliteOnly.t_log.leftJoin('more', 'm', 'more_id = m.id').join('s').join('subj').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "subj_table" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b"."more_id" = "m"."id") CROSS JOIN "s" CROSS JOIN "subj" WHERE ("b"."id"=1) AND "subj_table".rowid = "b".rowid`);

		s = sqliteOnly.t_log.leftJoin('more', 'm', 'more_id = m.id').join('s').join('subj').join('subj_table').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "_subj_table" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b"."more_id" = "m"."id") CROSS JOIN "s" CROSS JOIN "subj" CROSS JOIN "subj_table" WHERE ("b"."id"=1) AND "_subj_table".rowid = "b".rowid`);

		s = mssqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" ON ("b"."more_id" = "more"."id") WHERE ("b"."id"=1)`);

		// One LEFT JOIN and one INNER:

		s = mysqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `b` LEFT JOIN `more` ON (`b`.more_id = `more`.id) INNER JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) SET `b`.`message`='Message 1' WHERE (`b`.id=1)");

		s = sqliteOnly.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "s" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" ON ("b"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("b"."id"=1) AND "s".rowid = "b".rowid`);

		s = mssqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" ON ("b"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("b"."id"=1)`);

		// Two INNER JOINs:

		s = mysql.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `b` INNER JOIN `more` ON (`b`.more_id = `more`.id) INNER JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) SET `b`.`message`='Message 1' WHERE (`b`.id=1)");

		s = pgsql.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" INNER JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) WHERE ("b".id=1) AND ("b".more_id = "more".id)`);

		s = sqlite.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("b"."id"=1) AND ("b"."more_id" = "more"."id")`);

		s = sqlite.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("b"."more_id" = "more"."id")`);

		s = mssql.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" INNER JOIN "more" ON ("b"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("b"."id"=1)`);

		// One INNER JOIN, one LEFT and one CROSS (and maybe one more INNER):

		s = mysql.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', 'm2', 'more.more2_id = m2.id').join('more3').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `b` INNER JOIN `more` ON (`b`.more_id = `more`.id) LEFT JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) CROSS JOIN `more3` SET `b`.`message`='Message 1' WHERE (`b`.id=1)");

		s = pgsql.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', 'm2', 'more.more2_id = m2.id').join('more3').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" LEFT JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) CROSS JOIN "more3" WHERE ("b".id=1) AND ("b".more_id = "more".id)`);

		s = sqlite.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', '', 'more.more2_id = more2.id').join('more3', 'm3').join('more4', '', 'm3.more4_id = more4.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" LEFT JOIN "more2" ON ("more"."more2_id" = "more2"."id") CROSS JOIN "more3" AS "m3" INNER JOIN "more4" ON ("m3"."more4_id" = "more4"."id") WHERE ("b"."id"=1) AND ("b"."more_id" = "more"."id")`);

		s = mssql.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', 'm2', 'more.more2_id = m2.id').join('more3').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" INNER JOIN "more" ON ("b"."more_id" = "more"."id") LEFT JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") CROSS JOIN "more3" WHERE ("b"."id"=1)`);

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

		// One INNER JOIN:

		s = mysql.t_log.join('more', '', 'more_id = more.id').where("id=1").delete();
		assertEquals(s+'', "DELETE `b` FROM `t_log` AS `b` INNER JOIN `more` ON (`b`.more_id = `more`.id) WHERE (`b`.id=1)");

		s = pgsql.t_log.join('more', '', 'more_id = more.id').where("id=1").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "b" USING "more" WHERE ("b".id=1) AND ("b".more_id = "more".id)`);

		s = pgsql.t_log.join('more', '', 'more_id = more.id').where("").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "b" USING "more" WHERE ("b".more_id = "more".id)`);

		s = sqlite.t_log.join('more', 'm', 'more_id = m.id').where("id=1").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "s" WHERE rowid IN (SELECT "b".rowid FROM "t_log" AS "b" INNER JOIN "more" AS "m" ON ("b"."more_id" = "m"."id") WHERE ("b"."id"=1))`);

		s = mssql.t_log.join('more', '', 'more_id = more.id').where("id=1").delete();
		assertEquals(s+'', `DELETE "b" FROM "t_log" AS "b" INNER JOIN "more" ON ("b"."more_id" = "more"."id") WHERE ("b"."id"=1)`);

		// One LEFT JOIN:

		s = mysqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").delete();
		assertEquals(s+'', "DELETE `b` FROM `t_log` AS `b` LEFT JOIN `more` ON (`b`.more_id = `more`.id) WHERE (`b`.id=1)");

		s = sqliteOnly.t_log.leftJoin('more', 'm', 'more_id = m.id').where("id=1").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "s" WHERE rowid IN (SELECT "b".rowid FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b"."more_id" = "m"."id") WHERE ("b"."id"=1))`);

		// One LEFT JOIN and one INNER:

		s = mysqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").delete();
		assertEquals(s+'', "DELETE `b` FROM `t_log` AS `b` LEFT JOIN `more` ON (`b`.more_id = `more`.id) INNER JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) WHERE (`b`.id=1)");

		s = sqliteOnly.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "s" WHERE rowid IN (SELECT "b".rowid FROM "t_log" AS "b" LEFT JOIN "more" ON ("b"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("b"."id"=1))`);

		s = mssqlOnly.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").delete();
		assertEquals(s+'', `DELETE "b" FROM "t_log" AS "b" LEFT JOIN "more" ON ("b"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("b"."id"=1)`);

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
			assertEquals(s+'', "INSERT INTO `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20') ON DUPLICATE KEY UPDATE `a`=`a`");

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
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) SELECT `cb1`, `cb2` FROM `t_log_bak`");

		s = mysqlOnly.t_log.insertFrom(['c1', 'c2'], mysql.t_log_bak.where('id<=100').select('cb1, cb2'), 'nothing');
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) SELECT `cb1`, `cb2` FROM `t_log_bak` WHERE (`id`<=100) ON DUPLICATE KEY UPDATE `c1`=`c1`");

		s = pgsqlOnly.t_log.insertFrom(['c1', 'c2'], mysql.t_log_bak.where('id<=100').select('cb1, cb2'), 'nothing');
		assertEquals(s+'', `INSERT INTO "t_log" ("c1", "c2") SELECT "cb1", "cb2" FROM "t_log_bak" WHERE ("id"<=100) ON CONFLICT DO NOTHING`);

		s = sqliteOnly.t_log.insertFrom(['c1', 'c2'], mysql.t_log_bak.where('id<=100').select('cb1, cb2'), 'nothing');
		assertEquals(s+'', `INSERT INTO "t_log" ("c1", "c2") SELECT "cb1", "cb2" FROM "t_log_bak" WHERE ("id"<=100) ON CONFLICT DO NOTHING`);

		s = mysqlOnly.t_log.insertFrom(['c1', 'c2'], mysql.t_log_bak.where('id<=100').select('cb1, cb2'), 'replace');
		assertEquals(s+'', "REPLACE `t_log` (`c1`, `c2`) SELECT `cb1`, `cb2` FROM `t_log_bak` WHERE (`id`<=100)");

		s = sqliteOnly.t_log.insertFrom(['c1', 'c2'], mysql.t_log_bak.where('id<=100').select('cb1, cb2'), 'replace');
		assertEquals(s+'', `REPLACE INTO "t_log" ("c1", "c2") SELECT "cb1", "cb2" FROM "t_log_bak" WHERE ("id"<=100)`);

		s = mysql.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`);
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) HELLO ALL");

		s = mysqlOnly.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'nothing');
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) HELLO ALL ON DUPLICATE KEY UPDATE `c1`=`c1`");

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
		assertEquals(s, "SELECT Length(`b`.a) AS `la`, Length(`b`.b) AS `lb`, Length(`b`.c) AS `lc` FROM `links` AS `b` CROSS JOIN `pages` AS `p` WHERE (`b`.id = 1)");

		s = '' + mysql.new_pages.insertFrom(['pa', 'pb', 'pc'], mysql.links.join('pages', 'p').select('Length(a) AS "la", Length(b) AS `lb`, Length(c) AS lc').where('id = 1'));
		assertEquals(s, "INSERT INTO `new_pages` (`pa`, `pb`, `pc`) SELECT Length(`b`.a) AS `la`, Length(`b`.b) AS `lb`, Length(`b`.c) AS `lc` FROM `links` AS `b` CROSS JOIN `pages` AS `p` WHERE (`b`.id = 1)");
	}
);
