import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendSMS } from "../../utils/sms";

// Mock logger
vi.mock("../../utils/logger", () => ({
  default: {
    error: vi.fn(),
  },
}));

// Create a single mock and make Africastalking return it
const sendMock = vi.fn();
vi.mock("africastalking", () => ({
  default: () => ({
    SMS: {
      send: sendMock,
    },
  }),
}));

describe("sendSMS", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("should send an SMS successfully", async () => {
    const mockResponse = { SMSMessageData: { Message: "Sent" } };
    sendMock.mockResolvedValue(mockResponse);

    const result = await sendSMS("+254712345678", "Hello test");

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      to: ["+254712345678"],
      message: "Hello test",
    });
    expect(result).toEqual(mockResponse);
  });

  it("should include 'from' when provided", async () => {
    const mockResponse = { SMSMessageData: { Message: "Sent" } };
    sendMock.mockResolvedValue(mockResponse);

    await sendSMS("+254712345678", "Hello test", "GlobalPay");

    expect(sendMock).toHaveBeenCalledWith({
      to: ["+254712345678"],
      message: "Hello test",
      from: "GlobalPay",
    });
  });

  it("should throw APIError on failure", async () => {
    sendMock.mockRejectedValue(new Error("Network issue"));

    await expect(sendSMS("+254712345678", "Hello")).rejects.toMatchObject({
      message: "Error sending SMS",
      statusCode: 400,
      status: "fail",
    });
  });
});
