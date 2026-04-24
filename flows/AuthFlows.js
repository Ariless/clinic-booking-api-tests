const {AuthClient} = require("../api/AuthClient");

async function loginDoctor(request, doctor) {
    const auth = new AuthClient(request);

    const { status, body } = await auth.verifyLogin(
        doctor.email,
        doctor.password
    );

    if (status !== 200) throw new Error("Doctor login failed");

    return body.token;
}

module.exports = {
    loginDoctor
};