/*
import { OllamaEmbeddings, Ollama } from "@langchain/ollama";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { MongoClient } from "mongodb";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

export async function askQuestion(question) {
  // 1. Connect to MongoDB
  const client = new MongoClient(
    "mongodb://admin:password@localhost:27018/?directConnection=true&authSource=admin"
  );
  await client.connect();
  const collection = client.db("rag_db").collection("documents");

  const embeddings = new OllamaEmbeddings({
    model: "nomic-embed-text",
    baseUrl: "http://localhost:11434",
  });

  // 2. Connect to the vector store
  const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
    collection,
    indexName: "vector_index",
  });

  // 3. Retrieve relevant chunks
  const retriever = vectorStore.asRetriever({ k: 7 });
  const relevantDocs = await retriever.invoke(question);
  const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");
  console.log(`✅ Retrieved ${relevantDocs.length} relevant chunk(s).`);

  // 👇 DEBUG BLOCK
console.log("--- Retrieved Chunks ---");
console.log(`Total retrieved: ${relevantDocs.length}`);
relevantDocs.forEach((doc, i) => {
  console.log(`\n[Chunk ${i + 1}]:`);
  console.log(doc.pageContent);
});
// 👆 END DEBUG BLOCK

  // 4. Generate an answer with your local LLM
  const llm = new Ollama({
    model: "qwen2.5:0.5b",
    baseUrl: "http://localhost:11434",
  });

  const prompt = ChatPromptTemplate.fromMessages([
    //[
    //  "system",
    //  "Answer the question based only on the following context. If you don't know the answer, say you don't know.\n\nContext:\n{context}",
    //],
    [
        "system",
        `You are a helpful assistant. Answer the user's question based only on the provided context. If the answer is not in the context, respond with: "I don't have that information."
        Context:
        {context}`,
    ],
    ["human", "{question}"],
  ]);

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const answer = await chain.invoke({ context, question });

  console.log("\n--- Answer ---\n", answer);
  
  await client.close();

  return answer
}

//askQuestion("What is this document about?");
//askQuestion("Who founded Acme Corporation and in what year?");
//askQuestion("How many vacation days do employees get after 5 years?");
//askQuestion("What is the hotel expense cap for business travel?");
//askQuestion("What is the remote work stipend amount?");
//askQuestion("What is the company's policy on pets in the office?");
//askQuestion("Do you deliver, and how much does it cost?");


*/










import { OllamaEmbeddings, Ollama } from "@langchain/ollama";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { MongoClient } from "mongodb";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────
const MONGO_URI =
  "mongodb://admin:password@localhost:27018/?directConnection=true&authSource=admin";
const DB_NAME = "rag_db";
const COLLECTION_NAME = "documents";
const INDEX_NAME = "vector_index";
const EMBEDDING_MODEL = "nomic-embed-text";
const LLM_MODEL = "qwen2.5:0.5b"; // switch to "llama3.2:3b" when ready
const OLLAMA_URL = "http://localhost:11434";
const TOP_K = 7;

// ─────────────────────────────────────────────
// SMALL TALK DETECTION
// ─────────────────────────────────────────────
function detectSmallTalk(input) {
  const text = input.toLowerCase().trim();

  // Greetings
  const greetings = [
    "hi",
    "hello",
    "hey",
    "yo",
    "hiya",
    "howdy",
    "good morning",
    "good afternoon",
    "good evening",
  ];
  if (
    greetings.some((g) => text === g || text.startsWith(g + " ")) ||
    /^(hi|hey|hello)[!.,\s]*$/i.test(text)
  ) {
    return "Hello! I'm the Brew Haven Coffee assistant. Ask me anything about our menu, delivery, loyalty program, hours, allergens, or catering.";
  }

  // Thanks
  const thanks = ["thanks", "thank you", "thx", "appreciate it", "ty"];
  if (thanks.some((t) => text.includes(t))) {
    return "You're welcome! Let me know if you have any other questions.";
  }

  // Goodbyes
  const goodbyes = ["bye", "goodbye", "see you", "later", "cya"];
  if (
    goodbyes.some((b) => text === b || text.startsWith(b + " ")) ||
    /^(bye|goodbye)[!.,\s]*$/i.test(text)
  ) {
    return "Goodbye! Have a great day.";
  }

  // Identity
  if (
    text.includes("who are you") ||
    text.includes("what are you") ||
    text.includes("what can you do") ||
    text.includes("help me")
  ) {
    return "I'm the Brew Haven Coffee assistant. I can answer questions about our menu, delivery, loyalty program, hours, allergens, and catering. What would you like to know?";
  }

  // Empty or very short input
  if (text.length === 0) {
    return "I didn't catch that. Could you ask a question about Brew Haven Coffee?";
  }

  return null; // Not small talk — proceed with RAG
}

// ─────────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────────
export async function askQuestion(question) {
  // STEP 0: Handle greetings and small talk without hitting the LLM
  const smallTalkResponse = detectSmallTalk(question);
  if (smallTalkResponse) {
    console.log("\n--- Answer ---\n", smallTalkResponse);
    return smallTalkResponse;
  }

  // STEP 1: Connect to MongoDB
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

  try {
    // STEP 2: Verify index is ready
    const indexes = await collection.listSearchIndexes().toArray();
    const vectorIndex = indexes.find((idx) => idx.name === INDEX_NAME);

    if (!vectorIndex) {
      console.log(`❌ Index "${INDEX_NAME}" not found. Create it in Compass.`);
      return;
    }
    if (vectorIndex.status !== "READY") {
      console.log(
        `⏳ Index status: ${vectorIndex.status}. Wait a moment and try again.`
      );
      return;
    }

    // STEP 3: Set up embeddings and vector store
    const embeddings = new OllamaEmbeddings({
      model: EMBEDDING_MODEL,
      baseUrl: OLLAMA_URL,
    });

    const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
      collection,
      indexName: INDEX_NAME,
    });

    // STEP 4: Retrieve relevant chunks
    const retriever = vectorStore.asRetriever({ k: TOP_K });
    const relevantDocs = await retriever.invoke(question);

    console.log(`✅ Retrieved ${relevantDocs.length} relevant chunk(s).`);

    // Debug: show chunks
    relevantDocs.forEach((doc, i) => {
      console.log(`\n[Chunk ${i + 1}]:`);
      console.log(doc.pageContent.substring(0, 200) + "...");
    });

    if (relevantDocs.length === 0) {
      const noContextAnswer =
        "I don't have that information in my knowledge base. Could you rephrase, or ask about our menu, delivery, hours, allergens, or catering?";
      console.log("\n--- Answer ---\n", noContextAnswer);
      return noContextAnswer;
    }

    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");

    // STEP 5: Generate answer with the LLM
    const llm = new Ollama({
      model: LLM_MODEL,
      baseUrl: OLLAMA_URL,
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful customer service assistant for Brew Haven Coffee.
Answer the user's question based ONLY on the provided context.
If the answer is not in the context, respond exactly with: "I don't have that information in my knowledge base."
Do not make up facts. Do not use outside knowledge.

Context:
{context}`,
      ],
      ["human", "{question}"],
    ]);

    const chain = prompt.pipe(llm).pipe(new StringOutputParser());
    const answer = await chain.invoke({ context, question });

    console.log("\n--- Answer ---\n", answer);
    return answer;
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.close();
  }
}

// ─────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────
// Test with different inputs:
// askQuestion("Hi");
// askQuestion("Thanks!");
// askQuestion("Who are you?");

