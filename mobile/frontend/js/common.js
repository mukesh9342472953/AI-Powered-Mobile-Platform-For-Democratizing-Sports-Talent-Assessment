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

// Global 30 Sports Array
const SPORTS_LIST = [
    { name: "Cricket", emoji: "🏏" },
    { name: "Football", emoji: "⚽" },
    { name: "Tennis", emoji: "🎾" },
    { name: "Badminton", emoji: "🏸" },
    { name: "Athletics", emoji: "🏃" },
    { name: "Basketball", emoji: "🏀" },
    { name: "Volleyball", emoji: "🏐" },
    { name: "Hockey", emoji: "🏑" },
    { name: "Table Tennis", emoji: "🏓" },
    { name: "Kabaddi", emoji: "🤼" },
    { name: "Swimming", emoji: "🏊" },
    { name: "Boxing", emoji: "🥊" },
    { name: "Wrestling", emoji: "🤼" },
    { name: "Archery", emoji: "🏹" },
    { name: "Shooting", emoji: "🔫" },
    { name: "Chess", emoji: "♟️" },
    { name: "Rugby", emoji: "🏉" },
    { name: "Handball", emoji: "🤾" },
    { name: "Cycling", emoji: "🚴" },
    { name: "Gymnastics", emoji: "🤸" },
    { name: "Weightlifting", emoji: "🏋️" },
    { name: "Taekwondo", emoji: "🥋" },
    { name: "Karate", emoji: "🥋" },
    { name: "Judo", emoji: "🥋" },
    { name: "Fencing", emoji: "🤺" },
    { name: "Skating", emoji: "⛸️" },
    { name: "Surfing", emoji: "🏄" },
    { name: "Baseball", emoji: "⚾" },
    { name: "Softball", emoji: "🥎" },
    { name: "Golf", emoji: "⛳" }
].sort((a, b) => a.name.localeCompare(b.name));

// Reusable Searchable Dropdown Builder
function setupSearchableDropdown(selectId, includeAllOption = false) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;

    // Save initial selected value if any
    const initialVal = selectEl.value;

    // Populate original select options
    selectEl.innerHTML = '';
    if (includeAllOption) {
        const opt = document.createElement('option');
        opt.value = 'all';
        opt.textContent = 'All Sports';
        selectEl.appendChild(opt);
    }
    SPORTS_LIST.forEach(sp => {
        const opt = document.createElement('option');
        opt.value = sp.name;
        opt.textContent = sp.name;
        selectEl.appendChild(opt);
    });

    // Set initial value
    if (initialVal) {
        selectEl.value = initialVal;
    } else {
        selectEl.selectedIndex = 0;
    }

    // Hide original select
    selectEl.style.display = 'none';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';

    // Get current option details
    const currentOptionText = selectEl.options[selectEl.selectedIndex] ? selectEl.options[selectEl.selectedIndex].text : 'Select Sport';
    const activeSportObj = SPORTS_LIST.find(s => s.name === selectEl.value);
    const initialEmoji = activeSportObj ? activeSportObj.emoji : '🎯';

    // Create trigger button
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    trigger.innerHTML = `
        <span class="selected-text"><span class="sport-emoji">${initialEmoji}</span> ${currentOptionText}</span>
        <i data-lucide="chevron-down" style="width: 16px; height: 16px;"></i>
    `;
    wrapper.appendChild(trigger);

    // Create dropdown menu
    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'custom-select-dropdown';

    // Create search field
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'custom-select-search';
    searchInput.placeholder = 'Search sport...';
    dropdownMenu.appendChild(searchInput);

    // Create options list container
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-select-options';

    // Populating options
    const allOptions = [];
    if (includeAllOption) {
        const optionItem = document.createElement('div');
        optionItem.className = 'custom-select-option' + (selectEl.value === 'all' ? ' selected' : '');
        optionItem.dataset.value = 'all';
        optionItem.innerHTML = `<span class="sport-emoji">🌐</span> All Sports`;
        optionsContainer.appendChild(optionItem);
        allOptions.push(optionItem);
    }

    SPORTS_LIST.forEach(sp => {
        const optionItem = document.createElement('div');
        optionItem.className = 'custom-select-option' + (selectEl.value === sp.name ? ' selected' : '');
        optionItem.dataset.value = sp.name;
        optionItem.innerHTML = `<span class="sport-emoji">${sp.emoji}</span> ${sp.name}`;
        optionsContainer.appendChild(optionItem);
        allOptions.push(optionItem);
    });

    dropdownMenu.appendChild(optionsContainer);
    wrapper.appendChild(dropdownMenu);

    // Insert wrapper in DOM
    selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);

    // Toggle dropdown visibility
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdownMenu.classList.contains('show');
        // Close all other dropdowns
        document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.remove('show'));
        if (!isOpen) {
            dropdownMenu.classList.add('show');
            searchInput.focus();
        }
    });

    // Handle option click
    allOptions.forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            allOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            
            const val = opt.dataset.value;
            selectEl.value = val;
            
            const emojiText = opt.querySelector('.sport-emoji').textContent;
            trigger.querySelector('.selected-text').innerHTML = `<span class="sport-emoji">${emojiText}</span> ${opt.textContent.replace(emojiText, '').trim()}`;
            
            dropdownMenu.classList.remove('show');
            // Trigger change event on original select
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });

    // Handle search filtering
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        allOptions.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            if (text.includes(query)) {
                opt.style.display = 'flex';
            } else {
                opt.style.display = 'none';
            }
        });
    });

    // Close on click away
    document.addEventListener('click', () => {
        dropdownMenu.classList.remove('show');
    });

    // Trigger update if lucide icons need rendering
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

