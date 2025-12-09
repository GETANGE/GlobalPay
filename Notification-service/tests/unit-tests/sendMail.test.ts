import { describe, it, expect , vi, beforeEach } from "vitest";
import nodemailer from "nodemailer";
import { sendMail } from "../../utils/email";

// Mock environment variables
process.env.MAIL_USERNAME = "test@example.com";
process.env.MAIL_PASSWORD = "password123";

// Mock nodemailer
const sendMailMock = vi.fn();
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: sendMailMock,
    })),
  },
}));

describe("sendMail", () => {
  beforeEach(() => {
    sendMailMock.mockReset();
  });
  
  it("should create transporter with correct config", async () => {
    sendMailMock.mockResolvedValue({ response: "OK" });

    await sendMail({
      from: "GlobalPay",
      email: "user@example.com",
      subject: "Hello",
      name: "John Doe",
      message: "Welcome",
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
    });
  });
  
  it("should call sendMail with correct mail options", async () => {
    sendMailMock.mockResolvedValue({ messageId: "msg123" });

    await sendMail({
      from: "GlobalPay",
      email: "user@example.com",
      subject: "Test Subject",
      name: "John",
      message: "Test message",
      otp: 123456,
    });

    const callArg = sendMailMock.mock.calls[0][0];

    expect(callArg.to).toBe("user@example.com");
    expect(callArg.subject).toBe("Test Subject");
    expect(callArg.html).toContain("Hello John");
    expect(callArg.html).toContain("Test message");
    expect(callArg.html).toContain("123456");
    expect(callArg.from).toEqual({
      name: "GlobalPay",
      address: process.env.MAIL_USERNAME,
    });
  });
  
  it("should return expected result structure", async () => {
    const fakeResponse = { messageId: "XYZ123" };
    sendMailMock.mockResolvedValue(fakeResponse);

    const result = await sendMail({
      from: "GlobalPay",
      email: "a@b.com",
      subject: "Welcome",
      name: "User",
      message: "Hello",
    });

    expect(result).toEqual({
      message: "💌 Email sent successfully",
      info: fakeResponse,
    });
  });
});

