import { describe, it, expect, vi, beforeEach } from "vitest";
import client from "../../configs/db-config";
import { 
  createFCM_Token, 
  deleteFCM_Token, 
  getFCM_Token, 
  getFCM_Tokens, 
  updateFCM_Token 
} from "../../services/fcm.service";
import APIError from "../../utils/APIError";

vi.mock("../../configs/db-config", () => ({
  default: { query: vi.fn() },
}));

describe("FCM Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new FCM token", async () => {
    const userId = "user123";
    const token = "token123";
    const device_type = "android";

    (client.query as any).mockResolvedValue({ 
      rowCount: 1, 
      rows: [{ 
        id: "1", 
        user_id: userId, 
        token 
      }] 
    });

    const result = await createFCM_Token(userId, token, device_type);

    expect(result).toEqual({ id: "1", user_id: userId, token });
    expect(client.query).toHaveBeenCalledTimes(3); // BEGIN + INSERT + ROLLBACK
  });

  it("should throw APIError if create fails", async () => {
    (client.query as any).mockResolvedValue({ 
      rowCount: 0, 
      rows: [] 
    });

    await expect(createFCM_Token("user123", "token123", "android")).rejects.toBeInstanceOf(APIError);
  });

  it("should delete an FCM token", async () => {
    (client.query as any).mockResolvedValue({ 
      rowCount: 1, 
      rows: [] 
    });

    await expect(deleteFCM_Token("user123", "token123")).resolves.toBeUndefined();
  });

  it("should throw APIError if delete fails", async () => {
    (client.query as any).mockResolvedValue({ 
      rowCount: 0, 
      rows: [] 
    });

    await expect(deleteFCM_Token("user123", "token123")).rejects.toBeInstanceOf(APIError);
  });

  it("should get all FCM tokens", async () => {
    const tokens = [{ token: "token123", device_type: "android" }];
    (client.query as any).mockResolvedValue({ 
      rowCount: tokens.length, 
      rows: tokens 
    });

    const result = await getFCM_Tokens("user123");
    expect(result).toEqual(tokens);
  });

  it("should throw APIError if no tokens found", async () => {
    (client.query as any).mockResolvedValue({ 
      rowCount: 0, 
      rows: [] 
    });

    await expect(getFCM_Tokens("user123")).rejects.toBeInstanceOf(APIError);
  });

  it("should get a single FCM token", async () => {
    const tokenRow = { token: "token123", device_type: "android" };
    (client.query as any).mockResolvedValue({ 
      rowCount: 1, 
      rows: [tokenRow] 
    });

    const result = await getFCM_Token("user123", "token123");
    expect(result).toEqual(tokenRow);
  });

  it("should throw APIError if token not found", async () => {
    (client.query as any).mockResolvedValue({ 
      rowCount: 0, 
      rows: [] 
    });

    await expect(getFCM_Token("user123", "token123")).rejects.toBeInstanceOf(APIError);
  });

  it("should update an FCM token", async () => {
    (client.query as any).mockResolvedValue({ 
      rowCount: 1, 
      rows: [] 
    });

    await expect(updateFCM_Token("user123", "token123", "android")).resolves.toBeUndefined();
  });

  it("should throw APIError if update fails", async () => {
    (client.query as any).mockResolvedValue({ 
      rowCount: 0, 
      rows: [] 
    });

    await expect(updateFCM_Token("user123", "token123", "android")).rejects.toBeInstanceOf(APIError);
  });
});