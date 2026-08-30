import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { progressTrackingApi } from "../lib/apiClient";
import { useAuth } from "./AuthContext";

const ProgressContext = createContext(null);
const syncStatusPollingIntervalMs = 3000;

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return context;
};

export const ProgressProvider = ({ children }) => {
  const { accessToken, user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [emailsByApplicationId, setEmailsByApplicationId] = useState({});
  const [expandedApplicationId, setExpandedApplicationId] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [selectedEmailDetail, setSelectedEmailDetail] = useState(null);
  const [draftText, setDraftText] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasLoadedProgress, setHasLoadedProgress] = useState(false);
  const [loadingEmailsByApplicationId, setLoadingEmailsByApplicationId] =
    useState({});
  const [loadingEmailDetail, setLoadingEmailDetail] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [confirmingReply, setConfirmingReply] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [disconnectingGmail, setDisconnectingGmail] = useState(false);
  const [loadingGmailStatus, setLoadingGmailStatus] = useState(true);
  const [syncingMailbox, setSyncingMailbox] = useState(false);
  const [deletingApplications, setDeletingApplications] = useState(false);
  const [gmailStatus, setGmailStatus] = useState(null);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState([]);
  const [syncMessage, setSyncMessage] = useState("");
  const [error, setError] = useState("");
  const hasLoadedProgressRef = useRef(false);
  const previousSyncStatusRef = useRef("");

  const selectedEmailId = selectedEmailDetail?.id || selectedEmail?.id || "";
  const isInviteEmail = selectedEmailDetail?.intent === "invite";
  const gmailConnected = Boolean(gmailStatus?.connected);
  const isGoogleLoginSession = user?.authProvider === "google";
  const backendSyncRunning = gmailStatus?.sync?.status === "running";
  const isSyncRunning = syncingMailbox || backendSyncRunning;

  const resetSelection = useCallback(() => {
    setExpandedApplicationId(null);
    setEmailsByApplicationId({});
    setSelectedEmail(null);
    setSelectedEmailDetail(null);
    setDraftText("");
    setConfirmationMessage("");
  }, []);

  const resetProgressState = useCallback(() => {
    setApplications([]);
    setEmailsByApplicationId({});
    setExpandedApplicationId(null);
    setSelectedEmail(null);
    setSelectedEmailDetail(null);
    setDraftText("");
    setConfirmationMessage("");
    setLoading(false);
    setHasLoadedProgress(false);
    setLoadingEmailsByApplicationId({});
    setLoadingEmailDetail(false);
    setLoadingDraft(false);
    setConfirmingReply(false);
    setConnectingGmail(false);
    setDisconnectingGmail(false);
    setLoadingGmailStatus(false);
    setSyncingMailbox(false);
    setDeletingApplications(false);
    setGmailStatus(null);
    setSelectedApplicationIds([]);
    setSyncMessage("");
    setError("");
    hasLoadedProgressRef.current = false;
    previousSyncStatusRef.current = "";
  }, []);

  useEffect(() => {
    if (accessToken) {
      return;
    }

    resetProgressState();
  }, [accessToken, resetProgressState]);

  const loadApplications = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) {
        return [];
      }

      if (!silent) {
        setLoading(true);
        setError("");
      }

      try {
        const response = await progressTrackingApi.listApplications(accessToken);
        const nextApplications = response?.data?.applications || [];
        setApplications(nextApplications);
        setSelectedApplicationIds((prev) =>
          prev.filter((id) =>
            nextApplications.some((application) => application.id === id),
          ),
        );
        return nextApplications;
      } catch (loadError) {
        setError(loadError.message || "Failed to load application progress.");
        return [];
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [accessToken],
  );

  const loadGmailStatus = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) {
        return null;
      }

      if (!silent) {
        setLoadingGmailStatus(true);
      }
      try {
        const response = await progressTrackingApi.getGmailStatus(accessToken);
        const nextGmailStatus = response?.data?.gmail || null;
        setGmailStatus(nextGmailStatus);
        return nextGmailStatus;
      } catch (loadError) {
        setError(loadError.message || "Failed to load Gmail connection status.");
        return null;
      } finally {
        if (!silent) {
          setLoadingGmailStatus(false);
        }
      }
    },
    [accessToken],
  );

  const ensureProgressLoaded = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    if (hasLoadedProgressRef.current) {
      return;
    }

    const [nextApplications, nextGmailStatus] = await Promise.all([
      loadApplications(),
      loadGmailStatus(),
    ]);

    if (nextApplications || nextGmailStatus) {
      setHasLoadedProgress(true);
      hasLoadedProgressRef.current = true;
      previousSyncStatusRef.current = nextGmailStatus?.sync?.status || "";
    }
  }, [accessToken, loadApplications, loadGmailStatus]);

  const loadEmailsForApplication = useCallback(
    async (applicationId) => {
      if (!accessToken) {
        return [];
      }

      setLoadingEmailsByApplicationId((prev) => ({
        ...prev,
        [applicationId]: true,
      }));
      try {
        const response = await progressTrackingApi.listApplicationEmails(
          applicationId,
          accessToken,
        );
        const nextEmails = response?.data?.emails || [];
        setEmailsByApplicationId((prev) => ({
          ...prev,
          [applicationId]: nextEmails,
        }));
        return nextEmails;
      } catch (loadError) {
        setError(loadError.message || "Failed to load related emails.");
        return [];
      } finally {
        setLoadingEmailsByApplicationId((prev) => ({
          ...prev,
          [applicationId]: false,
        }));
      }
    },
    [accessToken],
  );

  const loadSelectedEmailState = useCallback(
    async (email) => {
      if (!accessToken) {
        return;
      }

      setSelectedEmail(email);
      setSelectedEmailDetail(null);
      setDraftText("");
      setConfirmationMessage("");
      setError("");
      setLoadingEmailDetail(true);
      setLoadingDraft(false);

      try {
        const detailResponse = await progressTrackingApi.getEmailDetail(
          email.id,
          accessToken,
        );
        const emailDetail = detailResponse?.data?.email || null;
        setSelectedEmailDetail(emailDetail);
        if (emailDetail?.id) {
          setSelectedEmail((prev) => ({
            ...(prev || email),
            ...email,
            id: emailDetail.id,
            applicationId: emailDetail.applicationId || email.applicationId || null,
          }));
        }

        if (emailDetail?.intent === "invite") {
          setLoadingDraft(true);
          const draftResponse = await progressTrackingApi.getInviteReplyDraft(
            emailDetail.id,
            accessToken,
          );
          setDraftText(draftResponse?.data?.draft?.draftText || "");
        }
      } catch (loadError) {
        setError(loadError.message || "Failed to load email details.");
      } finally {
        setLoadingEmailDetail(false);
        setLoadingDraft(false);
      }
    },
    [accessToken],
  );

  const refreshAfterSync = useCallback(async () => {
    const previousExpandedApplicationId = expandedApplicationId;
    const previousSelectedEmailId = selectedEmailId;
    const nextApplications = await loadApplications({ silent: true });

    const expandedApplicationStillExists =
      previousExpandedApplicationId &&
      nextApplications.some(
        (application) => application.id === previousExpandedApplicationId,
      );

    if (expandedApplicationStillExists) {
      setExpandedApplicationId(previousExpandedApplicationId);
      const refreshedEmails = await loadEmailsForApplication(
        previousExpandedApplicationId,
      );
      const nextSelectedEmail = refreshedEmails.find(
        (email) => email.id === previousSelectedEmailId,
      );

      if (nextSelectedEmail) {
        await loadSelectedEmailState(nextSelectedEmail);
      } else {
        setSelectedEmail(null);
        setSelectedEmailDetail(null);
        setDraftText("");
        setConfirmationMessage("");
      }
    } else {
      resetSelection();
    }
  }, [
    expandedApplicationId,
    loadApplications,
    loadEmailsForApplication,
    loadSelectedEmailState,
    resetSelection,
    selectedEmailId,
  ]);

  useEffect(() => {
    if (!accessToken || !backendSyncRunning) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadGmailStatus({ silent: true });
    }, syncStatusPollingIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [accessToken, backendSyncRunning, loadGmailStatus]);

  useEffect(() => {
    const currentSyncStatus = gmailStatus?.sync?.status || "";
    const previousSyncStatus = previousSyncStatusRef.current;

    if (
      previousSyncStatus === "running" &&
      currentSyncStatus &&
      currentSyncStatus !== "running"
    ) {
      refreshAfterSync();
      if (!syncMessage) {
        setSyncMessage("Progress email sync completed.");
      }
      setSyncingMailbox(false);
    }

    previousSyncStatusRef.current = currentSyncStatus;
  }, [gmailStatus?.sync?.status, refreshAfterSync, syncMessage]);

  // Progress data only ever changes from the Sync button on this page, so there
  // is nothing to listen for: the assistant's MCP tool reads the database and
  // never writes to it.

  const handleToggleApplicationSelection = useCallback(
    (applicationId, checked) => {
      setSelectedApplicationIds((prev) => {
        if (checked) {
          return prev.includes(applicationId)
            ? prev
            : [...prev, applicationId];
        }
        return prev.filter((id) => id !== applicationId);
      });
    },
    [],
  );

  const handleToggleSelectAllApplications = useCallback(() => {
    setSelectedApplicationIds((prev) =>
      applications.length && prev.length === applications.length
        ? []
        : applications.map((application) => application.id),
    );
  }, [applications]);

  const handleDeleteSelectedApplications = useCallback(async () => {
    if (!accessToken || !selectedApplicationIds.length || deletingApplications) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedApplicationIds.length} selected position(s)? This will also remove related emails and reply drafts.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingApplications(true);
    setError("");
    setSyncMessage("");
    setConfirmationMessage("");

    try {
      const response = await progressTrackingApi.deleteApplications(
        selectedApplicationIds,
        accessToken,
      );
      const deletedApplicationIds =
        response?.data?.deletedApplicationIds || selectedApplicationIds;

      setApplications((prev) =>
        prev.filter(
          (application) => !deletedApplicationIds.includes(application.id),
        ),
      );
      setEmailsByApplicationId((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(
            ([applicationId]) => !deletedApplicationIds.includes(applicationId),
          ),
        ),
      );
      if (
        (expandedApplicationId &&
          deletedApplicationIds.includes(expandedApplicationId)) ||
        (selectedEmail?.applicationId &&
          deletedApplicationIds.includes(selectedEmail.applicationId))
      ) {
        resetSelection();
      }
      setSelectedApplicationIds((prev) =>
        prev.filter(
          (applicationId) => !deletedApplicationIds.includes(applicationId),
        ),
      );
      setSyncMessage(
        `Deleted ${response?.data?.deletedApplicationsCount || deletedApplicationIds.length} position(s).`,
      );
    } catch (deleteError) {
      setError(deleteError.message || "Failed to delete selected positions.");
    } finally {
      setDeletingApplications(false);
    }
  }, [
    accessToken,
    deletingApplications,
    expandedApplicationId,
    resetSelection,
    selectedApplicationIds,
    selectedEmail,
  ]);

  const handleToggleApplication = useCallback(
    async (applicationId) => {
      const shouldClose = expandedApplicationId === applicationId;
      setExpandedApplicationId(shouldClose ? null : applicationId);
      if (shouldClose) {
        return;
      }

      if (!emailsByApplicationId[applicationId]) {
        await loadEmailsForApplication(applicationId);
      }
    },
    [emailsByApplicationId, expandedApplicationId, loadEmailsForApplication],
  );

  const handleSelectEmail = useCallback(
    async (email) => {
      await loadSelectedEmailState(email);
    },
    [loadSelectedEmailState],
  );

  const handleStartGmailConnect = useCallback(async () => {
    if (!accessToken || isGoogleLoginSession) {
      return;
    }

    setConnectingGmail(true);
    setError("");
    try {
      const response = await progressTrackingApi.connectGmail(accessToken);
      const authUrl = response?.data?.authUrl;
      if (!authUrl) {
        throw new Error("Gmail authorization URL was not returned.");
      }
      window.location.assign(authUrl);
    } catch (connectError) {
      setError(connectError.message || "Failed to start Gmail connection.");
      setConnectingGmail(false);
    }
  }, [accessToken, isGoogleLoginSession]);

  const handleDisconnectGmail = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setDisconnectingGmail(true);
    setError("");
    try {
      const response = await progressTrackingApi.disconnectGmail(accessToken);
      setGmailStatus(response?.data?.gmail || null);
      setSyncMessage("Gmail account disconnected.");
      setSyncingMailbox(false);
      previousSyncStatusRef.current = "";
    } catch (disconnectError) {
      setError(disconnectError.message || "Failed to disconnect Gmail.");
    } finally {
      setDisconnectingGmail(false);
    }
  }, [accessToken]);

  const handleSyncMailbox = useCallback(async () => {
    if (!accessToken || !gmailConnected || isSyncRunning) {
      return;
    }

    setSyncingMailbox(true);
    setError("");
    setSyncMessage("");
    setConfirmationMessage("");

    try {
      const response = await progressTrackingApi.syncMailbox(accessToken);
      const sync = response?.data?.sync;
      await loadGmailStatus({ silent: true });
      await refreshAfterSync();
      setSyncMessage(
        `Synced ${sync?.processedMessages || 0} relevant email(s) from ${sync?.scannedMessages || 0} scanned message(s).`,
      );
    } catch (syncError) {
      setError(syncError.message || "Failed to sync Gmail progress emails.");
    } finally {
      setSyncingMailbox(false);
    }
  }, [
    accessToken,
    gmailConnected,
    isSyncRunning,
    loadGmailStatus,
    refreshAfterSync,
  ]);

  const handleConfirmReply = useCallback(async () => {
    if (!accessToken || !selectedEmailId || !draftText.trim()) {
      return;
    }

    setConfirmingReply(true);
    setError("");
    setConfirmationMessage("");
    try {
      const response = await progressTrackingApi.confirmInviteReply(
        { emailId: selectedEmailId, draftText },
        accessToken,
      );
      const confirmation = response?.data?.confirmation;
      if (confirmation?.deliveryId) {
        setConfirmationMessage(
          `Reply sent (delivery id: ${confirmation.deliveryId}).`,
        );
      } else {
        setConfirmationMessage("Reply sent successfully.");
      }
    } catch (confirmError) {
      setError(confirmError.message || "Failed to confirm Gmail send.");
    } finally {
      setConfirmingReply(false);
    }
  }, [accessToken, draftText, selectedEmailId]);

  const expandedEmails = useMemo(
    () =>
      expandedApplicationId
        ? emailsByApplicationId[expandedApplicationId] || []
        : [],
    [emailsByApplicationId, expandedApplicationId],
  );

  const selectedApplicationsCount = selectedApplicationIds.length;
  const allApplicationsSelected =
    applications.length > 0 &&
    selectedApplicationsCount === applications.length;

  const value = useMemo(
    () => ({
      applications,
      emailsByApplicationId,
      expandedApplicationId,
      setExpandedApplicationId,
      selectedEmail,
      setSelectedEmail,
      selectedEmailDetail,
      setSelectedEmailDetail,
      draftText,
      setDraftText,
      confirmationMessage,
      setConfirmationMessage,
      loading,
      hasLoadedProgress,
      loadingEmailsByApplicationId,
      loadingEmailDetail,
      loadingDraft,
      confirmingReply,
      connectingGmail,
      disconnectingGmail,
      loadingGmailStatus,
      syncingMailbox,
      deletingApplications,
      gmailStatus,
      selectedApplicationIds,
      syncMessage,
      setSyncMessage,
      error,
      setError,
      selectedEmailId,
      isInviteEmail,
      gmailConnected,
      isGoogleLoginSession,
      isSyncRunning,
      expandedEmails,
      selectedApplicationsCount,
      allApplicationsSelected,
      ensureProgressLoaded,
      loadApplications,
      loadGmailStatus,
      loadEmailsForApplication,
      loadSelectedEmailState,
      handleToggleApplicationSelection,
      handleToggleSelectAllApplications,
      handleDeleteSelectedApplications,
      handleToggleApplication,
      handleSelectEmail,
      handleStartGmailConnect,
      handleDisconnectGmail,
      handleSyncMailbox,
      handleConfirmReply,
    }),
    [
      applications,
      emailsByApplicationId,
      expandedApplicationId,
      selectedEmail,
      selectedEmailDetail,
      draftText,
      confirmationMessage,
      loading,
      hasLoadedProgress,
      loadingEmailsByApplicationId,
      loadingEmailDetail,
      loadingDraft,
      confirmingReply,
      connectingGmail,
      disconnectingGmail,
      loadingGmailStatus,
      syncingMailbox,
      deletingApplications,
      gmailStatus,
      selectedApplicationIds,
      syncMessage,
      error,
      selectedEmailId,
      isInviteEmail,
      gmailConnected,
      isGoogleLoginSession,
      isSyncRunning,
      expandedEmails,
      selectedApplicationsCount,
      allApplicationsSelected,
      ensureProgressLoaded,
      loadApplications,
      loadGmailStatus,
      loadEmailsForApplication,
      loadSelectedEmailState,
      handleToggleApplicationSelection,
      handleToggleSelectAllApplications,
      handleDeleteSelectedApplications,
      handleToggleApplication,
      handleSelectEmail,
      handleStartGmailConnect,
      handleDisconnectGmail,
      handleSyncMailbox,
      handleConfirmReply,
    ],
  );

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
};
