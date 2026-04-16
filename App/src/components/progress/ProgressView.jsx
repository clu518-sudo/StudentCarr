import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { progressTrackingApi } from "../../lib/apiClient";
import ProgressApplicationItem from "./ProgressApplicationItem";
import ProgressEmailDetailPanel from "./ProgressEmailDetailPanel";
import InviteReplyPanel from "./InviteReplyPanel";

const ProgressView = () => {
  const { accessToken } = useAuth();
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
  const [error, setError] = useState("");

  const selectedEmailId = selectedEmail?.id || "";
  const isInviteEmail = selectedEmailDetail?.intent === "invite";

  const loadApplications = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await progressTrackingApi.listApplications(accessToken);
      setApplications(response?.data?.applications || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load application progress.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const loadEmailsForApplication = useCallback(
    async (applicationId) => {
      if (!accessToken) {
        return;
      }

      setLoadingEmailsByApplicationId((prev) => ({ ...prev, [applicationId]: true }));
      try {
        const response = await progressTrackingApi.listApplicationEmails(
          applicationId,
          accessToken,
        );
        const nextEmails = response?.data?.emails || [];
        setEmailsByApplicationId((prev) => ({ ...prev, [applicationId]: nextEmails }));
      } catch (loadError) {
        setError(loadError.message || "Failed to load related emails.");
      } finally {
        setLoadingEmailsByApplicationId((prev) => ({ ...prev, [applicationId]: false }));
      }
    },
    [accessToken],
  );

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

  const handleSelectEmail = useCallback(
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

        if (emailDetail?.intent === "invite") {
          setLoadingDraft(true);
          const draftResponse = await progressTrackingApi.getInviteReplyDraft(
            email.id,
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
          `Mock reply sent (delivery id: ${confirmation.deliveryId}).`,
        );
      } else {
        setConfirmationMessage("Mock reply sent successfully.");
      }
    } catch (confirmError) {
      setError(confirmError.message || "Failed to confirm mock send.");
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
        <h1 className="text-2xl font-bold mb-2">Progress Tracking</h1>
        <p className="text-indigo-100">
          Review application status, inspect related emails, and draft invite replies.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Job Applications
            </h2>
            <p className="text-sm text-gray-600">
              Expand an application to inspect all related emails.
            </p>
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
                emails={
                  expandedApplicationId === application.id
                    ? expandedEmails
                    : emailsByApplicationId[application.id] || []
                }
                loadingEmails={Boolean(loadingEmailsByApplicationId[application.id])}
                selectedEmailId={selectedEmailId}
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
