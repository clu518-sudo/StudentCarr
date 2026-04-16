import React from "react";
import ProgressEmailList from "./ProgressEmailList";

const statusClasses = {
  applied: "bg-blue-100 text-blue-700",
  under_review: "bg-amber-100 text-amber-700",
  invited: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  offer: "bg-purple-100 text-purple-700",
};

const statusLabel = {
  applied: "Applied",
  under_review: "Under Review",
  invited: "Invited",
  rejected: "Rejected",
  offer: "Offer",
};

const ProgressApplicationItem = ({
  application,
  isExpanded,
  isSelected,
  emails,
  loadingEmails,
  selectedEmailId,
  deleting,
  onToggleSelect,
  onToggleExpand,
  onSelectEmail,
}) => (
  <div className="rounded-lg border border-gray-200 bg-white">
    <button
      type="button"
      onClick={onToggleExpand}
      className="w-full px-4 py-4 text-left hover:bg-gray-50 transition-colors"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={deleting}
            onChange={(event) => onToggleSelect(event.target.checked)}
            onClick={(event) => event.stopPropagation()}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            aria-label={`Select ${application.companyName} ${application.positionTitle}`}
          />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {application.companyName}
            </h3>
            <p className="text-sm text-gray-600">{application.positionTitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[application.status] || "bg-gray-100 text-gray-700"}`}
          >
            {statusLabel[application.status] || application.status}
          </span>
          <span className="text-xs text-gray-500">
            Updated {new Date(application.lastUpdatedAt).toLocaleString()}
          </span>
        </div>
      </div>
    </button>

    {isExpanded && (
      <div className="border-t border-gray-100 p-4">
        <ProgressEmailList
          emails={emails}
          loading={loadingEmails}
          selectedEmailId={selectedEmailId}
          onSelectEmail={onSelectEmail}
        />
      </div>
    )}
  </div>
);

export default ProgressApplicationItem;
