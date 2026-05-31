import { z } from "zod";
import { manualProfileSchema } from "../generate_user_infomation.js";

// Reusable helpers, mirroring the style in generate_user_infomation.ts
const trimmedString = z.string().trim().max(2000).optional().default("");
const stringArray = z
  .array(z.string().trim().min(1).max(300))
  .optional()
  .default([]);

// Job position / role-profile schema 
export const jobPositionSchema = z.object({
  id: z.uuid(),
  roleName: z.string().trim().min(1),
  category: trimmedString,
  overview: trimmedString,
  coreSkills: stringArray,
  commonTools: stringArray,
  typicalResponsibilities: stringArray,
  typicalEducation: trimmedString,
  entryLevelExperience: trimmedString,
  seniorityLevels: stringArray,
  typicalSalaryRange: trimmedString,
  commonIndustries: stringArray,
  careerPaths: stringArray,
  relatedRoles: stringArray,
  learningResources: stringArray,
});

// Upload payload: { postings: jobPositionSchema[] }
export const jobPositionUploadSchema = z.object({
    positions: z.array(jobPositionSchema).min(1),
});

// Recommend request: { userProfile: manualProfileSchema }
export const recommendRequestSchema = z.object({
    userProfile: manualProfileSchema,
})

// Recommended job + response envelope
export const recommendedJobSchema = z.object({
    position: jobPositionSchema,
    matchScore: z.number().min(0).max(100),
    matchReasons: stringArray,
    gaps: stringArray,
});

export const recommendResponseSchema = z.object({
    summary: trimmedString,
    jobs: z.array(recommendedJobSchema).default([]),
});


// Inferred TypeScript types
export type JobPosition = z.infer<typeof jobPositionSchema>;
export type JobPositionUpload = z.infer<typeof jobPositionUploadSchema>;
export type RecommendRequest = z.infer<typeof recommendRequestSchema>;
export type RecommendedJob = z.infer<typeof recommendedJobSchema>;
export type RecommendResponse = z.infer<typeof recommendResponseSchema>;