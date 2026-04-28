const { BaseClient } = require("./BaseClient");
const { endpoints } = require("../data/testData");

class UserClient extends BaseClient {
  async registerPatient({ email, password = "password", name = "Test Patient" }) {
    const response = await this.postJson(endpoints.authRegister, {
      email,
      password,
      name,
      role: "patient",
    });
    return this.parseResponse(response);
  }

  async registerDoctor({ email, password = "password", name = "Test Doctor", doctorRecordId }) {
    const response = await this.postJson(endpoints.authRegister, {
      email,
      password,
      name,
      role: "doctor",
      doctorRecordId,
    });
    return this.parseResponse(response);
  }

  async deleteMyAccount(accessToken) {
    const response = await this.deleteWithBearer(endpoints.authMe, accessToken);
    const status = response.status();
    if (status === 204) {
      return { status };
    }
    const body = await response.json().catch(() => ({}));
    return { status, body };
  }
}

module.exports = { UserClient };
