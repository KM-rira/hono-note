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
import { redis, connectRedis, redisStatusLog } from "./lib/redis";
import { randomUUID } from "node:crypto";
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
await connectRedis();
redisStatusLog();

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

app.get(`${honoNotePrefix}/me`, requireAuth, async (c: any) => {
    const user = c.get("user");
    return c.json({ success: true, user });
});

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

const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24時間
const SESSION_COOKIE_NAME = "session_id";
app.post(`${honoNotePrefix}/login`, async (c: any) => {
    console.log("login post hit");
    redisStatusLog
    const body = await c.req.parseBody();
    const username = body.username?.toString();
    const password = body.password?.toString();

    const authUser = process.env.AUTH_USERNAME ?? "admin";
    const authPass = process.env.AUTH_PASSWORD ?? "password";

    if (username !== authUser || password !== authPass) {
        return c.json({ success: false, message: "ログイン失敗" }, 401);
    }

    const sessionId = randomUUID();
    const sessionData = { username, createdAt: new Date().toISOString() };

    await redis.set(
        `session:${sessionId}`,
        JSON.stringify(sessionData),
        {
            EX: SESSION_TTL_SECONDS,
        }
    );

    setCookie(c, SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        sameSite: 'Lax',
        maxAge: SESSION_TTL_SECONDS,
    });
    return c.json({ success: true, message: "ログイン成功" });
});


app.post(`${honoNotePrefix}/logout`, (c: any) => {
    console.log("logout get hit");
    redisStatusLog();
    console.log("redis connected", {
        isOpen: redis.isOpen,
        isReady: redis.isReady,
    });
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    if (sessionId) {
        redis.del(`session:${sessionId}`);
    }
    deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
    return c.json({ success: true });
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

const COOKIE_NAME = "session_id"
const SESSION_PREFIX = "session:"

async function requireAuth(c: any, next: any) {
    const sid = getCookie(c, COOKIE_NAME)

    console.log("requireAuth", {
        cookieHeader: c.req.header("cookie"),
        sid,
    })

    if (!sid) {
        return c.json({ success: false, message: "セッション切れ(cookieなし)" }, 401)
    }

    const key = `${SESSION_PREFIX}${sid}`
    const session = await redis.get(key)

    console.log("requireAuth redis", {
        key,
        session,
        ttl: await redis.ttl(key),
    })

    if (!session) {
        return c.json({ success: false, message: "セッション切れ(redisなし)" }, 401)
    }

    c.set("user", session)
    await next()
}
