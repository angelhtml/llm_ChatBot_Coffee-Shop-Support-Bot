import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OllamaEmbeddings } from "@langchain/ollama";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { MongoClient } from "mongodb";

async function ingestDocument(filePath) {
  // 1. Load the PDF
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();
  console.log(`✅ Loaded ${docs.length} document(s).`);

  // 2. Split into chunks
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const splitDocs = await textSplitter.splitDocuments(docs);
  console.log(`✅ Split into ${splitDocs.length} chunks.`);

  // 3. Create embeddings using Ollama
  const embeddings = new OllamaEmbeddings({
    model: "nomic-embed-text",
    baseUrl: "http://localhost:11434",
  });

  // 4. Connect to MongoDB (Docker)
  const client = new MongoClient(
    "mongodb://admin:password@localhost:27018/?directConnection=true&authSource=admin"
  );
  await client.connect();
  const collection = client.db("rag_db").collection("documents");

  // 5. Store vectors in MongoDB
  await MongoDBAtlasVectorSearch.fromDocuments(splitDocs, embeddings, {
    collection,
    indexName: "vector_index",
  });

  console.log("✅ Document ingested and vectors stored in MongoDB.");
  await client.close();
}

// Replace with your actual PDF filename
ingestDocument("./coffee-shop-faq.pdf");