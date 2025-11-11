// --- Authentication ---
function getCurrentUser() { return JSON.parse(localStorage.getItem('user') || 'null'); }
function setCurrentUser(user) { localStorage.setItem('user', JSON.stringify(user)); }
function logout() { localStorage.removeItem('user'); window.location.reload(); }
function login(email, password) {
    const user = { email: email, id: Date.now(), name: email.split('@')[0] };
    setCurrentUser(user);
    window.location.reload();
    return user;
}

// --- PRODUCTS DATA (paste your full products here!) ---
const PRODUCTS_DATA = [id: 'netflix', 
        name: 'Netflix Premium', 
        category: 'entertainment', 
        icon: '📺',
        stock: 15,
        sold: 42,
        pricing: {
            'solo profile': { '1m': 160, '2m': 280, '3m': 435, '4m': 565, '6m': 850, '8m': 1090, '12m': 1500 },
            'shared profile': { '1m': 80, '2m': 145, '3m': 205, '4m': 270, '6m': 410, '8m': 520, '12m': 800 }
        }
    },
    { 
        id: 'viu', 
        name: 'Viu Premium', 
        category: 'entertainment', 
        icon: '🎬',
        stock: 8,
        sold: 25,
        pricing: {
            'solo account': { '1m': 70, '2m': 105, '3m': 145, '4m': 170, '6m': 205, '10m': 280, '12m': 310 },
            'shared account': { '1m': 30, '2m': 55, '3m': 75, '4m': 90, '6m': 120, '10m': 190, '12m': 220 }
        }
    },
    { 
        id: 'viva-max', 
        name: 'VIVAMAX VIVAONE', 
        category: 'entertainment', 
        icon: '🎭',
        stock: 15,
        sold: 33,
        pricing: {
            'solo account': { '1m': 110, '2m': 145, '3m': 170 },
            'shared account': { '1m': 65, '2m': 90, '3m': 120 }
        }
    },
    { 
        id: 'wetv', 
        name: 'WeTV', 
        category: 'entertainment', 
        icon: '📱',
        stock: 8,
        sold: 18,
        pricing: {
            'solo account': { '1m': 150 },
            'shared account': { '1m': 55, '2m': 95, '3m': 135 }
        }
    },
    { 
        id: 'iwant-tfc', 
        name: 'IWANT TFC', 
        category: 'entertainment', 
        icon: '📺',
        stock: 8,
        sold: 12,
        pricing: {
            'solo account': { '1m': 145 },
            'shared account': { '1m': 50, '2m': 90, '3m': 125 }
        }
    },
    { 
        id: 'crunchyroll', 
        name: 'Crunchyroll', 
        category: 'entertainment', 
        icon: '🎮',
        stock: 10,
        sold: 22,
        pricing: {
            'solo profile': { '1m': 75, '2m': 115, '3m': 160, '4m': 195 },
            'shared profile': { '1m': 35, '2m': 60, '3m': 90, '4m': 115 }
        }
    },
    { 
        id: 'disney-plus', 
        name: 'Disney+', 
        category: 'entertainment', 
        icon: '🦁',
        stock: 12,
        sold: 38,
        pricing: {
            'solo account': { '1m': 390 },
            'solo profile': { '1m': 160, '2m': 315, '4m': 630, '10m': 1480, '12m': 1700 },
            'shared profile': { '1m': 85, '2m': 165, '4m': 330, '10m': 720, '12m': 880 }
        }
    },
    { 
        id: 'bilibili', 
        name: 'Bilibili', 
        category: 'entertainment', 
        icon: '📺',
        stock: 6,
        sold: 15,
        pricing: {
            'shared account': { '1m': 45, '2m': 75, '3m': 105 }
        }
    },
    { 
        id: 'loklok', 
        name: 'Loklok', 
        category: 'entertainment', 
        icon: '📱',
        stock: 7,
        sold: 10,
        pricing: {
            'solo account': { '1m': 150 },
            'shared account': { '1m': 65, '2m': 115, '3m': 170 }
        }
    },
    { 
        id: 'iqiyi', 
        name: 'iQiyi', 
        category: 'entertainment', 
        icon: '📺',
        stock: 8,
        sold: 14,
        pricing: {
            'shared account': { '1m': 50, '2m': 90, '3m': 135 }
        }
    },
    { 
        id: 'hbo-max', 
        name: 'HBO Max', 
        category: 'entertainment', 
        icon: '📹',
        stock: 10,
        sold: 28,
        pricing: {
            'solo account': { '1m': 240, '2m': 360, '3m': 480 },
            'solo profile': { '1m': 135, '2m': 240, '3m': 350 },
            'shared profile': { '1m': 70, '2m': 120, '3m': 170 }
        }
    },
    { 
        id: 'amazon-prime', 
        name: 'Amazon Prime', 
        category: 'entertainment', 
        icon: '🛒',
        stock: 15,
        sold: 35,
        pricing: {
            'solo account': { '1m': 80, '2m': 110, '3m': 135, '4m': 160, '5m': 185, '6m': 210 },
            'solo profile': { '1m': 50, '2m': 80, '3m': 110, '4m': 135, '5m': 150, '6m': 170 },
            'shared profile': { '1m': 30, '2m': 50, '3m': 70, '4m': 80, '5m': 90, '6m': 100 }
        }
    },
    { 
        id: 'youku', 
        name: 'Youku', 
        category: 'entertainment', 
        icon: '📺',
        stock: 6,
        sold: 8,
        pricing: {
            'solo account': { '1m': 125 },
            'shared account': { '1m': 50, '2m': 90, '3m': 125 }
        }
    },
    { 
        id: 'nba-league-pass', 
        name: 'NBA League Pass Premium', 
        category: 'entertainment', 
        icon: '🏀',
        stock: 5,
        sold: 12,
        pricing: {
            'solo account': { '1m': 150 },
            'shared account': { '1m': 75 }
        }
    },

    // ==================== STREAMING (MUSIC) ====================
    { 
        id: 'youtube', 
        name: 'YouTube Premium', 
        category: 'streaming', 
        icon: '📹',
        stock: 20,
        sold: 65,
        pricing: {
            'famhead': { '1m': 70, '2m': 90, '3m': 125, '4m': 150, '5m': 175, '6m': 200 },
            'solo': { '1m': 45, '2m': 60, '3m': 85, '4m': 105, '5m': 125, '6m': 145 },
            'invite': { '1m': 20, '2m': 35, '3m': 50, '4m': 60, '5m': 70, '6m': 80 }
        }
    },
    { 
        id: 'spotify', 
        name: 'Spotify Premium', 
        category: 'streaming', 
        icon: '🎵',
        stock: 15,
        sold: 55,
        pricing: {
            'solo fw': { '1m': 60, '2m': 110, '3m': 150, '4m': 200 },
            'solo nw': { '1m': 45, '2m': 80, '3m': 120, '4m': 150 }
        }
    },
    { 
        id: 'apple-music', 
        name: 'Apple Music', 
        category: 'streaming', 
        icon: '🎧',
        stock: 12,
        sold: 40,
        pricing: {
            'solo account': { '1m': 49, '2m': 89, '3m': 129, '4m': 159 }
        }
    },

    // ==================== AI TOOLS ====================
    { 
        id: 'chatgpt', 
        name: 'ChatGPT Plus', 
        category: 'ai', 
        icon: '🧠',
        stock: 10,
        sold: 22,
        pricing: {
            'solo account': { '1m': 600, '2m': 1050, '3m': 1500 },
            'shared account': { '1m': 120, '2m': 200, '3m': 290 }
        }
    },
    { 
        id: 'blackbox-ai', 
        name: 'Blackbox AI', 
        category: 'ai', 
        icon: '🤖',
        stock: 0,
        sold: 5,
        pricing: {
            'solo account': { '1m': 90, '2m': 170, '3m': 250 }
        }
    },
    { 
        id: 'perplexity', 
        name: 'Perplexity AI', 
        category: 'ai', 
        icon: '🔍',
        stock: 8,
        sold: 15,
        pricing: {
            'solo account': { '1m': 120, '4m': 200, '6m': 250, '12m': 300, '24m': 450 },
            'shared account': { '1m': 55, '4m': 140, '6m': 190, '12m': 230, '24m': 350 }
        }
    },
    { 
        id: 'google-one', 
        name: 'Google One + Gemini AI', 
        category: 'ai', 
        icon: '☁️',
        stock: 10,
        sold: 18,
        pricing: {
            'solo account': { '1m': 50, '2m': 85, '3m': 120, '12m': 280 },
            'shared account': { '1m': 30, '2m': 50, '3m': 80, '12m': 150 }
        }
    },

    // ==================== EDUCATIONAL ====================
    { 
        id: 'quizlet', 
        name: 'Quizlet+', 
        category: 'educational', 
        icon: '📚',
        stock: 6,
        sold: 12,
        pricing: {
            'solo account': { '1m': 45, '2m': 65, '3m': 100 },
            'shared account': { '1m': 20, '2m': 35, '3m': 50 }
        }
    },
    { 
        id: 'scribd', 
        name: 'Scribd Premium', 
        category: 'educational', 
        icon: '📖',
        stock: 7,
        sold: 15,
        pricing: {
            'solo account': { '1m': 50, '2m': 85, '3m': 120 },
            'shared account': { '1m': 30, '2m': 50, '3m': 80 }
        }
    },
    { 
        id: 'studocu', 
        name: 'Studocu Premium', 
        category: 'educational', 
        icon: '🎓',
        stock: 6,
        sold: 10,
        pricing: {
            'solo account': { '1m': 50, '2m': 85, '3m': 120 },
            'shared account': { '1m': 30, '2m': 50, '3m': 80 }
        }
    },
    { 
        id: 'duolingo', 
        name: 'Duolingo Super', 
        category: 'educational', 
        icon: '🧑‍🎓',
        stock: 6,
        sold: 8,
        pricing: {
            'solo account': { '1m': 80, '2m': 130, '3m': 170 }
        }
    },
    { 
        id: 'turnitin-student', 
        name: 'Turnitin Student', 
        category: 'educational', 
        icon: '📝',
        stock: 8,
        sold: 20,
        pricing: {
            'solo account': { '7d': 35, '14d': 50, '1m': 80, '2m': 140, '3m': 160, '6m': 330, '12m': 580 }
        }
    },
    { 
        id: 'turnitin-instructor', 
        name: 'Turnitin Instructor', 
        category: 'educational', 
        icon: '👨‍🏫',
        stock: 5,
        sold: 8,
        pricing: {
            'solo account': { '1m': 520 },
            'shared account': { '7d': 120, '14d': 175, '1m': 280 }
        }
    },
    { 
        id: 'grammarly', 
        name: 'Grammarly Premium', 
        category: 'educational', 
        icon: '✍️',
        stock: 8,
        sold: 18,
        pricing: {
            'solo account': { '1m': 85 },
            'shared account': { '1m': 35, '2m': 65, '3m': 95 }
        }
    },
    { 
        id: 'quillbot', 
        name: 'Quillbot Premium', 
        category: 'educational', 
        icon: '📝',
        stock: 8,
        sold: 14,
        pricing: {
            'solo account': { '1m': 100 },
            'shared account': { '1m': 45, '2m': 75, '3m': 110 }
        }
    },
    { 
        id: 'ms-365', 
        name: 'Microsoft 365', 
        category: 'educational', 
        icon: '💼',
        stock: 15,
        sold: 30,
        pricing: {
            'solo account': { '1m': 55, '2m': 90, '3m': 120 },
            'shared account': { '1m': 25, '2m': 45, '3m': 65 }
        }
    },
    { 
        id: 'zoom', 
        name: 'Zoom Pro', 
        category: 'educational', 
        icon: '📽️',
        stock: 6,
        sold: 12,
        pricing: {
            'solo account': { '14d': 45, '1m': 70, '2m': 120, '3m': 160 }
        }
    },

    // ==================== EDITING TOOLS ====================
    { 
        id: 'canva', 
        name: 'Canva Pro', 
        category: 'editing', 
        icon: '🎨',
        stock: 25,
        sold: 78,
        pricing: {
            'edu lifetime': { 'nw': 19, '3m w': 39, '6m w': 49, '12m w': 69 },
            'teamhead': { '1m': 45, '2m': 55, '3m': 65, '4m': 75, '5m': 85, '6m': 95 },
            'solo': { '1m': 25, '2m': 35, '3m': 45, '4m': 55, '5m': 65, '6m': 75 },
            'invite': { '1m': 10, '2m': 15, '3m': 20, '4m': 25, '5m': 30, '6m': 35 }
        }
    },
    { 
        id: 'picsart', 
        name: 'Picsart Gold', 
        category: 'editing', 
        icon: '🖼️',
        stock: 12,
        sold: 25,
        pricing: {
            'teamhead account': { '1m': 70, '2m': 115, '3m': 150 },
            'solo account': { '1m': 50, '2m': 85, '3m': 120 },
            'shared account': { '1m': 25, '2m': 45, '3m': 70 }
        }
    },
    { 
        id: 'capcut', 
        name: 'CapCut Pro', 
        category: 'editing', 
        icon: '🎬',
        stock: 10,
        sold: 18,
        pricing: {
            'solo account': { '7d': 50, '1m': 130, '2m': 190, '3m': 240 },
            'shared account': { '1m': 70, '2m': 120, '3m': 155 }
        }
    },
    { 
        id: 'alight-motion', 
        name: 'Alight Motion Pro', 
        category: 'editing', 
        icon: '📱',
        stock: 8,
        sold: 15,
        pricing: {
            'solo account': { '1m': 90, '12m': 149 },
            'shared account': { '1m': 35, '12m': 69 }
        }
    },
    { 
        id: 'remini', 
        name: 'Remini Web', 
        category: 'editing', 
        icon: '✨',
        stock: 6,
        sold: 10,
        pricing: {
            'solo account': { '7d': 30, '1m': 50 },
            'shared account': { '7d': 15, '1m': 25 }
        }
    },
    { 
        id: 'camscanner', 
        name: 'CamScanner Pro', 
        category: 'editing', 
        icon: '📄',
        stock: 8,
        sold: 12,
        pricing: {
            'solo account': { '1m': 100, '2m': 180, '3m': 250 },
            'shared account': { '1m': 50, '2m': 90, '3m': 120 }
        }
    },
    { 
        id: 'smallpdf', 
        name: 'Small PDF Pro', 
        category: 'editing', 
        icon: '📁',
        stock: 7,
        sold: 10,
        pricing: {
            'solo account': { '1m': 55, '2m': 95, '3m': 130 },
            'shared account': { '1m': 30, '2m': 50, '3m': 70 }
        }
    }
];

