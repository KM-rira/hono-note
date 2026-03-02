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

app.get('/helth', (c) => {
    return c.text('Hello Hono!')
})

app.get('/', (c) => {
    return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Notes</title>
      <style>
        body { font-family: sans-serif; padding: 20px; }
        .note { border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; }
        button { padding: 6px 12px; }
      </style>
    </head>
    <body>
      <h1>Notes</h1>

      <button onclick="location.href='/register'">
        新規登録
      </button>

      <hr />

      <div id="list"></div>

      <script>
        async function loadList() {
          const res = await fetch('/list');
          const data = await res.json();
          console.log("result:",data)

          const listDiv = document.getElementById('list');
          listDiv.innerHTML = '';

          data.forEach(note => {
            const div = document.createElement('div');
            div.className = 'note';
            div.innerHTML = \`
              <h3>\${note.title}</h3>
              <small>Updated: \${note.updatedAt}</small>
              <small>Created: \${note.createdAt}</small>
            \`;
            listDiv.appendChild(div);
          });
        }

        loadList();
      </script>
    </body>
    </html>
  `);
});

app.get('/register', (c) => {
    return c.html(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>Register</title>
</head>
<body>
<h1>新規登録</h1>

<form id="registerForm">
  <div>
    <input name="title" placeholder="タイトル" />
  </div>
  <div>
    <textarea name="body" placeholder="本文"></textarea>
  </div>
  <button type="submit">登録</button>
</form>

<br />
<a href="/index">戻る</a>

<script>
const form = document.getElementById('registerForm');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(form);

  const res = await fetch('/register', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();

  if (data.success) {
    alert('✅ 登録成功');
    window.location.href = '/';
  } else {
    alert('❌ ' + (data.message || '登録失敗'));
  }
});
</script>

</body>
</html>
  `);
});

app.get('/list', (c) => {
    const res = doQuery(`SELECT * FROM ${tableName}`);
    return c.json(res);
})

app.post('/register', async (c) => {
    try {
        const body = await c.req.parseBody();
        const now = new Date().toISOString();

        if (!body.title || !body.body) {
            return c.json({ success: false, message: '入力不足です' }, 400);
        }

        doQuery(
            `INSERT INTO ${tableName} (title, body, createdAt, updatedAt)
       VALUES (?, ?, ?, ?)`,
            [body.title, body.body, now, now]
        );

        return c.json({ success: true });
    } catch (e) {
        return c.json({ success: false, message: 'サーバーエラー' }, 500);
    }
});

function doQuery(sql: string, params: any[] = []): unknown {
    const query = db.query(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return query.all(...params);
    } else {
        query.run(...params);
        return JSON.stringify({ success: true });
    }
}

export default app
