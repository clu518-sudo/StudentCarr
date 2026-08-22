import prisma from "../lib/prisma.js";
import { removeFileSafe } from "./pm.storage.js";
import { enqueueDocumentParsing } from "../documentParsing/index.js";
import { DOCUMENT_PARSER_STATUS } from "../documentParsing/constants.js";
import { getDecryptedLlmKey } from "../llmSettings/llmSettings.service.js";

const PROFILE_GENERATION_SERVICE_URL =
  process.env.PROFILE_GENERATION_SERVICE_URL ||
  "http://127.0.0.1:10002/generate-profile";

const isAbortError = (error) =>
  error?.name === "AbortError" || error?.code === "ABORT_ERR";

const toStringOrNull = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const cleanStringArray = (values = []) =>
  values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

const cleanLinks = (links = []) =>
  links
    .map((link) => ({
      label: typeof link.label === "string" ? link.label.trim() : "",
      url: typeof link.url === "string" ? link.url.trim() : "",
    }))
    .filter((link) => link.label || link.url);

const getManualProfileSkeleton = () => ({
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

const normalizeManualProfileForStorage = (manualData) => ({
  personalInfo: {
    name: toStringOrNull(manualData.personalInfo?.name),
    headline: toStringOrNull(manualData.personalInfo?.headline),
    summary: toStringOrNull(manualData.personalInfo?.summary),
    phone: toStringOrNull(manualData.personalInfo?.phone),
    location: toStringOrNull(manualData.personalInfo?.location),
    links: cleanLinks(manualData.personalInfo?.links || []),
  },
  preferences: {
    preferredRoles: cleanStringArray(
      manualData.preferences?.preferredRoles || [],
    ),
    preferredLocations: cleanStringArray(
      manualData.preferences?.preferredLocations || [],
    ),
    workAuthorization: toStringOrNull(
      manualData.preferences?.workAuthorization,
    ),
    salaryRange: toStringOrNull(manualData.preferences?.salaryRange),
    availability: toStringOrNull(manualData.preferences?.availability),
  },
  education: (manualData.education || []).map((item, index) => ({
    school: item.school.trim(),
    degree: toStringOrNull(item.degree),
    fieldOfStudy: toStringOrNull(item.fieldOfStudy),
    startDate: toStringOrNull(item.startDate),
    endDate: toStringOrNull(item.endDate),
    grade: toStringOrNull(item.grade),
    description: toStringOrNull(item.description),
    isCurrent: Boolean(item.isCurrent),
    sortOrder: index,
  })),
  workExperience: (manualData.workExperience || []).map((item, index) => ({
    company: item.company.trim(),
    title: item.title.trim(),
    location: toStringOrNull(item.location),
    startDate: toStringOrNull(item.startDate),
    endDate: toStringOrNull(item.endDate),
    isCurrent: Boolean(item.isCurrent),
    description: toStringOrNull(item.description),
    achievements: cleanStringArray(item.achievements || []),
    sortOrder: index,
  })),
  projects: (manualData.projects || []).map((item, index) => ({
    name: item.name.trim(),
    role: toStringOrNull(item.role),
    description: toStringOrNull(item.description),
    technologies: cleanStringArray(item.technologies || []),
    startDate: toStringOrNull(item.startDate),
    endDate: toStringOrNull(item.endDate),
    projectUrl: toStringOrNull(item.projectUrl),
    repositoryUrl: toStringOrNull(item.repositoryUrl),
    sortOrder: index,
  })),
  skills: (manualData.skills || []).map((item, index) => ({
    name: item.name.trim(),
    level: toStringOrNull(item.level),
    category: toStringOrNull(item.category),
    yearsOfExperience:
      typeof item.yearsOfExperience === "number"
        ? item.yearsOfExperience
        : null,
    keywords: cleanStringArray(item.keywords || []),
    sortOrder: index,
  })),
  certifications: (manualData.certifications || []).map((item, index) => ({
    name: item.name.trim(),
    issuer: toStringOrNull(item.issuer),
    issueDate: toStringOrNull(item.issueDate),
    expiryDate: toStringOrNull(item.expiryDate),
    credentialId: toStringOrNull(item.credentialId),
    credentialUrl: toStringOrNull(item.credentialUrl),
    sortOrder: index,
  })),
});

const mapProfileToManualResponse = (user, profile) => {
  const fallback = getManualProfileSkeleton();
  if (!profile) {
    fallback.personalInfo.name = user?.fullName || "";
    return fallback;
  }

  return {
    personalInfo: {
      name: user?.fullName || "",
      headline: profile.headline || "",
      summary: profile.summary || "",
      phone: profile.phone || "",
      location: profile.location || "",
      links: Array.isArray(profile.links) ? profile.links : [],
    },
    preferences: {
      preferredRoles: Array.isArray(profile.preferredRoles)
        ? profile.preferredRoles
        : [],
      preferredLocations: Array.isArray(profile.preferredLocations)
        ? profile.preferredLocations
        : [],
      workAuthorization: profile.workAuthorization || "",
      salaryRange: profile.salaryRange || "",
      availability: profile.availability || "",
    },
    education: profile.education.map((item) => ({
      school: item.school,
      degree: item.degree || "",
      fieldOfStudy: item.fieldOfStudy || "",
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      grade: item.grade || "",
      description: item.description || "",
      isCurrent: item.isCurrent,
    })),
    workExperience: profile.workExperiences.map((item) => ({
      company: item.company,
      title: item.title,
      location: item.location || "",
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      isCurrent: item.isCurrent,
      description: item.description || "",
      achievements: Array.isArray(item.achievements) ? item.achievements : [],
    })),
    projects: profile.projects.map((item) => ({
      name: item.name,
      role: item.role || "",
      description: item.description || "",
      technologies: Array.isArray(item.technologies) ? item.technologies : [],
      startDate: item.startDate || "",
      endDate: item.endDate || "",
      projectUrl: item.projectUrl || "",
      repositoryUrl: item.repositoryUrl || "",
    })),
    skills: profile.skills.map((item) => ({
      name: item.name,
      level: item.level || "",
      category: item.category || "",
      yearsOfExperience:
        typeof item.yearsOfExperience === "number"
          ? item.yearsOfExperience
          : "",
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
    })),
    certifications: profile.certifications.map((item) => ({
      name: item.name,
      issuer: item.issuer || "",
      issueDate: item.issueDate || "",
      expiryDate: item.expiryDate || "",
      credentialId: item.credentialId || "",
      credentialUrl: item.credentialUrl || "",
    })),
  };
};

const mapDocument = (document) => ({
  id: document.id,
  documentType: document.documentType,
  originalName: document.originalName,
  mimeType: document.mimeType,
  size: document.size,
  status: document.parserStatus || document.status,
  uploadStatus: document.status,
  parserStatus: document.parserStatus,
  extractionMethod: document.extractionMethod,
  pageCount: document.pageCount,
  parserError: document.parserError,
  parserStartedAt: document.parserStartedAt,
  parserCompletedAt: document.parserCompletedAt,
  parserUpdatedAt: document.parserUpdatedAt,
  uploadedAt: document.uploadedAt,
});

const documentListSelect = {
  id: true,
  documentType: true,
  originalName: true,
  mimeType: true,
  size: true,
  status: true,
  parserStatus: true,
  extractionMethod: true,
  pageCount: true,
  parserError: true,
  parserStartedAt: true,
  parserCompletedAt: true,
  parserUpdatedAt: true,
  uploadedAt: true,
};

const getProfileForUser = async (userId) => {
  const [user, profile, documents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true },
    }),
    prisma.userProfile.findUnique({
      where: { userId },
      include: {
        education: { orderBy: { sortOrder: "asc" } },
        workExperiences: { orderBy: { sortOrder: "asc" } },
        projects: { orderBy: { sortOrder: "asc" } },
        certifications: { orderBy: { sortOrder: "asc" } },
        skills: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.profileDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: "desc" },
      select: documentListSelect,
    }),
  ]);

  return {
    manualProfile: mapProfileToManualResponse(user, profile),
    documents: documents.map(mapDocument),
  };
};

