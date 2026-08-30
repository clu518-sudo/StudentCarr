import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile, emptyProfile } from "../../contexts/ProfileContext";
import RichTextEditor from "../common/RichTextEditor";
import { SECTION_LABELS, findDuplicatedSection } from "../../lib/profileEntries";
import {
  inputClass,
  parseCsv,
  profileActionButtonClass,
  profileDangerButtonClass,
  profileDisabledButtonClass,
  sectionTitleClass,
  toCsv,
} from "./profileFormConfig";

const DOCUMENT_TYPES = [
  "Resume",
  "Transcript",
  "Project",
  "Certification",
  "Recommendation Letter",
  "Essay",
  "Working History & Related Project Description",
];

const parseCsvInput = (value) => value.split(",");

const getParserStatus = (document) =>
  document?.parserStatus || document?.status || "pending";

const getParserStatusLabel = (status) => {
  switch (status) {
    case "processing":
      return "Parsing in progress";
    case "completed":
      return "Parsing completed";
    case "failed":
      return "Parsing failed";
    case "pending":
    default:
      return "Upload received / parsing pending";
  }
};

const getParserStatusClass = (status) => {
  switch (status) {
    case "processing":
      return "inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700";
    case "completed":
      return "inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700";
    case "failed":
      return "inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700";
    case "pending":
    default:
      return "inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700";
  }
};

