import React from "react";
import RichTextViewer from "../common/RichTextViewer";

const renderMessageBody = (body) => <RichTextViewer html={body} collapsible />

const ProgressEmailDetailPanel = ({ email, loading }) => {
  if (loading) {
    return (
      <div className="card">
        <p className="text-sm text-gray-600">Loading email detail...</p>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="card">
        <p className="text-sm text-gray-600">
          Select an email to view full content and actions.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="space-y-2 border-b border-gray-200 pb-4">
        <h2 className="text-lg font-semibold text-gray-900">{email.subject}</h2>
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-700">From:</span> {email.sender}
        </p>
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-700">Date:</span>{" "}
          {new Date(email.date).toLocaleString()}
        </p>
        {email.summary ? (
          <p className="text-sm text-gray-700">
            <span className="font-medium text-gray-900">Summary:</span> {email.summary}
          </p>
        ) : null}
        {(email.companyName || email.positionTitle || email.contactEmail) ? (
          <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-3">
            <p>
              <span className="font-medium text-gray-900">Company:</span>{" "}
              {email.companyName || "-"}
            </p>
            <p>
              <span className="font-medium text-gray-900">Position:</span>{" "}
              {email.positionTitle || "-"}
            </p>
            <p>
              <span className="font-medium text-gray-900">Contact:</span>{" "}
              {email.contactEmail || email.senderEmail || "-"}
            </p>
          </div>
        ) : null}
      </div>
      <div className="pt-4">
        {renderMessageBody(email.body)}
      </div>
      <div className="mt-6 border-t border-gray-200 pt-4">
        <h3 className="text-base font-semibold text-gray-900">
          Thread Replies ({email.replyCount || email.replies?.length || 0})
        </h3>
        {!email.replies?.length ? (
          <p className="mt-2 text-sm text-gray-600">
            No replies have been linked to this conversation yet.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {email.replies.map((reply) => (
              <div
                key={reply.id}
                className="rounded-md border border-gray-200 bg-gray-50 p-3"
                style={{ marginLeft: `${Math.max((reply.depth || 1) - 1, 0) * 12}px` }}
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900">
                    {reply.subject || "(no subject)"}
                  </p>
                  <p className="text-xs text-gray-600">
                    <span className="font-medium text-gray-700">From:</span> {reply.sender}
                  </p>
                  <p className="text-xs text-gray-600">
                    <span className="font-medium text-gray-700">Date:</span>{" "}
                    {new Date(reply.date).toLocaleString()}
                  </p>
                  {reply.summary ? (
                    <p className="text-xs text-gray-700">
                      <span className="font-medium text-gray-900">Summary:</span>{" "}
                      {reply.summary}
                    </p>
                  ) : null}
                </div>
                <div className="mt-2">{renderMessageBody(reply.body)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressEmailDetailPanel;
