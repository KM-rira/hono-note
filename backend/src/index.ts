// https://qiita.com/toshirot/items/06a992af8cf8aca9ff95
import { Hono } from 'hono';
import { Database } from "bun:sqlite";
import { dirname, join, extname } from 'node:path';
import { mkdirSync, createReadStream, existsSync, createWriteStream } from 'node:fs';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { lookup } from "mime-types";
import { createGunzip, createGzip } from "zlib";
import { PassThrough, Readable } from "stream";
import { pipeline } from "stream/promises";
const compressibleExt = new Set([".txt", ".md", ".json", ".csv", ".log", ".html", ".css", ".js", ".ts", ".xml",
]);

const app = new Hono()

const honoNotePrefix = '/hono-note/backend'

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

// app.get('/hono-note', (c: any) => c.redirect('/hono-note/'))
// app.get(`${honoNotePrefix}/`, requireAuth, (c: any) => {
//     return c.html(`
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="UTF-8" />
//   <title>Notes</title>
//   <style>
//     body { font-family: sans-serif; padding: 20px; }
//     .note { border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; }
//     button { padding: 6px 12px; }
//   </style>
// </head>
// <body>
//   <h1>Notes</h1>
//   <a href="/hono-note/logout">ログアウト</a>
//
//   <button onclick="location.href='/hono-note/register'">
//     新規登録
//   </button>
//
//   <form id="uploadForm" style="display:inline-block; margin-left: 12px;">
//     <input id="fileInput" type="file" name="file" />
//     <button type="submit">ファイルアップロード</button>
//   </form>
//
//   <div id="uploadMsg" style="margin-top: 8px;"></div>
//
//   <hr />
//
//   <h2>Files</h2>
//   <div id="fileList"></div>
//
//   <hr />
//
//   <h2>Notes</h2>
//   <div id="list"></div>
//
//   <script>
//     async function loadList() {
//       const res = await fetch('/hono-note/note/list');
//       if (!res.ok) {
//         console.error('note list failed', res.status);
//         return;
//       }
//       const data = await res.json();
//
//       const listDiv = document.getElementById('list');
//       listDiv.innerHTML = '';
//
//       data.forEach(note => {
//         const div = document.createElement('div');
//         div.className = 'note';
//         div.innerHTML = \`
//           <h3>\${note.title}</h3>
//           <small>Updated: \${note.updatedAt}</small><br/>
//           <small>Created: \${note.createdAt}</small><br/>
//           <a href="/hono-note/edit?id=\${note.id}">編集</a>
//         \`;
//         listDiv.appendChild(div);
//       });
//     }
//
//     async function loadFileList() {
//       const res = await fetch('/hono-note/file/list');
//       if (!res.ok) {
//         console.error('file list failed', res.status);
//         return;
//       }
//       const data = await res.json();
//
//       const fileListDiv = document.getElementById('fileList');
//       fileListDiv.innerHTML = '';
//
//       data.forEach(file => {
//         const div = document.createElement('div');
//         div.className = 'note';
//         div.innerHTML = \`
//           <strong>\${file.originalFileName}</strong><br />
//           <small>Created: \${file.createdAt}</small><br />
//         <a href="/hono-note/download?id=\${file.id}">ダウンロード</a>
//         \`;
//         fileListDiv.appendChild(div);
//       });
//     }
//
//     const uploadForm = document.getElementById('uploadForm');
//     const uploadMsg = document.getElementById('uploadMsg');
//
//     uploadForm.addEventListener('submit', async (e) => {
//       e.preventDefault();
//
//       const fileInput = document.getElementById('fileInput');
//       if (!fileInput.files || fileInput.files.length === 0) {
//         uploadMsg.textContent = 'ファイルを選択してください';
//         return;
//       }
//
//       const fd = new FormData();
//       fd.append('file', fileInput.files[0]);
//
//       const res = await fetch('/hono-note/upload', {
//         method: 'POST',
//         body: fd
//       });
//
//       if (res.ok) {
//         uploadMsg.textContent = '✅ アップロード成功';
//         fileInput.value = '';
//         await loadFileList(); // ★ここで更新
//       } else {
//         const text = await res.text();
//         uploadMsg.textContent = '❌ 失敗: ' + text;
//       }
//     });
//
//     loadList();
//     loadFileList();
//   </script>
// </body>
// </html>
//   `);
// });

