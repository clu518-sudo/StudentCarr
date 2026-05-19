import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useProgress } from "../../contexts/ProgressContext";
import { apiKeysApi } from "../../lib/apiClient";

// falls back to "—" for null/undefined
// (e.g. a key that has never been used has lastUsedAt === null)
const formatDate = (value) => {
    if (!value) return "-";
    try {
        return new Date(value).toLocaleDateString();
    } catch {
        return String(value);
    }
};

// "Connect to Claude Desktop" setup page.
// Responsibilities:
//   - Gate the whole page behind Gmail OAuth (we reuse ProgressContext's gmailConnected)
//   - Generate API keys via POST /api/keys and show the raw key ONCE
//   - Render a ready-to-paste Claude Desktop MCP config snippet
//   - List active keys (masked) and allow revoking the
const McpSetupView = () => {
    // accessToken is the JWT used for requireAuth-protected backend routes.
    // after login user can have The accessToken.
    const { accessToken } = useAuth();

    // gmailConnected / gmailStatus come from ProgressContext, which is the single source of truth for Gmail OAuth state across the app.
    const {
        gmailConnected,
        gmailStatus,
        loadingGmailStatus,
        ensureProgressLoaded,
    } = useProgress();

    // -- Local UI state --
    const [keys, setKeys] = useState([]);                      // list from GET api/keys
    const [loadingKeys, setLoadingKeys] = useState(false);
    const [label, setLabel] = useState("");                   // optional label for new key
    const [creating, setCreating] = useState(false);
    // newlyCreatedKey holds the *raw* key returned by POST /api/keys.
    // It only lives in memory and disappears on refresh — by design, since the backend can never produce it again.
    const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
    const [revokingId, setRevokingId] = useState(null);
    const [error, setError] = useState("");
    const [copiedField, setCopiedField] = useState(""); // click "copy" buttom.
    const [downloadingBundle, setDownloadingBundle] = useState(false);

    // Make sure ProgressContext has hydrated so gmailConnected is accurate before we decide what to render.
    useEffect(()=>{
        ensureProgressLoaded().catch(() => {
            // reload, nothing to do here.
        } )
    }, [ensureProgressLoaded]);

    // Fetch the current user's active keys. Memoized so the effect below doesn't re-trigger on every render.
    const loadKeys = useCallback(async () => {
        if (!accessToken) return;
        setLoadingKeys(true);
        setError("");
        try {
            const response = await apiKeysApi.list(accessToken);
            setKeys(response?.data || []);
        } catch (err) {
            setError(err.message || "Failed to load API keys");
        } finally {
            setLoadingKeys(false);
        }
    }, [accessToken]);

    // Only fetch keys once Gmail is connected — there's no point listing keys
    // for a user who can't yet use them (the API-key-protected MCP endpoints require a working Gmail token on the backend).
    useEffect(() => {
        if (gmailConnected) {
            loadKeys();
        }
    }, [gmailConnected, loadKeys]);

    // Generate a new key. The raw key returned here is the only chance the
    // user has to see/copy it, so we stash it in `newlyCreatedKey` and show a prominent warning.
    const handleGenerate = async (event) => {
        event.preventDefault();
        if (!accessToken || creating) return;
        setCreating(true);
        setError("");
        try {
            const response = await apiKeysApi.create(
                { label: label.trim() || undefined },
                accessToken,
            );
            setNewlyCreatedKey(response?.data || null);
            setLabel("");
            // Refresh the masked list so the new key appears immediately.
            loadKeys();
        } catch (err) {
            setError(err.message || "Failed to generate API key");
        } finally {
            setCreating(false);
        }
    }

    // Download a pre-configured Claude Desktop bundle (.mcpb).
    // The backend zips the MCP server with manifest defaults pointing at this
    // user's just-created key. Only callable while `newlyCreatedKey` is in
    // memory — the backend never sees the raw key again.
    const handleDownloadBundle = async () => {
        if (!newlyCreatedKey?.key || !accessToken || downloadingBundle) return;
        setDownloadingBundle(true);
        setError("");
        try {
            // VITE_API_BASE_URL is like "http://localhost:10001/api".
            // The MCP server's STUDENTCARR_API_URL must be the origin only
            // (it appends "/api/mcp" itself in apiClient.js), so strip "/api".
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`;
            const apiOrigin = apiBaseUrl.replace(/\/api\/?$/, "");

            const response = await fetch(`${apiBaseUrl}/keys/bundle`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    apiKey: newlyCreatedKey.key,
                    apiUrl: apiOrigin,
                }),
            });
         
            if (!response.ok) {
                throw new Error(`Bundle download failed (${response.status})`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "studentcarr-gmail.mcpb";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

        } catch (err) {
            setError(err.message || "Failed to download bundle");
        } finally { setDownloadingBundle(false) }
    };

    // Revoke a specific key. We confirm first because revocation immediately
    // breaks any Claude Desktop instance currently using this key.
    const handleRevoke = async (id) => {
        if (!accessToken) return;
        const ok = window.confirm(
            "Delete this API key? Any Claude Desktop using it will stop working.",
        );
        if (!ok) return;
        setRevokingId(id);
        setError("");
        try {
            await apiKeysApi.revoke(id, accessToken);
            // remove from the local list rather than re-fetching.
            setKeys((prev) => prev.filter((k) => k.id !== id));
        } catch (err) {
            setError(err.message || "Failed to delete API key");
        } finally {
            setRevokingId(null);
        }
    };

    // Generic clipboard helper that briefly highlights the "Copied" state on whichever button triggered it (raw key vs. config snippet).
    const copy = async (value, field) => {
        try{
            await navigator.clipboard.writeText(value);
            setCopiedField(field);
            setTimeout(() => setCopiedField(""),  1500);
        } catch {
            setError("Clipboard copy failed")
        }
    };

    // Build the Claude Desktop MCP config JSON the user pastes locally.
    // - If we just generated a key, embed it directly so a single copy works.
    // - Otherwise show the placeholder so the user knows where to paste.
    // - STUDENTCARR_API_URL defaults to current origin; replace before shipping.
    const mcpConfigSnippet = useMemo(() => {
        const keyValue = newlyCreatedKey?.key || "sc_YOUR_KEY_HERE";
        const apiUrl = (typeof window !== "undefined" && window.location?.origin) || "https://your-api-host";
        return JSON.stringify(
        {
            mcpServers: {
                "studentcarr-gmail": {
                    command: "npx",
                    args: ["-y", "studentcarr-mcp-server"],
                    env: {
                        STUDENTCARR_API_KEY: keyValue,
                        STUDENTCARR_API_URL: apiUrl,
                    },
                },
            },
        },
        null,
        2,
        );
    }, [newlyCreatedKey])


    // --- Render branches ---

    // 1) Still checking Gmail status: show a lightweight placeholder so we
    // don't flicker the "connect Gmail" CTA at users who actually are connected.
    if (loadingGmailStatus) {
    return (
        <div className="card">
        <p className="text-gray-600">Checking Gmail connection...</p>
        </div>
    );
    }

    // 2) Gmail not connected: hard gate. The MCP endpoints require a working
    // Gmail token server-side, so issuing API keys here would be misleading.
    if (!gmailConnected) {
    return (
        <div className="space-y-4">
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg p-6 text-white">
            <h1 className="text-2xl font-bold mb-2">Connect to Claude Desktop</h1>
            <p className="text-indigo-100">
            Generate an API key so Claude Desktop can reach your Gmail through StudentCarr.
            </p>
        </div>
        <div className="card border border-amber-200 bg-amber-50">
            <p className="text-amber-800 font-medium">
            Connect your Gmail first.
            </p>
            <p className="text-sm text-amber-700 mt-1">
            Gmail OAuth must be completed before generating API keys. Status:
            <span className="ml-1 font-mono">
                {gmailStatus?.connected ? "connected" : "not connected"}
            </span>
            </p>
            <Link
            to="/progress"
            className="inline-block mt-3 px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700"
            >
            Go to Progress Tracking to connect Gmail
            </Link>
        </div>
        </div>
    );
    }

    // 3) Happy path: Gmail is connected, render the full setup UI.
    return (
    <div className="space-y-6">
        {/* Header banner — matches the visual style used by ProgressView */}
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Connect to Claude Desktop</h1>
        <p className="text-indigo-100">
            Generate an API key, paste it into Claude Desktop's MCP config, and your local Claude
            Desktop will be able to call StudentCarr on your behalf.
        </p>
        </div>

        {/* Inline error banner. Errors from any of create/list/revoke land here. */}
        {error && (
        <div className="card border border-red-200 bg-red-50">
            <p className="text-red-700 text-sm">{error}</p>
        </div>
        )}

        {/* --- Generate key form --- */}
        <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Generate API key
        </h2>
        <form
            onSubmit={handleGenerate}
            className="flex flex-col sm:flex-row sm:items-end gap-3"
        >
            <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
                Label (optional)
            </label>
            {/* Label is purely cosmetic — helps the user remember which device
                this key lives on (e.g. "Laptop Claude Desktop"). */}
            <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Laptop Claude Desktop"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                maxLength={64}
            />
            </div>
            <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
            {creating ? "Generating..." : "Generate API key"}
            </button>
        </form>

        {/* One-time reveal panel. This is the ONLY place the raw key is ever
            shown — the backend stores only a SHA-256 hash. */}
        {newlyCreatedKey && (
            <div className="mt-4 border border-emerald-200 bg-emerald-50 rounded-md p-4">
            <p className="text-sm font-semibold text-emerald-800">
                Save this key now. It will not be shown again.
            </p>
            <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-white border border-emerald-200 rounded text-xs break-all font-mono">
                {newlyCreatedKey.key}
                </code>
                <button
                type="button"
                onClick={() => copy(newlyCreatedKey.key, "key")}
                className="px-3 py-2 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700"
                >
                {copiedField === "key" ? "Copied" : "Copy"}
                </button>
            </div>
            <div className="mt-3">
                <button
                    type="button"
                    onClick={handleDownloadBundle}
                    disabled={downloadingBundle}
                    className="px-3 py-2 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                    {downloadingBundle
                        ? "Building bundle..."
                        : "Download Claude Desktop bundle (.mcpb)"}
                </button>
                <p className="mt-1 text-xs text-emerald-700">
                    Double-click the downloaded file to install in Claude Desktop.
                    Your API key and server URL will already be filled in.
                </p>
            </div>
            {/* Manual dismiss — the panel doesn't auto-hide because that would
                make it easy to lose the key by accident. */}
            <button
                type="button"
                onClick={() => setNewlyCreatedKey(null)}
                className="mt-2 text-xs text-emerald-700 underline"
            >
                I've saved it — dismiss
            </button>
            </div>
        )}
        </div>

        {/* --- Claude Desktop config snippet --- */}
        <div className="card">
        <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">
            Claude Desktop MCP config
            </h2>
            <button
            type="button"
            onClick={() => copy(mcpConfigSnippet, "snippet")}
            className="px-3 py-1.5 bg-gray-800 text-white rounded text-xs font-medium hover:bg-gray-900"
            >
            {copiedField === "snippet" ? "Copied" : "Copy snippet"}
            </button>
        </div>
        <p className="text-sm text-gray-600 mb-2">
            Paste into Claude Desktop's <code>claude_desktop_config.json</code>.
            Replace <code>sc_YOUR_KEY_HERE</code> with the key shown above if you
            haven't already.
        </p>
        <pre className="bg-gray-900 text-gray-100 text-xs rounded-md p-3 overflow-x-auto font-mono">
            {mcpConfigSnippet}
        </pre>
        </div>

        {/* --- Active keys list --- */}
        <div className="card">
        <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Active keys</h2>
            <button
            type="button"
            onClick={loadKeys}
            disabled={loadingKeys}
            className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
            >
            {loadingKeys ? "Refreshing..." : "Refresh"}
            </button>
        </div>

        {loadingKeys && keys.length === 0 ? (
            <p className="text-sm text-gray-500">Loading keys...</p>
        ) : keys.length === 0 ? (
            <p className="text-sm text-gray-500">
            No active keys yet. Generate one above.
            </p>
        ) : (
            // maskedKey is the only key representation safe to display here;
            // the raw key is gone the moment the user dismisses the one-time panel.
            <ul className="divide-y divide-gray-200">
            {keys.map((key) => (
                <li
                key={key.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                <div>
                    <p className="text-sm font-medium text-gray-900">
                    {key.label || "Untitled key"}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                    {key.maskedKey}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                    Created {formatDate(key.createdAt)} · Last used{" "}
                    {formatDate(key.lastUsedAt)}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => handleRevoke(key.id)}
                    disabled={revokingId === key.id}
                    className="px-3 py-1.5 border border-red-200 text-red-700 rounded text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                >
                    {revokingId === key.id ? "Revoking..." : "Revoke"}
                </button>
                </li>
            ))}
            </ul>
        )}
        </div>
    </div>
    );

}

export default McpSetupView;

