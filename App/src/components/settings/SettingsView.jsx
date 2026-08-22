import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { llmSettingsApi } from "../../lib/apiClient";

const formatDate = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const emptyForm = { label: "", apiKey: "", model: "", baseUrl: "" };

// Settings panel where the user saves multiple named LLM settings (their own
// API key per model/provider) and selects which one is active. The selected
// setting replaces the app's integrated/default key wherever AI generation runs.
const SettingsView = () => {
  const { accessToken } = useAuth();

  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectingId, setSelectingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const loadSettings = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const response = await llmSettingsApi.list(accessToken);
      setSettings(response?.data || []);
    } catch (err) {
      setError(err.message || "Failed to load LLM settings");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleAddClick = () => {
    setForm(emptyForm);
    setShowForm((open) => !open);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!accessToken || saving || !form.apiKey.trim()) return;
    setSaving(true);
    setError("");
    try {
      await llmSettingsApi.create(
        {
          label: form.label.trim() || undefined,
          apiKey: form.apiKey.trim(),
          model: form.model.trim() || undefined,
          baseUrl: form.baseUrl.trim() || undefined,
        },
        accessToken,
      );
      setForm(emptyForm);
      setShowForm(false);
      await loadSettings();
    } catch (err) {
      setError(err.message || "Failed to save LLM setting");
    } finally {
      setSaving(false);
    }
  };

  const handleSelect = async (id) => {
    if (!accessToken || selectingId) return;
    setSelectingId(id);
    setError("");
    try {
      await llmSettingsApi.select(id, accessToken);
      await loadSettings();
    } catch (err) {
      setError(err.message || "Failed to select LLM setting");
    } finally {
      setSelectingId(null);
    }
  };

  const handleRemove = async (id) => {
    if (!accessToken || removingId) return;
    const ok = window.confirm("Remove this saved LLM setting?");
    if (!ok) return;
    setRemovingId(id);
    setError("");
    try {
      await llmSettingsApi.remove(id, accessToken);
      await loadSettings();
    } catch (err) {
      setError(err.message || "Failed to remove LLM setting");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
        <p className="text-indigo-100">
          Save your own LLM API keys and pick which model StudentCarr should
          use on your behalf.
        </p>
      </div>

      {error && (
        <div className="card border border-red-200 bg-red-50">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Saved LLM settings
          </h2>
          <button
            type="button"
            onClick={handleAddClick}
            className="px-3 py-1.5 bg-primary-600 text-white rounded text-xs font-medium hover:bg-primary-700"
          >
            {showForm ? "Cancel" : "+ Add"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSave}
            className="mb-4 border border-gray-200 rounded-md p-4 space-y-3"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. My OpenAI key"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API key
              </label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model (optional)
              </label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="e.g. gpt-4o-mini, qwen-max"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base URL (optional)
              </label>
              <input
                type="text"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use this for OpenAI-compatible providers (DashScope/Qwen,
                Ollama, OpenRouter, etc.).
              </p>
            </div>

            <button
              type="submit"
              disabled={saving || !form.apiKey.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save setting"}
            </button>
          </form>
        )}

        {loading && settings.length === 0 ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : settings.length === 0 ? (
          <p className="text-sm text-gray-500">
            No LLM settings saved yet. Click "+ Add" above.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {settings.map((setting) => (
              <li
                key={setting.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="selectedLlmSetting"
                    checked={setting.isSelected}
                    onChange={() => handleSelect(setting.id)}
                    disabled={selectingId === setting.id}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {setting.label}
                      {setting.isSelected && (
                        <span className="ml-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                          Active
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      Key ending in {setting.lastFour}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Model: {setting.model || "provider default"} · Base
                      URL: {setting.baseUrl || "https://api.openai.com/v1"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Updated {formatDate(setting.updatedAt)}
                    </p>
                  </div>
                </label>
                <button
                  type="button"
                  onClick={() => handleRemove(setting.id)}
                  disabled={removingId === setting.id}
                  className="px-3 py-1.5 border border-red-200 text-red-700 rounded text-xs font-medium hover:bg-red-50 disabled:opacity-50 self-start sm:self-center"
                >
                  {removingId === setting.id ? "Removing..." : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SettingsView;