// --- Globals ---
let currentUser = null;
let selectedProducts = {};

// --- Startup ---
document.addEventListener('DOMContentLoaded', function () {
    currentUser = getCurrentUser();
    updateAuthUI();
    initializeTabs();
    initializeEventListeners();
    renderAllProducts();
});

function updateAuthUI() {
    if (currentUser) {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('user-section').style.display = 'flex';
        document.getElementById('current-user').textContent = currentUser.email;
    } else {
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('user-section').style.display = 'none';
    }
}

// --- Tabs ---
function initializeTabs() {
    window.switchTab = function (tabName) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        event.target.classList.add('active');
        document.getElementById(tabName + '-tab').classList.add('active');
    };
}

// --- Event Listeners ---
function initializeEventListeners() {
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.onclick = function () {
            const email = prompt('Enter email:');
            const password = prompt('Enter password:');
            if (email && password) {
                login(email, password);
            }
        }
    }
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.onclick = logout;

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', handleSearch);
}

// --- Products Rendering ---
function renderAllProducts() {
    const catWrapper = document.querySelector('.categories-wrapper');
    if (!catWrapper) return;
    catWrapper.innerHTML = '';
    const categories = [...new Set(PRODUCTS_DATA.map(p => p.category))];
    categories.forEach(category => {
        const products = PRODUCTS_DATA.filter(p => p.category === category);
        catWrapper.appendChild(renderCategorySection(category, products));
    });
}

