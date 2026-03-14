import { useState } from "react";

export default function RegisterNotePage() {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append("title", title);
            formData.append("body", body);

            const res = await fetch("/hono-note/backend/register", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (data.success) {
                alert("✅ 登録成功");
                window.location.href = "/hono-note/frontend/";
            } else {
                alert("❌ " + (data.message || "登録失敗"));
            }
        } catch (error) {
            console.error("register error:", error);
            alert("❌ 通信エラー");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1>新規登録</h1>

            <form onSubmit={handleSubmit}>
                <div>
                    <input
                        name="title"
                        placeholder="タイトル"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>

                <div>
                    <textarea
                        name="body"
                        placeholder="本文"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                    />
                </div>

                <button type="submit" disabled={loading}>
                    {loading ? "登録中..." : "登録"}
                </button>
            </form>

            <br />
            <a href="/hono-note/frontend/">戻る</a>
        </div>
    );
}
