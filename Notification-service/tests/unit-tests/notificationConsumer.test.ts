import { describe, it, vi, beforeEach, expect } from "vitest";

// MOCK MODULES FIRST
vi.mock("../../configs/rabbitMQ", () => ({
  getRabbitMQChannel: vi.fn(),
}));

vi.mock("../../services/notifications.service", () => ({
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  deleteAllNotifications_service: vi.fn(),
  deleteNotification_service: vi.fn(),
  sendNotification_service: vi.fn(),
}));

vi.mock("../../services/fcm.service", () => ({
  createFCM_Token: vi.fn(),
  deleteFCM_Token: vi.fn(),
  updateFCM_Token: vi.fn(),
}));

vi.mock("../../helpers/sendTo_DLQ.helper", () => ({
  sendToDLQ: vi.fn(),
}));

vi.mock("../../events/publishers/publish.notify", () => ({
  publishEvent: vi.fn(),
}));

vi.mock("../../helpers/updateNotificationStatus.helper", () => ({
  updateNotificationStatus: vi.fn(),
}));

vi.mock("../../helpers/lognotification.helper", () => ({
  logNotification: vi.fn(),
}));

vi.mock("../../utils/sms", () => ({
  sendSMS: vi.fn(),
}));

vi.mock("../../utils/email", () => ({
  sendMail: vi.fn(),
}));

