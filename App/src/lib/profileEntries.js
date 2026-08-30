// Identity rules for the repeatable manual-profile entries (education, work
// experience, projects, skills, certifications).
//
// An entry is identified by its *name* fields alone — deliberately not by
// dates, category, or role, because the same real-world item comes back from
// document parsing with those secondary fields worded differently and would
// otherwise be stored twice. Two entries that share a key are the same entry,
// so adding or generating the second one is a no-op.

export const SECTION_NAME_FIELDS = {
  education: ["school", "degree"],
  workExperience: ["company", "title"],
  projects: ["name"],
  skills: ["name"],
  certifications: ["name"],
};

export const SECTION_LABELS = {
  education: "education",
  workExperience: "work experience",
  projects: "project",
  skills: "skill",
  certifications: "certification",
};

// Lower-cased and trimmed so casing or stray whitespace still collides.
// A blank entry (nothing typed yet) yields "".
export const getEntryKey = (section, entry) =>
  (SECTION_NAME_FIELDS[section] || [])
    .map((field) =>
      String(entry?.[field] ?? "")
        .trim()
        .toLowerCase(),
    )
    .join("|")
    .replace(/^\|+$/, "");

export const hasEntryWithKey = (items = [], section, key) =>
  items.some((item) => getEntryKey(section, item) === key);

// Keeps the first occurrence of each key. Blank entries are left alone here —
// the form's required-field validation is what reports those.
export const dedupeSection = (section, items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = getEntryKey(section, item);
    if (!key) {
      return true;
    }
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

// Returns the first section holding two entries with the same key, or "".
export const findDuplicatedSection = (profile = {}) =>
  Object.keys(SECTION_NAME_FIELDS).find((section) => {
    const items = profile[section] || [];
    return dedupeSection(section, items).length !== items.length;
  }) || "";

export const dedupeManualProfile = (profile = {}) =>
  Object.keys(SECTION_NAME_FIELDS).reduce(
    (next, section) => ({
      ...next,
      [section]: dedupeSection(section, profile[section] || []),
    }),
    { ...profile },
  );
