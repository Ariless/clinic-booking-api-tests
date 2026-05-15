export function authHeader(token: string) {
    return { headers: { Authorization: `Bearer ${token}` } };
}