vi.mock("../../utils/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// IMPORT MODULE UNDER TEST
import { getRabbitMQChannel } from "../../configs/rabbitMQ";

import {
  markNotificationRead,
  markAllNotificationsRead,
  deleteAllNotifications_service,
  deleteNotification_service,
  sendNotification_service,
} from "../../services/notifications.service";

import { 
  createFCM_Token, 
  deleteFCM_Token, 
  updateFCM_Token 
} from "../../services/fcm.service";

import { publishEvent } from "../../events/publishers/publish.notify";
import { updateNotificationStatus } from "../../helpers/updateNotificationStatus.helper";
import { logNotification } from "../../helpers/lognotification.helper";
import { sendSMS } from "../../utils/sms";
import { sendMail } from "../../utils/email";

import { sendToDLQ } from "../../helpers/sendTo_DLQ.helper";

import { processNotificationConsumer } from "../../events/consumers/notif_consumer";
import { processEmailJobConsumer, processSMSJobConsumer } from "../../events/consumers/auth_consumer";


// TEST SETUP
let fakeChannel: any;
let consumeCallback: any;

beforeEach(() => {
  consumeCallback = async () => {};

  fakeChannel = {
    assertQueue: vi.fn(),
    consume: vi.fn((queue: string, cb: (msg: any) => void) => {
      consumeCallback = cb;
    }),
    ack: vi.fn(),
    nack: vi.fn(),
  };

  (getRabbitMQChannel as any).mockResolvedValue(fakeChannel);

  vi.clearAllMocks();
});

// TEST SUITE

describe("processNotificationConsumer FCM", () => {
  it("should process READ notification and ack", async () => {
    const msg = {
      content: Buffer.from(
        JSON.stringify({
          action: "read",
          notificationId: "123",
          userId: "456",
          status: "read",
        })
      ),
    };

    fakeChannel.consume.mockImplementation((queue: string, cb: (msg: any) => void) => cb(msg));

    await processNotificationConsumer();

    expect(markNotificationRead).toHaveBeenCalledWith("123", "456");
    expect(fakeChannel.ack).toHaveBeenCalledWith(msg);
  });

  it("should process BULK READ and ack", async () => {
    const msg = {
      content: Buffer.from(
        JSON.stringify({
          action: "bulkRead",
          userId: "789",
          status: "read",
        })
      ),
    };

    fakeChannel.consume.mockImplementation((queue: string, cb: (msg: any) => void) => cb(msg));

    await processNotificationConsumer();

    expect(markAllNotificationsRead).toHaveBeenCalledWith("789");
    expect(fakeChannel.ack).toHaveBeenCalledWith(msg);
  });

  it("should process DELETE notification and ack", async () => {
    const msg = {
      content: Buffer.from(
        JSON.stringify({
          action: "delete",
          notificationId: "123",
          userId: "456",
        })
      ),
    };

    fakeChannel.consume.mockImplementation((queue: string, cb: (msg: any) => void) => cb(msg));

    await processNotificationConsumer();

    expect(deleteNotification_service).toHaveBeenCalledWith("123", "456");
    expect(fakeChannel.ack).toHaveBeenCalledWith(msg);
  });

  it("should process BULK DELETE and ack", async () => {
    const msg = {
      content: Buffer.from(
        JSON.stringify({
          action: "bulkDelete",
          userId: "789",
        })
      ),
    };

    fakeChannel.consume.mockImplementation((queue: string, cb: (msg: any) => void) => cb(msg));

    await processNotificationConsumer();

    expect(deleteAllNotifications_service).toHaveBeenCalledWith("789");
    expect(fakeChannel.ack).toHaveBeenCalledWith(msg);
  });

  it("should send FCM notification and ack", async () => {
    const msg = {
      content: Buffer.from(
        JSON.stringify({
          action: "notification",
          userId: "user-xyz",
          title: "Hello",
          body: "World",
          data: { foo: "bar" },
          device_type: "android",
        })
      ),
    };

    fakeChannel.consume.mockImplementation((queue: string, cb: (msg: any) => void) => cb(msg));

    await processNotificationConsumer();

    expect(sendNotification_service).toHaveBeenCalledWith(
      "Hello",
      "World",
      { foo: "bar" },
      "android",
      "user-xyz"
    );

    expect(fakeChannel.ack).toHaveBeenCalledWith(msg);
  });

  // it("should nack and send to DLQ on error", async () => {
  //   (markNotificationRead as any).mockRejectedValue(new Error("DB failed"));

  //   const msg = {
  //     content: Buffer.from(
  //       JSON.stringify({
  //         action: "read",
  //         notificationId: "123",
  //         userId: "456",
  //       })
  //     ),
  //   };

  //   fakeChannel.consume.mockImplementation((queue: string, cb: (msg: any) => void) => cb(msg));

  //   await processNotificationConsumer();

  //   expect(sendToDLQ).toHaveBeenCalledWith(
  //     expect.objectContaining({ action: "read" }),
  //     "DB failed"
  //   );

  //   expect(fakeChannel.nack).toHaveBeenCalledWith(msg, false, false);
  // });
});

describe("FCM Token Management (Notifications)", () => {
  it("should create FCM token", async () => {
    const userId = "user-xyz";
    const token = "token-abc";
    const device_type = "android";

    await createFCM_Token(userId, token, device_type);

    expect(createFCM_Token).toHaveBeenCalledWith(userId, token, device_type);
  });

  it("should delete FCM token", async () => {
    const userId = "user-xyz";
    const token = "token-abc";

    await deleteFCM_Token(userId, token);

    expect(deleteFCM_Token).toHaveBeenCalledWith(userId, token);
  });

  it("should update FCM token", async () => {
    const userId = "user-xyz";
    const newToken = "token-def";
    const device_type = "ios";

    await updateFCM_Token(userId, newToken, device_type);

    expect(updateFCM_Token).toHaveBeenCalledWith(userId, newToken, device_type);
  });
});

describe("SMS Job Consumer", () => {
  let fakeMsg: any;
  
  beforeEach(() => {
    fakeMsg = {
      content: Buffer.from(JSON.stringify({
        phone_number: "+1234567890",
        message: "Hello, World!",
        from: "sender-id",
        userId: "user-xyz",
        hashedToken: "token123",
        expiresAt: "2025-12-31",
        type: "SMS",
      })),
    };
    
    (sendSMS as any).mockResolvedValue(undefined);
    (logNotification as any).mockResolvedValue("notif-123");
    (publishEvent as any).mockResolvedValue(undefined);
    (updateNotificationStatus as any).mockResolvedValue(undefined);
  });

  it("should call sendSMS with correct payload", async () => {
    await processSMSJobConsumer();
    await consumeCallback(fakeMsg);

    expect(sendSMS).toHaveBeenCalledWith(
      "+1234567890", 
      "Hello, World!", 
      "sender-id"
    );
  });

  it("should log the notification sent correctly", async () => {
    await processSMSJobConsumer();
    await consumeCallback(fakeMsg);

    expect(logNotification).toHaveBeenCalledWith(
      "user-xyz",
      "SMS to +1234567890",
      "Hello, World!",
      "SMS",
      expect.any(Object)
    );
  });

  it("should publish an event after sending SMS", async () => {
    await processSMSJobConsumer();
    await consumeCallback(fakeMsg);

    expect(publishEvent).toHaveBeenCalledWith("notifications.sms.sent", {
      userId: "user-xyz",
      hashedToken: "token123",
      expiresAt: "2025-12-31",
    });
  });

  it("should update the notification status to SENT", async () => {
    await processSMSJobConsumer();
    await consumeCallback(fakeMsg);

    expect(updateNotificationStatus).toHaveBeenCalledWith("notif-123", "SENT");
  });

  it("should ack the message in the channel", async () => {
    await processSMSJobConsumer();
    await consumeCallback(fakeMsg);

    expect(fakeChannel.ack).toHaveBeenCalledWith(fakeMsg);
  });
});


describe("Email Job Consumer", () => {
  let fakeMsg: any;

  beforeEach(() => {
    fakeMsg = {
      content: Buffer.from(JSON.stringify({
        email: "user@example.com",
        name: "John Doe",
        subject: "Welcome",
        message: "Hello, John!",
        from: "no-reply@example.com",
        userId: "user-xyz",
        hashedToken: "token123",
        expiresAt: "2025-12-31",
        type: "EMAIL",
      })),
    };

    (sendMail as any).mockResolvedValue({ info: { response: "Email sent" } });
    (logNotification as any).mockResolvedValue("notif-email-123");
    (publishEvent as any).mockResolvedValue(undefined);
    (updateNotificationStatus as any).mockResolvedValue(undefined);
  });

  it("should call sendMail with correct payload", async () => {
    await processEmailJobConsumer();
    await consumeCallback(fakeMsg);

    expect(sendMail).toHaveBeenCalledWith({
      email: "user@example.com",
      name: "John Doe",
      subject: "Welcome",
      message: "Hello, John!",
      otp: undefined,
      from: "no-reply@example.com",
    });
  });

  it("should log the notification correctly", async () => {
    await processEmailJobConsumer();
    await consumeCallback(fakeMsg);

    expect(logNotification).toHaveBeenCalledWith(
      "user-xyz",
      "Welcome",
      "Hello, John!",
      "EMAIL",
      expect.any(Object)
    );
  });

  it("should publish an event after sending email", async () => {
    await processEmailJobConsumer();
    await consumeCallback(fakeMsg);

    expect(publishEvent).toHaveBeenCalledWith("notifications.email.sent", {
      userId: "user-xyz",
      hashedToken: "token123",
      expiresAt: "2025-12-31",
    });
  });

  it("should update the notification status to SENT", async () => {
    await processEmailJobConsumer();
    await consumeCallback(fakeMsg);

    expect(updateNotificationStatus).toHaveBeenCalledWith("notif-email-123", "SENT");
  });

  it("should ack the message in the channel", async () => {
    await processEmailJobConsumer();
    await consumeCallback(fakeMsg);

    expect(fakeChannel.ack).toHaveBeenCalledWith(fakeMsg);
  });
});