function renderCategorySection(category, products) {
    const section = document.createElement('div');
    section.className = 'category-section';
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    const categoryIcon = getCategoryIcon(category);
    section.innerHTML = `
        <div class="category-header">
            <h3 class="category-title">${categoryIcon} ${categoryName}</h3>
            <button class="btn-primary" style="padding:0.5rem 1rem;font-size:0.9rem;">View All (${products.length})</button>
        </div>
        <div class="products-grid"></div>
    `;
    renderProducts(products, section.querySelector('.products-grid'));
    return section;
}

function renderProducts(products, grid) {
    grid.innerHTML = '';
    products.forEach(product => {
        grid.appendChild(createProductCard(product));
    });
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';

    const accountTypes = Object.keys(product.pricing);
    const defaultType = accountTypes[0];
    const durations = Object.keys(product.pricing[defaultType]);
    const accountTypesHTML = accountTypes.map(type =>
        `<button class="account-btn" onclick="selectAccountType('${product.id}', '${type}')">${type}</button>`
    ).join('');
    const durationsHTML = durations.map(dur =>
        `<button class="duration-btn" onclick="selectDuration('${product.id}', '${defaultType}', '${dur}')">${dur}</button>`
    ).join('');

    card.innerHTML = `
        <div class="product-image">${product.icon}</div>
        <div class="product-info">
            <div class="product-name">${product.name}</div>
            <div class="product-badges">
                <span class="badge ${product.stock > 0 ? 'badge-stock' : 'badge-out'}">
                    ${product.stock > 0 ? product.stock + ' available' : 'Out of stock'}
                </span>
                <span class="badge badge-sold">${product.sold} sold</span>
            </div>
            <div class="account-types" id="${product.id}-types">${accountTypesHTML}</div>
            <div class="duration-label">Duration:</div>
            <div class="duration-scroll" id="${product.id}-durations">${durationsHTML}</div>
            <div class="price-display" id="${product.id}-price">
                <em style="color:#999;font-size:0.9rem;">Select account type & duration</em>
            </div>
            <button class="btn-checkout" disabled id="${product.id}-checkout">Select Options First</button>
        </div>
    `;
    return card;
}

