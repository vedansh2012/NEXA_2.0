
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve the NEXA frontend files
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/status", (req, res) => {
    res.json({
        online: true,
        name: "NEXA",
        version: "2.0"
    });
});

app.post("/api/chat", async (req, res) => {
    try {
        const { message } = req.body;

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                error: "Message cannot be empty."
            });
        }

        // Temporary reply until real AI is connected
        res.json({
            reply: `NEXA received: ${message}`
        });
    } catch (error) {
        console.error("NEXA Error:", error);

        res.status(500).json({
            error: "NEXA encountered an internal error."
        });
    }
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`NEXA 2.0 running at http://localhost:${PORT}`);
});
