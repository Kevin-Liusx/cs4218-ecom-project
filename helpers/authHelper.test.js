// Dong Cheng-Yu, A0262348B
import { hashPassword, comparePassword } from "./authHelper";

describe("authHelper", () => {
  it("should hash a password and validate it with comparePassword", async () => {
    const password = "mySecret123!";

    const hashed = await hashPassword(password);
    const isMatch = await comparePassword(password, hashed);

    expect(typeof hashed).toBe("string");
    expect(hashed).not.toBe(password);
    expect(isMatch).toBe(true);
  });

  it("should return false when comparing an incorrect password", async () => {
    const password = "rightPass";
    const wrongPassword = "wrongPass";
    const hashed = await hashPassword(password);

    const isMatch = await comparePassword(wrongPassword, hashed);

    expect(isMatch).toBe(false);
  });

  it("should log an error and return undefined if hashPassword fails", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation(() => {});

    const result = await hashPassword(undefined);

    expect(result).toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
