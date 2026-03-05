export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {})
    };

    const res = await fetch(endpoint, { ...options, headers, credentials: 'include' });
    const text = await res.text();
    let data: any = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            if (!res.ok) {
                throw new Error(`API Request Failed (${res.status})`);
            }
            return text;
        }
    }

    if (!res.ok) throw new Error(data?.error || `API Request Failed (${res.status})`);
    return data;
}