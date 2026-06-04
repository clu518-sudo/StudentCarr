import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";

// --- env wiring ---
const OPENAI_API_KEY = 
    process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const CHROMA_URL = process.env.CHROMA_URL || "http://127.0.0.1:8000";

const COLLECTION_NAME = "job_psotitions";
const EMBEDDING_MODEL = "text-embedding-3-small";

// --- singleton OpenAIEmbeddings ---
let embeddingsSingleton: OpenAIEmbeddings | null = null;

const getEmbeddings = (): OpenAIEmbeddings => {
    if (!OPENAI_API_KEY) {
        throw new Error(
            "OPENAI_API_KEY (or DASHSCOPE_API_KEY) is required for job-discovery embeddings",
        );
    }
    if (!embeddingsSingleton) {
        embeddingsSingleton = new OpenAIEmbeddings({
            apiKey: OPENAI_API_KEY,
            model: EMBEDDING_MODEL,
            configuration: OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : undefined,
        });
    }
    return embeddingsSingleton;
};

// --- singleton Chroma vectorstore ---
let vectorStoreSingleton: Chroma | null = null;

const buildVectorStore = (): Chroma => {
    return new Chroma(getEmbeddings(), {
        collectionName: COLLECTION_NAME,
        url: CHROMA_URL,
    });
};

// --- public accessor ---
export const getJobsVectorStore = (): Chroma => {
    if (!vectorStoreSingleton) {
        vectorStoreSingleton = buildVectorStore();
    }
    return vectorStoreSingleton;
};