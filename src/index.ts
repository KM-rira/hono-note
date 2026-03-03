// https://qiita.com/toshirot/items/06a992af8cf8aca9ff95
import { Hono } from 'hono';
import { Database } from "bun:sqlite";
import { dirname, join, extname } from 'node:path';
import { mkdirSync, createReadStream, existsSync } from 'node:fs';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { writeFile } from 'node:fs/promises';
import { lookup } from "mime-types";

const app = new Hono()

const honoNotePrefix = '/hono-note'

// このファイルの絶対パス基準
const __dirname = dirname(import.meta.path);

// hono-note/db/note.sqlite
const dbDir = join(__dirname, "..", "db");
const dbPath = join(dbDir, "note.sqlite");
const filesDir = join(__dirname, "..", "uploadFiles");

mkdirSync(dbDir, { recursive: true });
console.log("Useing DB:", dbPath);
mkdirSync(filesDir, { recursive: true });
console.log("Files Dir:", filesDir);

// 新しいデータベースインスタンスを作成し、ファイルが存在しない場合はデータベースファイルを作成
const db = new Database(dbPath, { create: true });

// テーブルの名前を指定
const notesTable = 'notes';
const filesTable = 'files';

doQuery(`CREATE TABLE IF NOT EXISTS ${notesTable} (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, body TEXT, updatedAt TEXT, createdAt TEXT)`);
doQuery(`CREATE TABLE IF NOT EXISTS ${filesTable} (id INTEGER PRIMARY KEY AUTOINCREMENT, saveFileName TEXT, originalFileName TEXT, updatedAt TEXT, createdAt TEXT)`);
let resNotes = doQuery(`SELECT * FROM ${notesTable}`);
console.log("Notes:");
console.log(resNotes);
let resFiles = doQuery(`SELECT * FROM ${filesTable}`);
console.log("Files:");
console.log(resFiles);

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

app.get(`${honoNotePrefix}/health`, (c: any) => {
    return c.text('Hello Hono!')
})

