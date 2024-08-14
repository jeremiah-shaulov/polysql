// deno-lint-ignore-file

import {mysql, pgsql, INLINE_STRING_MAX_LEN} from '../private/sql.ts';
import
{	mysqlTables, mysqlOnlyTables,
	pgsqlTables, pgsqlOnlyTables,
	sqliteTables, sqliteOnlyTables,
	mssqlTables, mssqlOnlyTables,
} from '../private/sql_table.ts';
import {assertEquals} from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';

Deno.test
(	'Table name must be string',
	async () =>
	{	let error;
		try
		{	mysqlTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be string");

		error = undefined;
		try
		{	mysqlOnlyTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be string");

		error = undefined;
		try
		{	pgsqlTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be string");

		error = undefined;
		try
		{	pgsqlOnlyTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be string");

		error = undefined;
		try
		{	sqliteTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be string");

		error = undefined;
		try
		{	sqliteOnlyTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be string");

		error = undefined;
		try
		{	mssqlTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be string");

		error = undefined;
		try
		{	mssqlOnlyTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be string");
	}
);

Deno.test
(	'Test sqlTables.select()',
	async () =>
	{	const TABLE = 'Hello `All`!';
		assertEquals(mysqlTables[TABLE].tableName, TABLE);

		let s = mysqlTables[TABLE].where("id=1").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `Hello ``All``!` WHERE (`id`=1)");

		s = mysqlTables[TABLE].where(mysql`name = '${'Untitled'}'`).select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `Hello ``All``!` WHERE (`name` = 'Untitled')");

		s = mysqlTables[TABLE].where("").select(mysql`col1*2, Count(*)`);
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `Hello ``All``!`");

		s = mysqlTables[TABLE].where("").select(['a', 'b b']);
		assertEquals(s+'', "SELECT `a`, `b b` FROM `Hello ``All``!`");

		s = mysqlTables[TABLE].join('more').where("").select(['a', 'b b']);
		assertEquals(s+'', "SELECT `b`.`a`, `b`.`b b` FROM `Hello ``All``!` AS `b` CROSS JOIN `more`");

		{	let a = 'a'.repeat(INLINE_STRING_MAX_LEN+1);
			let b = 'b'.repeat(INLINE_STRING_MAX_LEN+1);
			let params: any[] = [];
			let str = mysqlTables.t_log.where(pgsql`a='${a}'`).select(pgsql`b+'${b}'`).toString(params);
			assertEquals(str, "SELECT `b`+? FROM `t_log` WHERE (`a`=?)");
			assertEquals(params, [b, a]);
		}

		let error;
		try
		{	mysqlTables[TABLE].select("col1*2, Count(*)") + '';
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Please, call where() first");

		let table = mysqlTables.t_log.where('id IN (1, 2)');

		s = table.where("name <> ''").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `t_log` WHERE (`id` IN( 1, 2)) AND (`name` <> '')");

		error = undefined;
		try
		{	table.join('hello');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "join() can be called before where()");

		error = undefined;
		try
		{	mysqlTables._base_table;
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, `Alias "_base_table" is reserved`);

		error = undefined;
		try
		{	mysqlTables.t_log.join('_base_table');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, `Alias "_base_table" is reserved`);

		error = undefined;
		try
		{	mysqlTables._subj_table;
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, `Alias "_subj_table" is reserved`);

		error = undefined;
		try
		{	mysqlTables.t_log.join('_subj_table');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, `Alias "_subj_table" is reserved`);

		error = undefined;
		try
		{	mysqlTables.t_log.leftJoin('a', 'aa', '');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, `No condition in LEFT JOIN`);

		error = undefined;
		try
		{	mysqlTables.t_log.groupBy('').join('a', 'aa', '');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, `join() can be called before groupBy()`);

		error = undefined;
		try
		{	mysqlTables.t_log.groupBy('').where('1');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, `where() can be called before groupBy()`);

		error = undefined;
		try
		{	mysqlTables.t_log.groupBy('').groupBy('1');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, `groupBy() can be called only once`);

		s = mysqlTables.t_log.join('meta', 'm', 'meta_id = m.id').where("").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `b`.col1*2, Count(*) FROM `t_log` AS `b` INNER JOIN `meta` AS `m` ON (`b`.meta_id = `m`.id)");

		s = mysqlTables.t_log.join('meta', '', 'meta_id = meta.id').where("").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `b`.col1*2, Count(*) FROM `t_log` AS `b` INNER JOIN `meta` ON (`b`.meta_id = `meta`.id)");

		s = mysqlTables.t_log.leftJoin('meta', 'm', 'meta_id = m.id').where("").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `b`.col1*2, Count(*) FROM `t_log` AS `b` LEFT JOIN `meta` AS `m` ON (`b`.meta_id = `m`.id)");

		s = mysqlTables.t_log.leftJoin('meta', '', 'meta_id = meta.id').where("").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `b`.col1*2, Count(*) FROM `t_log` AS `b` LEFT JOIN `meta` ON (`b`.meta_id = `meta`.id)");

		s = mysqlTables.t_log.leftJoin('meta', 'b', 'meta_id = b.id').where("").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `base`.col1*2, Count(*) FROM `t_log` AS `base` LEFT JOIN `meta` AS `b` ON (`base`.meta_id = `b`.id)");

		s = mysqlTables.t_log.join('b').join('base').where("").select();
		assertEquals(s+'', "SELECT * FROM `t_log` AS `base_table` CROSS JOIN `b` CROSS JOIN `base`");

		s = mysqlTables.t_log.join('b').join('base').join('hello', 'base_table').where("").select();
		assertEquals(s+'', "SELECT * FROM `t_log` AS `_base_table` CROSS JOIN `b` CROSS JOIN `base` CROSS JOIN `hello` AS `base_table`");

		s = mysqlTables.t_log.where("").groupBy('g1, g2').select();
		assertEquals(s+'', "SELECT * FROM `t_log` GROUP BY `g1`, `g2`");

		s = mysqlTables.t_log.where("").groupBy(['g1', 'g2']).select();
		assertEquals(s+'', "SELECT * FROM `t_log` GROUP BY `g1`, `g2`");

		s = mysqlTables.t_log.where("").groupBy('g1, g2', 'hello IS NULL').select();
		assertEquals(s+'', "SELECT * FROM `t_log` GROUP BY `g1`, `g2` HAVING (`hello` IS NULL)");

		s = mysqlTables.t_log.join('meta', '', 'meta_id = meta.id').where("").groupBy(mysql`g1, meta.g2`, mysql`hello IS NULL`).select();
		assertEquals(s+'', "SELECT * FROM `t_log` AS `b` INNER JOIN `meta` ON (`b`.meta_id = `meta`.id) GROUP BY `b`.g1, `meta`.g2 HAVING (`hello` IS NULL)");

		s = mysqlTables.t_log.where("").select("col1*2, Count(*)", "position_major DESC, position_minor");
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `t_log` ORDER BY `position_major` DESC, `position_minor`");

		s = mysqlTables.t_log.where("").select(mysql`col1*2, Count(*)`, mysql`position_major DESC, position_minor`);
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `t_log` ORDER BY `position_major` DESC, `position_minor`");

		s = mysqlTables.t_log.where("").select(mysql`col1*2, Count(*)`, {columns: ['position_major', 'position_minor']});
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `t_log` ORDER BY `position_major`, `position_minor`");

		s = mysqlTables.t_log.where("").select(mysql`col1*2, Count(*)`, {columns: ['position_major', 'position_minor'], desc: false});
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `t_log` ORDER BY `position_major`, `position_minor`");

		s = mysqlTables.t_log.where("").select(mysql`col1*2, Count(*)`, {columns: ['position_major', 'position_minor'], desc: true});
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `t_log` ORDER BY `position_major` DESC, `position_minor` DESC");

		s = mysqlOnlyTables.t_log.where("").select("", "", 0, 10);
		assertEquals(s+'', "SELECT * FROM `t_log` LIMIT 10");

		s = mysqlOnlyTables.t_log.where("").select("", "", 1, 11);
		assertEquals(s+'', "SELECT * FROM `t_log` LIMIT 11 OFFSET 1");

		s = mysqlOnlyTables.t_log.where("").select("", "", 10);
		assertEquals(s+'', "SELECT * FROM `t_log` LIMIT 2147483647 OFFSET 10");

		s = pgsqlOnlyTables.t_log.where("").select("", "", 0, 10);
		assertEquals(s+'', `SELECT * FROM "t_log" LIMIT 10`);

		s = pgsqlOnlyTables.t_log.where("").select("", "", 1, 11);
		assertEquals(s+'', `SELECT * FROM "t_log" LIMIT 11 OFFSET 1`);

		s = pgsqlOnlyTables.t_log.where("").select("", "", 10);
		assertEquals(s+'', `SELECT * FROM "t_log" OFFSET 10`);

		s = sqliteOnlyTables.t_log.where("").select("", "", 0, 10);
		assertEquals(s+'', `SELECT * FROM "t_log" LIMIT 10`);

		s = sqliteOnlyTables.t_log.where("").select("", "", 1, 11);
		assertEquals(s+'', `SELECT * FROM "t_log" LIMIT 11 OFFSET 1`);

		s = sqliteOnlyTables.t_log.where("").select("", "", 10);
		assertEquals(s+'', `SELECT * FROM "t_log" LIMIT 2147483647 OFFSET 10`);

		s = mssqlTables.t_log.where("").select("", "id", 0, 10);
		assertEquals(s+'', `SELECT * FROM "t_log" ORDER BY "id" OFFSET 0 ROWS FETCH FIRST 10 ROWS ONLY`);

		s = mssqlTables.t_log.where("").select("", "id", 1, 11);
		assertEquals(s+'', `SELECT * FROM "t_log" ORDER BY "id" OFFSET 1 ROWS FETCH FIRST 11 ROWS ONLY`);

		s = mssqlTables.t_log.where("").select("", "id", 10);
		assertEquals(s+'', `SELECT * FROM "t_log" ORDER BY "id" OFFSET 10 ROWS`);

		error = undefined;
		try
		{	mysqlTables.t_log.where("").select("", "", 0, 10) + '';
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, 'SELECT with LIMIT but without ORDER BY is not supported across all engines. Please use mysqlOnly`...`');

		error = undefined;
		try
		{	pgsqlTables.t_log.where("").select("", "", 0, 10) + '';
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, 'SELECT with LIMIT but without ORDER BY is not supported across all engines. Please use pgsqlOnly`...`');

		error = undefined;
		try
		{	sqliteTables.t_log.where("").select("", "", 0, 10) + '';
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, 'SELECT with LIMIT but without ORDER BY is not supported across all engines. Please use sqliteOnly`...`');

		error = undefined;
		try
		{	mssqlTables.t_log.where("").select("", "", 0, 10) + '';
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, 'SELECT with LIMIT but without ORDER BY is not supported on MS SQL');

		error = undefined;
		try
		{	mssqlOnlyTables.t_log.where("").select("", "", 0, 10) + '';
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, 'SELECT with LIMIT but without ORDER BY is not supported on MS SQL');

		error = undefined;
		try
		{	mysqlTables.t_log.where("").select("", "", 10) + '';
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, 'SELECT with OFFSET but without ORDER BY is not supported across all engines. Please use mysqlOnly`...`');

		error = undefined;
		try
		{	pgsqlTables.t_log.where("").select("", "", 10) + '';
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, 'SELECT with OFFSET but without ORDER BY is not supported across all engines. Please use pgsqlOnly`...`');

		error = undefined;
		try
		{	sqliteTables.t_log.where("").select("", "", 10) + '';
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, 'SELECT with OFFSET but without ORDER BY is not supported across all engines. Please use sqliteOnly`...`');

		error = undefined;
		try
		{	mssqlTables.t_log.where("").select("", "", 10) + '';
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, 'SELECT with OFFSET but without ORDER BY is not supported on MS SQL');

		error = undefined;
		try
		{	mssqlOnlyTables.t_log.where("").select("", "", 10) + '';
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, 'SELECT with OFFSET but without ORDER BY is not supported on MS SQL');
	}
);

Deno.test
(	'Test sqlTables.update()',
	async () =>
	{	// Simple:

		let s = mysqlTables.t_log.where("id=1").update({message: "Message '1'"});
		assertEquals(s+'', "UPDATE `t_log` SET `message`='Message ''1''' WHERE (`id`=1)");

		// One INNER JOIN:

		s = mysqlTables.t_log.join('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `b` INNER JOIN `more` ON (`b`.more_id = `more`.id) SET `b`.`message`='Message 1' WHERE (`b`.id=1)");

		s = pgsqlTables.t_log.join('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" WHERE ("b".id=1) AND ("b".more_id = "more".id)`);

		s = sqliteTables.t_log.join('more', 'm', 'more_id = m.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" AS "m" WHERE ("b"."id"=1) AND ("b"."more_id" = "m"."id")`);

		s = mssqlTables.t_log.join('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" INNER JOIN "more" ON ("b"."more_id" = "more"."id") WHERE ("b"."id"=1)`);

		// One LEFT JOIN:

		s = mysqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `b` LEFT JOIN `more` ON (`b`.more_id = `more`.id) SET `b`.`message`='Message 1' WHERE (`b`.id=1)");

		s = sqliteOnlyTables.t_log.leftJoin('more', 'm', 'more_id = m.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "s" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b"."more_id" = "m"."id") WHERE ("b"."id"=1) AND "s".rowid = "b".rowid`);

		s = sqliteOnlyTables.t_log.leftJoin('more', 'm', 'more_id = m.id').where('').update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "s" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b"."more_id" = "m"."id") WHERE "s".rowid = "b".rowid`);

		s = sqliteOnlyTables.t_log.leftJoin('more', 'm', 'more_id = m.id').join('s').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "subj" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b"."more_id" = "m"."id") CROSS JOIN "s" WHERE ("b"."id"=1) AND "subj".rowid = "b".rowid`);

		s = sqliteOnlyTables.t_log.leftJoin('more', 'm', 'more_id = m.id').join('s').join('subj').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "subj_table" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b"."more_id" = "m"."id") CROSS JOIN "s" CROSS JOIN "subj" WHERE ("b"."id"=1) AND "subj_table".rowid = "b".rowid`);

		s = sqliteOnlyTables.t_log.leftJoin('more', 'm', 'more_id = m.id').join('s').join('subj').join('subj_table').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "_subj_table" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b"."more_id" = "m"."id") CROSS JOIN "s" CROSS JOIN "subj" CROSS JOIN "subj_table" WHERE ("b"."id"=1) AND "_subj_table".rowid = "b".rowid`);

		s = mssqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" ON ("b"."more_id" = "more"."id") WHERE ("b"."id"=1)`);

		// One LEFT JOIN and one INNER:

		s = mysqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `b` LEFT JOIN `more` ON (`b`.more_id = `more`.id) INNER JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) SET `b`.`message`='Message 1' WHERE (`b`.id=1)");

		s = sqliteOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "s" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" ON ("b"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("b"."id"=1) AND "s".rowid = "b".rowid`);

		s = mssqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" ON ("b"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("b"."id"=1)`);

		// Two INNER JOINs:

		s = mysqlTables.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `b` INNER JOIN `more` ON (`b`.more_id = `more`.id) INNER JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) SET `b`.`message`='Message 1' WHERE (`b`.id=1)");

		s = pgsqlTables.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" INNER JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) WHERE ("b".id=1) AND ("b".more_id = "more".id)`);

		s = sqliteTables.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("b"."id"=1) AND ("b"."more_id" = "more"."id")`);

		s = sqliteTables.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("b"."more_id" = "more"."id")`);

		s = mssqlTables.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" INNER JOIN "more" ON ("b"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("b"."id"=1)`);

		// One INNER JOIN, one LEFT and one CROSS (and maybe one more INNER):

		s = mysqlTables.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', 'm2', 'more.more2_id = m2.id').join('more3').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `b` INNER JOIN `more` ON (`b`.more_id = `more`.id) LEFT JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) CROSS JOIN `more3` SET `b`.`message`='Message 1' WHERE (`b`.id=1)");

		s = pgsqlTables.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', 'm2', 'more.more2_id = m2.id').join('more3').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" LEFT JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) CROSS JOIN "more3" WHERE ("b".id=1) AND ("b".more_id = "more".id)`);

		s = sqliteTables.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', '', 'more.more2_id = more2.id').join('more3', 'm3').join('more4', '', 'm3.more4_id = more4.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" LEFT JOIN "more2" ON ("more"."more2_id" = "more2"."id") CROSS JOIN "more3" AS "m3" INNER JOIN "more4" ON ("m3"."more4_id" = "more4"."id") WHERE ("b"."id"=1) AND ("b"."more_id" = "more"."id")`);

		s = mssqlTables.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', 'm2', 'more.more2_id = m2.id').join('more3').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" INNER JOIN "more" ON ("b"."more_id" = "more"."id") LEFT JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") CROSS JOIN "more3" WHERE ("b"."id"=1)`);

		// Errors:

		let error;
		try
		{	'' + mysqlTables.t_log.where("id=1").update({});
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "In SQL fragment: 0 values for {${...}}");

		error = undefined;
		try
		{	'' + mysqlTables.t_log.where("id=1").groupBy('').update({a: 1});
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Cannot UPDATE with GROUP BY");

		// leftJoin not supported:

		error = undefined;
		try
		{	'' + mysqlTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "UPDATE where the first join is a LEFT JOIN is not supported across all engines. Please use mysqlOnly`...`");

		error = undefined;
		try
		{	'' + pgsqlTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "UPDATE where the first join is a LEFT JOIN is not supported on PostgreSQL");

		error = undefined;
		try
		{	'' + pgsqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "UPDATE where the first join is a LEFT JOIN is not supported on PostgreSQL");

		error = undefined;
		try
		{	'' + sqliteTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "UPDATE where the first join is a LEFT JOIN is not supported across all engines. Please use sqliteOnly`...`");

		error = undefined;
		try
		{	'' + mssqlTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "UPDATE where the first join is a LEFT JOIN is not supported across all engines. Please use mssqlOnly`...`");
	}
);

Deno.test
(	'Test sqlTables.delete()',
	async () =>
	{	// Simple:

		let s = mysqlTables.t_log.where("id=1").delete();
		assertEquals(s+'', "DELETE FROM `t_log` WHERE (`id`=1)");

		// One INNER JOIN:

		s = mysqlTables.t_log.join('more', '', 'more_id = more.id').where("id=1").delete();
		assertEquals(s+'', "DELETE `b` FROM `t_log` AS `b` INNER JOIN `more` ON (`b`.more_id = `more`.id) WHERE (`b`.id=1)");

		s = pgsqlTables.t_log.join('more', '', 'more_id = more.id').where("id=1").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "b" USING "more" WHERE ("b".id=1) AND ("b".more_id = "more".id)`);

		s = pgsqlTables.t_log.join('more', '', 'more_id = more.id').where("").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "b" USING "more" WHERE ("b".more_id = "more".id)`);

		s = sqliteTables.t_log.join('more', 'm', 'more_id = m.id').where("id=1").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "s" WHERE rowid IN (SELECT "b".rowid FROM "t_log" AS "b" INNER JOIN "more" AS "m" ON ("b"."more_id" = "m"."id") WHERE ("b"."id"=1))`);

		s = mssqlTables.t_log.join('more', '', 'more_id = more.id').where("id=1").delete();
		assertEquals(s+'', `DELETE "b" FROM "t_log" AS "b" INNER JOIN "more" ON ("b"."more_id" = "more"."id") WHERE ("b"."id"=1)`);

		// One LEFT JOIN:

		s = mysqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").delete();
		assertEquals(s+'', "DELETE `b` FROM `t_log` AS `b` LEFT JOIN `more` ON (`b`.more_id = `more`.id) WHERE (`b`.id=1)");

		s = sqliteOnlyTables.t_log.leftJoin('more', 'm', 'more_id = m.id').where("id=1").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "s" WHERE rowid IN (SELECT "b".rowid FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b"."more_id" = "m"."id") WHERE ("b"."id"=1))`);

		// One LEFT JOIN and one INNER:

		s = mysqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").delete();
		assertEquals(s+'', "DELETE `b` FROM `t_log` AS `b` LEFT JOIN `more` ON (`b`.more_id = `more`.id) INNER JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) WHERE (`b`.id=1)");

		s = sqliteOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "s" WHERE rowid IN (SELECT "b".rowid FROM "t_log" AS "b" LEFT JOIN "more" ON ("b"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("b"."id"=1))`);

		s = mssqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").delete();
		assertEquals(s+'', `DELETE "b" FROM "t_log" AS "b" LEFT JOIN "more" ON ("b"."more_id" = "more"."id") INNER JOIN "more2" AS "m2" ON ("more"."more2_id" = "m2"."id") WHERE ("b"."id"=1)`);

		// Errors:

		let error;
		try
		{	'' + mysqlTables.t_log.where("id=1").groupBy('').delete();
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Cannot DELETE with GROUP BY");

		// leftJoin not supported:

		error = undefined;
		try
		{	'' + mysqlTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").delete();
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "DELETE where the first join is a LEFT JOIN is not supported across all engines. Please use mysqlOnly`...`");

		error = undefined;
		try
		{	'' + pgsqlTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").delete();
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "DELETE where the first join is a LEFT JOIN is not supported on PostgreSQL");

		error = undefined;
		try
		{	'' + pgsqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").delete();
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "DELETE where the first join is a LEFT JOIN is not supported on PostgreSQL");

		error = undefined;
		try
		{	'' + sqliteTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").delete();
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "DELETE where the first join is a LEFT JOIN is not supported across all engines. Please use sqliteOnly`...`");

		error = undefined;
		try
		{	'' + mssqlTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").delete();
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "DELETE where the first join is a LEFT JOIN is not supported across all engines. Please use mssqlOnly`...`");
	}
);

Deno.test
(	'Test sqlTables.insert()',
	async () =>
	{	const ROWS = [{a: 1, b: '2'}, {a: 10, b: '20'}];
		function *itRows(rows: Record<string, any>[])
		{	for (let row of rows)
			{	yield row;
			}
		}

		for (let i=0; i<2; i++)
		{	let s = mysqlTables.t_log.insert(i==0 ? ROWS : itRows(ROWS));
			assertEquals(s+'', "INSERT INTO `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20')");

			s = mysqlOnlyTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'nothing');
			assertEquals(s+'', "INSERT INTO `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20') ON DUPLICATE KEY UPDATE `a`=`a`");

			s = pgsqlOnlyTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'nothing');
			assertEquals(s+'', `INSERT INTO "t_log" ("a", "b") VALUES\n(1,'2'),\n(10,'20') ON CONFLICT DO NOTHING`);

			s = sqliteOnlyTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'nothing');
			assertEquals(s+'', `INSERT INTO "t_log" ("a", "b") VALUES\n(1,'2'),\n(10,'20') ON CONFLICT DO NOTHING`);

			s = mysqlOnlyTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'replace');
			assertEquals(s+'', "REPLACE `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20')");

			s = sqliteOnlyTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'replace');
			assertEquals(s+'', `REPLACE INTO "t_log" ("a", "b") VALUES\n(1,'2'),\n(10,'20')`);

			s = mysqlOnlyTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'update');
			assertEquals(s+'', "INSERT INTO `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20') AS excluded ON DUPLICATE KEY UPDATE `a`=excluded.`a`, `b`=excluded.`b`");

			s = mysqlOnlyTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'patch');
			assertEquals(s+'', "INSERT INTO `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20') AS excluded ON DUPLICATE KEY UPDATE `a`=CASE WHEN excluded.`a` IS NOT NULL AND (`t_log`.`a` IS NULL OR Cast(excluded.`a` AS char) NOT IN ('', '0') OR Cast(`t_log`.`a` AS char) IN ('', '0')) THEN excluded.`a` ELSE `t_log`.`a` END, `b`=CASE WHEN excluded.`b` IS NOT NULL AND (`t_log`.`b` IS NULL OR Cast(excluded.`b` AS char) NOT IN ('', '0') OR Cast(`t_log`.`b` AS char) IN ('', '0')) THEN excluded.`b` ELSE `t_log`.`b` END");

			let error;
			try
			{	'' + mysqlTables.t_log.join('more').insert(i==0 ? ROWS : itRows(ROWS));
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "Cannot INSERT with JOIN");

			error = undefined;
			try
			{	'' + mysqlTables.t_log.where("id=1").insert(i==0 ? ROWS : itRows(ROWS));
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "Cannot INSERT with WHERE");

			error = undefined;
			try
			{	'' + mysqlTables.t_log.insert(i==0 ? [] : itRows([]));
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "0 rows in <${param}>");

			error = undefined;
			try
			{	'' + mysqlOnlyTables.t_log.insert(i==0 ? [] : itRows([]), 'update');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "0 rows in <${param}>");

			error = undefined;
			try
			{	'' + mysqlTables.t_log.insert(i==0 ? [{}] : itRows([{}]));
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "No fields for <${param}>");

			error = undefined;
			try
			{	'' + mysqlTables.t_log.groupBy('').insert(i==0 ? ROWS : itRows(ROWS));
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "Cannot INSERT with GROUP BY");

			error = undefined;
			try
			{	'' + mysqlTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'nothing');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use mysqlOnly`...`");

			error = undefined;
			try
			{	'' + pgsqlTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'nothing');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use pgsqlOnly`...`");

			error = undefined;
			try
			{	'' + sqliteTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'nothing');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use sqliteOnly`...`");

			error = undefined;
			try
			{	'' + mssqlTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'nothing');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported on MS SQL");

			error = undefined;
			try
			{	'' + mysqlTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'replace');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "REPLACE is not supported across all engines. Please use mysqlOnly`...`");

			error = undefined;
			try
			{	'' + sqliteTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'replace');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "REPLACE is not supported across all engines. Please use sqliteOnly`...`");

			error = undefined;
			try
			{	'' + pgsqlTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'replace');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "REPLACE is not supported on PostgreSQL");

			error = undefined;
			try
			{	'' + mssqlTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'replace');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "REPLACE is not supported on MS SQL");

			error = undefined;
			try
			{	'' + mysqlTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'update');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO UPDATE is not supported across all engines. Please use mysqlOnly`...`");

			error = undefined;
			try
			{	'' + pgsqlTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'update');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO UPDATE is not supported on PostgreSQL");

			error = undefined;
			try
			{	'' + sqliteTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'update');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO UPDATE is not supported on SQLite");

			error = undefined;
			try
			{	'' + mssqlTables.t_log.insert(i==0 ? ROWS : itRows(ROWS), 'update');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO UPDATE is not supported on MS SQL");
		}
	}
);

