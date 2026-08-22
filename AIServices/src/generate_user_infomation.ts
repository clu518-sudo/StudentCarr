const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "..", ".env") });

import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";

import { config as loadEnv } from "dotenv";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = Number(process.env.LANGGRAPH_PORT || 10002);
const GENERATE_ROUTE = "/generate-profile";
const OPENAI_MODEL =
  process.env.OPENAI_MODEL || process.env.MODEL || "gpt-4.1-mini";
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 45000);
const OPENAI_MAX_RETRIES = Number(process.env.OPENAI_MAX_RETRIES || 2);
const PROFILE_DOCUMENT_MAX_CHARS = Number(
  process.env.PROFILE_DOCUMENT_MAX_CHARS || 12000,
);
const PROFILE_CONTEXT_MAX_CHARS = Number(
  process.env.PROFILE_CONTEXT_MAX_CHARS || 40000,
);

class ServiceError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "ServiceError";
    this.statusCode = statusCode;
  }
}

const stringOrEmpty = z.string().trim().max(2000).optional().default("");

const linkSchema = z.object({
  label: z.string().trim().max(100).optional().or(z.literal("")),
  url: z.string().trim().max(500).optional().or(z.literal("")),
});

const educationItemSchema = z.object({
  school: z.string().trim().min(1),
  degree: stringOrEmpty,
  fieldOfStudy: stringOrEmpty,
  startDate: stringOrEmpty,
  endDate: stringOrEmpty,
  grade: stringOrEmpty,
  description: stringOrEmpty,
  isCurrent: z.boolean().optional().default(false),
});

const workExperienceItemSchema = z.object({
  company: z.string().trim().min(1),
  title: z.string().trim().min(1),
  location: stringOrEmpty,
  startDate: stringOrEmpty,
  endDate: stringOrEmpty,
  isCurrent: z.boolean().optional().default(false),
  description: stringOrEmpty,
  achievements: z.array(z.string().trim().max(300)).optional().default([]),
});

const projectItemSchema = z.object({
  name: z.string().trim().min(1),
  role: stringOrEmpty,
  description: stringOrEmpty,
  technologies: z.array(z.string().trim().max(100)).optional().default([]),
  startDate: stringOrEmpty,
  endDate: stringOrEmpty,
  projectUrl: stringOrEmpty,
  repositoryUrl: stringOrEmpty,
});

const skillItemSchema = z.object({
  name: z.string().trim().min(1),
  level: stringOrEmpty,
  category: stringOrEmpty,
  yearsOfExperience: z.number().int().min(0).max(80).optional(),
  keywords: z.array(z.string().trim().max(100)).optional().default([]),
});

const certificationItemSchema = z.object({
  name: z.string().trim().min(1),
  issuer: stringOrEmpty,
  issueDate: stringOrEmpty,
  expiryDate: stringOrEmpty,
  credentialId: stringOrEmpty,
  credentialUrl: stringOrEmpty,
});

