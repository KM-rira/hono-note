import { Database } from "bun:sqlite";
// データベースファイルの名前を指定
const dbFileName = 'test-1.sqlite';
// テーブルの名前を指定
const tableName = 'dogs';
// 新しいデータベースインスタンスを作成し、ファイルが存在しない場合はデータベースファイルを作成
const db = new Database(dbFileName, { create: true });
// テーブルが存在しない場合はテーブルを作成
const query1 = db.query('CREATE TABLE IF NOT EXISTS ' + tableName + ' (Id INTEGER PRIMARY KEY, Name VARCHAR(255), CreatedAt TIMESTAMP)');
query1.run();
// データをテーブルに挿入 p.s. id重複考慮してないので2件目は++してね
const query2 = db.query('INSERT OR IGNORE INTO ' + tableName + ' VALUES (1, "pochi", CURRENT_TIMESTAMP)');
query2.run();
// テーブルからデータを取得
const query3 = db.query('SELECT * FROM ' + tableName + ';');
query3.run();
// 取得した結果を配列で表示
console.log(query3.values());