app.get('/hono-note', (c: any) => c.redirect('/hono-note/'))
app.get(`${honoNotePrefix}/`, requireAuth, (c: any) => {
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
  <a href="/hono-note/logout">ログアウト</a>

  <button onclick="location.href='/hono-note/register'">
    新規登録
  </button>

  <form id="uploadForm" style="display:inline-block; margin-left: 12px;">
    <input id="fileInput" type="file" name="file" />
    <button type="submit">ファイルアップロード</button>
  </form>

  <div id="uploadMsg" style="margin-top: 8px;"></div>

  <hr />

  <h2>Files</h2>
  <div id="fileList"></div>

  <hr />

  <h2>Notes</h2>
  <div id="list"></div>

  <script>
    async function loadList() {
      const res = await fetch('/hono-note/note/list');
      if (!res.ok) {
        console.error('note list failed', res.status);
        return;
      }
      const data = await res.json();

      const listDiv = document.getElementById('list');
      listDiv.innerHTML = '';

      data.forEach(note => {
        const div = document.createElement('div');
        div.className = 'note';
        div.innerHTML = \`
          <h3>\${note.title}</h3>
          <small>Updated: \${note.updatedAt}</small><br/>
          <small>Created: \${note.createdAt}</small><br/>
          <a href="/hono-note/edit?id=\${note.id}">編集</a>
        \`;
        listDiv.appendChild(div);
      });
    }

    async function loadFileList() {
      const res = await fetch('/hono-note/file/list');
      if (!res.ok) {
        console.error('file list failed', res.status);
        return;
      }
      const data = await res.json();

      const fileListDiv = document.getElementById('fileList');
      fileListDiv.innerHTML = '';

      data.forEach(file => {
        const div = document.createElement('div');
        div.className = 'note';
        div.innerHTML = \`
          <strong>\${file.originalFileName}</strong><br />
          <small>Created: \${file.createdAt}</small><br />
        <a href="/hono-note/download?id=\${file.id}">ダウンロード</a>
        \`;
        fileListDiv.appendChild(div);
      });
    }

    const uploadForm = document.getElementById('uploadForm');
    const uploadMsg = document.getElementById('uploadMsg');

    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fileInput = document.getElementById('fileInput');
      if (!fileInput.files || fileInput.files.length === 0) {
        uploadMsg.textContent = 'ファイルを選択してください';
        return;
      }

      const fd = new FormData();
      fd.append('file', fileInput.files[0]);

      const res = await fetch('/hono-note/upload', {
        method: 'POST',
        body: fd
      });

      if (res.ok) {
        uploadMsg.textContent = '✅ アップロード成功';
        fileInput.value = '';
        await loadFileList(); // ★ここで更新
      } else {
        const text = await res.text();
        uploadMsg.textContent = '❌ 失敗: ' + text;
      }
    });

    loadList();
    loadFileList();
  </script>
</body>
</html>
  `);
});

app.post(`${honoNotePrefix}/upload`, requireAuth, async (c: any) => {
    const body = await c.req.parseBody()
    const now = new Date().toISOString();
    const file = body['file']
    console.log(file)
    if (!(file instanceof File)) {
        return c.json({ message: 'not found file' }, 400)
    }

    console.log(`file name: ${file.name}`)
    console.log(`file size: ${file.size} bytes`)

    const uuid = crypto.randomUUID();
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const extention = extname(file.name)
    const saveFileName = `${uuid}${extention}`
    const uploadFilePath = join(filesDir, saveFileName)
    await writeFile(uploadFilePath, buffer)
    console.log("uploadFilePath :", uploadFilePath)

    doQuery(
        `INSERT INTO ${filesTable} (saveFileName, originalFileName,  updatedAt, createdAt)
       VALUES (?, ?, ?, ?)`,
        [saveFileName, file.name, now, now]
    );

    return c.json({
        message: 'success',
        filename: file.name,
        size: file.size
    })
});

app.get(`${honoNotePrefix}/register`, requireAuth, (c: any) => {
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
<a href="/hono-note/">戻る</a>

<script>
const form = document.getElementById('registerForm');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(form);

  const res = await fetch('/hono-note/register', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();

  if (data.success) {
    alert('✅ 登録成功');
    window.location.href = '/hono-note/';
  } else {
    alert('❌ ' + (data.message || '登録失敗'));
  }
});
</script>

</body>
</html>
  `);
});

app.get(`${honoNotePrefix}/note/list`, requireAuth, (c: any) => {
    const res = doQuery(`SELECT * FROM ${notesTable} ORDER BY updatedAt DESC`);
    return c.json(res);
})


app.get(`${honoNotePrefix}/file/list`, requireAuth, (c: any) => {
    const res = doQuery(`SELECT * FROM ${filesTable} ORDER BY updatedAt DESC`);
    return c.json(res);
})

app.get(`${honoNotePrefix}/download`, requireAuth, (c: any) => {
    const idStr = c.req.query('id');
    const id = Number(idStr);

    if (!idStr || Number.isNaN(id)) {
        return c.html('not found id', 400);
    }

    // ここで1件取る（doQueryはSELECTなら配列を返す前提）
    const rows = doQuery(`SELECT * FROM ${filesTable} WHERE id = ?`, [id]) as any[];
    if (!rows || rows.length === 0) return c.text("File not found", 404);
    const file = rows[0];
    const filesDir = join(__dirname, "..", "uploadFiles");
    const saveFilePath = join(filesDir, String(file.saveFileName));

    if (!existsSync(saveFilePath)) {
        return c.text("file missing on server", 404)
    }

    const stream = createReadStream(saveFilePath);
    const name = String(file.originalFileName ?? "download.bin");
    const encoded = encodeURIComponent(name);
    const guessed = lookup(name)
    const contentType = typeof guessed === "string" ? guessed : "application/octet-stream"

    c.header("Content-Type", contentType);
    c.header("Content-Disposition", `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);

    return c.body(stream as any);
})

