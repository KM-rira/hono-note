import { useEffect, useState } from "react";

type NoteDetail = {
    id: number;
    title: string;
    body: string;
    createdAt: string;
    updatedAt: string;
};

export default function EditNotePage() {
    const [note, setNote] = useState<NoteDetail | null>(null);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        const loadNote = async () => {
            try {
                const params = new URLSearchParams(window.location.search);
                const id = params.get("id");

                if (!id) {
                    setMessage("id がありません");
                    setLoading(false);
                    return;
                }

                const res = await fetch(`/hono-note/backend/note/detail?id=${id}`, {
                    credentials: "include",
                });

                const data = await res.json();

                if (!res.ok || !data.success) {
                    setMessage(data.message || "取得失敗");
                    setLoading(false);
                    return;
                }

                setNote(data.note);
                setTitle(data.note.title);
                setBody(data.note.body);
            } catch (error) {
                console.error(error);
                setMessage("取得中にエラーが発生しました");
            } finally {
                setLoading(false);
            }
        };

        void loadNote();
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!note) return;

        try {
            setSaving(true);
            setMessage("");

            const fd = new FormData();
            fd.append("id", String(note.id));
            fd.append("title", title);
            fd.append("body", body);

            const res = await fetch("/hono-note/update", {
                method: "POST",
                body: fd,
                credentials: "include",
            });

            const data = await res.json();

            if (res.ok && data.success) {
                alert("✅ 更新成功");
                window.location.href = "/hono-note/frontend/";
            } else {
                setMessage(data.message || "更新失敗");
            }
        } catch (error) {
            console.error(error);
            setMessage("更新中にエラーが発生しました");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div style={{ padding: 20 }}>読み込み中...</div>;
    }

    if (!note) {
        return <div style={{ padding: 20 }}>❌ {message || "note not found"}</div>;
    }

    return (
        <div style={{ fontFamily: "sans-serif", padding: 20 }}>
            <h1>編集 (id={note.id})</h1>

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 12 }}>
                    <input
                        name="title"
                        placeholder="タイトル"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={{ width: 300, padding: 8 }}
                    />
                </div>

                <div style={{ marginBottom: 12 }}>
                    <textarea
                        name="body"
                        placeholder="本文"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        style={{ width: 500, height: 200, padding: 8 }}
                    />
                </div>

                <button type="submit" disabled={saving}>
                    {saving ? "更新中..." : "更新"}
                </button>
            </form>

            {message && <div style={{ marginTop: 12, color: "red" }}>❌ {message}</div>}

            <br />
            <a href="/hono-note/frontend/">戻る</a>
        </div>
    );
}
