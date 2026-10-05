Pull a small LLM: Open a new terminal and run one of these commands
bash
ollama pull qwen2.5:0.5b
ollama pull nomic-embed-text

bash
ollama pull llama3.2:1b

bash
docker-compose up -d
Wait about 30 seconds, then verify it is running:

bash
docker ps
You should see a container running the mongodb/mongodb-atlas-local:preview image. The built-in healthcheck automatically verifies that both mongod and mongot are healthy.

Step 3: Connect MongoDB Compass and Create the Vector Index
Open MongoDB Compass and connect using this connection string:

text
mongodb://admin:password@localhost:27018/?directConnection=true&authSource=admin
The directConnection=true parameter is required for the local single-node replica set.

Once connected:

Click Create Database

Database name: rag_db

Collection name: documents

Select the documents collection

Click the Indexes tab

Click Create → Search Index

Set the index name to: vector_index

Select Vector Search as the type

Switch to JSON Editor mode and paste this:

{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    }
  ]
}

bash
npm i
node ingest.js
node index.js


POST /ask HTTP/1.1
Host: localhost:3001
Content-Type: application/json
Content-Length: 66

{
    "question": "Do you deliver, and how much does it cost?"
}
