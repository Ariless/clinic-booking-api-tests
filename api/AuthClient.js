const { endpoints } = require("../data/testData");
const { BaseClient } = require("./BaseClient");

class AuthClient extends BaseClient {
  async verifyLogin(email, password) {
    const response = await this.postJson(endpoints.login, { email, password });
    return this.parseResponse(response);
  }
}

module.exports = { AuthClient };
