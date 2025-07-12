import { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import client from "../configs/db-config";

// Get user's previously registered passkeys
export const getUserPasskeys = async (user: { id?: number }) => {
  const text = `SELECT * FROM passkeys WHERE user_id = $1`;
  const values = [user.id];

  try {
    const result = await client.query(text, values);

    return result.rows.map((row) => ({
        id: row.id,
        publicKey: new Uint8Array(row.public_key),
        user: {
            id: row.user_id,
            username: '', // optional
        },
        webauthnUserID: row.webauthn_user_id,
        counter: row.counter,
        deviceType: row.device_type,
        backedUp: row.backed_up,
        transports: row.transports?.split(',') as AuthenticatorTransportFuture[] | undefined,
    }));
  } catch (err) {
    console.error('Error fetching passkeys:', err);
    throw err;
  }
};

export const getCurrentRegistrationOptions = async (userId: number) => {
  const text = `SELECT current_challange FROM users WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`;
  const result = await client.query(text, [userId]);

  if (result.rows.length === 0) return null;

  return result.rows[0].options;
};

export const getChallenge = async (loginId: number) => {
  const text = `SELECT * FROM users WHERE login_challange = $1 ORDER BY created_at DESC LIMIT 1`;
  const result = await client.query(text, [loginId]);

  if (result.rows.length === 0) return null;

  return result.rows[0].options;
};

export const updatePasskeyCounter = async( passkey: string, newCounter: any) =>{
    const text = `UPDATE SET counter = $1, updated_at = NOW() WHERE id= $2`;
    await client.query(text, [newCounter, passkey])
}