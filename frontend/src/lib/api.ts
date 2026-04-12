export async function apiFetch(url: string, options: RequestInit = {}) {
    const defaultOptions: RequestInit = {
        credentials: "include",
        ...options,
    };

    const response = await fetch(url, defaultOptions);

    if (response.status === 401) {
        // セッション切れの場合、ログインページへリダイレクト
        // BrowserRouterのbasenameを考慮したパスを指定
        window.location.href = "/hono-note/frontend/login";
        throw new Error("Session expired. Redirecting to login...");
    }

    return response;
}
