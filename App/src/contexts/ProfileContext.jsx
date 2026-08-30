import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { profileManagementApi } from "../lib/apiClient";
import { dedupeManualProfile } from "../lib/profileEntries";
import { useAuth } from "./AuthContext";

const ProfileContext = createContext(null);

const activeParserStatuses = new Set(["pending", "processing"]);
const documentPollingIntervalMs = 3000;
const sseReconnectDelaysMs = [1000, 2000, 5000, 10000, 30000];

export const emptyProfile = {
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
};

const mergeManualProfile = (profile = {}) => ({
  ...emptyProfile,
  ...profile,
  personalInfo: {
    ...emptyProfile.personalInfo,
    ...(profile?.personalInfo || {}),
    links: Array.isArray(profile?.personalInfo?.links)
      ? profile.personalInfo.links
      : [],
  },
  preferences: {
    ...emptyProfile.preferences,
    ...(profile?.preferences || {}),
    preferredRoles: Array.isArray(profile?.preferences?.preferredRoles)
      ? profile.preferences.preferredRoles
      : [],
    preferredLocations: Array.isArray(profile?.preferences?.preferredLocations)
      ? profile.preferences.preferredLocations
      : [],
  },
  education: Array.isArray(profile?.education) ? profile.education : [],
  workExperience: Array.isArray(profile?.workExperience)
    ? profile.workExperience
    : [],
  projects: Array.isArray(profile?.projects) ? profile.projects : [],
  skills: Array.isArray(profile?.skills) ? profile.skills : [],
  certifications: Array.isArray(profile?.certifications)
    ? profile.certifications
    : [],
});

const getGithubUrlFromProfile = (profile) => {
  const links = profile?.personalInfo?.links || [];
  const githubLink = links.find(
    (link) => link?.label?.toLowerCase?.() === "github",
  );
  return githubLink?.url || "";
};

const hasActiveDocumentParsing = (documents = []) =>
  documents.some((document) =>
    activeParserStatuses.has(
      document?.parserStatus || document?.status || "pending",
    ),
  );

const upsertDocumentById = (documents = [], nextDocument) => {
  if (!nextDocument?.id) {
    return documents;
  }

  const existingIndex = documents.findIndex((item) => item.id === nextDocument.id);
  if (existingIndex === -1) {
    return [nextDocument, ...documents];
  }

  const nextDocuments = [...documents];
  nextDocuments[existingIndex] = { ...documents[existingIndex], ...nextDocument };
  return nextDocuments;
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
};

