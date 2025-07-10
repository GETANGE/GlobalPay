import client from "../configs/db-config";

interface userData {
    id?: string | number
    email? : string
}

export const getUser = async ({ id, email }: userData) => {
  if (!id && !email) {
    throw new Error('Provide either id or email');
  }

  const query = id
    ? 'SELECT * FROM users WHERE id = $1'
    : 'SELECT * FROM users WHERE email = $1';

  const value = id || email;

  const result = await client.query(query, [value]);
  return result.rows[0] || null;
};

export const getSubject = (type: "reset" | "welcome") => {
  return type === "reset"
    ? "Reset Your Password – GlobalPay"
    : "Welcome to GlobalPay – Let’s Get Started!";
};
