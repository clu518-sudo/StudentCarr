import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useProfile } from "../../contexts/ProfileContext";
import RichTextEditor from "../common/RichTextEditor";
import {
  PROFILE_SECTIONS,
  inputClass,
  parseCsv,
  profileActionButtonClass,
  profileDangerButtonClass,
  sectionTitleClass,
} from "./profileFormConfig";
import { SECTION_LABELS, getEntryKey, hasEntryWithKey } from "../../lib/profileEntries";

// Draft state keeps every field as the value its control needs: comma
// separated fields stay strings while typing and are only split on submit, so
// a half-typed "React, " does not lose its trailing separator.
const buildInitialValues = (section) =>
  PROFILE_SECTIONS[section].fields.reduce((values, field) => {
    if (field.type === "checkbox") {
      return { ...values, [field.name]: false };
    }
    return { ...values, [field.name]: "" };
  }, {});

const buildEntry = (section, values) =>
  PROFILE_SECTIONS[section].fields.reduce(
    (entry, field) => {
      const value = values[field.name];

      if (field.type === "csv") {
        return { ...entry, [field.name]: parseCsv(value) };
      }
      if (field.type === "number") {
        return { ...entry, [field.name]: value === "" ? "" : Number(value) };
      }
      if (field.type === "checkbox") {
        return { ...entry, [field.name]: Boolean(value) };
      }
      return { ...entry, [field.name]: value };
    },
    { ...PROFILE_SECTIONS[section].template },
  );

// Dedicated add page for one repeatable profile section, rendered in the
// workspace column at /profile/add/:section. The fields shown come from the
// section's config, so the panel format follows the component being added.
const ProfileEntryAddView = () => {
  const { section } = useParams();
  const navigate = useNavigate();
  const { manualProfile, setManualProfile, setError, setSuccessMessage, ensureProfileLoaded } =
    useProfile();

  const sectionConfig = PROFILE_SECTIONS[section];
  const [values, setValues] = useState(() =>
    sectionConfig ? buildInitialValues(section) : {},
  );
  const [formError, setFormError] = useState("");

  useEffect(() => {
    ensureProfileLoaded().catch(() => {
      // Error state is handled by the profile context.
    });
  }, [ensureProfileLoaded]);

  // Start from a blank draft whenever the route switches to another section
  // without unmounting this view.
  useEffect(() => {
    setValues(PROFILE_SECTIONS[section] ? buildInitialValues(section) : {});
    setFormError("");
  }, [section]);

  const existingEntries = useMemo(
    () => (sectionConfig ? manualProfile[section] || [] : []),
    [manualProfile, section, sectionConfig],
  );

  if (!sectionConfig) {
    return <Navigate to="/profile" replace />;
  }

  const updateValue = (fieldName, value) => {
    setFormError("");
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const missingField = sectionConfig.fields.find(
      (field) => field.required && !String(values[field.name] ?? "").trim(),
    );
    if (missingField) {
      setFormError(`${missingField.label} is required.`);
      return;
    }

    const entry = buildEntry(section, values);

    // Same identity rule as the rest of the profile: an entry whose name is
    // already in this section is not added again.
    if (hasEntryWithKey(existingEntries, section, getEntryKey(section, entry))) {
      setFormError(
        `A ${SECTION_LABELS[section]} entry with that name already exists.`,
      );
      return;
    }

    setManualProfile((prev) => ({
      ...prev,
      [section]: [...(prev[section] || []), entry],
    }));
    setError("");
    setSuccessMessage(
      `${sectionConfig.title} entry added. Click Save Profile to store it.`,
    );
    navigate("/profile");
  };

  const renderField = (field) => {
    if (field.type === "richtext") {
      return (
        <RichTextEditor
          value={values[field.name] || ""}
          onChange={(html) => updateValue(field.name, html)}
          placeholder={field.placeholder || field.label}
          minRows={field.minRows || 3}
        />
      );
    }

    if (field.type === "checkbox") {
      return (
        <label className="text-sm text-gray-700">
          <input
            type="checkbox"
            className="mr-2"
            checked={Boolean(values[field.name])}
            onChange={(event) => updateValue(field.name, event.target.checked)}
          />
          {field.label}
        </label>
      );
    }

    return (
      <input
        className={inputClass}
        placeholder={field.placeholder || field.label}
        value={values[field.name] ?? ""}
        onChange={(event) => updateValue(field.name, event.target.value)}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-6 text-white shadow-sm">
        <h1 className="text-2xl font-bold mb-2">{sectionConfig.addTitle}</h1>
        <p className="text-primary-100">{sectionConfig.addSubtitle}</p>
      </div>

      <div className="card">
        <h2 className={sectionTitleClass}>{sectionConfig.title} details</h2>

        {formError && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <form className="profile-manual-form space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sectionConfig.fields.map((field) => (
              <div
                key={field.name}
                className={field.full ? "md:col-span-2" : undefined}
              >
                {renderField(field)}
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-gray-200 flex items-center justify-between gap-3">
            <button
              type="button"
              className={profileDangerButtonClass}
              onClick={() => navigate("/profile")}
            >
              Cancel
            </button>
            <button type="submit" className={profileActionButtonClass}>
              {sectionConfig.addTitle}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileEntryAddView;