const ProfileView = () => {
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState("manual");
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const {
    manualProfile,
    setManualProfile,
    documents,
    githubUrl,
    setGithubUrl,
    loading,
    hasLoadedProfile,
    savingManual,
    uploadingByType,
    downloadingDocumentId,
    generatingManual,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    ensureProfileLoaded,
    saveManualProfileData,
    uploadDocumentForType,
    deleteDocument,
    downloadDocument,
    handleGenerateSection,
    cancelGeneration,
  } = useProfile();

  useEffect(() => {
    ensureProfileLoaded().catch(() => {
      // Error state is handled by the profile context.
    });
  }, [ensureProfileLoaded]);

  const updatePersonalInfo = (field, value) => {
    setManualProfile((prev) => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        [field]: value,
      },
    }));
  };

  const updatePreferences = (field, value, parseAsCsv = false) => {
    setManualProfile((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [field]: parseAsCsv ? parseCsvInput(value) : value,
      },
    }));
  };

  const addLink = () => {
    setManualProfile((prev) => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        links: [...(prev.personalInfo.links || []), { label: "", url: "" }],
      },
    }));
  };

  const updateLink = (index, field, value) => {
    setManualProfile((prev) => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        links: (prev.personalInfo.links || []).map((link, currentIndex) =>
          currentIndex === index ? { ...link, [field]: value } : link,
        ),
      },
    }));
  };

  const removeLink = (index) => {
    setManualProfile((prev) => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        links: (prev.personalInfo.links || []).filter(
          (_, currentIndex) => currentIndex !== index,
        ),
      },
    }));
  };

  // Adding an entry happens on its own subpage in the workspace column, which
  // renders the fields for that section and applies the duplicate-name check
  // before the entry comes back into this form.
  const openAddPage = (section) => {
    setError("");
    setSuccessMessage("");
    navigate(`/profile/add/${section}`);
  };

  const updateArrayItem = (
    section,
    index,
    field,
    value,
    parseAsCsv = false,
  ) => {
    setManualProfile((prev) => ({
      ...prev,
      [section]: (prev[section] || []).map((item, currentIndex) =>
        currentIndex === index
          ? {
              ...item,
              [field]: parseAsCsv ? parseCsv(value) : value,
            }
          : item,
      ),
    }));
  };

  const removeArrayItem = (section, index) => {
    setManualProfile((prev) => ({
      ...prev,
      [section]: (prev[section] || []).filter(
        (_, currentIndex) => currentIndex !== index,
      ),
    }));
  };

  const validateManualForm = () => {
    const hasMissingEducationBasics = manualProfile.education.some(
      (item) => !item.school?.trim() || !item.degree?.trim(),
    );
    const hasMissingWorkBasics = manualProfile.workExperience.some(
      (item) => !item.company?.trim() || !item.title?.trim(),
    );
    const hasMissingProjectName = manualProfile.projects.some(
      (item) => !item.name?.trim(),
    );
    const hasMissingSkill = manualProfile.skills.some(
      (item) => !item.name?.trim(),
    );
    const hasMissingCertification = manualProfile.certifications.some(
      (item) => !item.name?.trim(),
    );

    if (hasMissingEducationBasics)
      return "Each education entry needs a school name and degree.";
    if (hasMissingWorkBasics) return "Each work entry needs company and title.";
    if (hasMissingProjectName) return "Each project entry needs a name.";
    if (hasMissingSkill) return "Each skill entry needs a skill name.";
    if (hasMissingCertification)
      return "Each certification entry needs a name.";

    // A name can only be edited into a duplicate after the entry was added, so
    // the same rule that guards Add is re-checked here before saving.
    const duplicatedSection = findDuplicatedSection(manualProfile);
    if (duplicatedSection)
      return `Two ${SECTION_LABELS[duplicatedSection]} entries share the same name. Remove the duplicate before saving.`;

    return "";
  };

  const saveManualProfile = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const validationError = validateManualForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const normalizedProfile = {
        ...manualProfile,
        preferences: {
          ...manualProfile.preferences,
          preferredRoles: parseCsv(
            toCsv(manualProfile.preferences.preferredRoles || []),
          ),
          preferredLocations: parseCsv(
            toCsv(manualProfile.preferences.preferredLocations || []),
          ),
        },
      };
      await saveManualProfileData(normalizedProfile);
    } catch {
      // Error state is handled by the profile context.
    }
  };

  const confirmDeleteAllManual = async () => {
    setError("");
    setSuccessMessage("");
    setDeletingAll(true);
    try {
      await saveManualProfileData(emptyProfile, {
        successMessageText: "All manual entry information deleted.",
        errorMessageText: "Failed to delete manual entry information",
      });
      setShowDeleteAllConfirm(false);
    } catch {
      // Error state is handled by the profile context.
    } finally {
      setDeletingAll(false);
    }
  };

  if (!hasLoadedProfile && !error) {
    return (
      <div className="card">
        <p className="text-gray-600">Loading profile management data...</p>
      </div>
    );
  }

  const documentsByType = DOCUMENT_TYPES.reduce((acc, type) => {
    acc[type] = documents.filter((document) => document.documentType === type);
    return acc;
  }, {});
  // Generation sends every parsed document to the model regardless of type
  // (listDocumentsWithParsedTextForUser), so any upload is enough to run it.
  const canGenerateManualProfile = documents.length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-6 text-white shadow-sm">
        <h1 className="text-2xl font-bold mb-2">Profile Management</h1>
        <p className="text-primary-100">
          Build your profile manually or upload supporting documents for future
          AI parsing.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <div className="card">
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-6">
            <button
              type="button"
              onClick={() => setActiveMode("manual")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeMode === "manual"
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Manual Entry
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("documents")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeMode === "documents"
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Document Upload
            </button>
          </nav>
        </div>

        {activeMode === "manual" ? (
          <form
            className="profile-manual-form space-y-8"
            onSubmit={saveManualProfile}
          >
            <section>
              <h2 className={sectionTitleClass}>Personal Info</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  className={inputClass}
                  placeholder="Full name"
                  value={manualProfile.personalInfo.name || ""}
                  onChange={(event) =>
                    updatePersonalInfo("name", event.target.value)
                  }
                />
                <input
                  className={inputClass}
                  placeholder="Headline"
                  value={manualProfile.personalInfo.headline || ""}
                  onChange={(event) =>
                    updatePersonalInfo("headline", event.target.value)
                  }
                />
                <input
                  className={inputClass}
                  placeholder="Phone"
                  value={manualProfile.personalInfo.phone || ""}
                  onChange={(event) =>
                    updatePersonalInfo("phone", event.target.value)
                  }
                />
                <input
                  className={inputClass}
                  placeholder="Location"
                  value={manualProfile.personalInfo.location || ""}
                  onChange={(event) =>
                    updatePersonalInfo("location", event.target.value)
                  }
                />
              </div>

              <div className="mt-4">
                <RichTextEditor
                  value={manualProfile.personalInfo.summary || ""}
                  onChange={(html) => updatePersonalInfo("summary", html)}
                  placeholder="Professional summary"
                  minRows={4}
                />
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Links</h3>
                  <button
                    type="button"
                    className={profileActionButtonClass}
                    onClick={addLink}
                  >
                    Add Link
                  </button>
                </div>
                {(manualProfile.personalInfo.links || []).map((link, index) => (
                  <div
                    key={`link-${index}`}
                    className="grid grid-cols-1 md:grid-cols-5 gap-3"
                  >
                    <input
                      className={`${inputClass} md:col-span-2`}
                      placeholder="Label (e.g. LinkedIn)"
                      value={link.label || ""}
                      onChange={(event) =>
                        updateLink(index, "label", event.target.value)
                      }
                    />
                    <input
                      className={`${inputClass} md:col-span-2`}
                      placeholder="URL"
                      value={link.url || ""}
                      onChange={(event) =>
                        updateLink(index, "url", event.target.value)
                      }
                    />
                    <button
                      type="button"
                      className={profileDangerButtonClass}
                      onClick={() => removeLink(index)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className={sectionTitleClass}>Preferences</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  className={inputClass}
                  placeholder="Preferred roles (comma separated)"
                  value={toCsv(manualProfile.preferences.preferredRoles)}
                  onChange={(event) =>
                    updatePreferences(
                      "preferredRoles",
                      event.target.value,
                      true,
                    )
                  }
                />
                <input
                  className={inputClass}
                  placeholder="Preferred locations (comma separated)"
                  value={toCsv(manualProfile.preferences.preferredLocations)}
                  onChange={(event) =>
                    updatePreferences(
                      "preferredLocations",
                      event.target.value,
                      true,
                    )
                  }
                />
                <input
                  className={inputClass}
                  placeholder="Work authorization"
                  value={manualProfile.preferences.workAuthorization || ""}
                  onChange={(event) =>
                    updatePreferences("workAuthorization", event.target.value)
                  }
                />
                <input
                  className={inputClass}
                  placeholder="Salary range"
                  value={manualProfile.preferences.salaryRange || ""}
                  onChange={(event) =>
                    updatePreferences("salaryRange", event.target.value)
                  }
                />
                <input
                  className={inputClass}
                  placeholder="Availability"
                  value={manualProfile.preferences.availability || ""}
                  onChange={(event) =>
                    updatePreferences("availability", event.target.value)
                  }
                />
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className={sectionTitleClass}>Education</h2>
                <button
                  type="button"
                  className={profileActionButtonClass}
                  onClick={() => openAddPage("education")}
                >
                  Add Education
                </button>
              </div>
              <div className="space-y-4">
                {manualProfile.education.map((item, index) => (
                  <div
                    key={`edu-${index}`}
                    className="rounded-md border border-gray-200 p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        className={inputClass}
                        placeholder="School"
                        value={item.school}
                        onChange={(event) =>
                          updateArrayItem(
                            "education",
                            index,
                            "school",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Degree"
                        value={item.degree}
                        onChange={(event) =>
                          updateArrayItem(
                            "education",
                            index,
                            "degree",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Field of study"
                        value={item.fieldOfStudy}
                        onChange={(event) =>
                          updateArrayItem(
                            "education",
                            index,
                            "fieldOfStudy",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Grade"
                        value={item.grade}
                        onChange={(event) =>
                          updateArrayItem(
                            "education",
                            index,
                            "grade",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Start date"
                        value={item.startDate}
                        onChange={(event) =>
                          updateArrayItem(
                            "education",
                            index,
                            "startDate",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="End date"
                        value={item.endDate}
                        onChange={(event) =>
                          updateArrayItem(
                            "education",
                            index,
                            "endDate",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                    <RichTextEditor
                      value={item.description || ""}
                      onChange={(html) =>
                        updateArrayItem("education", index, "description", html)
                      }
                      placeholder="Description"
                      minRows={3}
                    />
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-700">
                        <input
                          type="checkbox"
                          className="mr-2"
                          checked={Boolean(item.isCurrent)}
                          onChange={(event) =>
                            updateArrayItem(
                              "education",
                              index,
                              "isCurrent",
                              event.target.checked,
                            )
                          }
                        />
                        Currently studying here
                      </label>
                      <button
                        type="button"
                        className={profileDangerButtonClass}
                        onClick={() => removeArrayItem("education", index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className={sectionTitleClass}>Work Experience</h2>
                <button
                  type="button"
                  className={profileActionButtonClass}
                  onClick={() => openAddPage("workExperience")}
                >
                  Add Work Experience
                </button>
              </div>
              <div className="space-y-4">
                {manualProfile.workExperience.map((item, index) => (
                  <div
                    key={`work-${index}`}
                    className="rounded-md border border-gray-200 p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        className={inputClass}
                        placeholder="Company"
                        value={item.company}
                        onChange={(event) =>
                          updateArrayItem(
                            "workExperience",
                            index,
                            "company",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Title"
                        value={item.title}
                        onChange={(event) =>
                          updateArrayItem(
                            "workExperience",
                            index,
                            "title",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Location"
                        value={item.location}
                        onChange={(event) =>
                          updateArrayItem(
                            "workExperience",
                            index,
                            "location",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Start date"
                        value={item.startDate}
                        onChange={(event) =>
                          updateArrayItem(
                            "workExperience",
                            index,
                            "startDate",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="End date"
                        value={item.endDate}
                        onChange={(event) =>
                          updateArrayItem(
                            "workExperience",
                            index,
                            "endDate",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                    <RichTextEditor
                      value={item.description || ""}
                      onChange={(html) =>
                        updateArrayItem("workExperience", index, "description", html)
                      }
                      placeholder="Description"
                      minRows={3}
                    />
                    <input
                      className={inputClass}
                      placeholder="Achievements (comma separated)"
                      value={toCsv(item.achievements)}
                      onChange={(event) =>
                        updateArrayItem(
                          "workExperience",
                          index,
                          "achievements",
                          event.target.value,
                          true,
                        )
                      }
                    />
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-700">
                        <input
                          type="checkbox"
                          className="mr-2"
                          checked={Boolean(item.isCurrent)}
                          onChange={(event) =>
                            updateArrayItem(
                              "workExperience",
                              index,
                              "isCurrent",
                              event.target.checked,
                            )
                          }
                        />
                        I currently work here
                      </label>
                      <button
                        type="button"
                        className={profileDangerButtonClass}
                        onClick={() => removeArrayItem("workExperience", index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className={sectionTitleClass}>Projects</h2>
                <button
                  type="button"
                  className={profileActionButtonClass}
                  onClick={() => openAddPage("projects")}
                >
                  Add Project
                </button>
              </div>
              <div className="space-y-4">
                {manualProfile.projects.map((item, index) => (
                  <div
                    key={`project-${index}`}
                    className="rounded-md border border-gray-200 p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        className={inputClass}
                        placeholder="Project name"
                        value={item.name}
                        onChange={(event) =>
                          updateArrayItem(
                            "projects",
                            index,
                            "name",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Role"
                        value={item.role}
                        onChange={(event) =>
                          updateArrayItem(
                            "projects",
                            index,
                            "role",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Start date"
                        value={item.startDate}
                        onChange={(event) =>
                          updateArrayItem(
                            "projects",
                            index,
                            "startDate",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="End date"
                        value={item.endDate}
                        onChange={(event) =>
                          updateArrayItem(
                            "projects",
                            index,
                            "endDate",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Project URL"
                        value={item.projectUrl}
                        onChange={(event) =>
                          updateArrayItem(
                            "projects",
                            index,
                            "projectUrl",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Repository URL"
                        value={item.repositoryUrl}
                        onChange={(event) =>
                          updateArrayItem(
                            "projects",
                            index,
                            "repositoryUrl",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                    <RichTextEditor
                      value={item.description || ""}
                      onChange={(html) =>
                        updateArrayItem("projects", index, "description", html)
                      }
                      placeholder="Description"
                      minRows={3}
                    />
                    <input
                      className={inputClass}
                      placeholder="Technologies (comma separated)"
                      value={toCsv(item.technologies)}
                      onChange={(event) =>
                        updateArrayItem(
                          "projects",
                          index,
                          "technologies",
                          event.target.value,
                          true,
                        )
                      }
                    />
                    <div className="text-right">
                      <button
                        type="button"
                        className={profileDangerButtonClass}
                        onClick={() => removeArrayItem("projects", index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className={sectionTitleClass}>Skills</h2>
                <button
                  type="button"
                  className={profileActionButtonClass}
                  onClick={() => openAddPage("skills")}
                >
                  Add Skill
                </button>
              </div>
              <div className="space-y-4">
                {manualProfile.skills.map((item, index) => (
                  <div
                    key={`skill-${index}`}
                    className="rounded-md border border-gray-200 p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        className={inputClass}
                        placeholder="Skill name"
                        value={item.name}
                        onChange={(event) =>
                          updateArrayItem(
                            "skills",
                            index,
                            "name",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Level (e.g. Beginner, Advanced)"
                        value={item.level}
                        onChange={(event) =>
                          updateArrayItem(
                            "skills",
                            index,
                            "level",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Category"
                        value={item.category}
                        onChange={(event) =>
                          updateArrayItem(
                            "skills",
                            index,
                            "category",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Years of experience"
                        value={item.yearsOfExperience}
                        onChange={(event) =>
                          updateArrayItem(
                            "skills",
                            index,
                            "yearsOfExperience",
                            event.target.value === ""
                              ? ""
                              : Number(event.target.value),
                          )
                        }
                      />
                    </div>
                    <input
                      className={inputClass}
                      placeholder="Keywords (comma separated)"
                      value={toCsv(item.keywords)}
                      onChange={(event) =>
                        updateArrayItem(
                          "skills",
                          index,
                          "keywords",
                          event.target.value,
                          true,
                        )
                      }
                    />
                    <div className="text-right">
                      <button
                        type="button"
                        className={profileDangerButtonClass}
                        onClick={() => removeArrayItem("skills", index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className={sectionTitleClass}>Certifications</h2>
                <button
                  type="button"
                  className={profileActionButtonClass}
                  onClick={() => openAddPage("certifications")}
                >
                  Add Certification
                </button>
              </div>
              <div className="space-y-4">
                {manualProfile.certifications.map((item, index) => (
                  <div
                    key={`cert-${index}`}
                    className="rounded-md border border-gray-200 p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        className={inputClass}
                        placeholder="Certification name"
                        value={item.name}
                        onChange={(event) =>
                          updateArrayItem(
                            "certifications",
                            index,
                            "name",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Issuer"
                        value={item.issuer}
                        onChange={(event) =>
                          updateArrayItem(
                            "certifications",
                            index,
                            "issuer",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Issue date"
                        value={item.issueDate}
                        onChange={(event) =>
                          updateArrayItem(
                            "certifications",
                            index,
                            "issueDate",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Expiry date"
                        value={item.expiryDate}
                        onChange={(event) =>
                          updateArrayItem(
                            "certifications",
                            index,
                            "expiryDate",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Credential ID"
                        value={item.credentialId}
                        onChange={(event) =>
                          updateArrayItem(
                            "certifications",
                            index,
                            "credentialId",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Credential URL"
                        value={item.credentialUrl}
                        onChange={(event) =>
                          updateArrayItem(
                            "certifications",
                            index,
                            "credentialUrl",
                            event.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="text-right">
                      <button
                        type="button"
                        className={profileDangerButtonClass}
                        onClick={() => removeArrayItem("certifications", index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="pt-4 border-t border-gray-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingManual}
                >
                  {savingManual ? "Saving..." : "Save Profile"}
                </button>
                <button
                  type="button"
                  className={profileDangerButtonClass}
                  onClick={() => setShowDeleteAllConfirm(true)}
                  disabled={savingManual || deletingAll}
                >
                  Delete All
                </button>
              </div>
              {generatingManual ? (
                <button
                  type="button"
                  className={profileDangerButtonClass}
                  onClick={cancelGeneration}
                >
                  Cancel Generate
                </button>
              ) : (
                <button
                  type="button"
                  className={
                    canGenerateManualProfile
                      ? "btn-primary"
                      : profileDisabledButtonClass
                  }
                  title="Ai generate according upload file"
                  disabled={!canGenerateManualProfile}
                  onClick={() => handleGenerateSection("Manual Entry")}
                >
                  Generate
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <section className="space-y-4">
              <h2 className={sectionTitleClass}>
                Upload Profile Documents (PDF)
              </h2>
              <p className="text-sm text-gray-600">
                Upload and manage each document category separately.
              </p>

              <input
                type="url"
                className={inputClass}
                placeholder="Optional GitHub URL"
                value={githubUrl}
                onChange={(event) => setGithubUrl(event.target.value)}
              />
            </section>

            <section>
              <h2 className={sectionTitleClass}>Documents by Category</h2>
              <div className="space-y-4">
                {DOCUMENT_TYPES.map((type) => (
                  <div
                    key={type}
                    className="rounded-md border border-gray-200 p-4 space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <h3 className="font-semibold text-gray-900">{type}</h3>
                      <label
                        className={`${profileActionButtonClass} cursor-pointer`}
                      >
                        {uploadingByType[type] ? "Uploading..." : "Upload"}
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          className="hidden"
                          disabled={Boolean(uploadingByType[type])}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            uploadDocumentForType(type, file);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </div>

                    {!documentsByType[type]?.length ? (
                      <p className="text-sm text-gray-600">
                        No {type.toLowerCase()} documents uploaded.
                      </p>
                    ) : (
                      <div className="rounded-md border border-gray-100 divide-y">
                        {documentsByType[type].map((doc) => {
                          const parserStatus = getParserStatus(doc);

                          return (
                            <div
                              key={doc.id}
                              className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3"
                            >
                            <div>
                              <p className="font-medium text-gray-900">
                                {doc.originalName}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className={getParserStatusClass(parserStatus)}>
                                  {getParserStatusLabel(parserStatus)}
                                </span>
                                {doc.extractionMethod && (
                                  <span className="text-xs text-gray-500">
                                    via {doc.extractionMethod}
                                  </span>
                                )}
                                {typeof doc.pageCount === "number" && (
                                  <span className="text-xs text-gray-500">
                                    {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-gray-600">
                                {(doc.size / 1024 / 1024).toFixed(2)} MB •{" "}
                                {parserStatus}
                              </p>
                              <p className="text-xs text-gray-500">
                                Uploaded{" "}
                                {new Date(doc.uploadedAt).toLocaleString()}
                              </p>
                              {doc.parserError && (
                                <p className="mt-1 text-xs text-red-600">
                                  {doc.parserError}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className={profileActionButtonClass}
                                disabled={downloadingDocumentId === doc.id}
                                onClick={() => downloadDocument(doc)}
                              >
                                {downloadingDocumentId === doc.id
                                  ? "Downloading..."
                                  : "Download"}
                              </button>
                              <button
                                type="button"
                                className={profileDangerButtonClass}
                                onClick={() => deleteDocument(doc.id)}
                              >
                                Delete
                              </button>
                            </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {showDeleteAllConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete all manual entries?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              This will permanently remove all manual entry information,
              including personal info, preferences, education, work experience,
              projects, skills, and certifications. This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className={profileActionButtonClass}
                onClick={() => setShowDeleteAllConfirm(false)}
                disabled={deletingAll}
              >
                Cancel
              </button>
              <button
                type="button"
                className={profileDangerButtonClass}
                onClick={confirmDeleteAllManual}
                disabled={deletingAll}
              >
                {deletingAll ? "Deleting..." : "Yes, Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileView;
