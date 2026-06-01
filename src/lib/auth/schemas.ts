import { z } from "zod";
import { selfDeclaredRankOptions } from "./rank-options";

export const playerProfileInputSchema = z.object({
  titleTh: z.string().trim().min(1, "กรุณากรอกคำนำหน้าไทย"),
  titleEn: z.string().trim().min(1, "กรุณากรอกคำนำหน้าอังกฤษ"),
  firstNameTh: z.string().trim().min(1, "กรุณากรอกชื่อไทย"),
  middleNameTh: z.string().trim().optional().default(""),
  lastNameTh: z.string().trim().min(1, "กรุณากรอกนามสกุลไทย"),
  firstNameEn: z.string().trim().min(1, "กรุณากรอกชื่ออังกฤษ"),
  middleNameEn: z.string().trim().optional().default(""),
  lastNameEn: z.string().trim().min(1, "กรุณากรอกนามสกุลอังกฤษ"),
  gender: z.enum(["male", "female", "unspecified"]),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาเลือกวันเกิด"),
  identityDocumentType: z.enum(["national_id", "passport"]),
  identityDocumentValue: z.string().trim().min(6, "กรุณากรอกเลขเอกสาร"),
  nationality: z.string().trim().min(1, "กรุณากรอกสัญชาติ").default("Thai"),
  instituteName: z.string().trim().optional().default(""),
  phone: z.string().trim().min(8, "กรุณากรอกเบอร์โทร"),
  pdpaConsent: z.boolean().refine((value) => value === true, {
    message: "กรุณายอมรับเงื่อนไข PDPA",
  }),
});

export const rankSelectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("matched"),
    candidateId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("self"),
    rank: z.string().refine((rank) => (selfDeclaredRankOptions as readonly string[]).includes(rank), {
      message: "ระดับฝีมือไม่ถูกต้อง",
    }),
  }),
]);

export const signupSchema = z.object({
  profile: playerProfileInputSchema,
  rankSelection: rankSelectionSchema,
  role: z.enum(["player", "coach"]),
  credentials: z.object({
    email: z.string().trim().email("อีเมลไม่ถูกต้อง"),
    password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
  }),
  remember: z.boolean().default(true),
});

export const loginSchema = z.object({
  email: z.string().trim().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
  remember: z.boolean().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("อีเมลไม่ถูกต้อง"),
});

export const updatePasswordSchema = z.object({
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
});
