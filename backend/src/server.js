import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import multer from "multer";

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "25mb" }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const upload = multer({ dest: "uploads/" });

// Helper: Wait
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Safe API call with retry
async function callAI(messages, retryCount = 3) {
    try {
        return await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages
        });

    } catch (err) {
        if (err.status === 429 && retryCount > 0) {
            console.log("⏳ Rate limit hit. Retrying in 3 seconds...");
            await delay(3000);
            return await callAI(messages, retryCount - 1);
        }
        throw err;
    }
}

app.post("/api/chat", upload.array("files"), async (req, res) => {
    try {
        console.log("📸 Files:", req.files?.length || 0);
        console.log("💬 Message:", req.body.message);

        const textMessage = req.body.message || "";
        const historyRaw = req.body.history || "[]";
        const userFiles = req.files || [];

        // Restore history sent from frontend
        let history = [];
        try {
            history = JSON.parse(historyRaw);
        } catch {
            history = [];
        }

        // BUILD FULL MESSAGE LIST FOR OPENAI
        let messages = [
            {
                role: "system",
                content: `
        You are **CampusAI**, an intelligent assistant exclusively developed by **VASU**.

        IDENTITY RULES (VERY IMPORTANT):
        - You are not ChatGPT, not OpenAI, not an OpenAI assistant.
        - Never say you were made or developed by OpenAI.
        - If ANY question is asked like:
            • who developed you  
            • who made you  
            • who created you  
            • who designed you  
            • who built this bot  
            • what company are you from  
            • who is behind you  
        ALWAYS answer: "I was developed by VASU — the creator of CampusAI."

        - If asked about your model, reply:
        "I run on an AI model integrated and customized by VASU for CampusAI."

        RESPONSE STYLE RULES:
        - Respond in ChatGPT-style formatting.
        - Always use structured answers:
            • clear paragraphs  
            • bullet points when helpful  
            • step-by-step explanations  
            • headings for long answers  
        - Never give short or one-line replies.
        - Always answer professionally, clearly, and in detail.
        `
            }
        ];


        // ADD FULL CHAT HISTORY (text only)
        for (const msg of history) {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        }

        // ADD CURRENT USER TEXT
        if (textMessage) {
            messages.push({ role: "user", content: textMessage });
        }

        // ADD IMAGES (Vision input)
        for (const file of userFiles) {
            const fileBuffer = fs.readFileSync(file.path);
            const base64Image = `data:${file.mimetype};base64,${fileBuffer.toString("base64")}`;

            messages.push({
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: { url: base64Image }
                    }
                ]
            });
        }

        // 🔥 AI CALL (Chat Format)
        const result = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages
        });

        const aiReply = result.choices[0].message.content;

        return res.json({ reply: aiReply });

    } catch (err) {
        console.error("🔥 ERROR:", err);
        return res.json({ reply: `⚠️ Error: ${err.message}` });
    }
});


app.listen(5000, () => console.log("🚀 Backend running at http://localhost:5000"));
