import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { progressTrackingApi } from "../../lib/apiClient";
import ProgressApplicationItem from "./ProgressApplicationItem";
import ProgressEmailDetailPanel from "./ProgressEmailDetailPanel";
import InviteReplyPanel from "./InviteReplyPanel";

const ProgressView = () => {
  const { accessToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [emailsByApplicationId, setEmailsByApplicationId] = useState({});
  const [expandedApplicationId, setExpandedApplicationId] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [selectedEmailDetail, setSelectedEmailDetail] = useState(null);
  const [draftText, setDraftText] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingEmailsByApplicationId, setLoadingEmailsByApplicationId] = useState({});
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

  const selectedEmailId = selectedEmailDetail?.id || selectedEmail?.id || "";
  const isInviteEmail = selectedEmailDetail?.intent === "invite";
  const gmailConnected = Boolean(gmailStatus?.connected);

  const loadApplications = useCallback(async () => {
    if (!accessToken) {
      return [];
    }

    setLoading(true);
    setError("");
    try {
      const response = await progressTrackingApi.listApplications(accessToken);
      const nextApplications = response?.data?.applications || [];
      setApplications(nextApplications);
      setSelectedApplicationIds((prev) =>
        prev.filter((id) => nextApplications.some((application) => application.id === id)),
      );
      return nextApplications;
    } catch (loadError) {
      setError(loadError.message || "Failed to load application progress.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const loadGmailStatus = useCallback(
    async ({ silent = false } = {}) => {
      if (!accessToken) {
        return;
      }

      if (!silent) {
        setLoadingGmailStatus(true);
      }
      try {
        const response = await progressTrackingApi.getGmailStatus(accessToken);
        setGmailStatus(response?.data?.gmail || null);
      } catch (loadError) {
        setError(loadError.message || "Failed to load Gmail connection status.");
      } finally {
        if (!silent) {
          setLoadingGmailStatus(false);
        }
      }
    },
    [accessToken],
  );

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    loadGmailStatus();
  }, [loadGmailStatus]);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const gmailState = query.get("gmail");
    const message = query.get("message");
    if (!gmailState) {
      return;
    }

    if (gmailState === "connected") {
      setSyncMessage("Gmail account connected successfully.");
      loadGmailStatus({ silent: false });
    }

    if (gmailState === "error") {
      setError(message || "Gmail connection failed.");
    }

    navigate(location.pathname, { replace: true });
  }, [loadGmailStatus, location.pathname, location.search, navigate]);

  const loadEmailsForApplication = useCallback(
    async (applicationId) => {
      if (!accessToken) {
        return [];
      }

      setLoadingEmailsByApplicationId((prev) => ({ ...prev, [applicationId]: true }));
      try {
        const response = await progressTrackingApi.listApplicationEmails(
          applicationId,
          accessToken,
        );
        const nextEmails = response?.data?.emails || [];
        setEmailsByApplicationId((prev) => ({ ...prev, [applicationId]: nextEmails }));
        return nextEmails;
      } catch (loadError) {
        setError(loadError.message || "Failed to load related emails.");
        return [];
      } finally {
        setLoadingEmailsByApplicationId((prev) => ({ ...prev, [applicationId]: false }));
      }
    },
    [accessToken],
  );

  const resetSelection = useCallback(() => {
    setExpandedApplicationId(null);
    setEmailsByApplicationId({});
    setSelectedEmail(null);
    setSelectedEmailDetail(null);
    setDraftText("");
    setConfirmationMessage("");
  }, []);

  const handleToggleApplicationSelection = useCallback((applicationId, checked) => {
    setSelectedApplicationIds((prev) => {
      if (checked) {
        return prev.includes(applicationId) ? prev : [...prev, applicationId];
      }
      return prev.filter((id) => id !== applicationId);
    });
  }, []);

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
      const deletedApplicationIds = response?.data?.deletedApplicationIds || selectedApplicationIds;

      setApplications((prev) =>
        prev.filter((application) => !deletedApplicationIds.includes(application.id)),
      );
      setEmailsByApplicationId((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(
            ([applicationId]) => !deletedApplicationIds.includes(applicationId),
          ),
        ),
      );
      if (
        (expandedApplicationId && deletedApplicationIds.includes(expandedApplicationId)) ||
        (selectedEmail?.applicationId &&
          deletedApplicationIds.includes(selectedEmail.applicationId))
      ) {
        resetSelection();
      }
      setSelectedApplicationIds((prev) =>
        prev.filter((applicationId) => !deletedApplicationIds.includes(applicationId)),
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
    selectedEmail,
    selectedApplicationIds,
  ]);

  const handleToggleApplication = async (applicationId) => {
    const shouldClose = expandedApplicationId === applicationId;
    setExpandedApplicationId(shouldClose ? null : applicationId);
    if (shouldClose) {
      return;
    }

    if (!emailsByApplicationId[applicationId]) {
      await loadEmailsForApplication(applicationId);
    }
  };

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

  const handleSelectEmail = useCallback(
    async (email) => {
      await loadSelectedEmailState(email);
    },
    [loadSelectedEmailState],
  );

  const handleStartGmailConnect = useCallback(async () => {
    if (!accessToken) {
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
  }, [accessToken]);

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
    } catch (disconnectError) {
      setError(disconnectError.message || "Failed to disconnect Gmail.");
    } finally {
      setDisconnectingGmail(false);
    }
  }, [accessToken]);

  const handleSyncMailbox = useCallback(async () => {
    if (!accessToken || !gmailConnected) {
      return;
    }

    setSyncingMailbox(true);
    setError("");
    setSyncMessage("");
    setConfirmationMessage("");

    try {
      const response = await progressTrackingApi.syncMailbox(accessToken);
      const sync = response?.data?.sync;
      const previousExpandedApplicationId = expandedApplicationId;
      const previousSelectedEmailId = selectedEmailId;
      const nextApplications = await loadApplications();
      await loadGmailStatus({ silent: true });

      const expandedApplicationStillExists =
        previousExpandedApplicationId &&
        nextApplications.some(
          (application) => application.id === previousExpandedApplicationId,
        );

      if (expandedApplicationStillExists) {
        setExpandedApplicationId(previousExpandedApplicationId);
        const refreshedEmails = await loadEmailsForApplication(previousExpandedApplicationId);
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
    expandedApplicationId,
    gmailConnected,
    loadApplications,
    loadEmailsForApplication,
    loadGmailStatus,
    loadSelectedEmailState,
    resetSelection,
    selectedEmailId,
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

  if (loading) {
    return (
      <div className="card">
        <p className="text-gray-600">Loading progress tracking data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg p-6 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Progress Tracking</h1>
            <p className="text-indigo-100">
              Review application status, inspect related emails, sync Gmail updates, and send reviewed invite replies.
            </p>
            <div className="mt-3 text-sm text-indigo-100">
              {loadingGmailStatus ? (
                <p>Checking Gmail connection status...</p>
              ) : gmailConnected ? (
                <p>
                  Connected Gmail: {gmailStatus?.email || "Connected"}.
                  {gmailStatus?.sync?.lastSyncCompletedAt
                    ? ` Last sync ${new Date(gmailStatus.sync.lastSyncCompletedAt).toLocaleString()}.`
                    : " No sync has been completed yet."}
                </p>
              ) : (
                <p>Connect your Gmail account to sync job-hunt emails.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
              onClick={handleStartGmailConnect}
              disabled={connectingGmail}
            >
              {connectingGmail
                ? "Connecting..."
                : gmailConnected
                  ? "Reconnect Gmail"
                  : "Connect Gmail"}
            </button>
            <button
              type="button"
              className="rounded-md border border-white/50 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
              onClick={handleSyncMailbox}
              disabled={!gmailConnected || syncingMailbox}
            >
              {syncingMailbox ? "Syncing..." : "Sync Progress Emails"}
            </button>
            {gmailConnected ? (
              <button
                type="button"
                className="rounded-md border border-white/50 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
                onClick={handleDisconnectGmail}
                disabled={disconnectingGmail}
              >
                {disconnectingGmail ? "Disconnecting..." : "Disconnect"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {syncMessage ? (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
          {syncMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="card">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  Job Applications
                </h2>
                <p className="text-sm text-gray-600">
                  Expand an application to inspect all related emails.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
                onClick={handleDeleteSelectedApplications}
                disabled={!selectedApplicationsCount || deletingApplications}
              >
                {deletingApplications
                  ? "Deleting..."
                  : `Delete Selected${selectedApplicationsCount ? ` (${selectedApplicationsCount})` : ""}`}
              </button>
            </div>
          </div>

          {!applications.length ? (
            <div className="card">
              <p className="text-sm text-gray-600">
                No applications available yet.
              </p>
            </div>
          ) : (
            applications.map((application) => (
              <ProgressApplicationItem
                key={application.id}
                application={application}
                isExpanded={expandedApplicationId === application.id}
                isSelected={selectedApplicationIds.includes(application.id)}
                emails={
                  expandedApplicationId === application.id
                    ? expandedEmails
                    : emailsByApplicationId[application.id] || []
                }
                loadingEmails={Boolean(loadingEmailsByApplicationId[application.id])}
                selectedEmailId={selectedEmailId}
                deleting={deletingApplications}
                onToggleSelect={(checked) =>
                  handleToggleApplicationSelection(application.id, checked)
                }
                onToggleExpand={() => handleToggleApplication(application.id)}
                onSelectEmail={handleSelectEmail}
              />
            ))
          )}
        </div>

        <div className="space-y-4">
          <ProgressEmailDetailPanel
            email={selectedEmailDetail}
            loading={loadingEmailDetail}
          />
          <InviteReplyPanel
            visible={isInviteEmail}
            loadingDraft={loadingDraft}
            draftText={draftText}
            onDraftChange={setDraftText}
            onConfirm={handleConfirmReply}
            confirming={confirmingReply}
            confirmationMessage={confirmationMessage}
          />
        </div>
      </div>
    </div>
  );
};

export default ProgressView;
