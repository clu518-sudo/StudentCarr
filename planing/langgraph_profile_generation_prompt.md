# Implementation Prompt: LangGraph Profile Generation Workflow

You are working in the `StudentCarr` repository. Implement a real LangGraph AI workflow that replaces the current dummy profile generation in the backend.

## Goal

Build a LangGraph workflow that reads uploaded user document text from the database, extracts structured profile information, merges it with the user's existing manual profile, and returns the generated profile draft to the existing frontend flow. Do not save the generated profile automatically. The frontend user must decide whether to save it using the existing save button.

The input documents may include resumes, transcripts, essays, work history descriptions, project descriptions, certifications, recommendation letters, and similar career-related text. These files are parsed during upload by the existing document parsing flow. This AI workflow should not parse raw files again; it should find and use the already parsed text stored in the database, specifically `ProfileDocument.parsedText`. The output must match the existing manual profile shape used by `Backend/src/profileManagement/pm.service.js` and validated by `Backend/src/profileManagement/pm.schemas.js`.

## Relevant Files

- `AIServices/src/generate_user_infomation.ts`
  - Build the LangGraph workflow here.
  - Keep the existing TypeScript/module style.
  - Fix the filename only if the rest of the repo can still import it cleanly; otherwise keep the current misspelling to avoid breaking paths.
- `Backend/src/profileManagement/pm.service.js`
  - Replace the dummy generator logic with the real AI workflow output.
  - The function currently named `generateManualProfileForUserDummy` should keep its exported name unless changing it is safe across all imports.
- `Backend/src/profileManagement/pm.schemas.js`
  - Use this file as the source of truth for the profile response shape.
- `Backend/prisma/schema.prisma`
  - User documents are stored in `ProfileDocument`.
  - Extracted document text is in `ProfileDocument.parsedText`.

## Current Dummy Logic To Replace

`Backend/src/profileManagement/pm.service.js` currently has:

- `createDummyGeneratedProfile(currentManualProfile, documents)`
- `generateManualProfileForUserDummy(userId, onProgress)`

The dummy function checks document types and returns hard-coded profile data. Replace that behavior with real extraction from uploaded document text.

Keep these existing behaviors:

- Load the current profile with `getProfileForUser(userId)`.
- Throw a `400` error with a useful message when no documents exist.
- Send progress updates through `onProgress` when provided.
- Return the generated manual profile draft to the frontend without calling `upsertManualProfileForUser`.
- Leave persistence to the existing frontend save flow, where the user reviews the draft and clicks the existing save button.

## Required Output Shape

Return a complete manual profile object:

```ts
{
  personalInfo: {
    name: string,
    headline: string,
    summary: string,
    phone: string,
    location: string,
    links: { label: string, url: string }[]
  },
  preferences: {
    preferredRoles: string[],
    preferredLocations: string[],
    workAuthorization: string,
    salaryRange: string,
    availability: string
  },
  education: {
    school: string,
    degree: string,
    fieldOfStudy: string,
    startDate: string,
    endDate: string,
    grade: string,
    description: string,
    isCurrent: boolean
  }[],
  workExperience: {
    company: string,
    title: string,
    location: string,
    startDate: string,
    endDate: string,
    isCurrent: boolean,
    description: string,
    achievements: string[]
  }[],
  projects: {
    name: string,
    role: string,
    description: string,
    technologies: string[],
    startDate: string,
    endDate: string,
    projectUrl: string,
    repositoryUrl: string
  }[],
  skills: {
    name: string,
    level: string,
    category: string,
    yearsOfExperience?: number,
    keywords: string[]
  }[],
  certifications: {
    name: string,
    issuer: string,
    issueDate: string,
    expiryDate: string,
    credentialId: string,
    credentialUrl: string
  }[]
}
```

Use empty strings for unknown scalar values, empty arrays for unknown lists, and omit or set `yearsOfExperience` only when there is evidence.

## LangGraph Workflow Requirements

Implement the workflow in `AIServices/src/generate_user_infomation.ts` using `@langchain/langgraph`, `@langchain/openai`, and `zod`.

Suggested graph nodes:

1. `prepareDocuments`
   - Accept current manual profile and documents.
   - Keep only documents with usable `parsedText`.
   - Preserve `documentType`, `originalName`, and `parsedText`.
   - If documents exist but none have parsed text, throw a clear `400` style error telling the user to wait for parsing or upload parseable documents.

2. `extractProfile`
   - Call `ChatOpenAI` with structured output.
   - Extract only facts supported by the uploaded text.
   - Do not invent schools, employers, dates, skills, links, grades, certifications, or achievements.
   - Normalize dates to `YYYY-MM` when month is known, `YYYY` when only year is known, or empty string when unknown.
   - Generate a concise professional `headline` and `summary` only from evidence in the documents.

