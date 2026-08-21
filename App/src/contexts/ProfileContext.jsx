import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { demoDisabledMessage, visitorDocuments, visitorProfile } from "../data/visitorDemoData";

const ProfileContext = createContext(null);

export const emptyProfile = {
  personalInfo: { name: "", headline: "", summary: "", phone: "", location: "", links: [] },
  preferences: { preferredRoles: [], preferredLocations: [], workAuthorization: "", salaryRange: "", availability: "" },
  education: [],
  workExperience: [],
  projects: [],
  skills: [],
  certifications: [],
};

const clone = (value) => JSON.parse(JSON.stringify(value));

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) throw new Error("useProfile must be used within a ProfileProvider");
  return context;
};

export const ProfileProvider = ({ children }) => {
  const [manualProfile, setManualProfile] = useState(() => clone(visitorProfile));
  const [documents, setDocuments] = useState(() => clone(visitorDocuments));
  const [githubUrl, setGithubUrl] = useState("https://github.com/example");
  const [savingManual, setSavingManual] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const ensureProfileLoaded = useCallback(async () => clone(visitorProfile), []);
  const loadProfile = ensureProfileLoaded;
  const refreshDocuments = useCallback(async () => documents, [documents]);

  const saveManualProfileData = useCallback(async (nextProfile, options = {}) => {
    setSavingManual(true);
    setError("");
    setManualProfile(nextProfile);
    setSuccessMessage(options.successMessageText || "Changes saved for this visitor session.");
    setSavingManual(false);
    return { manualProfile: nextProfile, documents };
  }, [documents]);

  const disabledAction = useCallback(() => {
    setError("");
    setSuccessMessage(demoDisabledMessage);
  }, []);

  const value = useMemo(() => ({
    manualProfile,
    setManualProfile,
    documents,
    setDocuments,
    githubUrl,
    setGithubUrl,
    loading: false,
    hasLoadedProfile: true,
    savingManual,
    uploadingByType: {},
    downloadingDocumentId: null,
    generatingManual: false,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    refreshDocuments,
    loadProfile,
    ensureProfileLoaded,
    saveManualProfileData,
    uploadDocumentForType: disabledAction,
    deleteDocument: disabledAction,
    downloadDocument: disabledAction,
    handleGenerateSection: disabledAction,
    cancelGeneration: () => {},
  }), [disabledAction, documents, ensureProfileLoaded, error, githubUrl, loadProfile, manualProfile, refreshDocuments, saveManualProfileData, savingManual, successMessage]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};