// --- Product Selection ---
window.selectAccountType = function(productId, type) {
    const product = PRODUCTS_DATA.find(p => p.id === productId);
    if (!product) return;

    document.querySelectorAll(`#${productId}-types .account-btn`).forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    const durations = Object.keys(product.pricing[type]);
    const durationsContainer = document.getElementById(`${productId}-durations`);
    durationsContainer.innerHTML = durations.map(dur =>
        `<button class="duration-btn" onclick="selectDuration('${productId}', '${type}', '${dur}')">${dur}</button>`
    ).join('');

    selectedProducts[productId] = { type, duration: null, price: null };
    document.getElementById(`${productId}-price`).innerHTML = '<em style="color:#999;font-size:0.9rem;">Select duration</em>';
    document.getElementById(`${productId}-checkout`).disabled = true;
};

window.selectDuration = function(productId, type, duration) {
    const product = PRODUCTS_DATA.find(p => p.id === productId);
    if (!product) return;
    const price = product.pricing[type][duration];

    document.querySelectorAll(`#${productId}-durations .duration-btn`).forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById(`${productId}-price`).innerHTML = `₱${price}`;
    const checkoutBtn = document.getElementById(`${productId}-checkout`);
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = 'Checkout';
    checkoutBtn.onclick = () => checkout(productId, type, duration, price);

    selectedProducts[productId] = { type, duration, price };
};

// --- Checkout ---
function checkout(productId, type, duration, price) {
    if (!getCurrentUser()) {
        alert('Please login first to checkout');
        return;
    }
    const product = PRODUCTS_DATA.find(p => p.id === productId);
    const confirmed = confirm(`Proceed to checkout?\n\nProduct: ${product.name}\nType: ${type}\nDuration: ${duration}\nPrice: ₱${price}`);
    if (confirmed) {
        alert(`Order created!\n\nPlease proceed to payment.`);
    }
}

// --- Search ---
function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const allProducts = document.querySelectorAll('.product-card');
    allProducts.forEach(card => {
        const productName = card.querySelector('.product-name').textContent.toLowerCase();
        card.style.display = productName.includes(query) ? 'block' : 'none';
    });
}

// --- Helpers ---
function getCategoryIcon(category) {
    const icons = {
        'entertainment': '🎬',
        'streaming': '🎵',
        'ai': '🧠',
        'educational': '📚',
        'editing': '🎨'
    };
    return icons[category] || '📦';
}