app.post(`${honoNotePrefix}/register`, requireAuth, async (c: any) => {
    try {
        const body = await c.req.parseBody();
        const now = new Date().toISOString();

        if (!body.title || !body.body) {
            return c.json({ success: false, message: '入力不足です' }, 400);
        }

        doQuery(
            `INSERT INTO ${notesTable} (title, body, createdAt, updatedAt)
       VALUES (?, ?, ?, ?)`,
            [body.title, body.body, now, now]
        );

        return c.json({ success: true });
    } catch (e) {
        return c.json({ success: false, message: 'サーバーエラー' }, 500);
    }
});

app.post(`${honoNotePrefix}/update`, requireAuth, async (c: any) => {
    try {
        const body = await c.req.parseBody();
        const now = new Date().toISOString();
        const id = Number(body.id)

        if (!body.title || !body.body || !Number.isFinite(id)) {
            return c.json({ success: false, message: '入力不足です' }, 400);
        }

        doQuery(
            `UPDATE ${notesTable} SET title = ?, body = ?, updatedAt = ? WHERE ID = ?`,
            [body.title, body.body, now, id]
        );

        return c.json({ success: true });
    } catch (e) {
        return c.json({ success: false, message: 'サーバーエラー' }, 500);
    }
});

app.get(`${honoNotePrefix}/edit`, requireAuth, (c: any) => {
    const idStr = c.req.query('id');
    const id = Number(idStr);

    if (!idStr || Number.isNaN(id)) {
        return c.html('not found id', 400);
    }

    // ここで1件取る（doQueryはSELECTなら配列を返す前提）
    const rows = doQuery(`SELECT * FROM ${notesTable} WHERE id = ?`, [id]) as any[];
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
<a href="/hono-note/">戻る</a>

<script>
const form = document.getElementById('editForm');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(form);

  const res = await fetch('/hono-note/update', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();

  if (data.success) {
    alert('✅ 更新成功');
    window.location.href = '/hono-note/';
  } else {
    alert('❌ ' + (data.message || '更新失敗'));
  }
});

</script>

</body>
</html>
  `);
});

app.get(`${honoNotePrefix}/login`, (c: any) => {
    return c.html(`
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Login</title>
  </head>
  <body>
    <h1>ログイン</h1>

    <form method="post" action="/hono-note/login">
      <div>
        <input name="username" placeholder="ユーザー名" />
      </div>
      <div>
        <input type="password" name="password" placeholder="パスワード" />
      </div>
      <button type="submit">ログイン</button>
    </form>

  </body>
  </html>
  `);
});

app.post(`${honoNotePrefix}/login`, async (c: any) => {
    console.log("ENV CHECK", {
        bunUser: Bun.env.AUTH_USERNAME,
        procUser: process.env.AUTH_USERNAME,
    });
    const body = await c.req.parseBody();
    const username = body.username?.toString();
    const password = body.password?.toString();

    // 環境変数がなければデフォルト値
    const authUser = process.env.AUTH_USERNAME ?? 'admin';
    const authPass = process.env.AUTH_PASSWORD ?? 'password';

    if (username === authUser && password === authPass) {
        setCookie(c, 'session', 'ok', {
            httpOnly: true,
            path: '/',
        });

        return c.redirect('/hono-note/');
    }

    return c.html('ログイン失敗', 401);
});

app.get(`${honoNotePrefix}/logout`, (c: any) => {
    deleteCookie(c, 'session');
    return c.redirect('/hono-note/login');
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

const port = Number(9010)
export default {
    port,
    fetch: app.fetch
}

function requireAuth(c: any, next: any) {
    const session = getCookie(c, 'session');
    if (session === 'ok') {
        return next();
    }
    return c.redirect('/hono-note/login');
}
