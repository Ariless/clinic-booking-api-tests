function authHeader(token) {
    return { headers: { Authorization: `Bearer ${token}` } };
}

module.exports = { authHeader };