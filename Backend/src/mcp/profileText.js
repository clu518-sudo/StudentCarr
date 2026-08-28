// Renders the Manual Entry profile as plain text for an LLM. JSON scaffolding
// costs tokens without helping a model read prose-shaped data, so fields become
// labelled lines and anything empty is dropped. Sections the user has not filled
// in are named at the end, so the model can tell "the user has none" apart from
// "the tool did not return any".

const clean = (value) => {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
};

const cleanList = (values) =>
    (Array.isArray(values) ? values : []).map(clean).filter(Boolean);

const labelled = (label, value) => {
    const text = clean(value);
    return text ? `${label}: ${text}` : "";
};

const joinParts = (parts, separator = " · ") =>
    parts.filter(Boolean).join(separator);

const lines = (...values) => values.filter(Boolean).join("\n");

const dateRange = (startDate, endDate, isCurrent) => {
    const start = clean(startDate);
    const end = isCurrent ? "present" : clean(endDate);
    if (start && end) return `${start} to ${end}`;
    if (start) return `from ${start}`;
    if (end) return `until ${end}`;
    return "";
};

// Entry details sit three spaces in so a multi-line description can never be
// mistaken for the start of the next record.
const indented = (value) => {
    const text = clean(value);
    if (!text) return "";
    return text
        .split("\n")
        .map((line) => (line.trim() ? `   ${line.trim()}` : ""))
        .join("\n");
};

const formatLinks = (links) =>
    (Array.isArray(links) ? links : [])
        .map((link) => joinParts([clean(link?.label), clean(link?.url)], " "))
        .filter(Boolean)
        .join(" | ");

const educationEntry = (item) =>
    lines(
        joinParts([clean(item?.school), clean(item?.degree)], " — "),
        indented(
            joinParts([
                clean(item?.fieldOfStudy),
                dateRange(item?.startDate, item?.endDate, item?.isCurrent),
                item?.grade ? `Grade ${clean(item.grade)}` : "",
            ]),
        ),
        indented(item?.description),
    );

const workEntry = (item) =>
    lines(
        joinParts([
            joinParts([clean(item?.company), clean(item?.title)], " — "),
            clean(item?.location),
        ]),
        indented(dateRange(item?.startDate, item?.endDate, item?.isCurrent)),
        indented(item?.description),
        cleanList(item?.achievements)
            .map((achievement) => `   - ${achievement}`)
            .join("\n"),
    );

const projectEntry = (item) =>
    lines(
        joinParts([clean(item?.name), clean(item?.role)], " — "),
        indented(
            joinParts([
                dateRange(item?.startDate, item?.endDate, false),
                cleanList(item?.technologies).join(", "),
            ]),
        ),
        indented(
            joinParts(
                [clean(item?.projectUrl), clean(item?.repositoryUrl)],
                " | ",
            ),
        ),
        indented(item?.description),
    );

const certificationEntry = (item) =>
    lines(
        joinParts([clean(item?.name), clean(item?.issuer)], " — "),
        indented(
            joinParts(
                [
                    item?.issueDate ? `issued ${clean(item.issueDate)}` : "",
                    item?.expiryDate ? `expires ${clean(item.expiryDate)}` : "",
                ],
                ", ",
            ),
        ),
        indented(
            joinParts([
                item?.credentialId ? `Credential ${clean(item.credentialId)}` : "",
                clean(item?.credentialUrl),
            ]),
        ),
    );

const skillEntry = (item) => {
    const name = clean(item?.name);
    if (!name) return "";

    const years = clean(item?.yearsOfExperience);
    const detail = joinParts([clean(item?.level), years ? `${years}y` : ""], ", ");
    const inside = joinParts([detail, cleanList(item?.keywords).join(", ")], "; ");
    return inside ? `${name} (${inside})` : name;
};

// Grouped by category rather than one line each: a long skill list is the
// biggest single source of noise in a profile.
const skillGroupLines = (skills) => {
    const groups = new Map();

    (Array.isArray(skills) ? skills : []).forEach((item) => {
        const entry = skillEntry(item);
        if (!entry) return;
        const category = clean(item?.category) || "Other";
        groups.set(category, [...(groups.get(category) || []), entry]);
    });

    return [...groups.entries()].map(
        ([category, entries]) => `${category}: ${entries.join(", ")}`,
    );
};

const section = (heading, entries) =>
    [heading, entries.map((entry, index) => `${index + 1}. ${entry}`).join("\n\n")]
        .filter(Boolean)
        .join("\n");

const renderManualProfileText = (profile = {}) => {
    const personalInfo = profile?.personalInfo || {};
    const preferences = profile?.preferences || {};

    const headerDetails = [
        labelled("Headline", personalInfo.headline),
        labelled("Location", personalInfo.location),
        labelled("Phone", personalInfo.phone),
        labelled("Links", formatLinks(personalInfo.links)),
    ].filter(Boolean);

    const summary = clean(personalInfo.summary);
    const preferenceLines = [
        labelled("Target roles", cleanList(preferences.preferredRoles).join(", ")),
        labelled(
            "Target locations",
            cleanList(preferences.preferredLocations).join(", "),
        ),
        labelled("Work authorization", preferences.workAuthorization),
        labelled("Salary range", preferences.salaryRange),
        labelled("Availability", preferences.availability),
    ].filter(Boolean);

    const entrySections = [
        ["EDUCATION", "Education", profile?.education, educationEntry],
        ["WORK EXPERIENCE", "Work Experience", profile?.workExperience, workEntry],
        ["PROJECTS", "Projects", profile?.projects, projectEntry],
    ];
    const skillLines = skillGroupLines(profile?.skills);
    const certifications = (Array.isArray(profile?.certifications)
        ? profile.certifications
        : [])
        .map(certificationEntry)
        .filter(Boolean);

    const renderedSections = entrySections.map(
        ([heading, label, items, renderEntry]) => ({
            heading,
            label,
            entries: (Array.isArray(items) ? items : [])
                .map(renderEntry)
                .filter(Boolean),
        }),
    );

    const isEmpty =
        !headerDetails.length &&
        !summary &&
        !preferenceLines.length &&
        !skillLines.length &&
        !certifications.length &&
        renderedSections.every((entry) => !entry.entries.length);

    if (isEmpty) {
        return "PROFILE — this user has not filled in any Manual Entry information yet.";
    }

    const notFilled = [];
    const blocks = [
        lines(
            `PROFILE — ${clean(personalInfo.name) || "name not set"}`,
            ...headerDetails,
        ),
    ];

    if (summary) {
        blocks.push(`Summary:\n${summary}`);
    }

    if (preferenceLines.length) {
        blocks.push(lines("PREFERENCES", ...preferenceLines));
    } else {
        notFilled.push("Preferences");
    }

    renderedSections.forEach(({ heading, label, entries }) => {
        if (entries.length) {
            blocks.push(section(heading, entries));
        } else {
            notFilled.push(label);
        }
    });

    if (skillLines.length) {
        blocks.push(lines("SKILLS", ...skillLines));
    } else {
        notFilled.push("Skills");
    }

    if (certifications.length) {
        blocks.push(section("CERTIFICATIONS", certifications));
    } else {
        notFilled.push("Certifications");
    }

    blocks.push(
        `Not filled in yet: ${notFilled.length ? notFilled.join(", ") : "(none)"}`,
    );

    return blocks.join("\n\n");
};

export { renderManualProfileText };
