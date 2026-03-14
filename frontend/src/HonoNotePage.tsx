import { useEffect, useState } from "react";

type Note = {
    id: number;
    title: string;
    updatedAt: string;
    createdAt: string;
};

type FileItem = {
    id: number;
    originalFileName: string;
    createdAt: string;
};

export default function HonoNotePage() {
    console.log("HonoNotePage hit");
    const [notes, setNotes] = useState<Note[]>([]);
    const [files, setFiles] = useState<FileItem[]>([]);
    const [uploadMsg, setUploadMsg] = useState("");
    const [uploading, setUploading] = useState(false);

    const loadList = async () => {
        try {
            const res = await fetch("/hono-note/backend/note/list", {
                credentials: "include",
            });

            if (!res.ok) {
                console.error("note list failed", res.status);
                return;
            }

            const data = await res.json();
            setNotes(data);
        } catch (error) {
            console.error("note list error", error);
        }
    };

    const loadFileList = async () => {
        try {
            const res = await fetch("/hono-note/backend/file/list", {
                credentials: "include",
            });

            if (!res.ok) {
                console.error("file list failed", res.status);
                return;
            }

            const data = await res.json();
            setFiles(data);
        } catch (error) {
            console.error("file list error", error);
        }
    };

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const form = e.currentTarget;
        const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;

        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            setUploadMsg("ファイルを選択してください");
            return;
        }

        try {
            setUploading(true);
            setUploadMsg("");

            const fd = new FormData();
            fd.append("file", fileInput.files[0]);

            const res = await fetch("/hono-note/backend/upload", {
                method: "POST",
                body: fd,
                credentials: "include",
            });

            if (res.ok) {
                setUploadMsg("✅ アップロード成功");
                form.reset();
                await loadFileList();
            } else {
                const text = await res.text();
                setUploadMsg("❌ 失敗: " + text);
            }
        } catch (error) {
            console.error(error);
            setUploadMsg("❌ アップロード中にエラーが発生しました");
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        void loadList();
        void loadFileList();
    }, []);

    return (
        <div style={{ fontFamily: "sans-serif", padding: 20 }}>
            <h1>Notes</h1>

            <a href="/hono-note/backend/logout">ログアウト</a>

            <div style={{ marginTop: 12 }}>
                <button onClick={() => (window.location.href = "/hono-note/frontend/register")}>
                    新規登録
                </button>

                <form
                    onSubmit={handleUpload}
                    style={{ display: "inline-block", marginLeft: 12 }}
                >
                    <input type="file" name="file" />
                    <button type="submit" disabled={uploading} style={{ marginLeft: 8 }}>
                        {uploading ? "アップロード中..." : "ファイルアップロード"}
                    </button>
                </form>

                <div style={{ marginTop: 8 }}>{uploadMsg}</div>
            </div>

            <hr />

            <h2>Files</h2>
            <div>
                {files.map((file) => (
                    <div
                        key={file.id}
                        style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}
                    >
                        <strong>{file.originalFileName}</strong>
                        <br />
                        <small>Created: {file.createdAt}</small>
                        <br />
                        <a href={`/hono-note/backend/download?id=${file.id}`}>ダウンロード</a>
                    </div>
                ))}
            </div>

            <hr />

            <h2>Notes</h2>
            <div>
                {notes.map((note) => (
                    <div
                        key={note.id}
                        style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}
                    >
                        <h3>{note.title}</h3>
                        <small>Updated: {note.updatedAt}</small>
                        <br />
                        <small>Created: {note.createdAt}</small>
                        <br />
                        <a href={`/hono-note/frontend/edit/${note.id}`}>編集</a>
                    </div>
                ))}
            </div>
        </div>
    );
}
