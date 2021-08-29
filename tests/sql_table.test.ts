import {mysql, pgsql, sqlite} from '../sql.ts';
import {SqlSettings, SqlMode} from '../sql_settings.ts';
import
{	mysqlTables, mysqlOnlyTables,
	pgsqlTables, pgsqlOnlyTables,
	sqliteTables, sqliteOnlyTables,
	mssqlTables, mssqlOnlyTables,
} from '../sql_table.ts';
import {assert, assertEquals} from "https://deno.land/std@0.97.0/testing/asserts.ts";

Deno.test
(	'Table name must be a string',
	async () =>
	{	let error;
		try
		{	mysqlTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be a string");

		error = undefined;
		try
		{	mysqlOnlyTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be a string");

		error = undefined;
		try
		{	pgsqlTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be a string");

		error = undefined;
		try
		{	pgsqlOnlyTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be a string");

		error = undefined;
		try
		{	sqliteTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be a string");

		error = undefined;
		try
		{	sqliteOnlyTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be a string");

		error = undefined;
		try
		{	mssqlTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be a string");

		error = undefined;
		try
		{	mssqlOnlyTables[Symbol.iterator as any];
		}
		catch (e)
		{	error = e;
		}
		assertEquals(error?.message, "Table name must be a string");
	}
);

Deno.test
(	'sqlTables SELECT',
	async () =>
	{	const TABLE = 'Hello `All`!';
		assertEquals(mysqlTables[TABLE].table_name, TABLE);

		let s = mysqlTables[TABLE].where("id=1").select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `Hello ``All``!` WHERE (`id`=1)");

		s = mysqlTables[TABLE].where(mysql`name = '${'Untitled'}'`).select("col1*2, Count(*)");
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `Hello ``All``!` WHERE (`name` = 'Untitled')");

		s = mysqlTables[TABLE].where("").select(mysql`col1*2, Count(*)`);
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `Hello ``All``!`");

		let error;
		try
		{	mysqlTables[TABLE].select("col1*2, Count(*)");
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

		s = mysqlTables.t_log.where("").groupBy('g1, g2', 'hello IS NULL').select();
		assertEquals(s+'', "SELECT * FROM `t_log` GROUP BY `g1`, `g2` HAVING (`hello` IS NULL)");

		s = mysqlTables.t_log.join('meta', '', 'meta_id = meta.id').where("").groupBy(mysql`g1, meta.g2`, mysql`hello IS NULL`).select();
		assertEquals(s+'', "SELECT * FROM `t_log` AS `b` INNER JOIN `meta` ON (`b`.meta_id = `meta`.id) GROUP BY `b`.g1, `meta`.g2 HAVING (`hello` IS NULL)");

		s = mysqlTables.t_log.where("").select("col1*2, Count(*)", "position_major DESC, position_minor");
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `t_log` ORDER BY `position_major` DESC, `position_minor`");

		s = mysqlTables.t_log.where("").select(mysql`col1*2, Count(*)`, mysql`position_major DESC, position_minor`);
		assertEquals(s+'', "SELECT `col1`*2, Count(*) FROM `t_log` ORDER BY `position_major` DESC, `position_minor`");

		s = mysqlTables.t_log.where("").select("", "", 0, 10);
		assertEquals(s+'', "SELECT * FROM `t_log` LIMIT 1, 10");

		s = mysqlTables.t_log.where("").select("", "", 1, 11);
		assertEquals(s+'', "SELECT * FROM `t_log` LIMIT 2, 11");

		s = mysqlTables.t_log.where("").select("", "", 10);
		assertEquals(s+'', "SELECT * FROM `t_log` LIMIT 11, 2147483647");
	}
);

Deno.test
(	'SQL sqlTables UPDATE',
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
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" AS "m" WHERE ("b".id=1) AND ("b".more_id = "m".id)`);

		s = mssqlTables.t_log.join('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" INNER JOIN "more" ON ("b".more_id = "more".id) WHERE ("b".id=1)`);

		// One LEFT JOIN:

		s = mysqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `b` LEFT JOIN `more` ON (`b`.more_id = `more`.id) SET `b`.`message`='Message 1' WHERE (`b`.id=1)");

		s = sqliteOnlyTables.t_log.leftJoin('more', 'm', 'more_id = m.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "s" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b".more_id = "m".id) WHERE ("b".id=1) AND "s".ROWID = "b".ROWID`);

		s = sqliteOnlyTables.t_log.leftJoin('more', 'm', 'more_id = m.id').where('').update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "s" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b".more_id = "m".id) WHERE "s".ROWID = "b".ROWID`);

		s = sqliteOnlyTables.t_log.leftJoin('more', 'm', 'more_id = m.id').join('s').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "subj" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b".more_id = "m".id) CROSS JOIN "s" WHERE ("b".id=1) AND "subj".ROWID = "b".ROWID`);

		s = sqliteOnlyTables.t_log.leftJoin('more', 'm', 'more_id = m.id').join('s').join('subj').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "subj_table" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b".more_id = "m".id) CROSS JOIN "s" CROSS JOIN "subj" WHERE ("b".id=1) AND "subj_table".ROWID = "b".ROWID`);

		s = sqliteOnlyTables.t_log.leftJoin('more', 'm', 'more_id = m.id').join('s').join('subj').join('subj_table').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "_subj_table" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b".more_id = "m".id) CROSS JOIN "s" CROSS JOIN "subj" CROSS JOIN "subj_table" WHERE ("b".id=1) AND "_subj_table".ROWID = "b".ROWID`);

		s = mssqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" ON ("b".more_id = "more".id) WHERE ("b".id=1)`);

		// One LEFT JOIN and one INNER:

		s = mysqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `b` LEFT JOIN `more` ON (`b`.more_id = `more`.id) INNER JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) SET `b`.`message`='Message 1' WHERE (`b`.id=1)");

		s = sqliteOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "s" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" ON ("b".more_id = "more".id) INNER JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) WHERE ("b".id=1) AND "s".ROWID = "b".ROWID`);

		s = mssqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" LEFT JOIN "more" ON ("b".more_id = "more".id) INNER JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) WHERE ("b".id=1)`);

		// Two INNER JOINs:

		s = mysqlTables.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `b` INNER JOIN `more` ON (`b`.more_id = `more`.id) INNER JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) SET `b`.`message`='Message 1' WHERE (`b`.id=1)");

		s = pgsqlTables.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" INNER JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) WHERE ("b".id=1) AND ("b".more_id = "more".id)`);

		s = sqliteTables.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" INNER JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) WHERE ("b".id=1) AND ("b".more_id = "more".id)`);

		s = sqliteTables.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" INNER JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) WHERE ("b".more_id = "more".id)`);

		s = mssqlTables.t_log.join('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" INNER JOIN "more" ON ("b".more_id = "more".id) INNER JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) WHERE ("b".id=1)`);

		// One INNER JOIN, one LEFT and one CROSS (and maybe one more INNER):

		s = mysqlTables.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', 'm2', 'more.more2_id = m2.id').join('more3').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', "UPDATE `t_log` AS `b` INNER JOIN `more` ON (`b`.more_id = `more`.id) LEFT JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) CROSS JOIN `more3` SET `b`.`message`='Message 1' WHERE (`b`.id=1)");

		s = pgsqlTables.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', 'm2', 'more.more2_id = m2.id').join('more3').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" LEFT JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) CROSS JOIN "more3" WHERE ("b".id=1) AND ("b".more_id = "more".id)`);

		s = sqliteTables.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', '', 'more.more2_id = more2.id').join('more3', 'm3').join('more4', '', 'more3.more4_id = more4.id').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" AS "b" SET "message"='Message 1' FROM "more" LEFT JOIN "more2" ON ("more".more2_id = "more2".id) CROSS JOIN "more3" AS "m3" INNER JOIN "more4" ON ("more3".more4_id = "more4".id) WHERE ("b".id=1) AND ("b".more_id = "more".id)`);

		s = mssqlTables.t_log.join('more', '', 'more_id = more.id').leftJoin('more2', 'm2', 'more.more2_id = m2.id').join('more3').where("id=1").update({message: "Message 1"});
		assertEquals(s+'', `UPDATE "t_log" SET "message"='Message 1' FROM "t_log" AS "b" INNER JOIN "more" ON ("b".more_id = "more".id) LEFT JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) CROSS JOIN "more3" WHERE ("b".id=1)`);

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
(	'SQL mysqlTables DELETE',
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
		assertEquals(s+'', `DELETE FROM "t_log" AS "s" WHERE ROWID IN (SELECT "b".ROWID FROM "t_log" AS "b" INNER JOIN "more" AS "m" ON ("b".more_id = "m".id) WHERE ("b".id=1))`);

		s = mssqlTables.t_log.join('more', '', 'more_id = more.id').where("id=1").delete();
		assertEquals(s+'', `DELETE "b" FROM "t_log" AS "b" INNER JOIN "more" ON ("b".more_id = "more".id) WHERE ("b".id=1)`);

		// One LEFT JOIN:

		s = mysqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').where("id=1").delete();
		assertEquals(s+'', "DELETE `b` FROM `t_log` AS `b` LEFT JOIN `more` ON (`b`.more_id = `more`.id) WHERE (`b`.id=1)");

		s = sqliteOnlyTables.t_log.leftJoin('more', 'm', 'more_id = m.id').where("id=1").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "s" WHERE ROWID IN (SELECT "b".ROWID FROM "t_log" AS "b" LEFT JOIN "more" AS "m" ON ("b".more_id = "m".id) WHERE ("b".id=1))`);

		// One LEFT JOIN and one INNER:

		s = mysqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").delete();
		assertEquals(s+'', "DELETE `b` FROM `t_log` AS `b` LEFT JOIN `more` ON (`b`.more_id = `more`.id) INNER JOIN `more2` AS `m2` ON (`more`.more2_id = `m2`.id) WHERE (`b`.id=1)");

		s = sqliteOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").delete();
		assertEquals(s+'', `DELETE FROM "t_log" AS "s" WHERE ROWID IN (SELECT "b".ROWID FROM "t_log" AS "b" LEFT JOIN "more" ON ("b".more_id = "more".id) INNER JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) WHERE ("b".id=1))`);

		s = mssqlOnlyTables.t_log.leftJoin('more', '', 'more_id = more.id').join('more2', 'm2', 'more.more2_id = m2.id').where("id=1").delete();
		assertEquals(s+'', `DELETE "b" FROM "t_log" AS "b" LEFT JOIN "more" ON ("b".more_id = "more".id) INNER JOIN "more2" AS "m2" ON ("more".more2_id = "m2".id) WHERE ("b".id=1)`);

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
(	'SQL mysqlTables INSERT',
	async () =>
	{	const ROWS = [{a: 1, b: '2'}, {a: 10, b: '20'}];
		function *it_rows(rows: Record<string, any>[])
		{	for (let row of rows)
			{	yield row;
			}
		}

		for (let i=0; i<2; i++)
		{	let s = mysqlTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS));
			assertEquals(s+'', "INSERT INTO `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20')");

			s = mysqlOnlyTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'nothing');
			assertEquals(s+'', "INSERT INTO `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20') ON DUPLICATE KEY UPDATE `a`=`a`");

			s = pgsqlOnlyTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'nothing');
			assertEquals(s+'', `INSERT INTO "t_log" ("a", "b") VALUES\n(1,'2'),\n(10,'20') ON CONFLICT DO NOTHING`);

			s = sqliteOnlyTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'nothing');
			assertEquals(s+'', `INSERT INTO "t_log" ("a", "b") VALUES\n(1,'2'),\n(10,'20') ON CONFLICT DO NOTHING`);

			s = mysqlOnlyTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'replace');
			assertEquals(s+'', "REPLACE `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20')");

			s = sqliteOnlyTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'replace');
			assertEquals(s+'', `REPLACE INTO "t_log" ("a", "b") VALUES\n(1,'2'),\n(10,'20')`);

			s = mysqlOnlyTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'update');
			assertEquals(s+'', "INSERT INTO `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20') AS excluded ON DUPLICATE KEY UPDATE `a`=excluded.`a`, `b`=excluded.`b`");

			s = mysqlOnlyTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'patch');
			assertEquals(s+'', "INSERT INTO `t_log` (`a`, `b`) VALUES\n(1,'2'),\n(10,'20') AS excluded ON DUPLICATE KEY UPDATE `a`=CASE WHEN excluded.`a` IS NOT NULL AND (`t_log`.`a` IS NULL OR Cast(excluded.`a` AS char) NOT IN ('', '0') OR Cast(`t_log`.`a` AS char) IN ('', '0')) THEN excluded.`a` ELSE `t_log`.`a` END, `b`=CASE WHEN excluded.`b` IS NOT NULL AND (`t_log`.`b` IS NULL OR Cast(excluded.`b` AS char) NOT IN ('', '0') OR Cast(`t_log`.`b` AS char) IN ('', '0')) THEN excluded.`b` ELSE `t_log`.`b` END");

			let error;
			try
			{	'' + mysqlTables.t_log.join('more').insert(i==0 ? ROWS : it_rows(ROWS));
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "Cannot INSERT with JOIN");

			error = undefined;
			try
			{	'' + mysqlTables.t_log.where("id=1").insert(i==0 ? ROWS : it_rows(ROWS));
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "Cannot INSERT with WHERE");

			error = undefined;
			try
			{	'' + mysqlTables.t_log.insert(i==0 ? [] : it_rows([]));
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "0 rows in <${param}>");

			error = undefined;
			try
			{	'' + mysqlOnlyTables.t_log.insert(i==0 ? [] : it_rows([]), 'update');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "0 rows in <${param}>");

			error = undefined;
			try
			{	'' + mysqlTables.t_log.insert(i==0 ? [{}] : it_rows([{}]));
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "No fields for <${param}>");

			error = undefined;
			try
			{	'' + mysqlTables.t_log.groupBy('').insert(i==0 ? ROWS : it_rows(ROWS));
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "Cannot INSERT with GROUP BY");

			error = undefined;
			try
			{	'' + mysqlTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'nothing');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use mysqlOnly`...`");

			error = undefined;
			try
			{	'' + pgsqlTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'nothing');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use pgsqlOnly`...`");

			error = undefined;
			try
			{	'' + sqliteTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'nothing');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported across all engines. Please use sqliteOnly`...`");

			error = undefined;
			try
			{	'' + mssqlTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'nothing');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO NOTHING is not supported on MS SQL");

			error = undefined;
			try
			{	'' + mysqlTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'replace');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "REPLACE is not supported across all engines. Please use mysqlOnly`...`");

			error = undefined;
			try
			{	'' + sqliteTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'replace');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "REPLACE is not supported across all engines. Please use sqliteOnly`...`");

			error = undefined;
			try
			{	'' + pgsqlTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'replace');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "REPLACE is not supported on PostgreSQL");

			error = undefined;
			try
			{	'' + mssqlTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'replace');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "REPLACE is not supported on MS SQL");

			error = undefined;
			try
			{	'' + mysqlTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'update');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO UPDATE is not supported across all engines. Please use mysqlOnly`...`");

			error = undefined;
			try
			{	'' + pgsqlTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'update');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO UPDATE is not supported on PostgreSQL");

			error = undefined;
			try
			{	'' + sqliteTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'update');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO UPDATE is not supported on SQLite");

			error = undefined;
			try
			{	'' + mssqlTables.t_log.insert(i==0 ? ROWS : it_rows(ROWS), 'update');
			}
			catch (e)
			{	error = e;
			}
			assertEquals(error?.message, "ON CONFLICT DO UPDATE is not supported on MS SQL");
		}
	}
);
