// API Configuration
const HUGGINGFACE_SPACE_URL = "https://jraw-gst-agentic-ai.hf.space/";
const N8N_WEBHOOK_URL = "https://edf8bf81e1b7.ngrok-free.app/webhook/gst-query";

// Fallback responses for when APIs are unavailable
const FALLBACK_RESPONSES = {
    "gst rate": "GST rates in India are: 0%, 5%, 12%, 18%, and 28%. The rate depends on the type of goods or services.",
    "registration": "GST registration is mandatory for businesses with aggregate turnover exceeding ₹40 lakhs (₹20 lakhs for northeastern states).",
    "return": "Main GST returns include GSTR-1, GSTR-3B, GSTR-2A, and GSTR-9. Filing deadlines vary by turnover.",
    "notice": "GST notices require specific response formats. Would you like help drafting a response?",
    "default": "I can help with GST queries related to registration, rates, returns, and compliance."
};

// Query GST AI via Hugging Face Space
async function queryGSTAI(question) {
    try {
        // Try Hugging Face Space first
        const response = await fetch(`${HUGGINGFACE_SPACE_URL}/api/predict`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: [question]
            })
        });

        if (response.ok) {
            const data = await response.json();
            return {
                success: true,
                answer: data.data[0],
                references: data.data[1] ? data.data[1].split('\n') : [],
                links: data.data[2] ? data.data[2].split('\n') : [],
                source: "Hugging Face Space"
            };
        }
    } catch (error) {
        console.warn('Hugging Face API failed:', error);
    }

    // Try n8n webhook as backup
    try {
        const response = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: question
            })
        });

        if (response.ok) {
            const data = await response.json();
            return {
                success: true,
                answer: data.answer,
                references: ["Local AI Processing"],
                links: [],
                source: "Local n8n + Ollama"
            };
        }
    } catch (error) {
        console.warn('n8n webhook failed:', error);
    }

    // Fallback to hardcoded responses
    const lowerQuestion = question.toLowerCase();
    for (const [key, response] of Object.entries(FALLBACK_RESPONSES)) {
        if (lowerQuestion.includes(key) && key !== 'default') {
            return {
                success: true,
                answer: response,
                references: ["Offline Knowledge Base"],
                links: ["https://www.gst.gov.in/"],
                source: "Fallback Response"
            };
        }
    }

    return {
        success: true,
        answer: FALLBACK_RESPONSES.default,
        references: ["General GST Information"],
        links: ["https://www.gst.gov.in/"],
        source: "Fallback Response"
    };
}

// Generate notice response
async function generateNoticeResponse(fileContent, additionalContext = "") {
    try {
        const response = await fetch(`${HUGGINGFACE_SPACE_URL}/api/predict`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                data: [fileContent, additionalContext],
                fn_index: 1 // Assuming second function for notice response
            })
        });

        if (response.ok) {
            const data = await response.json();
            return {
                success: true,
                draft: data.data[0],
                source: "AI Generated"
            };
        }
    } catch (error) {
        console.warn('Notice response API failed:', error);
    }

    // Fallback template
    return {
        success: true,
        draft: `To,
The Assistant Commissioner of GST,
[Address as mentioned in the notice]

Subject: Response to Show Cause Notice/Demand Notice

Sir/Madam,

With reference to the above notice, I/we submit the following response:

1. PRELIMINARY OBJECTIONS:
   - The notice may be time-barred under applicable provisions
   - Proper opportunity of hearing should be provided

2. FACTUAL SUBMISSIONS:
   [Based on your specific case details]

3. LEGAL SUBMISSIONS:
   - Reference: Relevant CGST Act sections
   - Supporting case laws and precedents

4. PRAYER:
   In light of the above, it is prayed that the notice may be dropped.

Respectfully submitted,
[Your Name]
Date: ${new Date().toLocaleDateString('en-GB')}

---
DISCLAIMER: This is a template. Please customize with your specific details and consult legal counsel.`,
        source: "Template"
    };
}

// File processing utility
async function processFile(file) {
    return new Promise((resolve, reject) => {
        if (file.type === 'application/pdf') {
            // Note: For production, you'd need a proper PDF parser
            resolve("PDF content extraction would require additional libraries");
        } else if (file.type.includes('word')) {
            // Note: For production, you'd need mammoth.js or similar
            resolve("Word document content extraction would require additional libraries");
        } else if (file.type === 'text/plain') {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        } else {
            reject(new Error('Unsupported file type'));
        }
    });
}

// Export functions for use in HTML
window.GSTApi = {
    queryGSTAI,
    generateNoticeResponse,
    processFile
};
