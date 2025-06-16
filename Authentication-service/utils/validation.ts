import Joi from "joi"

export const registration_validation = (data:any)=>{
    const schema = Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required(),
        firstName: Joi.string().alphanum().min(3).max(30).required(),
        lastName: Joi.string().alphanum().min(3).max(30).required(),
        email: Joi.string().email({
            maxDomainSegments: 2,
            tlds: {
                allow: ['com', 'net']
            }
        }),
        password: Joi.string().pattern(new RegExp('^[a-zA-Z0-9]{3,30}$')),
        passwordConfirm: Joi.ref('password'),
        access_token: [
            Joi.string(),
            Joi.number()
        ],
        phoneNumber: Joi.number().integer().min(10).max(10),
        isEmailVerified: Joi.boolean(),
        isPhoneVerified: Joi.boolean(),
        twoFactorEnabled: Joi.boolean(),
        kycStatus: Joi.string(),
        nationalID: Joi.number(),
        dateOfBirth: Joi.date(),
        walletBalance: Joi.number(),
        currency: Joi.string(),
        role: Joi.string(),
        createdAt: Joi.date(),
        updatedAt: Joi.date(),
        lastLogin: Joi.date(),
        loginIp: Joi.string(),
        deviceIp: Joi.string(),
        notification_preference: Joi.string()
    })

    return schema.validate(data)
}