app.post(`${honoNotePrefix}/upload`, requireAuth, async (c: any) => {
    console.log("Upload endpoint hit");
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
    const extention = extname(file.name).toLowerCase();
    const shouldCompress = compressibleExt.has(extention) && file.size >= 1024;
    const saveFileName = `${uuid}${extention}.gz`
    const uploadFilePath = join(filesDir, saveFileName)
    const inStream = (file as any).stream();
    const { Readable } = await import("stream");
    const nodeReadable = Readable.fromWeb(inStream)
    console.log({ name: file.name, ext: extention, size: file.size, shouldCompress });
    if (shouldCompress) {
        const gzip = createGzip({ level: 6 })
        await pipeline(nodeReadable, gzip, createWriteStream(uploadFilePath));
    } else {
        await pipeline(nodeReadable, createWriteStream(uploadFilePath));
    }


    doQuery(
        `INSERT INTO ${filesTable} (saveFileName, originalFileName,  updatedAt, createdAt)
       VALUES (?, ?, ?, ?)`,
        [saveFileName, file.name, now, now]
    );

    return c.json({
        message: 'success',
        filename: file.name,
        size: file.size,
        compressed: shouldCompress,
    })
});

// app.get(`${honoNotePrefix}/register`, requireAuth, (c: any) => {
//     console.log("register page hit");
//     return c.html(`
// <!DOCTYPE html>
// <html>
// <head>
// <meta charset="UTF-8" />
// <title>Register</title>
// </head>
// <body>
// <h1>新規登録</h1>
//
// <form id="registerForm">
//   <div>
//     <input name="title" placeholder="タイトル" />
//   </div>
//   <div>
//     <textarea name="body" placeholder="本文"></textarea>
//   </div>
//   <button type="submit">登録</button>
// </form>
//
// <br />
// <a href="/hono-note/">戻る</a>
//
// <script>
// const form = document.getElementById('registerForm');
//
// form.addEventListener('submit', async (e) => {
//   e.preventDefault();
//
//   const formData = new FormData(form);
//
//   const res = await fetch('/hono-note/backend/register', {
//     method: 'POST',
//     body: formData
//   });
//
//   const data = await res.json();
//
//   if (data.success) {
//     alert('✅ 登録成功');
//     window.location.href = '/hono-note/';
//   } else {
//     alert('❌ ' + (data.message || '登録失敗'));
//   }
// });
// </script>
//
// </body>
// </html>
//   `);
// });

app.get(`${honoNotePrefix}/note/list`, requireAuth, (c: any) => {
    console.log("note list hit");
    const res = doQuery(`SELECT * FROM ${notesTable} ORDER BY updatedAt DESC`);
    return c.json(res);
})

app.get(`${honoNotePrefix}/file/list`, requireAuth, (c: any) => {
    console.log("file list hit");
    const res = doQuery(`SELECT * FROM ${filesTable} ORDER BY updatedAt DESC`);
    return c.json(res);
})

