import os
import json
import hashlib
from typing import Optional
from dataclasses import dataclass, field


# ── Data models ──────────────────────────────────────────────────────────────

@dataclass
class Document:
    """Represents a single document chunk with metadata."""
    content: str
    source: str
    chunk_id: str = ""
    embedding: list = field(default_factory=list)

    def __post_init__(self):
        if not self.chunk_id:
            self.chunk_id = hashlib.md5(self.content.encode()).hexdigest()[:8]


@dataclass
class RetrievalResult:
    """Holds a retrieved document alongside its similarity score."""
    document: Document
    score: float

    def to_dict(self) -> dict:
        return {
            "content": self.document.content,
            "source": self.document.source,
            "score": round(self.score, 4),
        }


# ── Text processing ───────────────────────────────────────────────────────────

class TextChunker:
    """Splits raw text into overlapping chunks for embedding."""

    def __init__(self, chunk_size: int = 512, overlap: int = 64):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk(self, text: str, source: str) -> list[Document]:
        chunks = self._split_text(text)
        return [Document(content=c, source=source) for c in chunks]

    def _split_text(self, text: str) -> list[str]:
        words = text.split()
        results = []
        start = 0
        while start < len(words):
            end = start + self.chunk_size
            chunk = " ".join(words[start:end])
            results.append(chunk)
            start += self.chunk_size - self.overlap
        return results


class TextCleaner:
    """Normalizes and cleans raw text before chunking."""

    def clean(self, text: str) -> str:
        text = self._remove_extra_whitespace(text)
        text = self._normalize_unicode(text)
        return text.strip()

    def _remove_extra_whitespace(self, text: str) -> str:
        import re
        return re.sub(r"\s+", " ", text)

    def _normalize_unicode(self, text: str) -> str:
        return text.encode("ascii", errors="ignore").decode()


# ── Embedding ─────────────────────────────────────────────────────────────────

class EmbeddingModel:
    """Wraps an embedding provider (OpenAI, local, etc.)."""

    def __init__(self, model_name: str = "text-embedding-3-small"):
        self.model_name = model_name
        self._cache: dict[str, list[float]] = {}

    def embed(self, text: str) -> list[float]:
        if text in self._cache:
            return self._cache[text]
        vector = self._call_api(text)
        self._cache[text] = vector
        return vector

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self.embed(t) for t in texts]

    def _call_api(self, text: str) -> list[float]:
        # Stub — replace with real API call
        return [hash(text + str(i)) % 100 / 100.0 for i in range(128)]


# ── Vector store ──────────────────────────────────────────────────────────────

