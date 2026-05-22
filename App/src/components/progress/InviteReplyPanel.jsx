import React from "react";
import RichTextEditor from "../common/RichTextEditor";

const InviteReplyPanel = ({
  visible,
  loadingDraft,
  draftText,
  onDraftChange,
  onConfirm,
  confirming,
  confirmationMessage,
}) => {
  if (!visible) {
    return null;
  }

  return (
    <div className="card">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          AI Reply Draft
        </h2>
        <p className="text-sm text-gray-600">
          Edit the draft before confirming the Gmail send action.
        </p>
      </div>

      {loadingDraft ? (
        <p className="text-sm text-gray-600">Generating draft...</p>
      ) : (
        <div className="space-y-4">
          <RichTextEditor
            value={draftText}
            onChange={onDraftChange}
            minRows={9}
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={onConfirm}
              disabled={confirming || !draftText.trim()}
            >
              {confirming ? "Sending..." : "Confirm And Send"}
            </button>
            {confirmationMessage ? (
              <p className="text-sm text-green-700">{confirmationMessage}</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteReplyPanel;