const upsertManualProfileForUser = async (userId, manualData) => {
  const normalized = normalizeManualProfileForStorage(manualData);

  await prisma.$transaction(async (tx) => {
    if (normalized.personalInfo.name !== null) {
      await tx.user.update({
        where: { id: userId },
        data: { fullName: normalized.personalInfo.name },
      });
    }

    const upsertedProfile = await tx.userProfile.upsert({
      where: { userId },
      update: {
        headline: normalized.personalInfo.headline,
        summary: normalized.personalInfo.summary,
        phone: normalized.personalInfo.phone,
        location: normalized.personalInfo.location,
        preferredRoles: normalized.preferences.preferredRoles,
        preferredLocations: normalized.preferences.preferredLocations,
        workAuthorization: normalized.preferences.workAuthorization,
        salaryRange: normalized.preferences.salaryRange,
        availability: normalized.preferences.availability,
        links: normalized.personalInfo.links,
      },
      create: {
        userId,
        headline: normalized.personalInfo.headline,
        summary: normalized.personalInfo.summary,
        phone: normalized.personalInfo.phone,
        location: normalized.personalInfo.location,
        preferredRoles: normalized.preferences.preferredRoles,
        preferredLocations: normalized.preferences.preferredLocations,
        workAuthorization: normalized.preferences.workAuthorization,
        salaryRange: normalized.preferences.salaryRange,
        availability: normalized.preferences.availability,
        links: normalized.personalInfo.links,
      },
      select: { id: true },
    });

    const userProfileId = upsertedProfile.id;
    await Promise.all([
      tx.education.deleteMany({ where: { userProfileId } }),
      tx.workExperience.deleteMany({ where: { userProfileId } }),
      tx.project.deleteMany({ where: { userProfileId } }),
      tx.skill.deleteMany({ where: { userProfileId } }),
      tx.certification.deleteMany({ where: { userProfileId } }),
    ]);

    if (normalized.education.length) {
      await tx.education.createMany({
        data: normalized.education.map((item) => ({ ...item, userProfileId })),
      });
    }
    if (normalized.workExperience.length) {
      await tx.workExperience.createMany({
        data: normalized.workExperience.map((item) => ({
          ...item,
          userProfileId,
        })),
      });
    }
    if (normalized.projects.length) {
      await tx.project.createMany({
        data: normalized.projects.map((item) => ({ ...item, userProfileId })),
      });
    }
    if (normalized.skills.length) {
      await tx.skill.createMany({
        data: normalized.skills.map((item) => ({ ...item, userProfileId })),
      });
    }
    if (normalized.certifications.length) {
      await tx.certification.createMany({
        data: normalized.certifications.map((item) => ({
          ...item,
          userProfileId,
        })),
      });
    }
  });
};

