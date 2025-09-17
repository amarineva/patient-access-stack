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
                    card.style.display = 'flex';
                    card.style.animation = 'slideInUp 0.6s ease-out';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
    
    // App launch functionality
    const launchButtons = document.querySelectorAll('.app-launch-btn');
    launchButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const appCard = this.closest('.app-card');
            const appName = appCard.querySelector('.app-name').textContent;
            
            // Add loading state
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            this.disabled = true;
            
            // Simulate app launch
            setTimeout(() => {
                showNotification(`Launching ${appName}...`, 'success');
                this.innerHTML = '<i class="fas fa-play"></i>';
                this.disabled = false;
            }, 1500);
        });
    });
    
    // App card click functionality
    appCards.forEach(card => {
        card.addEventListener('click', function() {
            const appName = this.querySelector('.app-name').textContent;
            const appDescription = this.querySelector('.app-description').textContent;
            showAppDetails(appName, appDescription);
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
});

// Show app details modal
function showAppDetails(appName, description) {
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
    launchBtn.addEventListener('click', function() {
        showNotification(`Launching ${appName}...`, 'success');
        closeModal();
    });
    
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
