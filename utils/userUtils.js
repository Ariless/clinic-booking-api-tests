require("dotenv").config();

// Generates a unique patient-shaped user for each test run.
// Uniqueness: Date.now() + random suffix — safe under parallel workers without passing TestInfo.
function generateUser() {
    const id = Date.now();
    const rnd = Math.random().toString(36).slice(2, 10);
    return {
        email: `test_${id}_${rnd}@example.com`,
        name: `user_${id}`,
        password: process.env.TEST_USER_PASSWORD || "password",
    };
}

module.exports = { generateUser };
