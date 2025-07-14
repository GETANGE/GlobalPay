import passport from "passport";
import dotenv from "dotenv";
import { Strategy as GitHubStrategy } from "passport-github2";
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
            console.log(emails);

            // Find primary and verified email
            const primaryEmail = emails.find(
              (e: any) => e.primary && e.verified
            );
            email = primaryEmail?.email;
          }

          // Extract fullnames
          const fullName = profile.displayName || " ";
          const [first_name, last_name] = fullName.split(" ");

          // Check if user already exists
          const text = `SELECT * FROM users WHERE github_id = $1`;
          const values = [githubId];
          const existingUser = await client.query(text, values);

          let user;

          if (existingUser.rows.length === 0) {
            // Insert new user
            const insertText = `
              INSERT INTO users (username, email, github_id, first_name, last_name)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING *
            `;
            const insertValues = [
              username,
              email,
              githubId,
              first_name,
              last_name,
            ];
            const result = await client.query(insertText, insertValues);

            user = result.rows[0];
          } else {
            user = existingUser.rows[0];
          }

          return done(null, user);
        } catch (error) {
          return done(error as Error, null);
        }
      }
    )
  );
};
