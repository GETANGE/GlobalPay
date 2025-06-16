import bcrypt from "bcrypt";
const saltRounds = 10;

// Encrypt (Hash) Function
export const encrypt = async (data: string): Promise<string> => {
    const result = await bcrypt.hash(data, saltRounds);
    return result;
};

// Compare (Check) Function
export const decrypt = async (data: string, hashed: string): Promise<boolean> => {
    const result = await bcrypt.compare(data, hashed);
    return result;
};