export const manualProfileSchema = z.object({
  personalInfo: z.object({
    name: z.string().trim().max(150).optional().default(""),
    headline: stringOrEmpty,
    summary: stringOrEmpty,
    phone: stringOrEmpty,
    location: stringOrEmpty,
    links: z.array(linkSchema).optional().default([]),
  }),
  preferences: z.object({
    preferredRoles: z.array(z.string().trim().max(120)).optional().default([]),
    preferredLocations: z
      .array(z.string().trim().max(120))
      .optional()
      .default([]),
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

const profileDocumentInputSchema = z.object({
  id: z.string().optional(),
  documentType: z.string().trim().min(1),
  originalName: z.string().trim().min(1),
  parserStatus: z.string().trim().optional().or(z.literal("")),
  parsedText: z.string().trim().optional().or(z.literal("")),
  uploadedAt: z.string().optional(),
});

const llmSettingsSchema = z.object({
  apiKey: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  baseUrl: z.string().trim().min(1).optional(),
});

const generateRequestSchema = z.object({
  currentManualProfile: manualProfileSchema,
  documents: z.array(profileDocumentInputSchema).min(1),
  llmSettings: llmSettingsSchema.optional(),
});

const extractPersonalPreferencesEducationOutputSchema =
  manualProfileSchema.pick({
    personalInfo: true,
    preferences: true,
    education: true,
  });
const extractWorkExperienceProjectsOutputSchema = manualProfileSchema.pick({
  workExperience: true,
  projects: true,
});
const extractSkillsCertificationsOutputSchema = manualProfileSchema.pick({
  skills: true,
  certifications: true,
});

const GraphState = Annotation.Root({
  currentManualProfile: Annotation<ManualProfile>,
  documents: Annotation<ProfileDocumentInput[]>,
  preparedDocuments: Annotation<PreparedDocument[]>,
  extractedPersonalPreferencesEducation: Annotation<ManualProfile>,
  extractedWorkExperienceProjects: Annotation<ManualProfile>,
  extractedSkillsCertifications: Annotation<ManualProfile>,
  extractedProfile: Annotation<ManualProfile>,
  generatedManualProfile: Annotation<ManualProfile>,
});

type ManualProfile = z.infer<typeof manualProfileSchema>;
type ProfileDocumentInput = z.infer<typeof profileDocumentInputSchema>;
type LlmSettings = z.infer<typeof llmSettingsSchema>;
type PreparedDocument = {
  documentType: string;
  originalName: string;
  parsedText: string;
};

const emptyProfile = (): ManualProfile => ({
  personalInfo: {
    name: "",
    headline: "",
    summary: "",
    phone: "",
    location: "",
    links: [],
  },
  preferences: {
    preferredRoles: [],
    preferredLocations: [],
    workAuthorization: "",
    salaryRange: "",
    availability: "",
  },
  education: [],
  workExperience: [],
  projects: [],
  skills: [],
  certifications: [],
});

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const cleanStringArray = (values: unknown): string[] =>
  Array.isArray(values)
    ? values.map((value) => normalizeText(value)).filter(Boolean)
    : [];

const uniqueByKey = <T>(items: T[], getKey: (item: T) => string): T[] => {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }
  return unique;
};

const normalizeDate = (value: string): string => {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }

  const monthMatch = text.match(/^(\d{4})[-/](\d{1,2})$/);
  if (monthMatch) {
    const month = monthMatch[2].padStart(2, "0");
    return `${monthMatch[1]}-${month}`;
  }

  const yearMatch = text.match(/^(\d{4})$/);
  if (yearMatch) {
    return yearMatch[1];
  }

  return text;
};

const sanitizeManualProfile = (profile: unknown): ManualProfile => {
  const raw =
    profile && typeof profile === "object"
      ? (profile as Partial<ManualProfile>)
      : {};

  const personalLinks = Array.isArray(raw.personalInfo?.links)
    ? raw.personalInfo.links
        .map((link) => ({
          label: normalizeText(link?.label),
          url: normalizeText(link?.url),
        }))
        .filter((link) => link.label || link.url)
    : [];

  const sanitized: ManualProfile = {
    personalInfo: {
      name: normalizeText(raw.personalInfo?.name),
      headline: normalizeText(raw.personalInfo?.headline),
      summary: normalizeText(raw.personalInfo?.summary),
      phone: normalizeText(raw.personalInfo?.phone),
      location: normalizeText(raw.personalInfo?.location),
      links: uniqueByKey(
        personalLinks,
        (item) => `${item.label.toLowerCase()}|${item.url.toLowerCase()}`,
      ),
    },
    preferences: {
      preferredRoles: cleanStringArray(raw.preferences?.preferredRoles),
      preferredLocations: cleanStringArray(raw.preferences?.preferredLocations),
      workAuthorization: normalizeText(raw.preferences?.workAuthorization),
      salaryRange: normalizeText(raw.preferences?.salaryRange),
      availability: normalizeText(raw.preferences?.availability),
    },
    education: Array.isArray(raw.education)
      ? raw.education
          .map((item) => ({
            school: normalizeText(item?.school),
            degree: normalizeText(item?.degree),
            fieldOfStudy: normalizeText(item?.fieldOfStudy),
            startDate: normalizeDate(normalizeText(item?.startDate)),
            endDate: normalizeDate(normalizeText(item?.endDate)),
            grade: normalizeText(item?.grade),
            description: normalizeText(item?.description),
            isCurrent: Boolean(item?.isCurrent),
          }))
          .filter((item) => item.school)
      : [],
    workExperience: Array.isArray(raw.workExperience)
      ? raw.workExperience
          .map((item) => ({
            company: normalizeText(item?.company),
            title: normalizeText(item?.title),
            location: normalizeText(item?.location),
            startDate: normalizeDate(normalizeText(item?.startDate)),
            endDate: normalizeDate(normalizeText(item?.endDate)),
            isCurrent: Boolean(item?.isCurrent),
            description: normalizeText(item?.description),
            achievements: cleanStringArray(item?.achievements),
          }))
          .filter((item) => item.company && item.title)
      : [],
    projects: Array.isArray(raw.projects)
      ? raw.projects
          .map((item) => ({
            name: normalizeText(item?.name),
            role: normalizeText(item?.role),
            description: normalizeText(item?.description),
            technologies: cleanStringArray(item?.technologies),
            startDate: normalizeDate(normalizeText(item?.startDate)),
            endDate: normalizeDate(normalizeText(item?.endDate)),
            projectUrl: normalizeText(item?.projectUrl),
            repositoryUrl: normalizeText(item?.repositoryUrl),
          }))
          .filter((item) => item.name)
      : [],
    skills: Array.isArray(raw.skills)
      ? raw.skills
          .map((item) => ({
            name: normalizeText(item?.name),
            level: normalizeText(item?.level),
            category: normalizeText(item?.category),
            yearsOfExperience:
              typeof item?.yearsOfExperience === "number" &&
              Number.isFinite(item.yearsOfExperience)
                ? item.yearsOfExperience
                : undefined,
            keywords: cleanStringArray(item?.keywords),
          }))
          .filter((item) => item.name)
      : [],
    certifications: Array.isArray(raw.certifications)
      ? raw.certifications
          .map((item) => ({
            name: normalizeText(item?.name),
            issuer: normalizeText(item?.issuer),
            issueDate: normalizeDate(normalizeText(item?.issueDate)),
            expiryDate: normalizeDate(normalizeText(item?.expiryDate)),
            credentialId: normalizeText(item?.credentialId),
            credentialUrl: normalizeText(item?.credentialUrl),
          }))
          .filter((item) => item.name)
      : [],
  };

  return manualProfileSchema.parse(sanitized);
};

const mergeString = (preferred: unknown, fallback: unknown) =>
  normalizeText(preferred) || normalizeText(fallback);

const mergeArray = (preferred: string[], fallback: string[]) =>
  uniqueByKey(
    [...cleanStringArray(preferred), ...cleanStringArray(fallback)],
    (value) => value.toLowerCase(),
  );

const mergeProfile = (
  currentManualProfile: ManualProfile,
  extractedProfile: ManualProfile,
): ManualProfile => {
  const current = sanitizeManualProfile(currentManualProfile);
  const extracted = sanitizeManualProfile(extractedProfile);

  const merged: ManualProfile = {
    personalInfo: {
      name: mergeString(extracted.personalInfo.name, current.personalInfo.name),
      headline: mergeString(
        extracted.personalInfo.headline,
        current.personalInfo.headline,
      ),
      summary: mergeString(
        extracted.personalInfo.summary,
        current.personalInfo.summary,
      ),
      phone: mergeString(
        extracted.personalInfo.phone,
        current.personalInfo.phone,
      ),
      location: mergeString(
        extracted.personalInfo.location,
        current.personalInfo.location,
      ),
      links: uniqueByKey(
        [...extracted.personalInfo.links, ...current.personalInfo.links],
        (item) =>
          `${normalizeText(item.label).toLowerCase()}|${normalizeText(item.url).toLowerCase()}`,
      ),
    },
    preferences: {
      preferredRoles: mergeArray(
        extracted.preferences.preferredRoles,
        current.preferences.preferredRoles,
      ),
      preferredLocations: mergeArray(
        extracted.preferences.preferredLocations,
        current.preferences.preferredLocations,
      ),
      workAuthorization: mergeString(
        extracted.preferences.workAuthorization,
        current.preferences.workAuthorization,
      ),
      salaryRange: mergeString(
        extracted.preferences.salaryRange,
        current.preferences.salaryRange,
      ),
      availability: mergeString(
        extracted.preferences.availability,
        current.preferences.availability,
      ),
    },
    education: uniqueByKey(
      [...extracted.education, ...current.education],
      (item) =>
        `${normalizeText(item.school).toLowerCase()}|${normalizeText(item.degree).toLowerCase()}|${normalizeText(item.startDate).toLowerCase()}|${normalizeText(item.endDate).toLowerCase()}`,
    ),
    workExperience: uniqueByKey(
      [...extracted.workExperience, ...current.workExperience],
      (item) =>
        `${normalizeText(item.company).toLowerCase()}|${normalizeText(item.title).toLowerCase()}|${normalizeText(item.startDate).toLowerCase()}|${normalizeText(item.endDate).toLowerCase()}`,
    ),
    projects: uniqueByKey(
      [...extracted.projects, ...current.projects],
      (item) =>
        `${normalizeText(item.name).toLowerCase()}|${normalizeText(item.role).toLowerCase()}`,
    ),
    skills: uniqueByKey(
      [...extracted.skills, ...current.skills],
      (item) =>
        `${normalizeText(item.name).toLowerCase()}|${normalizeText(item.category).toLowerCase()}`,
    ).map((item) => ({
      ...item,
      yearsOfExperience:
        typeof item.yearsOfExperience === "number"
          ? item.yearsOfExperience
          : undefined,
    })),
    certifications: uniqueByKey(
      [...extracted.certifications, ...current.certifications],
      (item) =>
        `${normalizeText(item.name).toLowerCase()}|${normalizeText(item.issuer).toLowerCase()}|${normalizeText(item.issueDate).toLowerCase()}`,
    ),
  };

  return sanitizeManualProfile(merged);
};

const clampChars = (value: string, maxChars: number): string => {
  if (maxChars <= 0 || value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n...[truncated]`;
};

const isTimeoutLikeError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const asRecord = error as Record<string, unknown>;
  const name = typeof asRecord.name === "string" ? asRecord.name : "";
  const message = typeof asRecord.message === "string" ? asRecord.message : "";
  return (
    /timeout/i.test(name) ||
    /timed out/i.test(message) ||
    /ETIMEDOUT/i.test(message)
  );
};

const buildDocumentContext = (
  documents: PreparedDocument[],
  options?: {
    maxDocumentChars?: number;
    maxTotalChars?: number;
  },
) => {
  const maxDocumentChars =
    options?.maxDocumentChars ?? PROFILE_DOCUMENT_MAX_CHARS;
  const maxTotalChars = options?.maxTotalChars ?? PROFILE_CONTEXT_MAX_CHARS;

  let totalChars = 0;
  const chunks: string[] = [];

  for (let index = 0; index < documents.length; index += 1) {
    const document = documents[index];
    const clampedText = clampChars(document.parsedText, maxDocumentChars);
    const chunk = `Document ${index + 1}\nType: ${document.documentType}\nFilename: ${document.originalName}\nContent:\n${clampedText}`;
    const separatorLength = chunks.length ? 10 : 0; // "\n\n-----\n\n"
    if (
      chunks.length &&
      totalChars + separatorLength + chunk.length > maxTotalChars
    ) {
      break;
    }
    chunks.push(chunk);
    totalChars += separatorLength + chunk.length;
  }

  return chunks.join("\n\n-----\n\n");
};

// llmSettings, when provided, comes from a user's own Settings panel entry
// (name/url/key) and takes priority over this service's environment variables.
const buildModel = (llmSettings?: LlmSettings) => {
  const apiKey = llmSettings?.apiKey || OPENAI_API_KEY;
  const model = llmSettings?.model || OPENAI_MODEL;
  const baseUrl = llmSettings?.baseUrl || OPENAI_BASE_URL;

  if (!apiKey) {
    throw new ServiceError(
      "OPENAI_API_KEY (or DASHSCOPE_API_KEY) is required for profile generation",
      500,
    );
  }

  return new ChatOpenAI({
    apiKey,
    model,
    temperature: 0,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: OPENAI_MAX_RETRIES,
    configuration: baseUrl ? { baseURL: baseUrl } : undefined,
  });
};

export async function generateUserInformationProfile({
  currentManualProfile,
  documents,
  llmSettings,
  onProgress,
}: {
  currentManualProfile: ManualProfile;
  documents: ProfileDocumentInput[];
  llmSettings?: LlmSettings;
  onProgress?: (message: string) => void | Promise<void>;
}): Promise<ManualProfile> {
  const safeCurrent = sanitizeManualProfile(currentManualProfile);
  const safeDocuments = z.array(profileDocumentInputSchema).parse(documents);

  const llm = buildModel(llmSettings);

  const runProgress = async (message: string) => {
    if (onProgress) {
      await onProgress(message);
    }
  };

  const prepareDocuments = async (state: typeof GraphState.State) => {
    await runProgress("Preparing parsed document text for extraction...");
    const preparedDocuments = state.documents
      .map((document) => ({
        documentType: document.documentType,
        originalName: document.originalName,
        parsedText: normalizeText(document.parsedText),
      }))
      .filter((document) => Boolean(document.parsedText));

    if (!preparedDocuments.length) {
      throw new ServiceError(
        "Uploaded documents are still being parsed or do not contain extractable text. Please wait for parsing to complete or upload parseable documents.",
        400,
      );
    }

    return { preparedDocuments };
  };

  const extractProfileSegment = async ({
    state,
    outputSchema,
    progressMessage,
    timeoutProgressMessage,
    focusGuidelines,
  }: {
    state: typeof GraphState.State;
    outputSchema: z.ZodTypeAny;
    progressMessage: string;
    timeoutProgressMessage: string;
    focusGuidelines: string[];
  }): Promise<ManualProfile> => {
    await runProgress(progressMessage);
    const extractor = llm.withStructuredOutput(outputSchema);

    const promptPrefix = [
      "You are an expert career profile extraction engine.",
      "Your task is to extract structured user profile data strictly from the provided document text.",
      "STRICT RULES:",
      "- Extract only information that is explicitly stated in the document.",
      "- Do NOT infer, assume, or generate any missing information.",
      "- Never invent schools, employers, projects, dates, achievements, certifications, links, grades, or skills.",
      '- If a value is not clearly provided, return an empty string "" or an empty array [].',
      "- Always ensure required identifiers are non-empty when the item exists (e.g., school, company, title, project name, skill name, certification name). If the item cannot be confidently identified, omit the entire item instead of guessing.",
      "- if there is a resume in the Document context, makre sure capture all infoamtion from the resume.",
      "DATE FORMATTING:",
      '- Use "YYYY-MM" when both year and month are available.',
      '- Use "YYYY" when only the year is available.',
      '- Use "" if no valid date is found.',
      "OUTPUT FORMAT:",
      "- Return ONLY a valid JSON object.",
      "- Do not include explanations, comments, or extra text.",
      "- Ensure the output strictly matches the required schema provided separately.",
      "TARGET FIELDS FOR THIS NODE:",
      ...focusGuidelines,
      "Achievements & descriptions should stay concise and grounded in source text.",
      "FINAL CHECK:",
      "- Ensure JSON validity (no trailing commas, correct structure).",
      "- Ensure no hallucinated or unsupported data is present.",
      "Document context:",
    ].join("\n\n");

    const normalContext = buildDocumentContext(state.preparedDocuments || []);
    const fallbackContext = buildDocumentContext(
      state.preparedDocuments || [],
      {
        maxDocumentChars: Math.max(
          2000,
          Math.floor(PROFILE_DOCUMENT_MAX_CHARS / 2),
        ),
        maxTotalChars: Math.max(
          8000,
          Math.floor(PROFILE_CONTEXT_MAX_CHARS / 2),
        ),
      },
    );

    let extracted: unknown;
    try {
      extracted = await extractor.invoke(
        `${promptPrefix}\n\n\"${normalContext}\"`,
      );
    } catch (error) {
      if (!isTimeoutLikeError(error)) {
        throw error;
      }

      await runProgress(timeoutProgressMessage);
      try {
        extracted = await extractor.invoke(
          `${promptPrefix}\n\n\"${fallbackContext}\"`,
        );
      } catch (fallbackError) {
        if (isTimeoutLikeError(fallbackError)) {
          throw new ServiceError(
            "AI extraction timed out. Increase OPENAI_TIMEOUT_MS or reduce uploaded document size/content.",
            504,
          );
        }
        throw fallbackError;
      }
    }

    return sanitizeManualProfile(extracted || {});
  };

  const extractPersonalPreferencesEducation = async (
    state: typeof GraphState.State,
  ) => {
    const extractedPersonalPreferencesEducation = await extractProfileSegment({
      state,
      outputSchema: extractPersonalPreferencesEducationOutputSchema,
      progressMessage:
        "Extracting Personal Info, Preferences, and Education in parallel...",
      timeoutProgressMessage:
        "Personal/Preferences/Education extraction timed out; retrying with a compressed document context...",
      focusGuidelines: [
        "- Personal Info: Extract direct contact and identity details only (no assumptions).",
        "- Personal Info: Write personalInfo.summary as a concise job-hunting summary grounded in explicit evidence.",
        "- Preferences: Only include if explicitly mentioned (e.g., desired roles, locations, salary).",
        "- Education: Include formal education entries only.",
        '- Education: Always include the "description" field for each education item (use "" when no evidence is available).',
      ],
    });
    return { extractedPersonalPreferencesEducation };
  };

  const extractWorkExperienceProjects = async (
    state: typeof GraphState.State,
  ) => {
    const extractedWorkExperienceProjects = await extractProfileSegment({
      state,
      outputSchema: extractWorkExperienceProjectsOutputSchema,
      progressMessage: "Extracting Work Experience and Projects in parallel...",
      timeoutProgressMessage:
        "Work Experience/Projects extraction timed out; retrying with a compressed document context...",
      focusGuidelines: [
        "- Work Experience: Include professional roles with clear company and title.",
        "- Work Experience: if no explicit description, summarize the related projects as work experience description.",
        "- Projects: Include only clearly defined projects (academic, personal, or professional).",
      ],
    });
    return { extractedWorkExperienceProjects };
  };

  const extractSkillsCertifications = async (
    state: typeof GraphState.State,
  ) => {
    const extractedSkillsCertifications = await extractProfileSegment({
      state,
      outputSchema: extractSkillsCertificationsOutputSchema,
      progressMessage: "Extracting Skills and Certifications in parallel...",
      timeoutProgressMessage:
        "Skills/Certifications extraction timed out; retrying with a compressed document context...",
      focusGuidelines: [
        "- Skills: Extract generalizable knowledge areas, not overly specific fragments.",
        "- Skills can include programming languages, frameworks, tools, and platforms.",
        "- Avoid too specific entries. For example, if multiple similar ML skills appear, keep a normalized broader skill where appropriate.",
        '- Normalize similar skills where appropriate (e.g., "React.js" -> "React").',
        "- Certifications: Include only formally named certifications with a clear issuer when available.",
      ],
    });
    return { extractedSkillsCertifications };
  };

  const combineParallelExtractions = async (state: typeof GraphState.State) => {
    await runProgress("Combining parallel extraction outputs...");
    let extractedProfile = mergeProfile(
      emptyProfile(),
      state.extractedPersonalPreferencesEducation || emptyProfile(),
    );
    extractedProfile = mergeProfile(
      extractedProfile,
      state.extractedWorkExperienceProjects || emptyProfile(),
    );
    extractedProfile = mergeProfile(
      extractedProfile,
      state.extractedSkillsCertifications || emptyProfile(),
    );
    return { extractedProfile };
  };

  const mergeWithCurrentProfile = async (state: typeof GraphState.State) => {
    await runProgress("Merging extracted data with current profile...");
    const generatedManualProfile = mergeProfile(
      state.currentManualProfile,
      state.extractedProfile || emptyProfile(),
    );
    return { generatedManualProfile };
  };

  const validateProfile = async (state: typeof GraphState.State) => {
    await runProgress("Validating generated profile draft...");
    const generatedManualProfile = sanitizeManualProfile(
      state.generatedManualProfile || state.currentManualProfile,
    );
    return { generatedManualProfile };
  };

  const graph = new StateGraph(GraphState)
    .addNode("prepareDocuments", prepareDocuments)
    .addNode(
      "extractPersonalPreferencesEducation",
      extractPersonalPreferencesEducation,
    )
    .addNode("extractWorkExperienceProjects", extractWorkExperienceProjects)
    .addNode("extractSkillsCertifications", extractSkillsCertifications)
    .addNode("combineParallelExtractions", combineParallelExtractions)
    .addNode("mergeWithCurrentProfile", mergeWithCurrentProfile)
    .addNode("validateProfile", validateProfile)
    .addEdge(START, "prepareDocuments")
    .addEdge("prepareDocuments", "extractPersonalPreferencesEducation")
    .addEdge("prepareDocuments", "extractWorkExperienceProjects")
    .addEdge("prepareDocuments", "extractSkillsCertifications")
    .addEdge(
      "extractPersonalPreferencesEducation",
      "combineParallelExtractions",
    )
    .addEdge("extractWorkExperienceProjects", "combineParallelExtractions")
    .addEdge("extractSkillsCertifications", "combineParallelExtractions")
    .addEdge("combineParallelExtractions", "mergeWithCurrentProfile")
    .addEdge("mergeWithCurrentProfile", "validateProfile")
    .addEdge("validateProfile", END)
    .compile();

  const result = await graph.invoke({
    currentManualProfile: safeCurrent,
    documents: safeDocuments,
    preparedDocuments: [],
    extractedPersonalPreferencesEducation: emptyProfile(),
    extractedWorkExperienceProjects: emptyProfile(),
    extractedSkillsCertifications: emptyProfile(),
    extractedProfile: emptyProfile(),
    generatedManualProfile: safeCurrent,
  });

  return sanitizeManualProfile(result.generatedManualProfile || safeCurrent);
}

