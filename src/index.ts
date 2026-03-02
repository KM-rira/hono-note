// https://qiita.com/toshirot/items/06a992af8cf8aca9ff95
import { Hono } from 'hono'
import { Database } from "bun:sqlite";
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const app = new Hono()


// このファイルの絶対パス基準
const __dirname = dirname(import.meta.path);

// hono-note/db/note.sqlite
const dbDir = join(__dirname, "..", "db");
const dbPath = join(dbDir, "note.sqlite");

mkdirSync(dbDir, { recursive: true });
console.log("Useing DB:", dbPath);

// 新しいデータベースインスタンスを作成し、ファイルが存在しない場合はデータベースファイルを作成
const db = new Database(dbPath, { create: true });

// テーブルの名前を指定
const tableName = 'notes';

doQuery(`CREATE TABLE IF NOT EXISTS ${tableName} (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, body TEXT, updatedAt TEXT, createdAt TEXT)`);
let res = doQuery(`SELECT * FROM ${tableName}`);
console.log(res);

function escapeHtml(s: string): string {
    return s
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

type Note = {
    id: number;
    title: string;
    body: string;
    updatedAt: string;
    createdAt: string;
}

app.get('/health', (c) => {
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
              <a href="/edit?id=\${note.id}">編集</a>
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
<a href="/">戻る</a>

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

app.post('/update', async (c) => {
    try {
        const body = await c.req.parseBody();
        const now = new Date().toISOString();

        if (!body.title || !body.body) {
            return c.json({ success: false, message: '入力不足です' }, 400);
        }

        doQuery(
            `UPDATE ${tableName} SET title = ?, body = ?, updatedAt = ? WHERE ID = ?`,
            [body.title, body.body, now, body.id]
        );

        return c.json({ success: true });
    } catch (e) {
        return c.json({ success: false, message: 'サーバーエラー' }, 500);
    }
});

app.get('/edit', (c) => {
    const idStr = c.req.query('id');
    const id = Number(idStr);

    if (!idStr || Number.isNaN(id)) {
        return c.html('not found id', 400);
    }

    // ここで1件取る（doQueryはSELECTなら配列を返す前提）
    const rows = doQuery(`SELECT * FROM ${tableName} WHERE id = ?`, [id]) as any[];
    const note = rows[0];

    if (!note) {
        return c.html('note not found', 404);
    }

    return c.html(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Edit</title>
</head>
<body>
<h1>編集 (id=${note.id})</h1>

<form id="editForm">
  <input type="hidden" name="id" value="${note.id}" />
  <div>
    <input name="title" placeholder="タイトル" value="${escapeHtml(note.title ?? '')}" />
  </div>
  <div>
    <textarea name="body" placeholder="本文">${escapeHtml(note.body ?? '')}</textarea>
  </div>
  <button type="submit">更新</button>
</form>

<br/>
<a href="/">戻る</a>

<script>
const form = document.getElementById('editForm');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(form);

  const res = await fetch('/update', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();

  if (data.success) {
    alert('✅ 更新成功');
    window.location.href = '/';
  } else {
    alert('❌ ' + (data.message || '更新失敗'));
  }
});

</script>

</body>
</html>
  `);
});

function doQuery<T = unknown>(sql: string, params: any[] = []): T {
    const query = db.query(sql);
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT');

    if (isSelect) {
        return query.all(...params) as T;
    } else {
        query.run(...params);
        return { success: true } as T;
    }
}

export default app
