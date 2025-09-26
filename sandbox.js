(function() {
    const LS_KEYS = {
        apiKey: 'sandbox.openai.apiKey',
        lastProduct: 'sandbox.last.product',
        lastSigInput: 'sandbox.sig.input',
        lastNdcInput: 'sandbox.ndc.input'
    };

    const DEFAULT_SIG_MODEL = 'gpt-4.1-mini';
    const PROMPT_ID = 'pmpt_68d1aac7137081978a62cfad87ffd3730b5be593908223a0';
    const PROMPT_VERSION = '7';

    function getEl(id) {
        return document.getElementById(id);
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

    function saveConfig() {
        const apiKey = getEl('apiKey').value.trim();
        const product = getEl('productSelect').value;

        if (apiKey) localStorage.setItem(LS_KEYS.apiKey, apiKey);
        localStorage.setItem(LS_KEYS.lastProduct, product);
        showToast('Configuration saved', 'success');
    }

    async function runSigNormalizer() {
        const apiKey = (getEl('apiKey').value.trim() || localStorage.getItem(LS_KEYS.apiKey) || '').trim();
        const model = DEFAULT_SIG_MODEL;
        const sigInput = getEl('sigInput').value.trim();

        if (!apiKey) {
            showToast('Please provide your OpenAI API key.', 'error');
            return;
        }
        if (!sigInput) {
            showToast('Please enter a SIG to normalize.', 'error');
            return;
        }

        localStorage.setItem(LS_KEYS.apiKey, apiKey);
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

            const res = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
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
        const baseUrlInput = getEl('medcastBaseUrl');
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
            const baseUrl = (baseUrlInput && baseUrlInput.value.trim()) || fallback;
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
            const baseUrl = (getEl('medcastBaseUrl') && getEl('medcastBaseUrl').value.trim()) || 'https://medcast.scriptability.net';
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

    function wireEvents() {
        getEl('saveConfigBtn').addEventListener('click', saveConfig);
        getEl('runSigBtn').addEventListener('click', runSigNormalizer);
        getEl('copyOutputSigBtn').addEventListener('click', () => {
            const text = getEl('outputSig').textContent || '';
            navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success'));
        });
        const productSelect = getEl('productSelect');
        productSelect.addEventListener('change', () => {
            localStorage.setItem(LS_KEYS.lastProduct, productSelect.value);
            updateProductVisibility();
        });

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
    }

    function updateProductVisibility() {
        const selected = getEl('productSelect').value;
        document.querySelectorAll('.sandbox-grid').forEach(section => {
            const product = section.getAttribute('data-product');
            section.style.display = product === selected ? 'grid' : 'none';
        });
        const apiKeyGroup = document.getElementById('apiKeyGroup');
        if (apiKeyGroup) {
            apiKeyGroup.style.display = selected === 'sig-normalizer' ? 'flex' : 'none';
        }
        const medcastBaseUrlGroup = document.getElementById('medcastBaseUrlGroup');
        if (medcastBaseUrlGroup) {
            medcastBaseUrlGroup.style.display = selected === 'medcast' ? 'flex' : 'none';
        }
    }

    function hydrateFromStorage() {
        const savedKey = localStorage.getItem(LS_KEYS.apiKey) || '';
        const savedProduct = localStorage.getItem(LS_KEYS.lastProduct) || 'sig-normalizer';
        const preSig = localStorage.getItem(LS_KEYS.lastSigInput) || '';
        const preNdc = localStorage.getItem(LS_KEYS.lastNdcInput) || '';

        getEl('apiKey').value = savedKey;
        getEl('productSelect').value = savedProduct;
        getEl('sigInput').value = preSig.slice(0, 200);
        const ndcInputEl = document.getElementById('ndcInput');
        if (ndcInputEl) ndcInputEl.value = preNdc;
        const medcastUrlEl = getEl('medcastBaseUrl');
        if (medcastUrlEl && !medcastUrlEl.value) {
            medcastUrlEl.value = 'https://medcast.scriptability.net';
        }
        updateProductVisibility();

        const url = new URL(window.location.href);
        const preset = url.searchParams.get('product');
        if (preset) {
            getEl('productSelect').value = preset;
            updateProductVisibility();
        }

    }

    document.addEventListener('DOMContentLoaded', function() {
        wireEvents();
        hydrateFromStorage();
    });
})();


