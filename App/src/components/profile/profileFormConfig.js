// Field definitions for the repeatable manual-profile sections.
//
// Both the inline editors on the Profile page and the dedicated
// "/profile/add/:section" subpage render from this config, so a section's panel
// layout follows the entry type it belongs to and the two stay in step.
//
// Field `type` values:
//   text      - single-line input
//   number    - single-line input stored as a number ("" when cleared)
//   csv       - comma separated input stored as a string array
//   richtext  - RichTextEditor (HTML string)
//   checkbox  - boolean
// `full: true` makes a field span the two-column grid.

export const emptyEducation = {
  school: "",
  degree: "",
  fieldOfStudy: "",
  startDate: "",
  endDate: "",
  grade: "",
  description: "",
  isCurrent: false,
};

export const emptyWork = {
  company: "",
  title: "",
  location: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  description: "",
  achievements: [],
};

export const emptyProject = {
  name: "",
  role: "",
  description: "",
  technologies: [],
  startDate: "",
  endDate: "",
  projectUrl: "",
  repositoryUrl: "",
};

export const emptySkill = {
  name: "",
  level: "",
  category: "",
  yearsOfExperience: "",
  keywords: [],
};

export const emptyCertification = {
  name: "",
  issuer: "",
  issueDate: "",
  expiryDate: "",
  credentialId: "",
  credentialUrl: "",
};

export const PROFILE_SECTIONS = {
  education: {
    title: "Education",
    addTitle: "Add Education",
    addSubtitle: "Add a school, degree, or programme to your profile.",
    template: emptyEducation,
    fields: [
      { name: "school", label: "School", type: "text", required: true },
      { name: "degree", label: "Degree", type: "text", required: true },
      { name: "fieldOfStudy", label: "Field of study", type: "text" },
      { name: "grade", label: "Grade", type: "text" },
      { name: "startDate", label: "Start date", type: "text" },
      { name: "endDate", label: "End date", type: "text" },
      {
        name: "description",
        label: "Description",
        type: "richtext",
        minRows: 3,
        full: true,
      },
      {
        name: "isCurrent",
        label: "Currently studying here",
        type: "checkbox",
        full: true,
      },
    ],
  },
  workExperience: {
    title: "Work Experience",
    addTitle: "Add Work Experience",
    addSubtitle: "Add a role you have held.",
    template: emptyWork,
    fields: [
      { name: "company", label: "Company", type: "text", required: true },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "location", label: "Location", type: "text" },
      { name: "startDate", label: "Start date", type: "text" },
      { name: "endDate", label: "End date", type: "text" },
      {
        name: "description",
        label: "Description",
        type: "richtext",
        minRows: 3,
        full: true,
      },
      {
        name: "achievements",
        label: "Achievements",
        placeholder: "Achievements (comma separated)",
        type: "csv",
        full: true,
      },
      {
        name: "isCurrent",
        label: "I currently work here",
        type: "checkbox",
        full: true,
      },
    ],
  },
  projects: {
    title: "Projects",
    addTitle: "Add Project",
    addSubtitle: "Add a project you built or contributed to.",
    template: emptyProject,
    fields: [
      {
        name: "name",
        label: "Project name",
        type: "text",
        required: true,
      },
      { name: "role", label: "Role", type: "text" },
      { name: "startDate", label: "Start date", type: "text" },
      { name: "endDate", label: "End date", type: "text" },
      { name: "projectUrl", label: "Project URL", type: "text" },
      { name: "repositoryUrl", label: "Repository URL", type: "text" },
      {
        name: "description",
        label: "Description",
        type: "richtext",
        minRows: 3,
        full: true,
      },
      {
        name: "technologies",
        label: "Technologies",
        placeholder: "Technologies (comma separated)",
        type: "csv",
        full: true,
      },
    ],
  },
  skills: {
    title: "Skills",
    addTitle: "Add Skill",
    addSubtitle: "Add a skill and how strong you are in it.",
    template: emptySkill,
    fields: [
      { name: "name", label: "Skill name", type: "text", required: true },
      {
        name: "level",
        label: "Level",
        placeholder: "Level (e.g. Beginner, Advanced)",
        type: "text",
      },
      { name: "category", label: "Category", type: "text" },
      {
        name: "yearsOfExperience",
        label: "Years of experience",
        type: "number",
      },
      {
        name: "keywords",
        label: "Keywords",
        placeholder: "Keywords (comma separated)",
        type: "csv",
        full: true,
      },
    ],
  },
  certifications: {
    title: "Certifications",
    addTitle: "Add Certification",
    addSubtitle: "Add a credential you have earned.",
    template: emptyCertification,
    fields: [
      {
        name: "name",
        label: "Certification name",
        type: "text",
        required: true,
      },
      { name: "issuer", label: "Issuer", type: "text" },
      { name: "issueDate", label: "Issue date", type: "text" },
      { name: "expiryDate", label: "Expiry date", type: "text" },
      { name: "credentialId", label: "Credential ID", type: "text" },
      { name: "credentialUrl", label: "Credential URL", type: "text" },
    ],
  },
};

export const PROFILE_SECTION_KEYS = Object.keys(PROFILE_SECTIONS);

export const parseCsv = (value) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const toCsv = (items = []) => items.join(", ");

// Shared control styling, so the add subpage matches the inline editors.
export const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

export const sectionTitleClass = "text-lg font-semibold text-gray-900 mb-4";

export const profileActionButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-primary-600 bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-primary-700 hover:border-primary-700";

export const profileDangerButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-colors duration-200 hover:bg-red-100";

export const profileDisabledButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed";
