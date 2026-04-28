import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useProgress } from "../../contexts/ProgressContext";
import ProgressApplicationItem from "./ProgressApplicationItem";
import ProgressEmailDetailPanel from "./ProgressEmailDetailPanel";
import InviteReplyPanel from "./InviteReplyPanel";

const ProgressView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    applications,
    emailsByApplicationId,
    expandedApplicationId,
    selectedEmailDetail,
    draftText,
    setDraftText,
    confirmationMessage,
    hasLoadedProgress,
    loadingEmailsByApplicationId,
    loadingEmailDetail,
    loadingDraft,
    confirmingReply,
    connectingGmail,
    disconnectingGmail,
    loadingGmailStatus,
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
    isSyncRunning,
    expandedEmails,
    selectedApplicationsCount,
    ensureProgressLoaded,
    loadGmailStatus,
    handleToggleApplicationSelection,
    handleDeleteSelectedApplications,
    handleToggleApplication,
    handleSelectEmail,
    handleStartGmailConnect,
    handleDisconnectGmail,
    handleSyncMailbox,
    handleConfirmReply,
  } = useProgress();

  useEffect(() => {
    ensureProgressLoaded().catch(() => {
      // Error state is handled by the progress context.
    });
  }, [ensureProgressLoaded]);

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

  if (!hasLoadedProgress && !error) {
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
              disabled={!gmailConnected || isSyncRunning}
            >
              {isSyncRunning ? "Syncing..." : "Sync Progress Emails"}
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
