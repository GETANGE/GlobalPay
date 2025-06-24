import jwt from "jsonwebtoken"
import crypto from 'crypto'
import dotenv from 'dotenv'
import client from '../configs/db-config'

dotenv.config()

export const generateToken = async(user:any)=>{
    const access_token= jwt.sign({ userId:user.id, username:user.username, email:user.email }, process.env.JWT_SECRET as string, {
        expiresIn: '15m'
    })

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate()+7) // expires after 7 days

    const query ={
        text:`INSERT INTO user_verification(user_id, access_token, expiresAt) VALUES($1, $2, $3) RETURNING *`,
        values: [user.id, access_token, expiresAt]
    }

    await client.query(query)

    return { access_token, refreshToken }
}

export const resetToken = () => {
    const token = crypto.randomInt(11111, 99999);

    const hashedToken = crypto.createHash('sha256').update(token.toString()).digest('hex');
    console.log(hashedToken)
    
    const expiresAt = new Date(Date.now()+ 10 * 60 * 1000).toISOString();

  return { token, expiresAt, hashedToken };
};