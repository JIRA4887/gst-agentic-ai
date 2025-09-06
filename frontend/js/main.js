// Main functionality for GST Agentic AI website

// Navigation scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Tab switching functionality
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.dataset.tab;
        
        // Remove active class from all buttons and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button and corresponding content
        button.classList.add('active');
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

// Chat functionality
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const chatMessages = document.getElementById('chatMessages');
const typingIndicator = document.getElementById('typingIndicator');

let currentFile = null;

function addMessage(text, isUser = false, references = [], links = [], source = '') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    
    let messageHTML = `<p>${text}</p>`;
    
    if (!isUser && (references.length > 0 || links.length > 0)) {
        messageHTML += '<div class="message-references"><strong>📚 Sources & References:</strong>';
        
        references.forEach(ref => {
            messageHTML += `<div class="reference-link">• ${ref}</div>`;
        });
        
        links.forEach(link => {
            if (link.includes('http')) {
                messageHTML += `<a href="${link}" target="_blank" class="reference-link">• ${link}</a>`;
            }
        });
        
        if (source) {
            messageHTML += `<div style="margin-top: 8px; font-size: 0.8rem; opacity: 0.7;">Source: ${source}</div>`;
        }
        
        messageHTML += '</div>';
    }
    
    messageDiv.innerHTML = messageHTML;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    typingIndicator.style.display = 'flex';
    chatMessages.appendChild(typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    typingIndicator.style.display = 'none';
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    addMessage(message, true);
    messageInput.value = '';

    showTypingIndicator();

    try {
        const response = await window.GSTApi.queryGSTAI(message);
        
        hideTypingIndicator();
        
        if (response.success) {
            addMessage(response.answer, false, response.references, response.links, response.source);
        } else {
            addMessage("I apologize, but I'm having trouble processing your query right now. Please try again later.", false);
        }
    } catch (error) {
        hideTypingIndicator();
        addMessage("There was an error processing your request. Please try again.", false);
        console.error('Chat error:', error);
    }
}

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// File upload functionality
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadedFile = document.getElementById('uploadedFile');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const draftContent = document.getElementById('draftContent');
const processingNotice = document.getElementById('processingNotice');

// Drag and drop functionality
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
});

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
    }
});

function handleFileUpload(file) {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
        alert('Please upload only PDF, DOC, or DOCX files.');
        return;
    }

    if (file.size > maxSize) {
        alert('File size must be less than 10MB.');
        return;
    }

    currentFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    uploadedFile.style.display = 'block';
    uploadArea.style.display = 'none';
}

function removeFile() {
    currentFile = null;
    uploadedFile.style.display = 'none';
    uploadArea.style.display = 'block';
    draftContent.value = '';
    fileInput.value = '';
}

async function generateDraft() {
    if (!currentFile) {
        alert('Please upload a notice file first.');
        return;
    }

    processingNotice.classList.add('active');
    draftContent.value = '';

    try {
        const fileContent = await window.GSTApi.processFile(currentFile);
        const response = await window.GSTApi.generateNoticeResponse(fileContent);
        
        processingNotice.classList.remove('active');
        
        if (response.success) {
            draftContent.value = response.draft;
        } else {
            alert('Error generating response. Please try again.');
        }
    } catch (error) {
        processingNotice.classList.remove('active');
        alert('Error processing file. Please try again.');
        console.error('File processing error:', error);
    }
}

function exportToPDF() {
    if (!draftContent.value.trim()) {
        alert('Please generate a draft first.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const text = draftContent.value;
    const lines = doc.splitTextToSize(text, 170);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(lines, 20, 20);
    
    doc.save(`GST_Notice_Response_${new Date().toISOString().split('T')[0]}.pdf`);
}

function exportToWord() {
    if (!draftContent.value.trim()) {
        alert('Please generate a draft first.');
        return;
    }

    const content = draftContent.value;
    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_Notice_Response_${new Date().toISOString().split('T')[0]}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearDraft() {
    if (confirm('Are you sure you want to clear the draft?')) {
        draftContent.value = '';
    }
}

// Make functions global for onclick handlers
window.removeFile = removeFile;
window.generateDraft = generateDraft;
window.exportToPDF = exportToPDF;
window.exportToWord = exportToWord;
window.clearDraft = clearDraft;

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe feature cards
document.querySelectorAll('.feature-card').forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = `all 0.6s ease ${index * 0.1}s`;
    observer.observe(card);
});
