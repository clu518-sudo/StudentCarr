import { z } from "zod";

const documentTypes = [
  "Resume",
  "Transcript",
  "Project",
  "Certification",
  "Recommendation Letter",
  "Essay",
  "Working History & Related Project Description",
];

const stringOrEmpty = z
  .string()
  .trim()
  .max(2000, "Value is too long")
  .optional()
  .or(z.literal(""));

const linkSchema = z.object({
  label: z.string().trim().max(100).optional().or(z.literal("")),
  url: z.string().trim().max(500).optional().or(z.literal("")),
});

const educationItemSchema = z.object({
  school: z.string().trim().min(1, "School is required"),
  degree: stringOrEmpty,
  fieldOfStudy: stringOrEmpty,
  startDate: stringOrEmpty,
  endDate: stringOrEmpty,
  grade: stringOrEmpty,
  description: stringOrEmpty,
  isCurrent: z.boolean().optional().default(false),
});

const workExperienceItemSchema = z.object({
  company: z.string().trim().min(1, "Company is required"),
  title: z.string().trim().min(1, "Title is required"),
  location: stringOrEmpty,
  startDate: stringOrEmpty,
  endDate: stringOrEmpty,
  isCurrent: z.boolean().optional().default(false),
  description: stringOrEmpty,
  achievements: z.array(z.string().trim().max(300)).optional().default([]),
});

const projectItemSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  role: stringOrEmpty,
  description: stringOrEmpty,
  technologies: z.array(z.string().trim().max(100)).optional().default([]),
  startDate: stringOrEmpty,
  endDate: stringOrEmpty,
  projectUrl: stringOrEmpty,
  repositoryUrl: stringOrEmpty,
});

const skillItemSchema = z.object({
  name: z.string().trim().min(1, "Skill name is required"),
  level: stringOrEmpty,
  category: stringOrEmpty,
  yearsOfExperience: z
    .number()
    .int("Years of experience must be an integer")
    .min(0)
    .max(80)
    .optional(),
  keywords: z.array(z.string().trim().max(100)).optional().default([]),
});

const certificationItemSchema = z.object({
  name: z.string().trim().min(1, "Certification name is required"),
  issuer: stringOrEmpty,
  issueDate: stringOrEmpty,
  expiryDate: stringOrEmpty,
  credentialId: stringOrEmpty,
  credentialUrl: stringOrEmpty,
});

const manualProfileSchema = z.object({
  personalInfo: z.object({
    name: z.string().trim().max(150).optional().or(z.literal("")),
    headline: stringOrEmpty,
    summary: stringOrEmpty,
    phone: stringOrEmpty,
    location: stringOrEmpty,
    links: z.array(linkSchema).optional().default([]),
  }),
  preferences: z.object({
    preferredRoles: z.array(z.string().trim().max(120)).optional().default([]),
    preferredLocations: z.array(z.string().trim().max(120)).optional().default([]),
    workAuthorization: stringOrEmpty,
    salaryRange: stringOrEmpty,
    availability: stringOrEmpty,
  }),
  education: z.array(educationItemSchema).optional().default([]),
  workExperience: z.array(workExperienceItemSchema).optional().default([]),
  projects: z.array(projectItemSchema).optional().default([]),
  skills: z.array(skillItemSchema).optional().default([]),
  certifications: z.array(certificationItemSchema).optional().default([]),
});

const deleteDocumentParamsSchema = z.object({
  id: z.string().uuid("Invalid document id"),
});

const uploadDocumentsSchema = z.object({
  documentTypes: z
    .array(
      z
        .string()
        .trim()
        .refine((value) => documentTypes.includes(value), {
          message: "Invalid document type provided",
        }),
    )
    .min(1, "At least one document type is required"),
  githubUrl: z.string().trim().url("GitHub URL must be valid").optional().or(z.literal("")),
});

const uploadSingleDocumentSchema = z.object({
  documentType: z
    .string()
    .trim()
    .refine((value) => documentTypes.includes(value), {
      message: "Invalid document type provided",
    }),
  githubUrl: z.string().trim().url("GitHub URL must be valid").optional().or(z.literal("")),
});

const validate = (schema, payload) => schema.parse(payload);

export {
  documentTypes,
  manualProfileSchema,
  deleteDocumentParamsSchema,
  uploadDocumentsSchema,
  uploadSingleDocumentSchema,
  validate,
};
