class BaseClient {
  constructor(request) {
    this.request = request;
  }

  async parseResponse(response) {
    const body = await response.json();
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
