import { v2 as cloudinary } from 'cloudinary';
import dotenv from "dotenv"
import logger from './logger';

dotenv.config()

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME as string,
    api_key: process.env.CLOUDINARY_API_KEY as string,
    api_secret: process.env.CLOUDINARY_API_SECRET as string,
})

const uploadFile_ID = async (file: string) =>{
    try {
        const result = await cloudinary.uploader.upload(file, {
            folder: 'kyc_docs(ID)',
            resource_type: 'auto'
        })

        logger.info(`National ID uploaded successfully`);
        return {
            secure_url:result.secure_url,
            public_id: result.public_id
        };
    } catch (error) {
        logger.error(`Error uploading national ID to: ${error} `)
        throw error
    }
}

const uploadFile_kra = async (file: string) =>{
    try {
        const result = await cloudinary.uploader.upload(file, {
            folder: 'kyc_docs(KRA)',
            resource_type: 'auto'
        })

        logger.info(`KRA document uploaded successfully`);
        return {
            secure_url:result.secure_url,
            public_id: result.public_id
        };
    } catch (error) {
        logger.error(`Error uploading KRA document file to: ${error} `)
        throw error
    }
}

const uploadFile_bank_proof = async (file: string) =>{
    try {
        const result = await cloudinary.uploader.upload(file, {
            folder: 'kyc_docs(BANK_PROOF)',
            resource_type: 'auto'
        })

        logger.info(`Proof of banking uploaded successfully`);
        return {
            secure_url:result.secure_url,
            public_id: result.public_id
        };
    } catch (error) {
        logger.error(`Error uploading bank proof document to: ${error} `)
        throw error
    }
}

const uploadFile_passport_photo = async (file: string) =>{
    try {
        const result = await cloudinary.uploader.upload(file, {
            folder: 'kyc_docs(PASSPORT)',
            resource_type: 'auto'
        })

        logger.info(`Passport photo uploaded successfully`);
        return {
            secure_url:result.secure_url,
            public_id: result.public_id
        };
    } catch (error) {
        logger.error(`Error uploading passport photo to: ${error} `)
        throw error
    }
}

const process_kyc_docs = async(data:any)=>{
    try {
        
    } catch (error) {
        logger.error(`Error processing KYC docs`)
    }
}