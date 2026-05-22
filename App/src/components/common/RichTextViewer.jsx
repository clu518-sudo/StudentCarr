import React, { useMemo, useState } from "react";
import DOMPurify from "dompurify";

const looksLikeHtml = (value) =>
    typeof value === "string" && /<\/?[a-z][\s\S]*>/i.test(value);

// Email bodies often arrive as plain text — wrap into <p>/<br> so the
// viewer preserves paragraph breaks instead of collapsing whitespace.
const plainTextToHtml = (text) => {
    const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    return escaped
        .split(/\n{2,}/)
        .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br/>")}</p>`)
        .join("");
};

const RichTextViewer = ({
    html = "",
    className = "",
    collapsible = false,
    expandLabel = "Show original email ▼",
    collapseLabel = "Hide original email ▲",
}) => {
    const [expanded, setExpanded] = useState(!collapsible);

    const safeHtml = useMemo(() => {
        const source = looksLikeHtml(html) ? html : plainTextToHtml(html || "");
        return DOMPurify.sanitize(source, {
            USE_PROFILES: { html: true },
            ADD_ATTR: ["target", "rel"],
            // Allow inline base64 images (data:image/...) but only on <img>.
            // Script-style data: URIs on other tags remain blocked.
            ADD_DATA_URI_TAGS: ["img"],
        });
    }, [html]);

    if (!safeHtml.trim()) {
        return <p className="text-sm text-gray-500 italic">(no content)</p>;
    }

    const body = (
        <div
            className={`tiptap-shell prose prose-sm max-w-none ${className}`}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
    );

    if (!collapsible) {
        return body;
    }

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
                {expanded ? collapseLabel : expandLabel}
            </button>
            {expanded ? body : null}
        </div>
    );
};

export default RichTextViewer;