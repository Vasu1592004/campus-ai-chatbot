import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import multer from "multer";
import fetch from "node-fetch";

dotenv.config();

const app = express();

app.use(cors({
    origin: ["https://vasugoli.netlify.app", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
}));

app.use(express.json({ limit: "25mb" }));

const upload = multer({ dest: "uploads/" });

// Helper: Wait
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Safe NVIDIA API call with retry
async function callAI(messages, retryCount = 3) {
    try {
        const response = await fetch(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`
                },
                body: JSON.stringify({
                    model: "meta/llama3-70b-instruct",
                    messages,
                    max_tokens: 1000,
                    temperature: 0.7
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
        console.log("NVIDIA RAW ERROR:", data);
        throw new Error(JSON.stringify(data));
        }
        return data;

    } catch (err) {
        if (retryCount > 0) {
            console.log("⏳ Retrying NVIDIA API...");
            await delay(3000);
            return await callAI(messages, retryCount - 1);
        }
        throw err;
    }
}

app.get("/", (req, res) => res.send("CampusAI Backend is live (NVIDIA Mode)"));

app.post("/api/chat", upload.array("files"), async (req, res) => {
    try {
        console.log("📸 Files:", req.files?.length || 0);
        console.log("💬 Message:", req.body.message);

        const textMessage = req.body.message || "";
        const historyRaw = req.body.history || "[]";
        const userFiles = req.files || [];

        let history = [];
        try {
            history = JSON.parse(historyRaw);
        } catch {
            history = [];
        }

        // SYSTEM PROMPT
        let messages = [
            {
                role: "system",
                content: `
You are CampusAI, an intelligent assistant developed by VASU.

IDENTITY RULES:
- You are not ChatGPT.
- You are not OpenAI.
- If asked who developed you, always reply:
"I was developed by VASU — the creator of CampusAI."

RESPONSE STYLE:
- Structured responses
- Headings for long answers
- Bullet points when needed
- Clear explanations
`
            }
        ];

        // Add history
        for (const msg of history) {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        }

        // Add user text
        if (textMessage) {
            messages.push({ role: "user", content: textMessage });
        }

        // Add images (if any)
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

        // 🔥 NVIDIA CALL
        const result = await callAI(messages);

        const aiReply =
            result.choices?.[0]?.message?.content ||
            "⚠️ No response from NVIDIA model";

        return res.json({ reply: aiReply });

    } catch (err) {
        console.error("🔥 ERROR:", err);
        return res.json({ reply: `⚠️ Error: ${err.message}` });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));