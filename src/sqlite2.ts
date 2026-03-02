// https://qiita.com/toshirot/items/06a992af8cf8aca9ff95
import { Database } from "bun:sqlite";
// データベースファイルの名前を指定
const dbFileName = 'test-3.sqlite';
// テーブルの名前を指定
const tableName = 'dogs';
// 新しいデータベースインスタンスを作成し、ファイルが存在しない場合はデータベースファイルを作成
const db = new Database(dbFileName, { create: true });
// テーブルが存在しない場合はテーブルを作成
doQuery(`CREATE TABLE IF NOT EXISTS ${tableName} (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)`);
doQuery(`INSERT INTO ${tableName} (name, age) VALUES ('Buddy', 1)`);
doQuery(`INSERT INTO ${tableName} (name, age) VALUES ('Charlie', 2)`);
doQuery(`SELECT * FROM ${tableName}`);

function doQuery(sql) {
    const query = db.query(sql);
    query.run();
    let res = query.values();
    if(res) console.log(res);
}