const listDocumentsForUser = async (userId) => {
  const documents = await prisma.profileDocument.findMany({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
    select: documentListSelect,
  });
  return documents.map(mapDocument);
};

const listDocumentsWithParsedTextForUser = async (userId) => {
  const documents = await prisma.profileDocument.findMany({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      documentType: true,
      originalName: true,
      parserStatus: true,
      parsedText: true,
      uploadedAt: true,
    },
  });

  return documents.map((document) => ({
    id: document.id,
    documentType: document.documentType,
    originalName: document.originalName,
    parserStatus: document.parserStatus,
    parsedText: document.parsedText || "",
    uploadedAt:
      document.uploadedAt instanceof Date
        ? document.uploadedAt.toISOString()
        : "",
  }));
};

const uploadDocumentsForUser = async (
  userId,
  files,
  documentTypes,
  optionalGithubUrl,
) => {
  if (!files?.length) {
    const error = new Error("At least one document file is required");
    error.statusCode = 400;
    throw error;
  }

  if (documentTypes.length !== files.length) {
    const error = new Error(
      "Each uploaded document must have an associated document type",
    );
    error.statusCode = 400;
    throw error;
  }

  const linksToSave = optionalGithubUrl
    ? [{ label: "GitHub", url: optionalGithubUrl }]
    : [];

  try {
    const createdDocs = await prisma.$transaction(async (tx) => {
      if (linksToSave.length) {
        const existingProfile = await tx.userProfile.findUnique({
          where: { userId },
          select: { links: true },
        });

        const existingLinks = Array.isArray(existingProfile?.links)
          ? existingProfile.links
          : [];
        const mergedLinks = [
          ...existingLinks.filter((item) => item?.label !== "GitHub"),
          ...linksToSave,
        ];

        await tx.userProfile.upsert({
          where: { userId },
          update: { links: mergedLinks },
          create: { userId, links: mergedLinks },
        });
      }

      const created = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const savedDoc = await tx.profileDocument.create({
          data: {
            userId,
            documentType: documentTypes[index],
            originalName: file.originalname,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
            path: file.path,
            status: "uploaded",
            parserStatus: DOCUMENT_PARSER_STATUS.PENDING,
            parserError: null,
          },
          select: documentListSelect,
        });
        created.push(savedDoc);
      }

      return created;
    });

    createdDocs.forEach((document) => {
      enqueueDocumentParsing(document.id);
    });

    return createdDocs.map(mapDocument);
  } catch (error) {
    await Promise.all((files || []).map((file) => removeFileSafe(file.path)));
    throw error;
  }
};

