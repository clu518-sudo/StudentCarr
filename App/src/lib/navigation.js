// Shared, route-derived section metadata. Used by the app shell top bar and
// the career chatbot so the visible title/subtitle and the chatbot's
// "current page" context stay in sync with React Router without changing any
// existing routes or navigation logic.

export const SECTION_META = {
  dashboard: {
    label: "Dashboard",
    subtitle: "Your central workspace to manage your career journey.",
  },
  profile: {
    label: "Profile",
    subtitle:
      "Manage the profile context used by applications and the AI assistant.",
  },
  skills: {
    label: "Skills",
    subtitle: "Track strengths, skill gaps, and learning priorities.",
  },
  progress: {
    label: "Progress",
    subtitle: "See readiness, activity, milestones, and career momentum.",
  },
  jobs: {
    label: "Jobs",
    subtitle: "Review matched opportunities and compare fit.",
  },
  applications: {
    label: "Applications",
    subtitle:
      "Track applications, status, documents, and follow-up actions.",
  },
  interview: {
    label: "Interview",
    subtitle: "Prepare for interviews with contextual AI support.",
  },
};

const DEFAULT_META = {
  label: "StudentCarr",
  subtitle: "Your central workspace to manage your career journey.",
};

// Resolve the top-level section key from a router pathname (e.g. "/skills/gap-analysis" -> "skills").
export const getSectionKey = (pathname = "") => {
  const segment = pathname.split("/").filter(Boolean)[0] || "dashboard";
  return SECTION_META[segment] ? segment : "dashboard";
};

export const getSectionMeta = (pathname = "") =>
  SECTION_META[getSectionKey(pathname)] || DEFAULT_META;