app.get(`${honoNotePrefix}/download`, requireAuth, (c: any) => {
    console.log("download hit");

    const idStr = c.req.query("id");
    const id = Number(idStr);

    if (!idStr || Number.isNaN(id)) {
        return c.text("not found id", 400);
    }

    const rows = doQuery(`SELECT * FROM ${filesTable} WHERE id = ?`, [id]) as any[];
    if (!rows || rows.length === 0) {
        return c.text("File not found", 404);
    }

    const file = rows[0];

    console.log("download target:", {
        id: file.id,
        originalFileName: file.originalFileName,
        saveFileName: file.saveFileName,
        isCompressed: file.isCompressed,
    });

    const filesDir = join(__dirname, "..", "uploadFiles");
    const saveFilePath = join(filesDir, String(file.saveFileName));

    if (!existsSync(saveFilePath)) {
        return c.text("file missing on server", 404);
    }

    const originalName = String(file.originalFileName ?? "download.bin");
    const encoded = encodeURIComponent(originalName);
    const guessed = lookup(originalName);
    const contentType =
        typeof guessed === "string" ? guessed : "application/octet-stream";

    c.header("Content-Type", contentType);
    c.header(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encoded}`
    );

    const isCompressed = Number(file.isCompressed) === 1;

    if (!isCompressed) {
        const src = createReadStream(saveFilePath);
        return c.body(Readable.toWeb(src) as any);
    }

    const src = createReadStream(saveFilePath);
    const gunzip = createGunzip();
    const out = new PassThrough();

    src.pipe(gunzip).pipe(out);

    src.on("error", (err) => {
        console.error("src error:", err);
        out.destroy(err);
    });

    gunzip.on("error", (err) => {
        console.error("gunzip error:", err);
        out.destroy(err);
    });

    return c.body(Readable.toWeb(out) as any);
});

app.post(`${honoNotePrefix}/register`, requireAuth, async (c: any) => {
    console.log("register post hit");
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
    console.log("update post hit");
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

// app.get(`${honoNotePrefix}/edit`, requireAuth, (c: any) => {
//     const idStr = c.req.query('id');
//     const id = Number(idStr);
//
//     if (!idStr || Number.isNaN(id)) {
//         return c.html('not found id', 400);
//     }
//
//     // ここで1件取る（doQueryはSELECTなら配列を返す前提）
//     const rows = doQuery(`SELECT * FROM ${notesTable} WHERE id = ?`, [id]) as any[];
//     const note = rows[0];
//
//     if (!note) {
//         return c.html('note not found', 404);
//     }
//
//     return c.html(`
// <!DOCTYPE html>
// <html>
// <head>
//   <meta charset="UTF-8" />
//   <title>Edit</title>
// </head>
// <body>
// <h1>編集 (id=${note.id})</h1>
//
// <form id="editForm">
//   <input type="hidden" name="id" value="${note.id}" />
//   <div>
//     <input name="title" placeholder="タイトル" value="${escapeHtml(note.title ?? '')}" />
//   </div>
//   <div>
//     <textarea name="body" placeholder="本文">${escapeHtml(note.body ?? '')}</textarea>
//   </div>
//   <button type="submit">更新</button>
// </form>
//
// <br/>
// <a href="/hono-note/">戻る</a>
//
// <script>
// const form = document.getElementById('editForm');
//
// form.addEventListener('submit', async (e) => {
//   e.preventDefault();
//
//   const formData = new FormData(form);
//
//   const res = await fetch('/hono-note/update', {
//     method: 'POST',
//     body: formData
//   });
//
//   const data = await res.json();
//
//   if (data.success) {
//     alert('✅ 更新成功');
//     window.location.href = '/hono-note/';
//   } else {
//     alert('❌ ' + (data.message || '更新失敗'));
//   }
// });
//
// </script>
//
// </body>
// </html>
//   `);
// });

app.get(`${honoNotePrefix}/note/detail`, requireAuth, (c: any) => {
    console.log("note detail get hit");
    const idStr = c.req.query("id");
    const id = Number(idStr);

    if (!idStr || Number.isNaN(id)) {
        return c.json({ success: false, message: "not found id" }, 400);
    }

    const rows = doQuery(`SELECT * FROM ${notesTable} WHERE id = ?`, [id]) as any[];
    const note = rows[0];

    if (!note) {
        return c.json({ success: false, message: "note not found" }, 404);
    }

    return c.json({
        success: true,
        note: {
            id: note.id,
            title: note.title ?? "",
            body: note.body ?? "",
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
        },
    });
});


// app.get(`${honoNotePrefix}/login`, (c: any) => {
//     console.log("login get hit");
//     return c.html(`
//   <!DOCTYPE html>
//   <html>
//   <head>
//     <meta charset="UTF-8" />
//     <title>Login</title>
//   </head>
//   <body>
//     <h1>ログイン</h1>
//
//     <form method="post" action="/hono-note/login">
//       <div>
//         <input name="username" placeholder="ユーザー名" />
//       </div>
//       <div>
//         <input type="password" name="password" placeholder="パスワード" />
//       </div>
//       <button type="submit">ログイン</button>
//     </form>
//
//   </body>
//   </html>
//   `);
// });

app.post(`${honoNotePrefix}/login`, async (c: any) => {
    const body = await c.req.parseBody();
    const username = body.username?.toString();
    const password = body.password?.toString();

    const authUser = process.env.AUTH_USERNAME ?? "admin";
    const authPass = process.env.AUTH_PASSWORD ?? "password";

    if (username === authUser && password === authPass) {
        setCookie(c, "session", "ok", {
            httpOnly: true,
            path: "/",
        });

        return c.json({ success: true });
    }

    return c.json({ success: false, message: "ログイン失敗" }, 401);
});

app.get(`${honoNotePrefix}/logout`, (c: any) => {
    console.log("logout get hit");
    deleteCookie(c, 'session');
    return c.redirect('/hono-note/frontend/login');
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
    console.log("requireAuth hit");
    const session = getCookie(c, 'session');
    if (session === 'ok') {
        return next();
    }
    return c.redirect('/hono-note/login');
}