const uploadSingleDocumentForUser = async (
  userId,
  file,
  documentType,
  optionalGithubUrl,
) => {
  if (!file) {
    const error = new Error("A document file is required");
    error.statusCode = 400;
    throw error;
  }

  const documents = await uploadDocumentsForUser(
    userId,
    [file],
    [documentType],
    optionalGithubUrl,
  );
  return documents[0];
};

const deleteDocumentForUser = async (userId, documentId) => {
  const existing = await prisma.profileDocument.findFirst({
    where: { id: documentId, userId },
  });

  if (!existing) {
    const error = new Error("Document not found");
    error.statusCode = 404;
    throw error;
  }

  await prisma.profileDocument.delete({ where: { id: existing.id } });
  await removeFileSafe(existing.path);
};

const getDocumentForUser = async (userId, documentId) => {
  const document = await prisma.profileDocument.findFirst({
    where: { id: documentId, userId },
  });

  if (!document) {
    const error = new Error("Document not found");
    error.statusCode = 404;
    throw error;
  }

  return document;
};

const requestGeneratedManualProfile = async (
  currentManualProfile,
  documents,
  signal,
  llmSettings,
) => {
  let response;
  try {
    response = await fetch(PROFILE_GENERATION_SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentManualProfile,
        documents,
        llmSettings,
      }),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    const networkError = new Error(
      "Unable to reach the AI profile generation service. Make sure AIServices is running.",
    );
    networkError.statusCode = 502;
    throw networkError;
  }

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const serviceError = new Error(
      responseBody?.error ||
        "AI profile generation failed. Please try again in a moment.",
    );
    serviceError.statusCode = response.status >= 400 ? response.status : 502;
    throw serviceError;
  }

  const manualProfile = responseBody?.data?.manualProfile;
  if (!manualProfile || typeof manualProfile !== "object") {
    const shapeError = new Error(
      "AI profile service returned an invalid profile shape.",
    );
    shapeError.statusCode = 502;
    throw shapeError;
  }

  return manualProfile;
};

const generateManualProfileForUserDummy = async (
  userId,
  onProgress,
  options = {},
) => {
  const signal = options?.signal;
  if (signal?.aborted) {
    const abortError = new Error("Generation cancelled");
    abortError.name = "AbortError";
    throw abortError;
  }

  const current = await getProfileForUser(userId);
  if (!current.documents.length) {
    const error = new Error(
      "Upload at least one document before generating profile content",
    );
    error.statusCode = 400;
    throw error;
  }

  if (onProgress) {
    onProgress("Analyzing uploaded documents...");
  }

  const sourceDocuments = await listDocumentsWithParsedTextForUser(userId);
  const hasUsableParsedText = sourceDocuments.some(
    (document) => typeof document.parsedText === "string" && document.parsedText.trim(),
  );
  if (!hasUsableParsedText) {
    const error = new Error(
      "Uploaded documents are still being parsed or do not contain extractable text. Please wait for parsing to complete or upload parseable documents.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (onProgress) {
    onProgress("Extracting profile details from parsed documents...");
  }

  const userLlmKey = await getDecryptedLlmKey({ userId });
  const llmSettings = userLlmKey
    ? {
        apiKey: userLlmKey.apiKey,
        model: userLlmKey.model || undefined,
        baseUrl: userLlmKey.baseUrl || undefined,
      }
    : undefined;

  const generatedManualProfile = await requestGeneratedManualProfile(
    current.manualProfile,
    sourceDocuments,
    signal,
    llmSettings,
  );

  if (onProgress) {
    onProgress("Generated profile draft is ready for review.");
  }

  return {
    ...current,
    manualProfile: generatedManualProfile,
  };
};

export {
  getProfileForUser,
  upsertManualProfileForUser,
  listDocumentsForUser,
  uploadDocumentsForUser,
  uploadSingleDocumentForUser,
  deleteDocumentForUser,
  getDocumentForUser,
  generateManualProfileForUserDummy,
};
