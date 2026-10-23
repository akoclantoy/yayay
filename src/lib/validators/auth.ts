import { z } from "zod";

export const loginSchema = z.object({
  phone: z.string().trim().min(8, "Enter your registered phone number").max(24)
    .regex(/^\+?[0-9\s().-]+$/, "Enter a valid phone number")
    .refine((phone) => phone.replace(/\D/g, "").length >= 8 && phone.replace(/\D/g, "").length <= 15, "Enter a valid phone number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    email: z.string().trim().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string(),
    phone: z.string().trim().min(8, "Enter a valid phone number").max(24)
      .regex(/^\+?[0-9\s().-]+$/, "Enter a valid phone number")
      .refine((phone) => phone.replace(/\D/g, "").length >= 8 && phone.replace(/\D/g, "").length <= 15, "Enter a valid phone number"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const createStaffSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    email: z.string().trim().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    phone: z.string().trim().min(8, "Enter a valid phone number").max(24)
      .regex(/^\+?[0-9\s().-]+$/, "Enter a valid phone number")
      .refine((phone) => phone.replace(/\D/g, "").length >= 8 && phone.replace(/\D/g, "").length <= 15, "Enter a valid phone number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your registered email or account name").max(254),
  phone: z.string().trim().min(8, "Enter your registered phone number").max(24)
    .regex(/^\+?[0-9\s().-]+$/, "Enter a valid phone number")
    .refine((phone) => phone.replace(/\D/g, "").length >= 8 && phone.replace(/\D/g, "").length <= 15, "Enter a valid phone number"),
});

export const verifyRecoveryOtpSchema = z.object({
  challengeId: z.string().min(1).max(64),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const resetRecoveredPasswordSchema = z
  .object({
    challengeId: z.string().min(1).max(64),
    resetToken: z.string().regex(/^[a-f0-9]{64}$/i),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const recoveryIdentifierSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const recyclingRecordSchema = z.object({
  residentQrOrId: z.string().min(1),
  wasteCategoryId: z.string().min(1),
  weightKg: z.coerce.number().positive("Weight must be positive"),
  quantity: z.coerce.number().int().positive().default(1),
  centerId: z.string().optional(),
  notes: z.string().optional(),
  images: z.array(z.string()).optional(),
});

export const pickupRequestSchema = z.object({
  address: z.string().min(5),
  scheduledDate: z.string().optional(),
  wasteNotes: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

export const redemptionSchema = z.object({
  rewardId: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