export const ProfileProvider = ({ children }) => {
  const { accessToken } = useAuth();
  const [manualProfile, setManualProfile] = useState(emptyProfile);
  const [documents, setDocuments] = useState([]);
  const [githubUrl, setGithubUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [uploadingByType, setUploadingByType] = useState({});
  const [downloadingDocumentId, setDownloadingDocumentId] = useState(null);
  const [generatingManual, setGeneratingManual] = useState(false);
  const [eventsConnected, setEventsConnected] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const generateAbortControllerRef = useRef(null);
  const eventsAbortControllerRef = useRef(null);
  const eventsReconnectTimerRef = useRef(null);
  const eventsReconnectAttemptRef = useRef(0);
  const hasLoadedProfileRef = useRef(false);

  const resetProfileState = useCallback(() => {
    setManualProfile(emptyProfile);
    setDocuments([]);
    setGithubUrl("");
    setLoading(false);
    setHasLoadedProfile(false);
    setSavingManual(false);
    setUploadingByType({});
    setDownloadingDocumentId(null);
    setGeneratingManual(false);
    setEventsConnected(false);
    setError("");
    setSuccessMessage("");
    hasLoadedProfileRef.current = false;
  }, []);

  useEffect(() => {
    if (accessToken) {
      return;
    }

    generateAbortControllerRef.current?.abort();
    generateAbortControllerRef.current = null;
    eventsAbortControllerRef.current?.abort();
    eventsAbortControllerRef.current = null;
    if (eventsReconnectTimerRef.current) {
      window.clearTimeout(eventsReconnectTimerRef.current);
      eventsReconnectTimerRef.current = null;
    }
    eventsReconnectAttemptRef.current = 0;
    resetProfileState();
  }, [accessToken, resetProfileState]);

  const refreshDocuments = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) {
        return [];
      }

      try {
        const docsResponse =
          await profileManagementApi.getDocuments(accessToken);
        const nextDocuments = docsResponse?.data?.documents || [];
        setDocuments(nextDocuments);
        return nextDocuments;
      } catch (loadError) {
        if (!silent) {
          throw loadError;
        }
        return [];
      }
    },
    [accessToken],
  );

  const loadProfile = useCallback(
    async ({ force = false } = {}) => {
      if (!accessToken) {
        return null;
      }

      if (hasLoadedProfileRef.current && !force) {
        return null;
      }

      setLoading(true);
      setError("");
      try {
        const response = await profileManagementApi.getProfile(accessToken);
        const nextProfile = mergeManualProfile(
          response?.data?.manualProfile || emptyProfile,
        );
        const nextDocuments = response?.data?.documents || [];
        setManualProfile(nextProfile);
        setDocuments(nextDocuments);
        setGithubUrl(getGithubUrlFromProfile(nextProfile));
        setHasLoadedProfile(true);
        hasLoadedProfileRef.current = true;
        return {
          manualProfile: nextProfile,
          documents: nextDocuments,
        };
      } catch (loadError) {
        setError(loadError.message || "Failed to load profile");
        throw loadError;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  const ensureProfileLoaded = useCallback(async () => {
    if (hasLoadedProfileRef.current) {
      return;
    }

    await loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!accessToken) {
      return undefined;
    }

    let isCancelled = false;

    const clearReconnectTimer = () => {
      if (eventsReconnectTimerRef.current) {
        window.clearTimeout(eventsReconnectTimerRef.current);
        eventsReconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (isCancelled) {
        return;
      }

      clearReconnectTimer();
      const delayIndex = Math.min(
        eventsReconnectAttemptRef.current,
        sseReconnectDelaysMs.length - 1,
      );
      const delayMs = sseReconnectDelaysMs[delayIndex];
      eventsReconnectAttemptRef.current += 1;

      eventsReconnectTimerRef.current = window.setTimeout(() => {
        if (!isCancelled) {
          connectToEvents();
        }
      }, delayMs);
    };

    const connectToEvents = async () => {
      clearReconnectTimer();
      eventsAbortControllerRef.current?.abort();
      const abortController = new AbortController();
      eventsAbortControllerRef.current = abortController;

      try {
        await profileManagementApi.subscribeEvents(
          {
            signal: abortController.signal,
            onEvent: (eventName, payload) => {
              if (eventName === "connected") {
                setEventsConnected(true);
                eventsReconnectAttemptRef.current = 0;
                return;
              }

              if (eventName === "document_parsing_updated" && payload?.document) {
                setDocuments((prev) => upsertDocumentById(prev, payload.document));
              }
            },
          },
          accessToken,
        );

        if (!isCancelled) {
          setEventsConnected(false);
          scheduleReconnect();
        }
      } catch (streamError) {
        if (isCancelled || streamError?.name === "AbortError") {
          return;
        }

        setEventsConnected(false);
        scheduleReconnect();
      }
    };

    setEventsConnected(false);
    connectToEvents();

    return () => {
      isCancelled = true;
      setEventsConnected(false);
      clearReconnectTimer();
      eventsAbortControllerRef.current?.abort();
      eventsAbortControllerRef.current = null;
      eventsReconnectAttemptRef.current = 0;
    };
  }, [accessToken]);

  useEffect(() => {
    if (
      !accessToken ||
      eventsConnected ||
      !hasActiveDocumentParsing(documents)
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refreshDocuments({ silent: true });
    }, documentPollingIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [accessToken, documents, eventsConnected, refreshDocuments]);

  useEffect(
    () => () => {
      generateAbortControllerRef.current?.abort();
      eventsAbortControllerRef.current?.abort();
      if (eventsReconnectTimerRef.current) {
        window.clearTimeout(eventsReconnectTimerRef.current);
        eventsReconnectTimerRef.current = null;
      }
    },
    [],
  );

  const saveManualProfileData = useCallback(
    async (
      nextManualProfile,
      {
        successMessageText = "Manual profile saved successfully.",
        errorMessageText = "Failed to save profile",
      } = {},
    ) => {
      if (!accessToken) {
        return null;
      }

      setError("");
      setSuccessMessage("");
      setSavingManual(true);

      try {
        const response = await profileManagementApi.updateManualProfile(
          nextManualProfile,
          accessToken,
        );
        const savedProfile = mergeManualProfile(
          response?.data?.manualProfile || nextManualProfile,
        );
        const savedDocuments = response?.data?.documents || documents;

        setManualProfile(savedProfile);
        setDocuments(savedDocuments);
        setGithubUrl(getGithubUrlFromProfile(savedProfile));
        setHasLoadedProfile(true);
        hasLoadedProfileRef.current = true;
        setSuccessMessage(successMessageText);

        return {
          manualProfile: savedProfile,
          documents: savedDocuments,
        };
      } catch (saveError) {
        setError(saveError.message || errorMessageText);
        throw saveError;
      } finally {
        setSavingManual(false);
      }
    },
    [accessToken, documents],
  );

  const uploadDocumentForType = useCallback(
    async (documentType, file) => {
      if (!accessToken || !file) {
        return;
      }

      setError("");
      setSuccessMessage("");
      setUploadingByType((prev) => ({ ...prev, [documentType]: true }));

      try {
        await profileManagementApi.uploadSingleDocument(
          {
            file,
            documentType,
            githubUrl: githubUrl.trim(),
          },
          accessToken,
        );
        await refreshDocuments();
        setSuccessMessage(`${documentType} uploaded successfully.`);
      } catch (uploadError) {
        setError(uploadError.message || "Failed to upload documents");
      } finally {
        setUploadingByType((prev) => ({ ...prev, [documentType]: false }));
      }
    },
    [accessToken, githubUrl, refreshDocuments],
  );

  const deleteDocument = useCallback(
    async (documentId) => {
      if (!accessToken) {
        return;
      }

      setError("");
      setSuccessMessage("");
      try {
        await profileManagementApi.deleteDocument(documentId, accessToken);
        setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
        setSuccessMessage("Document deleted successfully.");
      } catch (deleteError) {
        setError(deleteError.message || "Failed to delete document");
      }
    },
    [accessToken],
  );

  const downloadDocument = useCallback(
    async (document) => {
      if (!accessToken) {
        return;
      }

      setError("");
      setSuccessMessage("");
      setDownloadingDocumentId(document.id);

      try {
        const fileBlob = await profileManagementApi.downloadDocument(
          document.id,
          accessToken,
        );
        const downloadUrl = window.URL.createObjectURL(fileBlob);
        const link = window.document.createElement("a");
        link.href = downloadUrl;
        link.download = document.originalName || `${document.documentType}.pdf`;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        setSuccessMessage(`Downloading ${document.originalName}...`);
      } catch (downloadError) {
        setError(downloadError.message || "Failed to download document");
      } finally {
        setDownloadingDocumentId(null);
      }
    },
    [accessToken],
  );

  const handleGenerateSection = useCallback(
    async (sectionName) => {
      if (!accessToken || generatingManual) {
        return;
      }

      setError("");
      setSuccessMessage(`${sectionName} generation started...`);
      setGeneratingManual(true);

      const abortController = new AbortController();
      generateAbortControllerRef.current = abortController;
      let completedPayload = null;

      try {
        await profileManagementApi.generateManualProfileStream(
          {
            sectionName,
            signal: abortController.signal,
            onEvent: (eventName, payload) => {
              if (eventName === "started" || eventName === "progress") {
                if (payload?.message) {
                  setSuccessMessage(payload.message);
                }
              }

              if (eventName === "completed") {
                completedPayload = payload;

                // Generation merges freshly parsed documents into the existing
                // profile, so drop any entry whose name is already present
                // rather than letting the same school / job / project / skill /
                // certification be listed twice.
                const generatedProfile = dedupeManualProfile(
                  mergeManualProfile(
                    payload?.result?.manualProfile || emptyProfile,
                  ),
                );
                const generatedDocuments = Array.isArray(
                  payload?.result?.documents,
                )
                  ? payload.result.documents
                  : documents;

                setManualProfile(generatedProfile);
                setDocuments(generatedDocuments);
                setGithubUrl(getGithubUrlFromProfile(generatedProfile));
                setHasLoadedProfile(true);
                hasLoadedProfileRef.current = true;
                setSuccessMessage("Saving generated profile...");
              }
            },
          },
          accessToken,
        );

        if (completedPayload?.result?.manualProfile) {
          const generatedProfile = dedupeManualProfile(
            mergeManualProfile(completedPayload.result.manualProfile),
          );
          const persistResult = await saveManualProfileData(generatedProfile, {
            successMessageText:
              completedPayload?.message || "Profile generation completed.",
            errorMessageText: "Generated profile could not be saved",
          });

          if (persistResult?.documents) {
            setDocuments(persistResult.documents);
          }
        }
      } catch (generationError) {
        if (generationError?.name === "AbortError") {
          setSuccessMessage("Generation cancelled.");
          return;
        }

        setError(generationError.message || "Profile generation failed");
      } finally {
        generateAbortControllerRef.current = null;
        setGeneratingManual(false);
      }
    },
    [accessToken, documents, generatingManual, saveManualProfileData],
  );

  const cancelGeneration = useCallback(() => {
    if (!generatingManual) {
      return;
    }

    generateAbortControllerRef.current?.abort();
  }, [generatingManual]);

  const value = useMemo(
    () => ({
      manualProfile,
      setManualProfile,
      documents,
      setDocuments,
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
      refreshDocuments,
      loadProfile,
      ensureProfileLoaded,
      saveManualProfileData,
      uploadDocumentForType,
      deleteDocument,
      downloadDocument,
      handleGenerateSection,
      cancelGeneration,
    }),
    [
      manualProfile,
      documents,
      githubUrl,
      loading,
      hasLoadedProfile,
      savingManual,
      uploadingByType,
      downloadingDocumentId,
      generatingManual,
      error,
      successMessage,
      refreshDocuments,
      loadProfile,
      ensureProfileLoaded,
      saveManualProfileData,
      uploadDocumentForType,
      deleteDocument,
      downloadDocument,
      handleGenerateSection,
      cancelGeneration,
    ],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
};