const parseRequestBody = async (
  req: http.IncomingMessage,
): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text);
};

const writeJson = (
  res: http.ServerResponse,
  statusCode: number,
  payload: unknown,
) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

const handleGenerateRequest = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => {
  try {
    const payload = generateRequestSchema.parse(await parseRequestBody(req));
    const manualProfile = await generateUserInformationProfile({
      currentManualProfile: payload.currentManualProfile,
      documents: payload.documents,
      llmSettings: payload.llmSettings,
    });

    writeJson(res, 200, {
      success: true,
      data: { manualProfile },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      writeJson(res, 400, {
        success: false,
        error: "Invalid generation payload",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const statusCode = error instanceof ServiceError ? error.statusCode : 500;
    writeJson(res, statusCode, {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate manual profile",
    });
  }
};

export const startProfileGenerationServer = (
  port = DEFAULT_PORT,
  host = DEFAULT_HOST,
) => {
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === GENERATE_ROUTE) {
      await handleGenerateRequest(req, res);
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      writeJson(res, 200, { success: true, status: "ok" });
      return;
    }

    writeJson(res, 404, { success: false, error: "Not found" });
  });

  server.listen(port, host, () => {
    console.log(
      `LangGraph profile service listening on http://${host}:${port}`,
    );
  });

  return server;
};

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  startProfileGenerationServer();
}
