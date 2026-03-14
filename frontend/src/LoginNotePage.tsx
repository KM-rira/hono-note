import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const fd = new FormData();
        fd.append("username", username);
        fd.append("password", password);

        const res = await fetch("/hono-note/backend/login", {
            method: "POST",
            body: fd,
            credentials: "include",
        });

        if (res.ok) {
            navigate("/");
            return;
        }

        const text = await res.text();
        setMessage(text || "ログイン失敗");
    };

    return (
        <div style={{ padding: 20 }}>
            <h1>ログイン</h1>

            <form onSubmit={handleSubmit} autoComplete="on">
                <div>
                    <input
                        type="text"
                        name="username"
                        autoComplete="username"
                        placeholder="ユーザー名"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </div>

                <div>
                    <input
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        placeholder="パスワード"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <button type="submit">ログイン</button>
            </form>

            {message && <p style={{ color: "red" }}>{message}</p>}
        </div>
    );
}