Deno.test
(	'Test sqlTables.insertFrom()',
	async () =>
	{	let s = mysqlTables.t_log.insertFrom(['c1', 'c2'], mysqlTables.t_log_bak.where('').select('cb1, cb2'));
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) SELECT `cb1`, `cb2` FROM `t_log_bak`");

		s = mysqlOnlyTables.t_log.insertFrom(['c1', 'c2'], mysqlTables.t_log_bak.where('id<=100').select('cb1, cb2'), 'nothing');
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) SELECT `cb1`, `cb2` FROM `t_log_bak` WHERE (`id`<=100) ON DUPLICATE KEY UPDATE `c1`=`c1`");

		s = pgsqlOnlyTables.t_log.insertFrom(['c1', 'c2'], mysqlTables.t_log_bak.where('id<=100').select('cb1, cb2'), 'nothing');
		assertEquals(s+'', `INSERT INTO "t_log" ("c1", "c2") SELECT "cb1", "cb2" FROM "t_log_bak" WHERE ("id"<=100) ON CONFLICT DO NOTHING`);

		s = sqliteOnlyTables.t_log.insertFrom(['c1', 'c2'], mysqlTables.t_log_bak.where('id<=100').select('cb1, cb2'), 'nothing');
		assertEquals(s+'', `INSERT INTO "t_log" ("c1", "c2") SELECT "cb1", "cb2" FROM "t_log_bak" WHERE ("id"<=100) ON CONFLICT DO NOTHING`);

		s = mysqlOnlyTables.t_log.insertFrom(['c1', 'c2'], mysqlTables.t_log_bak.where('id<=100').select('cb1, cb2'), 'replace');
		assertEquals(s+'', "REPLACE `t_log` (`c1`, `c2`) SELECT `cb1`, `cb2` FROM `t_log_bak` WHERE (`id`<=100)");

		s = sqliteOnlyTables.t_log.insertFrom(['c1', 'c2'], mysqlTables.t_log_bak.where('id<=100').select('cb1, cb2'), 'replace');
		assertEquals(s+'', `REPLACE INTO "t_log" ("c1", "c2") SELECT "cb1", "cb2" FROM "t_log_bak" WHERE ("id"<=100)`);

		s = mysqlTables.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`);
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) HELLO ALL");

		s = mysqlOnlyTables.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'nothing');
		assertEquals(s+'', "INSERT INTO `t_log` (`c1`, `c2`) HELLO ALL ON DUPLICATE KEY UPDATE `c1`=`c1`");

		let error;
		try
		{	'' + mysqlTables.t_log.join('more').insertFrom(['c1', 'c2'], mysql`HELLO ALL`);
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Cannot INSERT with JOIN");

		error = undefined;
		try
		{	'' + mysqlTables.t_log.where("id=1").insertFrom(['c1', 'c2'], mysql`HELLO ALL`);
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Cannot INSERT with WHERE");

		error = undefined;
		try
		{	'' + mysqlTables.t_log.groupBy('').insertFrom(['c1', 'c2'], mysql`HELLO ALL`);
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Cannot INSERT with GROUP BY");

		error = undefined;
		try
		{	'' + mysqlTables.t_log.insertFrom([], mysql`HELLO ALL`);
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, 'No names for "${param}+"');

		error = undefined;
		try
		{	'' + mysqlTables.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'nothing');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use mysqlOnly`...`");

		error = undefined;
		try
		{	'' + pgsqlTables.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'nothing');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use pgsqlOnly`...`");

		error = undefined;
		try
		{	'' + sqliteTables.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'nothing');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use sqliteOnly`...`");

		error = undefined;
		try
		{	'' + mssqlTables.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'nothing');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported on MS SQL");

		error = undefined;
		try
		{	'' + mssqlOnlyTables.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'nothing');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported on MS SQL");

		error = undefined;
		try
		{	'' + mysqlTables.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'replace');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "REPLACE is not supported across all engines. Please use mysqlOnly`...`");

		error = undefined;
		try
		{	'' + sqliteTables.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'replace');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "REPLACE is not supported across all engines. Please use sqliteOnly`...`");

		error = undefined;
		try
		{	'' + pgsqlTables.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'replace');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "REPLACE is not supported on PostgreSQL");

		error = undefined;
		try
		{	'' + pgsqlOnlyTables.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'replace');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "REPLACE is not supported on PostgreSQL");

		error = undefined;
		try
		{	'' + mssqlTables.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'replace');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "REPLACE is not supported on MS SQL");

		error = undefined;
		try
		{	'' + mssqlOnlyTables.t_log.insertFrom(['c1', 'c2'], mysql`HELLO ALL`, 'replace');
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "REPLACE is not supported on MS SQL");

	}
);

Deno.test
(	'Test sqlTables.truncate()',
	async () =>
	{	let s = mysqlTables.t_log.truncate();
		assertEquals(s+'', "TRUNCATE TABLE `t_log`");

		s = s = pgsqlTables.t_log.truncate();
		assertEquals(s+'', `TRUNCATE TABLE "t_log"`);

		s = s = mssqlTables.t_log.truncate();
		assertEquals(s+'', `TRUNCATE TABLE "t_log"`);

		s = s = sqliteTables.t_log.truncate();
		assertEquals(s+'', `DELETE FROM "t_log"`);

		s = s = sqliteOnlyTables.t_log.truncate();
		assertEquals(s+'', `DELETE FROM "t_log"`);

		let error;
		try
		{	'' + mysqlTables.t_log.join('more').truncate();
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Cannot TRUNCATE with JOIN");

		error = undefined;
		try
		{	'' + mysqlTables.t_log.where("id=1").truncate();
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Cannot TRUNCATE with WHERE");

		error = undefined;
		try
		{	'' + mysqlTables.t_log.groupBy('').truncate();
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Cannot TRUNCATE with GROUP BY");
	}
);
