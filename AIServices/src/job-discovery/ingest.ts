import { Document } from "@langchain/core/documents";
import { getJobsVectorStore } from "./chroma.js";
import { jobPositionSchema, type JobPosition } from "./schema.js";

// --- buildPageContent ---
export const buildPageContent = (position: JobPosition): string => {
    const join = (arr: string[]) => arr.filter(Boolean).join(",") ;
    const sentences = (arr: string[]) => arr.filter(Boolean).join(";");

    const lines = [
        `Role: ${position.roleName} | Category: ${position.category}`,
        `Core skills: ${join(position.coreSkills)}`,
        `Common tools: ${join(position.commonTools)}`,
        `Day-to-day: ${sentences(position.typicalResponsibilities)}`,
        `Education: ${position.typicalEducation}`,
        `Overview: ${position.overview}`,
    ]

    return lines.join("\n");
};

// --- result strcture ---
export interface IngestResult {
    inserted: number;
    skipped: number;
    errors: Array<{ id?: string; index: number; message: string }>;
}

// --- ingestJobPositions ---
export const ingestJobPositions = async (
    positions: unknown[],
): Promise<IngestResult> => {
    const result: IngestResult = { inserted: 0, skipped: 0, errors: [] };

    const docs: Document[] = [];
    const ids: string[] = [];

    // 1) Validate each position individually so one bad record doesn't sink the whole batch — collect errors, skip the offender, keep going.
    positions.forEach( (raw, index) => {
        const parsed = jobPositionSchema.safeParse(raw);
        if (!parsed.success) {
            result.skipped += 1;
            result.errors.push({
                id: (raw as {id?: string})?.id,
                index,
                message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
            });
            return;
        }

        const position = parsed.data;

        // Chroma metadata only accepts primitive values (string/number/boolean) —
        // it rejects arrays and nested objects. So we stash the full structured
        // role as a JSON string and keep a couple of scalar fields alongside for
        // optional filtering / debugging.

        // parse `doc.metadata.positionJson` back into a JobPosition to recover the full object we embed here.
        docs.push(
            new Document({
                pageContent: buildPageContent(position),
                metadata: {
                    positionId: position.id,
                    roleName: position.roleName,
                    category: position.category,
                    positionJson: JSON.stringify(position),
                },
            }),
        );

        ids.push(position.id)
    });

    // 2) Upsert keyed by position.id. addDocuments(docs, { ids }) calls
    //    collection.upsert under the hood, so re-seeding the same id overwrites
    //    rather than duplicating — idempotent by design.
    if (docs.length > 0) {
        try {
            const store = getJobsVectorStore();
            await store.addDocuments(docs, { ids });
            result.inserted = docs.length;
        } catch (err) {
            // Embedding/Chroma failure affects the whole batch — none landed.
            result.inserted = 0;
            result.skipped += docs.length;
            result.errors.push({
                index: -1,
                message: `Chroma upsert failed: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
    }

    return result;
};
