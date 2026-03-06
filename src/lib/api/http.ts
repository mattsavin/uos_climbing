export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
        ...(!isFormData && { 'Content-Type': 'application/json' }),
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

    if (!res.ok) {
        const err: any = new Error(data?.error || `API Request Failed (${res.status})`);
        err.status = res.status;
        err.data = data;
        throw err;
    }
    return data;
}