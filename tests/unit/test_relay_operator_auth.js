const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { isRelayOperator, createOperatorAuth, DEFAULT_OPERATOR_EMAILS } = require("../../lib/relayOperatorAuth");

describe("relay operator allowlist", () => {
  it("admits the founder email and github knoxmortis by default", () => {
    assert.equal(isRelayOperator({ email: "J.Donavon.Love@gmail.com" }), true);
    assert.equal(isRelayOperator({
      email: "other@example.com",
      identities: [{ provider: "github", identity_data: { user_name: "Knoxmortis" } }],
    }), true);
  });

  it("rejects everyone else", () => {
    assert.equal(isRelayOperator({ email: "stranger@example.com" }), false);
    assert.equal(isRelayOperator({
      email: "stranger@example.com",
      identities: [{ provider: "github", identity_data: { user_name: "notknox" } }],
    }), false);
    assert.equal(isRelayOperator(null), false);
  });

  it("env allowlist replaces default emails", () => {
    const env = { RELAY_OPERATOR_EMAILS: "alex@veilcorp.example", RELAY_OPERATOR_HANDLES: "none" };
    assert.equal(isRelayOperator({ email: "j.donavon.love@gmail.com" }, env), false);
    assert.equal(isRelayOperator({ email: "alex@veilcorp.example" }, env), true);
  });
});

describe("requireOperator", () => {
  it("fails closed without a VeilLink bearer token", async () => {
    const auth = createOperatorAuth({
      env: { RELAY_OPERATOR_EMAILS: DEFAULT_OPERATOR_EMAILS.join(",") },
      fetchUser: async () => ({ email: "j.donavon.love@gmail.com", id: "1" }),
    });
    await assert.rejects(() => auth.requireOperator({ headers: {} }), /UNAUTHORIZED/);
  });

  it("forbids a valid VeilLink user who is not Knoxmortis", async () => {
    const auth = createOperatorAuth({
      fetchUser: async () => ({ email: "fan@example.com", id: "2" }),
    });
    await assert.rejects(
      () => auth.requireOperator({ headers: { authorization: "Bearer veil-token" } }),
      /OPERATOR_FORBIDDEN/,
    );
  });

  it("admits an injected Knoxmortis operator used by tests", async () => {
    const auth = createOperatorAuth();
    const operator = await auth.requireOperator({
      relayOperator: { email: "j.donavon.love@gmail.com", id: "knox" },
    });
    assert.equal(operator.email, "j.donavon.love@gmail.com");
  });
});
