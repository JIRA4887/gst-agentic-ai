# huggingface/app.py
import gradio as gr
import requests
import json
import PyPDF2
import docx
import io
from datetime import datetime
import os

# Your Ollama endpoint (you'll need to expose this or use HF models)
OLLAMA_URL = "https://fe12a0268f8d.ngrok-free.app/api/generate"  # We'll set this up

# GST Knowledge Base (hardcoded for now, can be expanded)
GST_KNOWLEDGE = {
    "registration_threshold": {
        "amount": "₹40 lakhs (₹20 lakhs for NE states)",
        "reference": "CGST Act 2017 - Section 22",
        "link": "https://cbic-gst.gov.in/gst-goods-services-rates.html"
    },
    "gst_rates": {
        "rates": "0%, 5%, 12%, 18%, 28%",
        "reference": "GST Rates Notification No. 01/2017-Central Tax (Rate)",
        "link": "https://cbic-gst.gov.in/gst-goods-services-rates.html"
    },
    "returns": {
        "types": "GSTR-1, GSTR-3B, GSTR-2A, GSTR-9",
        "reference": "CGST Act 2017 - Section 39",
        "link": "https://www.gst.gov.in/return"
    }
}

def query_local_llm(prompt, model="qwen2.5:1.5b"):
    """Query your local Ollama instance"""
    try:
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "max_tokens": 1000
            }
        }
        response = requests.post(OLLAMA_URL, json=payload, timeout=30)
        if response.status_code == 200:
            return response.json().get("response", "")
    except:
        pass
    return None

def fallback_gst_response(query):
    """Fallback response using hardcoded knowledge"""
    query_lower = query.lower()
    
    # Simple keyword matching
    if "registration" in query_lower or "threshold" in query_lower:
        info = GST_KNOWLEDGE["registration_threshold"]
        return f"GST registration is mandatory for businesses with turnover exceeding {info['amount']}.", [info['reference']], [info['link']]
    
    elif "rate" in query_lower or "percentage" in query_lower:
        info = GST_KNOWLEDGE["gst_rates"]
        return f"GST rates in India are: {info['rates']}. The applicable rate depends on the goods or services.", [info['reference']], [info['link']]
    
    elif "return" in query_lower or "filing" in query_lower:
        info = GST_KNOWLEDGE["returns"]
        return f"Main GST returns include: {info['types']}. Filing frequency and due dates vary by turnover.", [info['reference']], [info['link']]
    
    else:
        return ("I can help with GST queries related to registration, rates, returns, compliance, and notice responses. "
                "Please ask a specific GST question."), ["General GST Information"], ["https://www.gst.gov.in/"]

def process_gst_query(query):
    """Main function to process GST queries"""
    if not query.strip():
        return "", "", ""
    
    # Enhanced prompt for GST context
    enhanced_prompt = f"""You are an expert GST consultant in India. Answer this query professionally:

Query: {query}

Provide:
1. Clear, accurate answer
2. Specific legal references (CGST Act sections, notifications)
3. Official links where applicable

Keep response concise but comprehensive. Focus on practical guidance."""

    # Try local LLM first
    llm_response = query_local_llm(enhanced_prompt)
    
    if llm_response:
        # Parse LLM response (you can enhance this)
        answer = llm_response
        references = ["CGST Act 2017", "GST Portal: gst.gov.in"]
        links = ["https://www.gst.gov.in/", "https://cbic-gst.gov.in/"]
    else:
        # Use fallback
        answer, references, links = fallback_gst_response(query)
    
    # Format references
    refs_text = "\n".join([f"• {ref}" for ref in references])
    links_text = "\n".join([f"• {link}" for link in links])
    
    return answer, refs_text, links_text

def extract_text_from_file(file):
    """Extract text from uploaded file"""
    if file is None:
        return ""
    
    try:
        if file.name.endswith('.pdf'):
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            return text
        
        elif file.name.endswith('.docx'):
            doc = docx.Document(file)
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            return text
        
        elif file.name.endswith('.txt'):
            return file.read().decode('utf-8')
    
    except Exception as e:
        return f"Error reading file: {str(e)}"
    
    return "Unsupported file format. Please upload PDF, DOCX, or TXT files."

def generate_notice_response(file, additional_context=""):
    """Generate response to GST notice"""
    if file is None:
        return "Please upload a notice file first."
    
    # Extract notice content
    notice_content = extract_text_from_file(file)
    
    if not notice_content or "Error" in notice_content:
        return notice_content
    
    # Enhanced prompt for notice response
    response_prompt = f"""Draft a professional legal response to this GST notice:

NOTICE CONTENT:
{notice_content[:2000]}  # Limit to avoid token limits

ADDITIONAL CONTEXT:
{additional_context}

Create a comprehensive response with:
1. Professional legal format
2. Point-by-point response to allegations
3. Relevant CGST Act section references
4. Legal arguments and precedents
5. Prayer for relief

Format as a complete legal document ready for submission."""

    # Try local LLM
    llm_response = query_local_llm(response_prompt)
    
    if llm_response:
        draft = llm_response
    else:
        # Fallback template
        draft = f"""To,
The Assistant Commissioner of GST,
[Address as mentioned in the notice]

Subject: Response to Show Cause Notice/Demand Notice

Sir/Madam,

With reference to the above notice dated [DATE], I/we submit the following response:

1. PRELIMINARY OBJECTIONS:
   - The notice is time-barred under Section 73/74 of CGST Act, 2017
   - Proper opportunity of hearing not provided as per natural justice

2. FACTUAL SUBMISSIONS:
   [Based on the notice content, specific facts would be addressed here]

3. LEGAL SUBMISSIONS:
   - Reference: Section 73 of CGST Act, 2017 (Determination of tax)
   - Reference: Section 11(1)(a) of CGST Act, 2017 (Taxable event)
   - Reference: Rule 36 of CGST Rules, 2017 (Conditions for ITC)

4. PRAYER:
   In light of the above submissions, it is prayed that:
   a) The notice may be dropped
   b) No demand may be confirmed
   c) Any other relief deemed fit may be granted

Respectfully submitted,

[Signature]
[Name & Designation]
Date: {datetime.now().strftime('%d-%m-%Y')}

---
DISCLAIMER: This is an AI-generated draft. Please review with legal counsel before submission.
"""

    return draft

