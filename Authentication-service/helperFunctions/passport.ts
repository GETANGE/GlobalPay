import passport from "passport";
import dotenv from "dotenv";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import client from "../configs/db-config";
import APIError from "../utils/APIError";

dotenv.config();

export const githubStrategy = () => {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
        callbackURL: process.env.GITHUB_CALLBACK_URL as string,
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: {
          id: any;
          username: string;
          displayName?: string;
          emails: { value: string }[];
        },
        done: (error: Error | null, user: any) => any
      ) => {
        try {
          const githubId = profile.id;
          const username = profile.username;
          let email = profile.emails?.[0]?.value;

          //If no email, fetch from GitHub API
          if (!email) {
            const emailResponse = await fetch("https://api.github.com/user/emails", {
              headers: {
                Authorization: `token ${accessToken}`,
                "User-Agent": "Node.js",
                Accept: "application/vnd.github+json",
              },
            });

            const emails = await emailResponse.json();
            const primaryEmail = emails.find((e: any) => e.primary && e.verified);
            email = primaryEmail?.email;
          }

          if (!email) {
            return done(new Error("GitHub account does not have a verified primary email"), null);
          }

          // Parse name
          const fullName = profile.displayName || "";
          const [first_name = "", last_name = ""] = fullName.split(" ");

          //Check if user with email exists
          const { rows } = await client.query(`SELECT * FROM users WHERE email = $1`, [email]);
          const existingUser = rows[0];

          if (existingUser) {
            if(existingUser.active === false){
             throw new APIError("This account has been deactivated. Please contact customer support for assistance.", 403)
            }

            //If GitHub ID is not linked, update it
            if (!existingUser.github_id) {
              await client.query(
                `UPDATE users SET github_id = $1, last_login = CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi' WHERE email = $2`,
                [githubId, email]
              );
              existingUser.github_id = githubId; // reflect in returned user
            } else {
              // Just update last_login
              await client.query(
                `UPDATE users SET last_login = CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi' WHERE email = $1`,
                [email]
              );
            }

            return done(null, existingUser);
          }

          //No user exists — insert new one
          const insertQuery = `
            INSERT INTO users (
              username, email, github_id, first_name, last_name,
              kyc_status, currency, notification_preference
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
          `;
          const values = [
            username,
            email,
            githubId,
            first_name,
            last_name,
            "pending",      // kyc_status
            "KES",          // currency
            "email"         // notification_preference
          ];

          const result = await client.query(insertQuery, values);
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

          if (!email) {
            return done(new Error("Google account does not have an email"));
          }

          // Check for existing user by email
          const { rows } = await client.query(`SELECT * FROM users WHERE email = $1`, [email]);

          const existingUser = rows[0];

          // If user exists
          if (existingUser) {
            if(existingUser.active === false){
             throw new APIError("This account has been deactivated. Please contact customer support for assistance.", 403)
            }
            
            // Update google_id if not already set
            if (!existingUser.google_id) {
              await client.query(`UPDATE users SET google_id = $1, last_login = CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi' WHERE email = $2`,[googleId, email]
              );
              existingUser.google_id = googleId; // ensure updated object
            } else {
              // Just update last_login
              await client.query(`UPDATE users SET last_login = CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi' WHERE email = $1`, [email]
              );
            }

            return done(null, existingUser);
          }

          // New user - insert
          const result = await client.query(
            `
            INSERT INTO users (
              username, email, google_id, first_name, last_name,
              kyc_status, currency, notification_preference
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
          `,
            [
              username,
              email,
              googleId,
              first_name,
              last_name,
              "pending",      // kyc_status
              "KES",          // currency
              "email"         // notification_preference
            ]
          );

          return done(null, result.rows[0]);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
};