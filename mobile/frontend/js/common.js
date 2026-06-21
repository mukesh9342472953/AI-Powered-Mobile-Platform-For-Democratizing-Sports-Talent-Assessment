document.addEventListener("DOMContentLoaded", () => {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    const publicPages = ['login.html', 'register.html', 'index.html', ''];
    const pathParts = window.location.pathname.split('/');
    const currentFile = pathParts[pathParts.length - 1] || 'index.html';
    
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!publicPages.includes(currentFile) && (!token || !user)) {
        window.location.href = 'login.html';
    } else if ((currentFile === 'login.html' || currentFile === 'register.html' || currentFile === 'index.html') && token && user) {
        redirectBasedOnRole(user.role);
    }
});

function redirectBasedOnRole(role) {
    if (role === 'athlete') window.location.href = 'dashboard.html';
    else if (role === 'coach') window.location.href = 'coach.html';
    else if (role === 'recruiter') window.location.href = 'recruiter.html';
    else if (role === 'admin') window.location.href = 'admin.html';
    else window.location.href = 'dashboard.html';
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

function renderBottomNav(activePage) {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    if (!user) return;
    
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    
    let navHtml = '';
    
    if (user.role === 'athlete') {
        navHtml = `
            <a href="dashboard.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
                <i data-lucide="activity"></i>
                <span>Dashboard</span>
            </a>
            <a href="assessment.html" class="nav-item ${activePage === 'assessment' ? 'active' : ''}">
                <i data-lucide="video"></i>
                <span>Assess</span>
            </a>
            <a href="leaderboard.html" class="nav-item ${activePage === 'leaderboard' ? 'active' : ''}">
                <i data-lucide="trophy"></i>
                <span>Rankings</span>
            </a>
            <a href="events.html" class="nav-item ${activePage === 'events' ? 'active' : ''}">
                <i data-lucide="calendar"></i>
                <span>Events</span>
            </a>
            <a href="profile.html" class="nav-item ${activePage === 'profile' ? 'active' : ''}">
                <i data-lucide="user"></i>
                <span>Profile</span>
            </a>
        `;
    } else if (user.role === 'coach') {
        navHtml = `
            <a href="coach.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
                <i data-lucide="activity"></i>
                <span>Athletes</span>
            </a>
            <a href="profile.html" class="nav-item ${activePage === 'profile' ? 'active' : ''}">
                <i data-lucide="user"></i>
                <span>Profile</span>
            </a>
        `;
    } else if (user.role === 'recruiter') {
        navHtml = `
            <a href="recruiter.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
                <i data-lucide="search"></i>
                <span>Search</span>
            </a>
            <a href="profile.html" class="nav-item ${activePage === 'profile' ? 'active' : ''}">
                <i data-lucide="user"></i>
                <span>Profile</span>
            </a>
        `;
    }

    nav.innerHTML = navHtml;
    
    const phoneFrame = document.querySelector('.mobile-phone-frame');
    if (phoneFrame) {
        phoneFrame.appendChild(nav);
    } else {
        document.body.appendChild(nav);
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}
