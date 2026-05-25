import { z } from "zod";

// -- crawler -- 
export const jobPostingSchema = z.object({
    source: z.literal("seek"),
    sourceId: z.string().min(1),
    url: z.url(),
    title: z.string().min(1),
    company: z.string().default(""),
    location: z.string().default(""),
    workType: z.string().default(""),,
    salary: z.string().default(""),
    classification: z.string().default(""),
    postedAt: z.string().default(""),
    description: z.string().default(""),
    scrapedAt: z.iso.datetime(),
});
export type JosPosting = z.infer<typeof jobPostingSchema>;

export const crawlRequestSchema = z.object({
  source: z.enum(["seek"]).default("seek"),
  keywords: z.string().min(1).max(200),
  where: z.string().max(120).optional().default(""),
  maxJobs: z.number().int().min(1).max(100).optional().default(25),
});

// -- recommender --
export const roleRecommendationSchema = z.object({
    roleTitle: z.string().min(1).max(120), // "Frontend Developer"
    seachKeywords: z.string().min(1).max(120), // "frontend developer"
    suggestedLocation:  z.string().max(120).default(""),
    confidence: z.enum(["high", "medium", "low"]),
    reasoning: z.string().max(500),
})
export type RoleRecommendation = z.infer<typeof roleRecommendationSchema>;

export const recommendRequestSchema = z.object({
  profile: z.any(),                            // Prisma include payload
  count: z.number().int().min(1).max(8).optional().default(5),
});

// -- matcher --
export const matchOutputSchema = z.object({
    jobId: z.string(),
    score: z.number().int().min(0).max(100),
    fitSummary: z.string().max(500),
    matchedSkills: z.array(z.string()).default([]),
    missingSkills: z.array(z.string()).default([]),
    reasoning: z.string().max(1500),
});
export type MatchOutput = z.infer<typeof matchOutputSchema>;

export const matchRequestSchema = z.object({
    profile: z.any(),
    jobs: z.array(z.object({
        id: z.string(),
        title: z.string(),
        company: z.string(),
        description: z.string(),
        workType: z.string().optional().default(""),
        location: z.string().optional().default(""),
        classification: z.string().optional().default(""),
    })),
});