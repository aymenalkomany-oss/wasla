import bcrypt from 'bcryptjs';
export const hashPassword = async (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = async (plain: string, hashed: string) => bcrypt.compare(plain, hashed);
