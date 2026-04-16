import React from "react";

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
        <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
          {email.body}
        </pre>
      </div>
    </div>
  );
};

export default ProgressEmailDetailPanel;
