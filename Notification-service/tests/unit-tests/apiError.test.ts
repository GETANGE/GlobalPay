import { describe, it, expect } from "vitest";
import APIError from "../../utils/APIError";

describe("APIError", () => {
  it("should create an instance of Error", () => {
    const err = new APIError("Something went wrong", 500);

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(APIError);
  });

  it("should set message and statusCode correctly", () => {
    const err = new APIError("Not Found", 404);

    expect(err.message).toBe("Not Found");
    expect(err.statusCode).toBe(404);
  });

  it("should set status to 'fail' for 4xx errors", () => {
    const err = new APIError("Bad Request", 400);

    expect(err.status).toBe("fail");
  });

  it("should set status to 'error' for non-4xx errors", () => {
    const err = new APIError("Server Error", 500);

    expect(err.status).toBe("error");
  });

  it("should set isOperational to true", () => {
    const err = new APIError("Test error", 418);

    expect(err.isOperational).toBe(true);
  });

  it("should capture the stack trace", () => {
    const err = new APIError("Trace test", 500);

    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("APIError");
  });
});