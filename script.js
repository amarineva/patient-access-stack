// Mobile App Hub JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Category filtering
    const categoryTabs = document.querySelectorAll('.category-tab');
    const appCards = document.querySelectorAll('.app-card');
    
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            
            // Update active tab
            categoryTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Filter apps
            appCards.forEach(card => {
                const cardCategory = card.getAttribute('data-category');
                
                if (category === 'all' || cardCategory === category) {
                    // Restore default CSS layout (grid) rather than forcing flex
                    card.style.display = 'grid';
                    card.style.animation = 'slideInUp 0.6s ease-out';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
    
    // App launch functionality
    const PRODUCT_MAP = {
        'sig normalizer': 'sig-normalizer',
        'medcast': 'medcast',
        'medcast (podcast generator)': 'medcast',
        'ndc analysis': 'ndc-analysis',
        'pill identifier': 'pill-identifier'
    };

    function launchApp(productKey, appName, triggerBtn) {
        if (!productKey) {
            showNotification(`Launching ${appName}...`, 'info');
            return;
        }

        if (triggerBtn) {
            triggerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            triggerBtn.disabled = true;
        }

        setTimeout(() => {
            window.open(`sandbox.html?product=${encodeURIComponent(productKey)}`, '_blank', 'noopener');
            if (triggerBtn) {
                triggerBtn.innerHTML = '<i class="fas fa-play"></i>';
                triggerBtn.disabled = false;
            }
        }, triggerBtn ? 600 : 150);
    }

    const launchButtons = document.querySelectorAll('.app-launch-btn');
    launchButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const appCard = this.closest('.app-card');
            const appName = appCard.querySelector('.app-name').textContent.trim();
            const productKey = PRODUCT_MAP[appName.toLowerCase()];
            launchApp(productKey, appName, this);
        });
    });
    
    // App card click functionality
    appCards.forEach(card => {
        card.addEventListener('click', function() {
            const appName = this.querySelector('.app-name').textContent;
            const appDescription = this.querySelector('.app-description').textContent;
            const productKey = PRODUCT_MAP[appName.toLowerCase()];
            showAppDetails(appName, appDescription, productKey);
        });
    });
    
    // Bottom navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            const navText = this.querySelector('span').textContent;
            showNotification(`Switched to ${navText}`, 'info');
        });
    });
    
    // Header actions
    const searchBtn = document.querySelector('.search-btn');
    const menuBtn = document.querySelector('.menu-btn');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', showSearchModal);
    }
    
    if (menuBtn) {
        menuBtn.addEventListener('click', showMenuModal);
    }

    // Download Brochure - generate PDF from page content
    const brochureBtn = document.getElementById('download-brochure-btn');
    if (brochureBtn) {
        brochureBtn.addEventListener('click', async function(e) {
            try {
                // If static PDF exists and link works, let the default navigate/download happen
                // We'll attempt a HEAD request to confirm availability. If it fails, prevent default and generate.
                const href = brochureBtn.getAttribute('href');
                let staticOk = false;
                if (href) {
                    try {
                        const res = await fetch(href, { method: 'HEAD', cache: 'no-store' });
                        staticOk = res.ok && (res.headers.get('content-type') || '').includes('pdf');
                    } catch (_) {
                        staticOk = false;
                    }
                }

                if (staticOk) {
                    // allow default browser download
                    return;
                }

                // No static file found; fall back to dynamic generation
                e.preventDefault();
                // Build brochure content container
                const brochure = document.createElement('div');
                brochure.style.cssText = `
                    font-family: 'Montserrat', 'Open Sans', Arial, sans-serif;
                    color: #0f172a;
                    padding: 24px;
                    max-width: 900px;
                `;

                // Header
                const heroTitle = document.querySelector('.hero-title')?.textContent?.trim() || 'ScriptAbility Patient Access Stack';
                const heroSubtitle = document.querySelector('.hero-subtitle')?.textContent?.trim() || '';
                brochure.appendChild(htmlToElement(`
                    <div style="text-align:center; margin-bottom: 16px;">
                        <div style="font-size: 28px; font-weight: 800; color:#00325b;">${escapeHtml(heroTitle)}</div>
                        <div style="margin-top: 8px; font-size: 14px; color:#475569; line-height:1.6;">${escapeHtml(heroSubtitle)}</div>
                    </div>
                `));

                // Key stats
                const stats = Array.from(document.querySelectorAll('.hero-stats .stat')).map(s => ({
                    number: s.querySelector('.stat-number')?.textContent?.trim() || '',
                    label: s.querySelector('.stat-label')?.textContent?.trim() || ''
                }));
                if (stats.length) {
                    brochure.appendChild(htmlToElement(`
                        <div style="display:flex; gap:16px; justify-content:center; margin: 8px 0 16px 0;">
                            ${stats.map(st => `
                                <div style="text-align:center;">
                                    <div style="font-size:22px; font-weight:800; color:#f59e0b;">${escapeHtml(st.number)}</div>
                                    <div style="font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:0.04em;">${escapeHtml(st.label)}</div>
                                </div>
                            `).join('')}
                        </div>
                    `));
                }

                // Applications
                brochure.appendChild(htmlToElement(`<div style="font-size:18px; font-weight:800; color:#00325b; margin: 16px 0 8px 0;">Our Application Suite</div>`));
                const appCards = Array.from(document.querySelectorAll('.apps-grid .app-card')).map(card => ({
                    name: card.querySelector('.app-name')?.textContent?.trim() || '',
                    description: card.querySelector('.app-description')?.textContent?.trim() || '',
                    category: card.getAttribute('data-category') || ''
                }));
                if (appCards.length) {
                    brochure.appendChild(htmlToElement(`
                        <table style="width:100%; border-collapse:collapse; font-size:12px;">
                            <thead>
                                <tr>
                                    <th style="text-align:left; border-bottom:1px solid #e2e8f0; padding:8px;">App</th>
                                    <th style="text-align:left; border-bottom:1px solid #e2e8f0; padding:8px;">Description</th>
                                    <th style="text-align:left; border-bottom:1px solid #e2e8f0; padding:8px;">Category</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${appCards.map(app => `
                                    <tr>
                                        <td style="padding:8px; border-bottom:1px solid #f1f5f9; font-weight:600; color:#0f172a;">${escapeHtml(app.name)}</td>
                                        <td style="padding:8px; border-bottom:1px solid #f1f5f9; color:#475569;">${escapeHtml(app.description)}</td>
                                        <td style="padding:8px; border-bottom:1px solid #f1f5f9; color:#0ea5e9; text-transform:capitalize;">${escapeHtml(app.category)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `));
                }

                // Features
                brochure.appendChild(htmlToElement(`<div style="font-size:18px; font-weight:800; color:#00325b; margin: 16px 0 8px 0;">Why Choose ScriptAbility?</div>`));
                const features = Array.from(document.querySelectorAll('#features .feature-card')).map(card => ({
                    title: card.querySelector('h3')?.textContent?.trim() || '',
                    text: card.querySelector('p')?.textContent?.trim() || ''
                }));
                if (features.length) {
                    brochure.appendChild(htmlToElement(`
                        <ul style="margin:0 0 8px 16px; padding:0; font-size:12px; color:#334155;">
                            ${features.map(f => `
                                <li style="margin: 0 0 6px 0;">
                                    <span style="font-weight:700; color:#0f172a;">${escapeHtml(f.title)}</span>
                                    <span style="margin-left:6px; color:#475569;">${escapeHtml(f.text)}</span>
                                </li>
                            `).join('')}
                        </ul>
                    `));
                }

                // Testimonials (quotes only)
                const quotes = Array.from(document.querySelectorAll('.testimonial-card .testimonial-content p'))
                    .map(p => p.textContent?.trim()).filter(Boolean);
                if (quotes.length) {
                    brochure.appendChild(htmlToElement(`<div style="font-size:14px; font-weight:800; color:#00325b; margin: 12px 0 6px 0;">What Our Customers Say</div>`));
                    brochure.appendChild(htmlToElement(`
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            ${quotes.map(q => `<div style=\"font-style:italic; color:#334155; font-size:12px;\">“${escapeHtml(q)}”</div>`).join('')}
                        </div>
                    `));
                }

                // Contact
                const phone = document.querySelector('.contact-item i.fa-phone')?.parentElement?.querySelector('p')?.textContent?.trim() || '';
                const email = document.querySelector('.contact-item i.fa-envelope')?.parentElement?.querySelector('p')?.textContent?.trim() || '';
                brochure.appendChild(htmlToElement(`
                    <div style="margin-top: 16px; padding-top: 8px; border-top:1px solid #e2e8f0; font-size:12px; color:#334155;">
                        <div><strong>Contact</strong></div>
                        ${phone ? `<div>Phone: ${escapeHtml(phone)}</div>` : ''}
                        ${email ? `<div>Email: ${escapeHtml(email)}</div>` : ''}
                        <div style="margin-top:6px; color:#64748b;">© 2025 ScriptAbility. All rights reserved.</div>
                    </div>
                `));

                // Generate PDF
                const filename = 'ScriptAbility-Patient-Access-Stack-Brochure.pdf';
                const opt = {
                    margin:       [10, 10, 12, 10],
                    filename,
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                if (window.html2pdf) {
                    await window.html2pdf().from(brochure).set(opt).save();
                    showNotification('Brochure generated', 'success');
                } else {
                    showNotification('PDF library failed to load', 'error');
                }
            } catch (err) {
                console.error(err);
                showNotification('Failed to generate brochure', 'error');
            }
        });
    }
});

// Show app details modal
function showAppDetails(appName, description, productKey) {
    const modal = document.createElement('div');
    modal.className = 'app-modal';
    modal.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${appName}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${description}</p>
                    <div class="modal-actions">
                        <button class="btn btn-primary launch-app">Launch App</button>
                        <button class="btn btn-secondary">View Details</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;
    
    const modalContent = modal.querySelector('.modal-content');
    modalContent.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 24px;
        max-width: 400px;
        width: 100%;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        transform: scale(0.9);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        modalContent.style.transform = 'scale(1)';
    }, 100);
    
    // Close modal functionality
    const closeBtn = modal.querySelector('.modal-close');
    const overlay = modal.querySelector('.modal-overlay');
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    const launchBtn = modal.querySelector('.launch-app');
    if (productKey) {
        launchBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeModal();
            launchApp(productKey, appName);
        });
    } else {
        launchBtn.addEventListener('click', function() {
            showNotification(`Launching ${appName}...`, 'info');
            closeModal();
        });
    }
    
    function closeModal() {
        modalContent.style.transform = 'scale(0.9)';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }
}

// Show search modal
function showSearchModal() {
    const modal = document.createElement('div');
    modal.className = 'search-modal';
    modal.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="search-header">
                    <input type="text" placeholder="Search apps..." class="search-input" autofocus>
                    <button class="search-close">&times;</button>
                </div>
                <div class="search-results">
                    <p class="search-placeholder">Type to search for apps...</p>
                </div>
            </div>
        </div>
    `;
    
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 80px 20px 20px;
    `;
    
    const modalContent = modal.querySelector('.modal-content');
    modalContent.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 20px;
        max-width: 500px;
        width: 100%;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        transform: translateY(-20px);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        modalContent.style.transform = 'translateY(0)';
    }, 100);
    
    // Search functionality
    const searchInput = modal.querySelector('.search-input');
    const searchResults = modal.querySelector('.search-results');
    const appCards = document.querySelectorAll('.app-card');
    
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        const results = [];
        
        appCards.forEach(card => {
            const appName = card.querySelector('.app-name').textContent.toLowerCase();
            const description = card.querySelector('.app-description').textContent.toLowerCase();
            
            if (appName.includes(query) || description.includes(query)) {
                results.push({
                    name: card.querySelector('.app-name').textContent,
                    description: card.querySelector('.app-description').textContent,
                    category: card.getAttribute('data-category')
                });
            }
        });
        
        if (query.length > 0) {
            searchResults.innerHTML = results.map(result => `
                <div class="search-result-item">
                    <h4>${result.name}</h4>
                    <p>${result.description}</p>
                    <span class="result-category">${result.category}</span>
                </div>
            `).join('');
        } else {
            searchResults.innerHTML = '<p class="search-placeholder">Type to search for apps...</p>';
        }
    });
    
    const closeBtn = modal.querySelector('.search-close');
    const overlay = modal.querySelector('.modal-overlay');
    
    closeBtn.addEventListener('click', closeSearchModal);
    overlay.addEventListener('click', closeSearchModal);
    
    function closeSearchModal() {
        modalContent.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }
}

// Show menu modal
function showMenuModal() {
    const modal = document.createElement('div');
    modal.className = 'menu-modal';
    modal.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="menu-header">
                    <h3>Menu</h3>
                    <button class="menu-close">&times;</button>
                </div>
                <div class="menu-items">
                    <div class="menu-item">
                        <i class="fas fa-user"></i>
                        <span>Profile</span>
                    </div>
                    <div class="menu-item">
                        <i class="fas fa-cog"></i>
                        <span>Settings</span>
                    </div>
                    <div class="menu-item">
                        <i class="fas fa-question-circle"></i>
                        <span>Help & Support</span>
                    </div>
                    <div class="menu-item">
                        <i class="fas fa-info-circle"></i>
                        <span>About</span>
                    </div>
                    <div class="menu-item">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Sign Out</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 0;
    `;
    
    const modalContent = modal.querySelector('.modal-content');
    modalContent.style.cssText = `
        background: white;
        border-radius: 20px 20px 0 0;
        padding: 24px;
        width: 100%;
        max-width: 100%;
        box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.1);
        transform: translateY(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(modal);
    
    setTimeout(() => {
        modalContent.style.transform = 'translateY(0)';
    }, 100);
    
    const menuItems = modal.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const itemText = this.querySelector('span').textContent;
            showNotification(`${itemText} selected`, 'info');
            closeMenuModal();
        });
    });
    
    const closeBtn = modal.querySelector('.menu-close');
    const overlay = modal.querySelector('.modal-overlay');
    
    closeBtn.addEventListener('click', closeMenuModal);
    overlay.addEventListener('click', closeMenuModal);
    
    function closeMenuModal() {
        modalContent.style.transform = 'translateY(100%)';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }
}

// Notification system
function showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 16px;
        border-radius: 12px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        font-size: 0.9rem;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        removeNotification(notification);
    }, 4000);
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        removeNotification(notification);
    });
}

function removeNotification(notification) {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

// Add CSS for modals and notifications
const style = document.createElement('style');
style.textContent = `
    .notification-content {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        margin-left: auto;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .search-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
    }
    .search-input {
        flex: 1;
        padding: 12px 16px;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        font-size: 1rem;
        outline: none;
        transition: border-color 0.3s ease;
    }
    .search-input:focus {
        border-color: #2563eb;
    }
    .search-close, .menu-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #6b7280;
        padding: 8px;
        border-radius: 8px;
        transition: background-color 0.3s ease;
    }
    .search-close:hover, .menu-close:hover {
        background: #f3f4f6;
    }
    .search-result-item {
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }
    .search-result-item:hover {
        background: #f8fafc;
    }
    .search-result-item h4 {
        margin: 0 0 4px 0;
        color: #1f2937;
        font-size: 1rem;
    }
    .search-result-item p {
        margin: 0 0 4px 0;
        color: #6b7280;
        font-size: 0.85rem;
    }
    .result-category {
        background: #e0f2fe;
        color: #0369a1;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.7rem;
        font-weight: 500;
        text-transform: uppercase;
    }
    .search-placeholder {
        text-align: center;
        color: #9ca3af;
        font-style: italic;
        margin: 20px 0;
    }
    .menu-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    .menu-header h3 {
        margin: 0;
        color: #1f2937;
        font-size: 1.2rem;
    }
    .menu-items {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .menu-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 12px;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }
    .menu-item:hover {
        background: #f8fafc;
    }
    .menu-item i {
        width: 20px;
        color: #6b7280;
        font-size: 1.1rem;
    }
    .menu-item span {
        color: #1f2937;
        font-weight: 500;
    }
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }
    .modal-header h3 {
        margin: 0;
        color: #1f2937;
        font-size: 1.3rem;
    }
    .modal-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #6b7280;
        padding: 8px;
        border-radius: 8px;
        transition: background-color 0.3s ease;
    }
    .modal-close:hover {
        background: #f3f4f6;
    }
    .modal-body p {
        color: #6b7280;
        margin-bottom: 20px;
        line-height: 1.6;
    }
    .modal-actions {
        display: flex;
        gap: 12px;
    }
    .btn {
        padding: 10px 20px;
        border-radius: 8px;
        border: none;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        font-size: 0.9rem;
    }
    .btn-primary {
        background: #2563eb;
        color: white;
    }
    .btn-primary:hover {
        background: #1d4ed8;
        transform: translateY(-1px);
    }
    .btn-secondary {
        background: #f3f4f6;
        color: #374151;
    }
    .btn-secondary:hover {
        background: #e5e7eb;
        transform: translateY(-1px);
    }
`;
document.head.appendChild(style);

// Helpers for brochure generation
function escapeHtml(value) {
	if (value == null) return '';
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function htmlToElement(htmlString) {
	const template = document.createElement('template');
	template.innerHTML = htmlString.trim();
	return template.content.firstChild;
}

// Keyboard navigation support
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.app-modal, .search-modal, .menu-modal');
        modals.forEach(modal => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        });
    }
});
