class BaseClient {
  constructor(request) {
    this.request = request;
  }

  async parseResponse(response) {
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    return { status: response.status(), body };
  }

  async postJson(path, body, extraHeaders = {}) {
    return this.request.post(path, {
      data: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...extraHeaders,
      },
    });
  }

  async deleteWithBearer(path, accessToken) {
    return this.request.delete(path, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
}

module.exports = { BaseClient };
