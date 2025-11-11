// Authentication Functions

function getCurrentUser() {
    return JSON.parse(localStorage.getItem('user') || 'null');
}

function setCurrentUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Simple auth (expand with Supabase as needed)
function login(email, password) {
    // Demo: Just save user
    const user = {
        email: email,
        id: Date.now(),
        name: email.split('@')[0]
    };
    setCurrentUser(user);
    return user;
}

function signup(email, password) {
    return login(email, password);
}

// Check if user is logged in
function checkAuth() {
    const user = getCurrentUser();
    if (user) {
        document.getElementById('auth-section')?.style.setProperty('display', 'none');
        document.getElementById('user-section')?.style.setProperty('display', 'flex');
    }
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
} else {
    checkAuth();
}