# Custom CSS
css = """
.gradio-container {
    font-family: 'Inter', sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.gr-button-primary {
    background: linear-gradient(135deg, #667eea, #764ba2) !important;
    border: none !important;
}
.gr-panel {
    background: rgba(255, 255, 255, 0.1) !important;
    backdrop-filter: blur(10px) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
}
"""

# Create Gradio interface
with gr.Blocks(css=css, theme=gr.themes.Glass(), title="GST Agentic AI") as app:
    gr.HTML("""
    <div style="text-align: center; padding: 20px;">
        <h1 style="color: white; font-size: 3rem; margin-bottom: 10px;">🤖 GST Agentic AI</h1>
        <p style="color: rgba(255,255,255,0.8); font-size: 1.2rem;">Your Free, Autonomous GST Assistant</p>
    </div>
    """)
    
    with gr.Tab("💬 GST Query Chat"):
        gr.Markdown("### Ask any GST-related question and get instant answers with official references")
        
        with gr.Row():
            with gr.Column(scale=2):
                query_input = gr.Textbox(
                    label="Your GST Question",
                    placeholder="e.g., What is the GST registration threshold for services?",
                    lines=3
                )
                query_btn = gr.Button("Get Answer", variant="primary", scale=1)
            
            with gr.Column(scale=3):
                answer_output = gr.Textbox(
                    label="AI Response", 
                    lines=8,
                    interactive=False
                )
                refs_output = gr.Textbox(
                    label="📚 Legal References",
                    lines=4,
                    interactive=False
                )
                links_output = gr.Textbox(
                    label="🔗 Official Links",
                    lines=3,
                    interactive=False
                )
        
        # Example questions
        gr.Examples(
            examples=[
                ["What is the current GST registration threshold in India?"],
                ["What are the different GST return types and their due dates?"],
                ["How to claim input tax credit under GST?"],
                ["What is the penalty for late filing of GST returns?"],
                ["What are the documents required for GST registration?"]
            ],
            inputs=query_input
        )
    
    with gr.Tab("📄 Notice Response Drafting"):
        gr.Markdown("### Upload your GST notice and get a professional response draft")
        
        with gr.Row():
            with gr.Column(scale=1):
                file_input = gr.File(
                    label="Upload GST Notice",
                    file_types=[".pdf", ".docx", ".txt"],
                    file_count="single"
                )
                context_input = gr.Textbox(
                    label="Additional Context (Optional)",
                    placeholder="Add any specific details about your case...",
                    lines=4
                )
                generate_btn = gr.Button("Generate Response Draft", variant="primary")
                
                gr.HTML("""
                <div style="background: rgba(255,193,7,0.1); border: 1px solid rgba(255,193,7,0.3); 
                           border-radius: 10px; padding: 15px; margin-top: 20px;">
                    <h4 style="color: #ffc107; margin-bottom: 10px;">⚠️ Legal Disclaimer</h4>
                    <p style="font-size: 0.9rem; color: rgba(255,255,255,0.8);">
                        This is an AI-generated draft for reference only. 
                        <strong>Always consult with qualified legal counsel</strong> 
                        before submitting any response to GST authorities.
                    </p>
                </div>
                """)
            
            with gr.Column(scale=2):
                draft_output = gr.Textbox(
                    label="Generated Response Draft",
                    lines=20,
                    interactive=True,
                    placeholder="Upload a notice file to generate a professional response..."
                )
                
                with gr.Row():
                    download_btn = gr.DownloadButton(
                        label="📥 Download as TXT",
                        variant="secondary"
                    )
    
    # Event handlers
    query_btn.click(
        fn=process_gst_query,
        inputs=[query_input],
        outputs=[answer_output, refs_output, links_output]
    )
    
    generate_btn.click(
        fn=generate_notice_response,
        inputs=[file_input, context_input],
        outputs=[draft_output]
    )
    
    # Auto-update download button
    draft_output.change(
        fn=lambda x: gr.DownloadButton(
            label="📥 Download Draft",
            value=x,
            visible=bool(x.strip()) if x else False
        ),
        inputs=[draft_output],
        outputs=[download_btn]
    )

# Launch configuration
if __name__ == "__main__":
    app.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False,  # Set to True for temporary public link
        show_error=True
    )
