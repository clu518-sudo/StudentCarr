import prisma from "../lib/prisma.js";
import { removeFileSafe } from "./pm.storage.js";
import { enqueueDocumentParsing } from "../documentParsing/index.js";
import { DOCUMENT_PARSER_STATUS } from "../documentParsing/constants.js";

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createDummyGeneratedProfile = (currentManualProfile, documents) => {
  const hasTranscript = documents.some(
    (doc) => doc.documentType === "Transcript",
  );
  const hasWorkHistory = documents.some(
    (doc) =>
      doc.documentType === "Working History & Related Project Description",
  );
  const hasProject = documents.some((doc) => doc.documentType === "Project");
  const hasCertification = documents.some(
    (doc) => doc.documentType === "Certification",
  );
  const hasResume = documents.some((doc) => doc.documentType === "Resume");

  const generated = {
    ...currentManualProfile,
    personalInfo: {
      ...currentManualProfile.personalInfo,
      headline: hasResume
        ? "Full-Stack Software Engineer | React, Node.js, Prisma"
        : currentManualProfile.personalInfo.headline,
      summary: hasResume
        ? "Results-driven engineer with hands-on experience building full-stack web applications, integrating APIs, and delivering production-ready features."
        : currentManualProfile.personalInfo.summary,
    },
  };

  if (hasTranscript) {
    generated.education = [
      {
        school: "Dummy University",
        degree: "Bachelor of Science",
        fieldOfStudy: "Computer Science",
        startDate: "2019-09",
        endDate: "2023-06",
        grade: "3.8 / 4.0",
        description:
          "Focused on software engineering, databases, and distributed systems.",
        isCurrent: false,
      },
    ];
  }

  if (hasWorkHistory) {
    generated.workExperience = [
      {
        company: "Dummy Tech Co.",
        title: "Software Engineer",
        location: "Remote",
        startDate: "2023-07",
        endDate: "",
        isCurrent: true,
        description:
          "Built and maintained full-stack features using React and Node.js, improving delivery speed and reliability.",
        achievements: [
          "Delivered 12+ customer-facing features",
          "Reduced API error rate by 30%",
        ],
      },
    ];
  }

  if (hasProject) {
    generated.projects = [
      {
        name: "Student Career Platform",
        role: "Full-Stack Developer",
        description:
          "Developed a profile and document workflow with role-based authentication and API-driven architecture.",
        technologies: ["React", "Node.js", "Express", "Prisma", "SQLite"],
        startDate: "2024-01",
        endDate: "",
        projectUrl: "https://example.com/student-career",
        repositoryUrl: "https://github.com/example/student-career",
      },
    ];
  }

  if (hasCertification) {
    generated.certifications = [
      {
        name: "AWS Certified Cloud Practitioner",
        issuer: "Amazon Web Services",
        issueDate: "2024-05",
        expiryDate: "2027-05",
        credentialId: "DUMMY-AWS-12345",
        credentialUrl: "https://www.credly.com/",
      },
    ];
  }

  if (hasResume) {
    generated.skills = [
      {
        name: "JavaScript",
        level: "Advanced",
        category: "Programming Language",
        yearsOfExperience: 3,
        keywords: ["ES6+", "Async/Await", "Node.js"],
      },
      {
        name: "React",
        level: "Advanced",
        category: "Frontend",
        yearsOfExperience: 3,
        keywords: ["Hooks", "Component Design", "State Management"],
      },
      {
        name: "SQL",
        level: "Intermediate",
        category: "Database",
        yearsOfExperience: 2,
        keywords: ["Joins", "Indexing", "Query Optimization"],
      },
    ];
  }

  return generated;
};

/*
Need be replaced by real AI workflow implementation 
*/
const generateManualProfileForUserDummy = async (userId, onProgress) => {
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
  await sleep(1200);

  if (onProgress) {
    onProgress("Extracting profile details...");
  }
  await sleep(1300);

  const generatedManualProfile = createDummyGeneratedProfile(
    current.manualProfile,
    current.documents,
  );

  if (onProgress) {
    onProgress("Saving generated profile...");
  }
  await sleep(1500);

  await upsertManualProfileForUser(userId, generatedManualProfile);
  return getProfileForUser(userId);
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
