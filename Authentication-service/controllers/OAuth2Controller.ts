import { NextFunction, Response, Request } from "express";
import logger from "../utils/logger";
import { generateToken } from "../utils/generateToken";
import passport from "passport";
import APIError from "../utils/APIError";

export const githubCallback = (req: Request, res: Response, next: NextFunction ) => {
  passport.authenticate("github",{ session: false }, async (err: any, user: any, info: any) => {
      if (err || !user) {
        return next(
          new APIError(`GitHub auth failed: ${err} || 'No user returned'`, 400)
        );
      }

      try {
        const { access_token, refresh_token } = await generateToken({
          id: user.id,
          username: user.username,
          email: user.email,
        });

        return res.status(200).json({
          status: "success",
          access_token,
          refresh_token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
          },
        });
      } catch (error) {
        logger.error(`Error generating token after GitHub login: ${error}`);
        return next(new APIError(`Token generation failed`, 500));
      }
    }
  )(req, res, next);
};
