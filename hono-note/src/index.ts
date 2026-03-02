// https://qiita.com/toshirot/items/06a992af8cf8aca9ff95
import { Hono } from 'hono'
import { Database } from "bun:sqlite";
// データベースファイルの名前を指定
const dbFileName = 'note.sqlite';
// テーブルの名前を指定
const tableName = 'notes';
// 新しいデータベースインスタンスを作成し、ファイルが存在しない場合はデータベースファイルを作成
const db = new Database(dbFileName, { create: true });
doQuery(`CREATE TABLE IF NOT EXISTS ${tableName} (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, body TEXT, updatedAt TIMESTAMP, createdAt TIMESTAMP)`);
let res = doQuery(`SELECT * FROM ${tableName}`);
console.log(res);

const app = new Hono()

app.get('/', (c) => {
    return c.text('Hello Hono!')
})

app.get('/list', (c) => {
    const res = doQuery(`SELECT * FROM ${tableName}`);
    return c.text(res)
})


app.post('/register', async (c) => {
    const { title, body } = await c.req.json();
    const now = new Date().toISOString();

    console.log(`${title}, ${body}`)
    const sql = `INSERT INTO ${tableName} (title, body, UpdatedAt, CreatedAt) VALUES (?, ?, ?, ?)`;
    let res = doQuery(sql, [title, body, now, now])
    console.log("SQL SUCCESS:", res)
    return c.text(`OK`)
})

function doQuery(sql: string, params: any[] = []): string {
    const query = db.query(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const res = query.all(...params);
        return JSON.stringify(res);
    } else {
        query.run(...params);
        return JSON.stringify({ success: true });
    }
}

export default app
