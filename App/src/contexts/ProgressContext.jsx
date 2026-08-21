import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { demoDisabledMessage, visitorApplications, visitorEmailsByApplicationId, visitorInterviewDraft } from "../data/visitorDemoData";

const ProgressContext = createContext(null);
const clone = (value) => JSON.parse(JSON.stringify(value));

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) throw new Error("useProgress must be used within a ProgressProvider");
  return context;
};

export const ProgressProvider = ({ children }) => {
  const [applications] = useState(() => clone(visitorApplications));
  const [emailsByApplicationId] = useState(() => clone(visitorEmailsByApplicationId));
  const [expandedApplicationId, setExpandedApplicationId] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [selectedEmailDetail, setSelectedEmailDetail] = useState(null);
  const [draftText, setDraftText] = useState(visitorInterviewDraft);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [selectedApplicationIds, setSelectedApplicationIds] = useState([]);
  const [syncMessage, setSyncMessage] = useState("");
  const [error, setError] = useState("");

  const showDisabledMessage = useCallback(() => {
    setError("");
    setSyncMessage(demoDisabledMessage);
    setConfirmationMessage("");
  }, []);

  const ensureProgressLoaded = useCallback(async () => applications, [applications]);
  const loadApplications = ensureProgressLoaded;
  const loadGmailStatus = useCallback(async () => null, []);
  const loadEmailsForApplication = useCallback(async (applicationId) => emailsByApplicationId[applicationId] || [], [emailsByApplicationId]);

  const loadSelectedEmailState = useCallback(async (email) => {
    setSelectedEmail(email);
    setSelectedEmailDetail(email);
    setDraftText(email?.draftText || "");
    setConfirmationMessage("");
    return email;
  }, []);

  const handleToggleApplicationSelection = useCallback((applicationId, checked) => {
    setSelectedApplicationIds((current) => checked
      ? Array.from(new Set([...current, applicationId]))
      : current.filter((id) => id !== applicationId));
  }, []);

  const handleToggleApplication = useCallback((applicationId) => {
    setExpandedApplicationId((current) => current === applicationId ? null : applicationId);
    setSelectedEmail(null);
    setSelectedEmailDetail(null);
    setDraftText("");
    setConfirmationMessage("");
  }, []);

  const handleSelectEmail = useCallback((email) => {
    loadSelectedEmailState(email);
  }, [loadSelectedEmailState]);

  const expandedEmails = useMemo(() => expandedApplicationId ? emailsByApplicationId[expandedApplicationId] || [] : [], [emailsByApplicationId, expandedApplicationId]);
  const selectedEmailId = selectedEmailDetail?.id || selectedEmail?.id || "";

  const value = useMemo(() => ({
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
    loading: false,
    hasLoadedProgress: true,
    loadingEmailsByApplicationId: {},
    loadingEmailDetail: false,
    loadingDraft: false,
    confirmingReply: false,
    connectingGmail: false,
    disconnectingGmail: false,
    loadingGmailStatus: false,
    syncingMailbox: false,
    deletingApplications: false,
    gmailStatus: null,
    selectedApplicationIds,
    syncMessage,
    setSyncMessage,
    error,
    setError,
    selectedEmailId,
    isInviteEmail: selectedEmailDetail?.intent === "invite",
    gmailConnected: false,
    isGoogleLoginSession: false,
    isSyncRunning: false,
    expandedEmails,
    selectedApplicationsCount: selectedApplicationIds.length,
    ensureProgressLoaded,
    loadApplications,
    loadGmailStatus,
    loadEmailsForApplication,
    loadSelectedEmailState,
    handleToggleApplicationSelection,
    handleDeleteSelectedApplications: showDisabledMessage,
    handleToggleApplication,
    handleSelectEmail,
    handleStartGmailConnect: showDisabledMessage,
    handleDisconnectGmail: showDisabledMessage,
    handleSyncMailbox: showDisabledMessage,
    handleConfirmReply: showDisabledMessage,
  }), [applications, confirmationMessage, draftText, emailsByApplicationId, ensureProgressLoaded, error, expandedApplicationId, expandedEmails, handleSelectEmail, handleToggleApplication, handleToggleApplicationSelection, loadApplications, loadEmailsForApplication, loadGmailStatus, loadSelectedEmailState, selectedApplicationIds, selectedEmail, selectedEmailDetail, showDisabledMessage, syncMessage]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
};
