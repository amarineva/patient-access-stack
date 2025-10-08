(function() {
    const LS_KEYS = {
        lastProduct: 'sandbox.last.product',
        lastSigInput: 'sandbox.sig.input',
        lastNdcInput: 'sandbox.ndc.input',
        lastPillName: 'sandbox.pill.name',
        lastPillNdc: 'sandbox.pill.ndc',
        lastPillDescription: 'sandbox.pill.description',
        lastMcpEndpoint: 'sandbox.mcp.endpoint'
    };

    const DEFAULT_SIG_MODEL = 'gpt-4.1-mini';
    const PROMPT_ID = 'pmpt_68d1aac7137081978a62cfad87ffd3730b5be593908223a0';
    const PROMPT_VERSION = '7';

    const AUTH_STATE_KEY = 'sandbox.authenticated';
    const SANDBOX_CREDENTIALS = Object.freeze({
        // Update when rotating sandbox credentials.
        username: 'en-vision-tester',
        passwordHash: '66e8ca6dcb59bce51d597e7698740862ff4e143e18533d73467ec75a8d3485f1'
    });

    const PRODUCT_LABELS = {
        'sig-normalizer': 'SIG Normalizer',
        'ndc-analysis': 'NDC Analysis',
        'medcast': 'Medcast',
        'pill-identifier': 'Pill Identifier'
    };

    const MCP_TOOL_EXAMPLES = {
        'sig_normalize': {
            args: {"sig": "Take 1 tablet by mouth twice daily"},
            hint: 'Normalizes pharmacy SIG instructions into structured JSON'
        },
        'ndc_analysis': {
            args: {"ndc": "00527-1312-01"},
            hint: 'Looks up pharmaceutical data for an NDC code (digits and hyphens allowed)'
        },
        'medcast_generate_podcast': {
            args: {"text": "Important medication information", "ndc": "65862-523-01"},
            hint: 'Generates audio podcast. Note: Requires file paths for files parameter'
        },
        'pill_identifier': {
            args: {"name": "Lisinopril", "ndc11": "00527131201", "imagePath": "/path/to/image.jpg"},
            hint: 'Analyzes medication image. Note: imagePath must be accessible to MCP server'
        }
    };

    // Firebase Cloud Function URL (Gen2)
    const SIG_API_ENDPOINT = (() => {
        const productionUrl = 'https://normalizesig-z4vamvc43a-uc.a.run.app';
        const emulatorUrl = 'http://127.0.0.1:5001/scriptability-patient-access/us-central1/normalizeSig';

        const params = new URLSearchParams(window.location.search);
        const override = params.get('sigApi');
        if (override === 'emulator') {
            return emulatorUrl;
        }
        if (override === 'prod') {
            return productionUrl;
        }

        const host = window.location.hostname;
        const port = window.location.port;
        const isLocalHost = host === 'localhost' || host === '127.0.0.1';
        const isFirebaseEmulator = isLocalHost && (port === '5000' || port === '5001');
        return isFirebaseEmulator ? emulatorUrl : productionUrl;
    })();

    function getEl(id) {
        return document.getElementById(id);
    }

    function persistAuthState(isAuthenticated) {
        try {
            if (isAuthenticated) {
                sessionStorage.setItem(AUTH_STATE_KEY, 'true');
            } else {
                sessionStorage.removeItem(AUTH_STATE_KEY);
            }
        } catch (err) {
            console.warn('Sandbox auth persistence failed:', err);
        }
    }

    function readAuthState() {
        try {
            return sessionStorage.getItem(AUTH_STATE_KEY) === 'true';
        } catch (err) {
            console.warn('Sandbox auth read failed:', err);
            return false;
        }
    }

    function setSandboxAuthVisibility(isAuthenticated) {
        const gate = getEl('sandboxGate');
        const app = getEl('sandboxApp');
        const logoutBtn = getEl('sandboxLogoutBtn');
        if (gate) {
            gate.hidden = isAuthenticated;
        }
        if (app) {
            app.hidden = !isAuthenticated;
        }
        if (logoutBtn) {
            logoutBtn.hidden = !isAuthenticated;
        }
    }

    async function sha256Hex(value) {
        if (!window.crypto || !window.crypto.subtle) {
            throw new Error('Web Crypto API unavailable.');
        }
        const encoder = new TextEncoder();
        const data = encoder.encode(value);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function validateCredentials(username, password) {
        if (username !== SANDBOX_CREDENTIALS.username) {
            return false;
        }
        const hashed = await sha256Hex(password);
        return hashed === SANDBOX_CREDENTIALS.passwordHash;
    }

    function focusSandboxUsername() {
        const usernameInput = getEl('sandboxUsername');
        if (usernameInput) {
            usernameInput.focus();
        }
    }

    function initSandboxAuth() {
        const loginForm = getEl('sandboxLoginForm');
        const errorEl = getEl('sandboxLoginError');
        const submitBtn = getEl('sandboxLoginSubmit');
        const logoutBtn = getEl('sandboxLogoutBtn');

        if (!loginForm || !submitBtn) {
            setSandboxAuthVisibility(true);
            return;
        }

        const remembered = readAuthState();
        setSandboxAuthVisibility(remembered);
        if (!remembered) {
            setTimeout(focusSandboxUsername, 50);
        }

        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (errorEl) {
                errorEl.textContent = '';
            }

            const formData = new FormData(loginForm);
            const username = (formData.get('username') || '').toString().trim();
            const password = (formData.get('password') || '').toString();

            if (!username || !password) {
                if (errorEl) {
                    errorEl.textContent = 'Enter both username and password.';
                }
                focusSandboxUsername();
                return;
            }

            const originalLabel = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying';

            try {
                const isValid = await validateCredentials(username, password);
                if (isValid) {
                    persistAuthState(true);
                    setSandboxAuthVisibility(true);
                    loginForm.reset();
                    if (errorEl) {
                        errorEl.textContent = '';
                    }
                    setTimeout(() => {
                        const productSelect = getEl('productSelect');
                        if (productSelect) {
                            productSelect.focus();
                        }
                    }, 150);
                } else if (errorEl) {
                    errorEl.textContent = 'Incorrect username or password.';
                }
            } catch (err) {
                console.error('Sandbox auth error:', err);
                if (errorEl) {
                    errorEl.textContent = 'Unable to verify credentials in this browser.';
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalLabel;
                const passwordField = loginForm.querySelector('input[name="password"]');
                if (passwordField) {
                    passwordField.value = '';
                }
                if (!readAuthState()) {
                    focusSandboxUsername();
                }
            }
        });

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                persistAuthState(false);
                setSandboxAuthVisibility(false);
                loginForm.reset();
                if (errorEl) {
                    errorEl.textContent = '';
                }
                setTimeout(focusSandboxUsername, 50);
            });
        }
    }

    function showToast(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
            return;
        }
        console.log(`[${type}]`, message);
    }

    function extractResponseText(data) {
        if (!data) return '';
        if (data.output_text && typeof data.output_text === 'string' && data.output_text.trim().length > 0) {
            return data.output_text;
        }
        if (Array.isArray(data.output)) {
            for (const item of data.output) {
                if (item && item.type === 'message' && Array.isArray(item.content)) {
                    for (const part of item.content) {
                        if (part && part.type === 'output_text' && typeof part.text === 'string') {
                            return part.text;
                        }
                    }
                }
            }
        }
        return '';
    }

    // -------- MCP (Model Context Protocol) helpers --------
    const MCP_PROTOCOL_VERSION = '2025-03-26';
    const mcpState = {
        endpoint: '',
        protocolVersion: MCP_PROTOCOL_VERSION,
        connected: false
    };

    function setMcpStatus(status) {
        const badge = getEl('mcpStatusBadge');
        if (badge) {
            badge.setAttribute('data-status', status);
            const labels = {
                'disconnected': 'Disconnected',
                'connecting': 'Connecting...',
                'connected': 'Connected'
            };
            badge.textContent = labels[status] || status;
        }
        mcpState.connected = status === 'connected';
        
        // Enable/disable controls based on connection status
        const connectBtn = getEl('mcpConnectBtn');
        const disconnectBtn = getEl('mcpDisconnectBtn');
        const listBtn = getEl('mcpListBtn');
        const toolSelect = getEl('mcpToolSelect');
        const argsTextarea = getEl('mcpArgs');
        const callBtn = getEl('mcpCallBtn');
        
        if (status === 'connected') {
            if (connectBtn) connectBtn.style.display = 'none';
            if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';
            if (listBtn) listBtn.disabled = false;
            if (toolSelect) toolSelect.disabled = false;
            if (argsTextarea) argsTextarea.disabled = false;
            if (callBtn) callBtn.disabled = false;
        } else {
            if (connectBtn) connectBtn.style.display = 'inline-flex';
            if (disconnectBtn) disconnectBtn.style.display = 'none';
            if (listBtn) listBtn.disabled = true;
            if (toolSelect) toolSelect.disabled = true;
            if (argsTextarea) argsTextarea.disabled = true;
            if (callBtn) callBtn.disabled = true;
        }
    }

    function getMcpEndpoint() {
        const input = getEl('mcpEndpoint');
        let value = (input && input.value || '').trim();
        if (!value) {
            const host = window.location.hostname;
            const isLocal = host === 'localhost' || host === '127.0.0.1';
            value = isLocal ? 'http://localhost:3333/mcp' : 'https://scriptability-patient-access.web.app/mcp';
            if (input) input.value = value;
        }
        return value;
    }

    function saveMcpEndpoint(endpoint) {
        try { localStorage.setItem(LS_KEYS.lastMcpEndpoint, endpoint); } catch {}
    }

    function warnIfMixedContent(endpoint) {
        const isPageHttps = window.location.protocol === 'https:';
        if (isPageHttps && /^http:\/\//i.test(endpoint)) {
            showToast('This page is HTTPS. Use an HTTPS MCP endpoint to avoid browser blocking (mixed content).', 'error');
            return true;
        }
        return false;
    }

    async function fetchMcp(endpoint, message, includeProtocolHeader) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
        };
        if (includeProtocolHeader) {
            headers['mcp-protocol-version'] = mcpState.protocolVersion || MCP_PROTOCOL_VERSION;
        }
        const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(message)
        });
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        const text = await res.text();
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        if (ct.includes('application/json')) {
            return JSON.parse(text);
        }
        if (ct.includes('text/event-stream')) {
            // Parse first JSON-RPC object from SSE stream
            const lines = text.split(/\r?\n/);
            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const payload = line.slice(5).trim();
                    try { return JSON.parse(payload); } catch {}
                }
            }
            // Fallback: try last non-empty data line
            for (let i = lines.length - 1; i >= 0; i--) {
                const l = lines[i].trim();
                if (l.startsWith('data:')) {
                    try { return JSON.parse(l.slice(5).trim()); } catch {}
                }
            }
            throw new Error('Unable to parse SSE response from MCP');
        }
        // Unknown content type, try JSON anyway
        try { return JSON.parse(text); } catch {
            return { jsonrpc: '2.0', error: { code: -32000, message: 'Unexpected response', data: text }, id: null };
        }
    }

    async function fetchMcpStream(endpoint, message, includeProtocolHeader, onChunk) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
        };
        if (includeProtocolHeader) {
            headers['mcp-protocol-version'] = mcpState.protocolVersion || MCP_PROTOCOL_VERSION;
        }
        const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(message)
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`HTTP ${res.status}: ${errText}`);
        }
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('text/event-stream') || !res.body || !res.body.getReader) {
            const txt = await res.text();
            try {
                const json = JSON.parse(txt);
                if (onChunk) onChunk(json);
                return json;
            } catch (_) {
                if (onChunk) onChunk({ jsonrpc: '2.0', result: txt, id: null });
                return { jsonrpc: '2.0', result: txt, id: null };
            }
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let lastJson = null;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const payload = line.slice(5).trim();
                    if (payload) {
                        try {
                            const json = JSON.parse(payload);
                            lastJson = json;
                            if (onChunk) onChunk(json);
                        } catch (_e) {
                            // ignore parse errors for partial chunks
                        }
                    }
                }
            }
        }
        return lastJson;
    }

    function toggleMcpPanel() {
        const panel = getEl('mcpPanel');
        if (!panel) return;
        const isVisible = panel.style.display !== 'none';
        
        if (isVisible) {
            // Closing MCP panel - show the selected product
            panel.style.display = 'none';
            updateProductVisibility();
        } else {
            // Opening MCP panel - hide all products
            panel.style.display = 'grid';
            document.querySelectorAll('.sandbox-grid').forEach(section => {
                const product = section.getAttribute('data-product');
                if (product && section.id !== 'mcpPanel') {
                    section.style.display = 'none';
                }
            });
        }
    }

    async function mcpConnect() {
        const endpoint = getMcpEndpoint();
        if (!endpoint) {
            showToast('Enter MCP endpoint URL.', 'error');
            return;
        }
        if (warnIfMixedContent(endpoint)) return;

        const out = getEl('outputMcp');
        const btn = getEl('mcpConnectBtn');
        try {
            setMcpStatus('connecting');
            btn.disabled = true;
            out.textContent = 'Connecting to MCP server...';
            const message = {
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: MCP_PROTOCOL_VERSION,
                    capabilities: { tools: {} },
                    clientInfo: { name: 'scriptability-sandbox', version: '0.1.0' }
                }
            };
            const data = await fetchMcp(endpoint, message, false);
            mcpState.endpoint = endpoint;
            mcpState.protocolVersion = (data && data.result && data.result.protocolVersion) || MCP_PROTOCOL_VERSION;
            saveMcpEndpoint(endpoint);
            out.textContent = JSON.stringify(data, null, 2);
            setMcpStatus('connected');
            showToast('MCP connected successfully.', 'success');
        } catch (err) {
            out.textContent = `Connection failed: ${err.message}`;
            setMcpStatus('disconnected');
            showToast('Connection failed.', 'error');
        } finally {
            btn.disabled = false;
        }
    }

    function mcpDisconnect() {
        mcpState.endpoint = '';
        mcpState.connected = false;
        setMcpStatus('disconnected');
        const out = getEl('outputMcp');
        if (out) out.textContent = 'Disconnected from MCP server.';
        showToast('Disconnected.', 'info');
    }

    async function mcpListTools() {
        if (!mcpState.connected) { showToast('Connect first.', 'error'); return; }
        const endpoint = mcpState.endpoint;
        const out = getEl('outputMcp');
        const btn = getEl('mcpListBtn');
        try {
            btn.disabled = true;
            const origHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Listing';
            const message = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} };
            out.textContent = '';
            await fetchMcpStream(endpoint, message, true, (chunk) => {
                const prefix = out.textContent ? '\n' : '';
                out.textContent += prefix + JSON.stringify(chunk, null, 2);
            });
            showToast('Fetched tools.', 'success');
            btn.innerHTML = origHtml;
        } catch (err) {
            out.textContent = `Error: ${err.message}`;
            showToast('List tools failed.', 'error');
            btn.innerHTML = '<i class="fas fa-list"></i> List Tools';
        } finally {
            btn.disabled = false;
        }
    }

    function onMcpToolChange() {
        const toolSelect = getEl('mcpToolSelect');
        const argsEl = getEl('mcpArgs');
        const hintEl = getEl('mcpArgsHint');
        if (!toolSelect || !argsEl) return;
        
        const toolName = toolSelect.value;
        if (!toolName) {
            argsEl.value = '';
            argsEl.placeholder = 'Select a tool to see example arguments';
            if (hintEl) hintEl.textContent = '';
            return;
        }
        
        const example = MCP_TOOL_EXAMPLES[toolName];
        if (example) {
            argsEl.value = JSON.stringify(example.args, null, 2);
            if (hintEl) hintEl.textContent = example.hint;
        }
    }

    async function mcpCallTool() {
        if (!mcpState.connected) { showToast('Connect first.', 'error'); return; }
        const endpoint = mcpState.endpoint;
        const toolSelect = getEl('mcpToolSelect');
        const argsEl = getEl('mcpArgs');
        const out = getEl('outputMcp');
        const btn = getEl('mcpCallBtn');
        const toolName = toolSelect ? toolSelect.value : '';
        if (!toolName) { showToast('Select a tool.', 'error'); return; }
        let args = {};
        if (argsEl && argsEl.value.trim()) {
            try { args = JSON.parse(argsEl.value); }
            catch { showToast('Arguments must be valid JSON.', 'error'); return; }
        }
        try {
            btn.disabled = true;
            const origHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calling';
            const message = {
                jsonrpc: '2.0', id: 3, method: 'tools/call',
                params: { name: toolName, arguments: args }
            };
            out.textContent = '';
            await fetchMcpStream(endpoint, message, true, (chunk) => {
                const prefix = out.textContent ? '\n' : '';
                out.textContent += prefix + JSON.stringify(chunk, null, 2);
            });
            showToast('Tool call complete.', 'success');
            btn.innerHTML = origHtml;
        } catch (err) {
            out.textContent = `Error: ${err.message}`;
            showToast('Tool call failed.', 'error');
            btn.innerHTML = '<i class="fas fa-play"></i> Call Tool';
        } finally {
            btn.disabled = false;
        }
    }


    async function runSigNormalizer() {
        const model = DEFAULT_SIG_MODEL;
        const sigInput = getEl('sigInput').value.trim();

        if (!sigInput) {
            showToast('Please enter a SIG to normalize.', 'error');
            return;
        }

        localStorage.setItem(LS_KEYS.lastSigInput, sigInput);

        const runBtn = document.getElementById('runSigBtn');
        const output = document.getElementById('outputSig');
        runBtn.disabled = true;
        runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running';
        output.textContent = '';

        try {
            const needsJsonTag = !/json/i.test(sigInput);
            const requestBody = {
                model: model,
                prompt: { id: PROMPT_ID, version: PROMPT_VERSION },
                input: `SIG: ${sigInput}${needsJsonTag ? ' json' : ''}`,
                text: { format: { type: 'json_object' } },
                temperature: 0.25,
                max_output_tokens: 2048,
                top_p: 1,
                store: true
            };

            // Call our Firebase Function instead of OpenAI directly
            const res = await fetch(SIG_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`HTTP ${res.status}: ${errText}`);
            }

            const data = await res.json();
            let text = extractResponseText(data);
            if (text) {
                const trimmed = text.trim();
                if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                    try {
                        text = JSON.stringify(JSON.parse(trimmed), null, 2);
                    } catch (_) {
                    }
                }
                output.textContent = text;
            } else {
                output.textContent = JSON.stringify(data, null, 2);
            }
        } catch (err) {
            output.textContent = `Error: ${err.message}`;
            showToast('Request failed. See response area for details.', 'error');
        } finally {
            runBtn.disabled = false;
            runBtn.innerHTML = '<i class="fas fa-play"></i> Run';
        }
    }

    async function runNdcAnalysis() {
        const ndcRaw = getEl('ndcInput').value.trim();
        if (!ndcRaw) {
            showToast('Please enter an NDC number.', 'error');
            return;
        }

        localStorage.setItem(LS_KEYS.lastNdcInput, ndcRaw);

        const runBtn = getEl('runNdcBtn');
        const output = getEl('outputNdc');
        runBtn.disabled = true;
        runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running';
        output.textContent = '';

        // only allow digits and hyphens, then form the URL
        const safeNdc = ndcRaw.replace(/[^0-9-]/g, '');
        const url = `https://ndcanalysis.scriptability.net/ndc_descriptor.php?ndc=${encodeURIComponent(safeNdc)}`;

        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`HTTP ${res.status}: ${errText}`);
            }
            const data = await res.json();
            output.textContent = JSON.stringify(data, null, 2);
        } catch (err) {
            output.textContent = `Error: ${err.message}`;
            showToast('Request failed. See response area for details.', 'error');
        } finally {
            runBtn.disabled = false;
            runBtn.innerHTML = '<i class="fas fa-play"></i> Run';
        }
    }

    async function runMedcast() {
        const filesInput = getEl('medcastFiles');
        const textInput = getEl('medcastText');
        const ndcInput = getEl('medcastNdc');
        const output = getEl('outputMedcast');
        const runBtn = getEl('runMedcastBtn');

        const files = Array.from((filesInput && filesInput.files) || []);
        const text = (textInput && textInput.value || '').trim();
        const ndcRaw = (ndcInput && ndcInput.value || '').trim();

        // Basic client-side validation & size limits (mirrors server docs)
        const allowedExt = ['.txt', '.md', '.pdf', '.docx'];
        if (files.length > 10) {
            showToast('Too many files (max 10).', 'error');
            return;
        }
        let totalBytes = 0;
        for (const f of files) {
            const lower = f.name.toLowerCase();
            if (!allowedExt.some(ext => lower.endsWith(ext))) {
                showToast(`Unsupported file type: ${f.name}`, 'error');
                return;
            }
            totalBytes += f.size;
            if (f.size > 5 * 1024 * 1024) {
                showToast(`File too large (>5MB): ${f.name}`, 'error');
                return;
            }
        }
        if (totalBytes > 10 * 1024 * 1024) {
            showToast('Total attachment size exceeds 10MB.', 'error');
            return;
        }
        if (files.length === 0 && !text && !ndcRaw) {
            showToast('Provide at least one input: files, text, or NDC.', 'error');
            return;
        }

        runBtn.disabled = true;
        runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating';
        output.textContent = '';

        try {
            const formData = new FormData();
            for (const f of files) {
                formData.append('source_files', f, f.name);
            }
            if (text) formData.append('source_text', text);
            if (ndcRaw) formData.append('ndc_number', ndcRaw);

            // Configurable base URL (proxy-friendly to bypass CORS in browser)
            const fallback = 'https://medcast.scriptability.net';
            const baseUrl = fallback;
            const endpoint = `${baseUrl}/generate_podcast`;

            const controller = new AbortController();
            const timeoutMs = 180000; // 3 minutes per API guidance
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            let res;
            try {
                res = await fetch(endpoint, {
                    method: 'POST',
                    body: formData,
                    signal: controller.signal,
                });
            } finally {
                clearTimeout(timeoutId);
            }

            if (!res.ok) {
                // Try to parse error JSON
                let errText = await res.text();
                try {
                    const j = JSON.parse(errText);
                    errText = JSON.stringify(j, null, 2);
                } catch (_) {}
                const details = [
                    `URL: ${endpoint}`,
                    `Status: ${res.status}`,
                    `Response: ${errText}`
                ].join('\n');
                throw new Error(details);
            }

            // Expect WAV bytes
            const blob = await res.blob();
            // Force filename to output.wav as requested
            const dl = document.createElement('a');
            dl.href = URL.createObjectURL(blob);
            dl.download = 'output.wav';
            document.body.appendChild(dl);
            dl.click();
            dl.remove();
            URL.revokeObjectURL(dl.href);
            output.textContent = 'Success: output.wav downloaded.';
            showToast('Podcast generated. Download started.', 'success');
        } catch (err) {
            const baseUrl = 'https://medcast.scriptability.net';
            const likelyCors = err.name === 'TypeError' && /fetch/i.test(err.message);
            const likelyAbort = err.name === 'AbortError';
            const diagnostics = [
                `Error: ${err.message}`,
                `Base URL: ${baseUrl}`,
                likelyAbort ? 'Hint: Request timed out (3 min). Try again later.' : '',
                likelyCors ? 'Hint: Browser blocked the response. Ensure CORS is enabled on the API and it handles OPTIONS, and that HTTPS is used.' : ''
            ].filter(Boolean).join('\n');
            output.textContent = diagnostics;
            showToast('Request failed. See status area for details.', 'error');
        } finally {
            runBtn.disabled = false;
            runBtn.innerHTML = '<i class="fas fa-podcast"></i> Generate Podcast';
        }
    }

    async function runPillIdentifier() {
        const nameInput = getEl('pillName');
        const ndcInput = getEl('pillNdc');
        const descInput = getEl('pillDescription');
        const imageInput = getEl('pillImage');
        const output = getEl('outputPill');
        const runBtn = getEl('runPillBtn');

        const medName = (nameInput && nameInput.value || '').trim();
        const ndcRaw = (ndcInput && ndcInput.value || '').trim();
        const description = (descInput && descInput.value || '').trim();
        const imageFile = imageInput && imageInput.files && imageInput.files[0];

        if (!medName) {
            showToast('Please enter the medication name.', 'error');
            return;
        }
        if (!ndcRaw) {
            showToast('Please enter the 11-digit NDC number.', 'error');
            return;
        }

        const normalizedNdc = ndcRaw.replace(/[^0-9]/g, '');
        if (normalizedNdc.length !== 11) {
            showToast('NDC must contain exactly 11 digits.', 'error');
            return;
        }

        if (!imageFile) {
            showToast('Please upload an image of the medication.', 'error');
            return;
        }
        if (imageFile.size > 5 * 1024 * 1024) {
            showToast('Image is too large. Max size is 5MB.', 'error');
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(imageFile.type)) {
            showToast('Unsupported image format. Use JPG, PNG, GIF, or WebP.', 'error');
            return;
        }

        localStorage.setItem(LS_KEYS.lastPillName, medName);
        localStorage.setItem(LS_KEYS.lastPillNdc, normalizedNdc);
        localStorage.setItem(LS_KEYS.lastPillDescription, description);

        const pillInputs = [nameInput, ndcInput, descInput, imageInput];
        const togglePillInputs = (disabled) => {
            pillInputs.forEach(el => {
                if (el) {
                    el.disabled = disabled;
                }
            });
        };

        togglePillInputs(true);
        runBtn.disabled = true;
        runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing';
        output.textContent = '';

        try {
            const formData = new FormData();
            formData.append('medications[0][name]', medName);
            formData.append('medications[0][ndc]', normalizedNdc);
            if (description) {
                formData.append('medications[0][physical_description]', description);
            }
            formData.append('image[]', imageFile, imageFile.name || 'upload');

            const res = await fetch('https://picanalysis.scriptability.net/analyze', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                let errText = await res.text();
                try {
                    const jsonErr = JSON.parse(errText);
                    errText = JSON.stringify(jsonErr, null, 2);
                } catch (_) {}
                throw new Error(`HTTP ${res.status}: ${errText}`);
            }

            const data = await res.json();
            output.textContent = JSON.stringify(data, null, 2);
            showToast('Analysis complete.', 'success');
        } catch (err) {
            output.textContent = `Error: ${err.message}`;
            showToast('Request failed. See response area for details.', 'error');
        } finally {
            runBtn.disabled = false;
            runBtn.innerHTML = '<i class="fas fa-prescription-bottle-alt"></i> Analyze Image';
            togglePillInputs(false);
        }
    }

    function wireEvents() {
        getEl('runSigBtn').addEventListener('click', runSigNormalizer);
        getEl('copyOutputSigBtn').addEventListener('click', () => {
            const text = getEl('outputSig').textContent || '';
            navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success'));
        });
        const productSelect = getEl('productSelect');
        if (productSelect) {
            productSelect.addEventListener('change', () => {
                localStorage.setItem(LS_KEYS.lastProduct, productSelect.value);
                // Close MCP panel if open and show the selected product
                const mcpPanel = getEl('mcpPanel');
                if (mcpPanel && mcpPanel.style.display !== 'none') {
                    mcpPanel.style.display = 'none';
                }
                updateProductVisibility();
            });
        }

        // Limit SIG input to 200 characters at runtime (guard for paste)
        const sigInputEl = getEl('sigInput');
        if (sigInputEl) {
            const cap = 200;
            const enforceCap = () => {
                if (sigInputEl.value.length > cap) {
                    const cursor = sigInputEl.selectionStart;
                    sigInputEl.value = sigInputEl.value.slice(0, cap);
                    if (typeof cursor === 'number') {
                        const pos = Math.min(cursor, cap);
                        sigInputEl.setSelectionRange(pos, pos);
                    }
                }
            };
            sigInputEl.addEventListener('input', enforceCap);
        }

        // NDC Analysis wiring
        const runNdcBtn = document.getElementById('runNdcBtn');
        if (runNdcBtn) {
            runNdcBtn.addEventListener('click', runNdcAnalysis);
        }
        const copyNdcBtn = document.getElementById('copyOutputNdcBtn');
        if (copyNdcBtn) {
            copyNdcBtn.addEventListener('click', () => {
                const text = getEl('outputNdc').textContent || '';
                navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success'));
            });
        }

        // Enforce NDC input constraints: allow digits and hyphens; max 11 digits
        const ndcInput = document.getElementById('ndcInput');
        if (ndcInput) {
            ndcInput.addEventListener('input', () => {
                const previous = ndcInput.value;
                // Remove invalid characters first
                let cleaned = previous.replace(/[^0-9-]/g, '');
                // Count digits only
                const digits = cleaned.replace(/-/g, '');
                if (digits.length > 11) {
                    // Trim extra digits while preserving existing hyphens
                    let digitCount = 0;
                    let result = '';
                    for (const ch of cleaned) {
                        if (ch === '-') {
                            result += ch;
                        } else if (/[0-9]/.test(ch)) {
                            if (digitCount < 11) {
                                result += ch;
                                digitCount += 1;
                            }
                        }
                    }
                    cleaned = result;
                }
                if (cleaned !== previous) {
                    const selStart = ndcInput.selectionStart;
                    const delta = cleaned.length - previous.length;
                    ndcInput.value = cleaned;
                    // Best-effort caret maintenance
                    if (typeof selStart === 'number') {
                        const newPos = Math.max(0, selStart + delta);
                        ndcInput.setSelectionRange(newPos, newPos);
                    }
                }
            });
        }

        // Medcast wiring
        const runMedcastBtn = document.getElementById('runMedcastBtn');
        if (runMedcastBtn) {
            runMedcastBtn.addEventListener('click', runMedcast);
        }

        // Pill Identifier wiring
        const runPillBtn = document.getElementById('runPillBtn');
        if (runPillBtn) {
            runPillBtn.addEventListener('click', runPillIdentifier);
        }
        const copyPillBtn = document.getElementById('copyOutputPillBtn');
        if (copyPillBtn) {
            copyPillBtn.addEventListener('click', () => {
                const text = getEl('outputPill').textContent || '';
                navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success'));
            });
        }

        const pillNdcInput = document.getElementById('pillNdc');
        if (pillNdcInput) {
            pillNdcInput.addEventListener('input', () => {
                const digitsOnly = pillNdcInput.value.replace(/[^0-9]/g, '').slice(0, 11);
                if (pillNdcInput.value !== digitsOnly) {
                    pillNdcInput.value = digitsOnly;
                }
            });
        }

        // MCP wiring
        const mcpToggleBtn = getEl('mcpToggleBtn');
        if (mcpToggleBtn) mcpToggleBtn.addEventListener('click', toggleMcpPanel);
        const mcpConnectBtn = getEl('mcpConnectBtn');
        if (mcpConnectBtn) mcpConnectBtn.addEventListener('click', mcpConnect);
        const mcpDisconnectBtn = getEl('mcpDisconnectBtn');
        if (mcpDisconnectBtn) mcpDisconnectBtn.addEventListener('click', mcpDisconnect);
        const mcpListBtn = getEl('mcpListBtn');
        if (mcpListBtn) mcpListBtn.addEventListener('click', mcpListTools);
        const mcpToolSelect = getEl('mcpToolSelect');
        if (mcpToolSelect) mcpToolSelect.addEventListener('change', onMcpToolChange);
        const mcpCallBtn = getEl('mcpCallBtn');
        if (mcpCallBtn) mcpCallBtn.addEventListener('click', mcpCallTool);
        const copyMcpBtn = getEl('copyOutputMcpBtn');
        if (copyMcpBtn) copyMcpBtn.addEventListener('click', () => {
            const text = (getEl('outputMcp').textContent || '');
            navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success'));
        });
    }

    function updateActiveProductLabel() {
        const navProductEl = getEl('sandboxNavProduct');
        if (!navProductEl) {
            return;
        }
        const selectEl = getEl('productSelect');
        const value = selectEl ? selectEl.value : 'sig-normalizer';
        if (selectEl && selectEl.options) {
            const option = selectEl.options[selectEl.selectedIndex];
            if (option) {
                navProductEl.textContent = option.text.trim();
                return;
            }
        }
        navProductEl.textContent = PRODUCT_LABELS[value] || 'SIG Normalizer';
    }

    function updateProductVisibility() {
        const selectEl = getEl('productSelect');
        if (!selectEl) {
            return;
        }
        const selected = selectEl.value;
        document.querySelectorAll('.sandbox-grid').forEach(section => {
            const product = section.getAttribute('data-product');
            section.style.display = product === selected ? 'grid' : 'none';
        });
        updateActiveProductLabel();
    }

    function hydrateFromStorage() {
        const savedProduct = localStorage.getItem(LS_KEYS.lastProduct) || 'sig-normalizer';
        const preSig = localStorage.getItem(LS_KEYS.lastSigInput) || '';
        const preNdc = localStorage.getItem(LS_KEYS.lastNdcInput) || '';
        const prePillName = localStorage.getItem(LS_KEYS.lastPillName) || '';
        const prePillNdc = localStorage.getItem(LS_KEYS.lastPillNdc) || '';
        const prePillDescription = localStorage.getItem(LS_KEYS.lastPillDescription) || '';

        getEl('productSelect').value = savedProduct;
        getEl('sigInput').value = preSig.slice(0, 200);
        const ndcInputEl = document.getElementById('ndcInput');
        if (ndcInputEl) ndcInputEl.value = preNdc;
        const pillNameEl = document.getElementById('pillName');
        if (pillNameEl) pillNameEl.value = prePillName;
        const pillNdcEl = document.getElementById('pillNdc');
        if (pillNdcEl) pillNdcEl.value = prePillNdc;
        const pillDescEl = document.getElementById('pillDescription');
        if (pillDescEl) pillDescEl.value = prePillDescription;
        const mcpEndpointEl = getEl('mcpEndpoint');
        if (mcpEndpointEl) {
            const saved = localStorage.getItem(LS_KEYS.lastMcpEndpoint) || '';
            if (saved) mcpEndpointEl.value = saved;
        }
        updateProductVisibility();
        updateActiveProductLabel();

        const url = new URL(window.location.href);
        const preset = url.searchParams.get('product');
        if (preset) {
            getEl('productSelect').value = preset;
            updateProductVisibility();
        }

    }

    document.addEventListener('DOMContentLoaded', function() {
        initSandboxAuth();
        wireEvents();
        hydrateFromStorage();
        updateActiveProductLabel();
    });
})();