3. `mergeWithCurrentProfile`
   - Merge extracted fields into the current manual profile.
   - Prefer extracted non-empty evidence for generated sections.
   - Preserve existing manual fields when the AI output is empty or uncertain.
   - De-duplicate repeated education, work, projects, skills, links, and certifications.

4. `validateProfile`
   - Validate or sanitize the final object with a Zod schema that mirrors `manualProfileSchema`.
   - Ensure required fields like `education.school`, `workExperience.company`, `workExperience.title`, `projects.name`, `skills.name`, and `certifications.name` are not empty.
   - Remove invalid empty list items before returning the draft.

Export a function similar to:

```ts
export async function generateUserInformationProfile({
  currentManualProfile,
  documents,
  onProgress,
}: {
  currentManualProfile: ManualProfile;
  documents: ProfileDocumentInput[];
  onProgress?: (message: string) => void | Promise<void>;
}): Promise<ManualProfile>;
```

Run LangGraph as a local service on a fixed port, and have the backend call that service to receive generated profile values.

- start LangGraph as a local API server (for example, `http://127.0.0.1:2024`),
- keep generation logic inside `AIServices`,
- from backend (`pm.service.js`), send an HTTP request to the LangGraph endpoint and use the response as the generated draft profile.

Do not rely on direct TypeScript runtime imports from backend for this flow.

## Backend Integration Requirements

Update `Backend/src/profileManagement/pm.service.js` so `generateManualProfileForUserDummy` uses the LangGraph workflow instead of `createDummyGeneratedProfile`.

Important: this generation endpoint must be preview-only. It must not call `upsertManualProfileForUser` and must not write generated profile content to the database. The existing frontend save button should remain responsible for saving the profile after the user reviews or edits the generated draft.

The backend must pass documents that include `parsedText`. `getProfileForUser` currently maps documents through `mapDocument`, which may not include `parsedText`. Add a private query for generation if needed, for example:

- Fetch `ProfileDocument` rows for `userId`.
- Select `id`, `documentType`, `originalName`, `parserStatus`, `parsedText`, and `uploadedAt`.
- Do not expose `parsedText` to normal frontend document list responses unless the existing UI explicitly needs it.

Expected backend flow:

```js
const generateManualProfileForUserDummy = async (userId, onProgress) => {
  const current = await getProfileForUser(userId);
  if (!current.documents.length) {
    const error = new Error(
      "Upload at least one document before generating profile content",
    );
    error.statusCode = 400;
    throw error;
  }

  if (onProgress) onProgress("Analyzing uploaded documents...");

  const sourceDocuments = await listDocumentsWithParsedTextForUser(userId);

  const generatedManualProfile = await generateUserInformationProfile({
    currentManualProfile: current.manualProfile,
    documents: sourceDocuments,
    onProgress,
  });

  if (onProgress) onProgress("Generated profile draft is ready for review.");
  return {
    ...current,
    manualProfile: generatedManualProfile,
  };
};
```

Remove `createDummyGeneratedProfile` once the real workflow is wired.

## Prompting Requirements For The AI Extractor

The model prompt must include:

- The exact target JSON schema or Zod structured output schema.
- A clear instruction to extract only evidence present in the provided documents.
- A clear instruction not to fabricate missing fields.
- A merge policy: existing manual profile data should be preserved when extracted data is empty.
- A document context format that labels each source with document type and filename.

Use structured output rather than parsing free-form JSON manually.

## Error Handling

Handle these cases:

- No uploaded documents: keep the existing `400` behavior.
- Uploaded documents exist but no `parsedText`: return a clear `400` error.
- OpenAI/API configuration is missing: return a clear server error and do not return dummy data.
- Model returns invalid or partial output: sanitize, validate, and return only valid fields in the draft.
- AI call fails: surface a useful error and do not overwrite or modify the current manual profile.

## Environment

Use environment variables from `AIServices/.env` or the backend `.env` as appropriate. Do not hard-code API keys.

Expected variables may include:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`, defaulting to a current cost-effective structured-output capable model if unset.

## Verification

After implementation:

1. Run type checks for `AIServices`:

```bash
cd AIServices
npm run typecheck
```

2. Run backend tests if available:

```bash
cd Backend
npm test
```

3. Manually verify the generation path with at least one document row that has `parsedText`.

4. Confirm the frontend receives the same profile shape as before, but populated from AI extraction instead of dummy data.

5. Confirm the database is not updated until the user clicks the existing frontend save button.

## Acceptance Criteria

- The LangGraph workflow exists inside `AIServices/src`.
- The backend dummy profile generator no longer returns hard-coded dummy profile data.
- Generated data is based on `ProfileDocument.parsedText`.
- The generated draft profile matches `manualProfileSchema`.
- Existing frontend API contracts remain compatible.
- No generated profile content is saved automatically by the generation endpoint.
- No fabricated data is returned when the source documents do not contain enough evidence.
- Existing manually entered profile values are preserved when AI extraction is empty or uncertain.
- The existing frontend save button remains the only step that persists the generated profile after user review.
