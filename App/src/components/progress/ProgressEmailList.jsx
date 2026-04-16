import React from "react";

const intentClasses = {
  applied_confirmation: "bg-blue-100 text-blue-700",
  follow_up: "bg-amber-100 text-amber-700",
  invite: "bg-green-100 text-green-700",
  rejection: "bg-red-100 text-red-700",
  unknown: "bg-gray-100 text-gray-700",
};

const intentLabel = {
  applied_confirmation: "Applied Confirmation",
  follow_up: "Follow Up",
  invite: "Invite",
  rejection: "Rejection",
  unknown: "Unknown",
};

const ProgressEmailList = ({ emails, loading, selectedEmailId, onSelectEmail }) => {
  if (loading) {
    return <p className="text-sm text-gray-600">Loading related emails...</p>;
  }

  if (!emails.length) {
    return <p className="text-sm text-gray-600">No related emails found.</p>;
  }

  return (
    <div className="space-y-2">
      {emails.map((email) => {
        const isActive = selectedEmailId === email.id;
        return (
          <button
            key={email.id}
            type="button"
            onClick={() => onSelectEmail(email)}
            className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${
              isActive
                ? "border-primary-400 bg-primary-50"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{email.subject}</p>
                <p className="text-xs text-gray-600">{email.sender}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    intentClasses[email.intent] || intentClasses.unknown
                  }`}
                >
                  {intentLabel[email.intent] || intentLabel.unknown}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(email.date).toLocaleString()}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ProgressEmailList;
