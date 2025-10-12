import { z } from 'zod';

// Profile validation schemas
export const profileSchema = z.object({
  name: z.string()
    .trim()
    .min(1, { message: "Name cannot be empty" })
    .max(100, { message: "Name must be less than 100 characters" }),
  cityState: z.string()
    .trim()
    .max(200, { message: "Location must be less than 200 characters" })
    .optional()
    .or(z.literal('')),
  secondaryEmail: z.string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" })
    .optional()
    .or(z.literal('')),
});

// Chat/prompt validation schema
export const chatPromptSchema = z.object({
  prompt: z.string()
    .trim()
    .min(1, { message: "Prompt cannot be empty" })
    .max(2000, { message: "Prompt must be less than 2000 characters" }),
});

// Overlay creator validation schema
export const overlayCreatorSchema = z.object({
  region: z.string()
    .trim()
    .min(1, { message: "Region cannot be empty" })
    .max(200, { message: "Region must be less than 200 characters" }),
  baseYear: z.string()
    .trim()
    .regex(/^\d{4}$/, { message: "Base year must be a 4-digit year" }),
  compareYears: z.string()
    .trim()
    .min(1, { message: "Compare years cannot be empty" })
    .max(500, { message: "Compare years must be less than 500 characters" }),
  question: z.string()
    .trim()
    .min(1, { message: "Question cannot be empty" })
    .max(1000, { message: "Question must be less than 1000 characters" }),
  theme: z.string()
    .trim()
    .min(1, { message: "Theme cannot be empty" })
    .max(100, { message: "Theme must be less than 100 characters" }),
});

// Map/chart upload validation schema
export const chartUploadSchema = z.object({
  title: z.string()
    .trim()
    .min(1, { message: "Title cannot be empty" })
    .max(200, { message: "Title must be less than 200 characters" }),
  credit: z.string()
    .trim()
    .max(500, { message: "Credit must be less than 500 characters" })
    .optional()
    .or(z.literal('')),
  licenseStatus: z.enum(['public_domain', 'creative_commons', 'proprietary', 'unknown'], {
    errorMap: () => ({ message: "Please select a valid license status" }),
  }),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
export type ChatPromptFormData = z.infer<typeof chatPromptSchema>;
export type OverlayCreatorFormData = z.infer<typeof overlayCreatorSchema>;
export type ChartUploadFormData = z.infer<typeof chartUploadSchema>;
