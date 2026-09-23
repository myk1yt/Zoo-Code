import { GLOBAL_STATE_KEYS, SECRET_STATE_KEYS, isSecretStateKey } from "../index.js"

describe("secret state key registration", () => {
	it("registers mimoApiKey and poeApiKey as secret state keys", () => {
		// Regression: these keys were missing from SECRET_STATE_KEYS, so
		// checkExistKey rejected configured MiMo/Poe profiles and the webview
		// bounced to the welcome screen; values were also persisted in
		// plaintext globalState instead of secret storage.
		expect(SECRET_STATE_KEYS).toContain("mimoApiKey")
		expect(SECRET_STATE_KEYS).toContain("poeApiKey")
		expect(isSecretStateKey("mimoApiKey")).toBe(true)
		expect(isSecretStateKey("poeApiKey")).toBe(true)
	})

	it("excludes secret keys from the global state key list", () => {
		expect(GLOBAL_STATE_KEYS).not.toContain("mimoApiKey")
		expect(GLOBAL_STATE_KEYS).not.toContain("poeApiKey")
	})
})
