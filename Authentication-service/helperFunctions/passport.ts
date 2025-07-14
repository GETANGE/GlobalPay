import passport from "passport";
import dotenv from "dotenv";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import client from "../configs/db-config";

dotenv.config();

export const githubStrategy = () => {
  passport.use( new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        callbackURL: process.env.GITHUB_CALLBACK_URL as string,
      },
      async ( accessToken: string, refreshToken: string, profile: {
          id: any;
          username: string;
          displayName?: string;
          emails: { value: string }[];
        },
        done: (arg0: Error | null, arg1: null) => any
      ) => {
        try {
          const githubId = profile.id;
          const username = profile.username;
          let email = profile.emails?.[0]?.value;

          if (!email) {
            // Manually fetch emails from GitHub API
            const emailResponse = await fetch(
              "https://api.github.com/user/emails",
              {
                headers: {
                  Authorization: `token ${accessToken}`,
                  "User-Agent": "Node.js",
                  Accept: "application/vnd.github+json",
                },
              }
            );

            const emails = await emailResponse.json();

            // Find primary and verified email
            const primaryEmail = emails.find(
              (e: any) => e.primary && e.verified
            );
            email = primaryEmail?.email;
          }

          // Extract fullnames
          const fullName = profile.displayName || " ";
          const [first_name, last_name] = fullName.split(" ");

          const existing = await client.query(`SELECT * FROM users WHERE github_id = $1`, [githubId]);

          if (existing.rows.length > 0) {
            await client.query(`UPDATE users SET last_login = CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi' WHERE github_id = $1`, [githubId])
            return done(null, existing.rows[0]);
          }

          const kyc_status: string = 'pending'
          const currency: string = 'KES'
          const notification_preference: string = 'email'

          const insert = `
            INSERT INTO users (username, email, github_id, first_name, last_name, kyc_status, currency, notification_preference)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
          `;
          const values = [username, email, githubId, first_name, last_name, kyc_status, currency, notification_preference];

          const result = await client.query(insert, values);
          return done(null, result.rows[0]);
        } catch (error) {
          return done(error as Error, null);
        }
      }
    )
  );
};

export const googleStrategy = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          const fullName = profile.displayName || "";
          const [first_name = "", last_name = ""] = fullName.split(" ");
          const username = profile.username || email?.split('@')[0] || googleId;

          const existing = await client.query(`SELECT * FROM users WHERE google_id = $1`, [googleId]);

          if (existing.rows.length > 0) {
            await client.query(`UPDATE users SET last_login = CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi' WHERE google_id = $1`, [googleId])
            return done(null, existing.rows[0]);
          }

          const kyc_status: string = 'pending'
          const currency: string = 'KES'
          const notification_preference: string = 'email'

          const insert = `
            INSERT INTO users (username, email, google_id, first_name, last_name, kyc_status, currency, notification_preference)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
          `;
          const values = [username, email, googleId, first_name, last_name, kyc_status, currency, notification_preference];

          const result = await client.query(insert, values);
          return done(null, result.rows[0]);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
};