class VectorStore:
    """In-memory vector store with cosine similarity search."""

    def __init__(self):
        self._documents: list[Document] = []

    def add(self, documents: list[Document]) -> None:
        for doc in documents:
            self._documents.append(doc)

    def search(self, query_vector: list[float], top_k: int = 5) -> list[RetrievalResult]:
        scored = [
            RetrievalResult(doc, self._cosine(query_vector, doc.embedding))
            for doc in self._documents
            if doc.embedding
        ]
        scored.sort(key=lambda r: r.score, reverse=True)
        return scored[:top_k]

    def _cosine(self, a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x ** 2 for x in a) ** 0.5
        norm_b = sum(x ** 2 for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def size(self) -> int:
        return len(self._documents)


# ── Retriever ─────────────────────────────────────────────────────────────────

class Retriever:
    """Combines embedding model and vector store to retrieve relevant chunks."""

    def __init__(self, vector_store: VectorStore, embedding_model: EmbeddingModel):
        self.vector_store = vector_store
        self.embedding_model = embedding_model

    def retrieve(self, query: str, top_k: int = 5) -> list[RetrievalResult]:
        query_vector = self.embedding_model.embed(query)
        return self.vector_store.search(query_vector, top_k=top_k)

    def format_context(self, results: list[RetrievalResult]) -> str:
        return "\n\n---\n\n".join(
            f"[{r.document.source}]\n{r.document.content}" for r in results
        )


# ── LLM ───────────────────────────────────────────────────────────────────────

class LLMClient:
    """Wraps a language model for answer generation."""

    def __init__(self, model: str = "gpt-4o-mini", temperature: float = 0.2):
        self.model = model
        self.temperature = temperature

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        # Stub — replace with real API call (OpenAI, Anthropic, etc.)
        return f"[LLM response to: {user_prompt[:60]}...]"

    def build_rag_prompt(self, question: str, context: str) -> tuple[str, str]:
        system = (
            "You are a helpful assistant. Answer the user's question using only "
            "the context provided below. If the context doesn't contain enough "
            "information, say so clearly.\n\nContext:\n" + context
        )
        user = question
        return system, user


# ── Ingestion pipeline ────────────────────────────────────────────────────────

class IngestionPipeline:
    """Orchestrates document ingestion: clean → chunk → embed → store."""

    def __init__(
        self,
        cleaner: TextCleaner,
        chunker: TextChunker,
        embedding_model: EmbeddingModel,
        vector_store: VectorStore,
    ):
        self.cleaner = cleaner
        self.chunker = chunker
        self.embedding_model = embedding_model
        self.vector_store = vector_store

    def ingest(self, raw_text: str, source: str) -> int:
        clean_text = self.cleaner.clean(raw_text)
        chunks = self.chunker.chunk(clean_text, source)
        chunks = self._embed_chunks(chunks)
        self.vector_store.add(chunks)
        return len(chunks)

    def ingest_file(self, filepath: str) -> int:
        raw = self._read_file(filepath)
        return self.ingest(raw, source=os.path.basename(filepath))

    def _embed_chunks(self, chunks: list[Document]) -> list[Document]:
        texts = [c.content for c in chunks]
        vectors = self.embedding_model.embed_batch(texts)
        for chunk, vector in zip(chunks, vectors):
            chunk.embedding = vector
        return chunks

    def _read_file(self, filepath: str) -> str:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()


# ── RAG pipeline ──────────────────────────────────────────────────────────────

class RAGPipeline:
    """End-to-end RAG: retrieve relevant chunks then generate an answer."""

    def __init__(self, retriever: Retriever, llm: LLMClient, top_k: int = 5):
        self.retriever = retriever
        self.llm = llm
        self.top_k = top_k

    def query(self, question: str) -> dict:
        results = self.retriever.retrieve(question, top_k=self.top_k)
        context = self.retriever.format_context(results)
        system_prompt, user_prompt = self.llm.build_rag_prompt(question, context)
        answer = self.llm.complete(system_prompt, user_prompt)
        return self._build_response(question, answer, results)

    def _build_response(
        self, question: str, answer: str, results: list[RetrievalResult]
    ) -> dict:
        return {
            "question": question,
            "answer": answer,
            "sources": [r.to_dict() for r in results],
        }


# ── Factory ───────────────────────────────────────────────────────────────────

def build_pipeline(
    chunk_size: int = 512,
    overlap: int = 64,
    model_name: str = "text-embedding-3-small",
    llm_model: str = "gpt-4o-mini",
) -> tuple[IngestionPipeline, RAGPipeline]:
    """Wires all components together and returns ready-to-use pipelines."""
    cleaner = TextCleaner()
    chunker = TextChunker(chunk_size=chunk_size, overlap=overlap)
    embedding_model = EmbeddingModel(model_name=model_name)
    vector_store = VectorStore()
    retriever = Retriever(vector_store, embedding_model)
    llm = LLMClient(model=llm_model)

    ingestion = IngestionPipeline(cleaner, chunker, embedding_model, vector_store)
    rag = RAGPipeline(retriever, llm)

    return ingestion, rag


def save_results(results: dict, output_path: str = "rag_output.json") -> None:
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    ingestion_pipeline, rag_pipeline = build_pipeline()

    sample_text = """
    Retrieval-Augmented Generation (RAG) combines information retrieval with
    language model generation. Instead of relying solely on parametric knowledge
    baked into model weights, RAG fetches relevant documents at query time and
    conditions the model's response on that retrieved context. This makes answers
    more accurate, up-to-date, and grounded in verifiable sources.
    """

    n = ingestion_pipeline.ingest(sample_text, source="intro.txt")
    print(f"Ingested {n} chunks. Store size: {ingestion_pipeline.vector_store.size()}")

    response = rag_pipeline.query("What is RAG and why is it useful?")
    print(json.dumps(response, indent=2))

    save_results(response)