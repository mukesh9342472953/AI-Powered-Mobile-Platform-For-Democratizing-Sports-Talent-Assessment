let currentTab = 'search';
let lastSearchParams = '';

document.addEventListener("DOMContentLoaded", () => {
    if (typeof renderBottomNav === 'function') {
        renderBottomNav('dashboard');
    }
    // Load favorites on startup if we are on favorites tab, else just wait for search
    if (currentTab === 'favorites') {
        loadFavorites();
    }
});

function switchTab(tab) {
    currentTab = tab;
    const btnSearch = document.getElementById('tab-search');
    const btnFav = document.getElementById('tab-favorites');
    const searchContainer = document.getElementById('search-container');
    const resultsDiv = document.getElementById('search-results');

    if (tab === 'search') {
        btnSearch.classList.add('active');
        btnFav.classList.remove('active');
        searchContainer.style.display = 'block';
        if (lastSearchParams) {
            // we could re-run search here or just let the old results stay
            // For now, let's just keep the existing HTML in resultsDiv unless it's empty
            if (resultsDiv.innerHTML.trim() === '') {
                resultsDiv.innerHTML = '<div style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 20px 0;">Use the form above to scout athletes.</div>';
            }
        } else {
            resultsDiv.innerHTML = '<div style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 20px 0;">Use the form above to scout athletes.</div>';
        }
    } else {
        btnSearch.classList.remove('active');
        btnFav.classList.add('active');
        searchContainer.style.display = 'none';
        loadFavorites();
    }
}

async function executeSearch(e) {
    e.preventDefault();
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '<div class="loader-ring" style="margin: 20px auto; width: 30px; height: 30px; border-width: 3px;"></div>';
    
    try {
        const sport = document.getElementById('s-sport').value;
        const min = document.getElementById('s-min-score').value;
        const max = document.getElementById('s-max-age').value;
        const st = document.getElementById('s-state').value;
        
        let query = `sport=${sport}`;
        if (min) query += `&minScore=${min}`;
        if (max) query += `&maxAge=${max}`;
        if (st) query += `&state=${st}`;

        lastSearchParams = query;

        const res = await apiFetch(`/recruitment/search?${query}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error();

        renderAthletes(data, resultsDiv, 'No athletes found matching criteria.');
        
    } catch (e) {
        resultsDiv.innerHTML = '<div style="color: #f87171; font-size: 13px; text-align: center; padding: 20px 0;">Search failed. Please try again.</div>';
    }
}

async function loadFavorites() {
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '<div class="loader-ring" style="margin: 20px auto; width: 30px; height: 30px; border-width: 3px;"></div>';
    
    try {
        const res = await apiFetch(`/recruitment/favorites`);
        const data = await res.json();
        
        if (!res.ok) throw new Error();

        renderAthletes(data, resultsDiv, 'You have not saved any favorites yet.');
        
    } catch (e) {
        resultsDiv.innerHTML = '<div style="color: #f87171; font-size: 13px; text-align: center; padding: 20px 0;">Failed to load favorites.</div>';
    }
}

function renderAthletes(data, container, emptyMsg) {
    if (data.length === 0) {
        container.innerHTML = `<div style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 20px 0;">${emptyMsg}</div>`;
        return;
    }

    let html = '';
    data.forEach(ath => {
        const favClass = ath.is_favorite ? 'active' : '';
        html += `
            <div class="card" id="athlete-card-${ath.id}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: white;">${ath.name}</div>
                        <div style="font-size: 13px; color: var(--text-secondary);">${ath.sport} | Age: ${ath.age || 'N/A'}</div>
                        <div style="font-size: 12px; color: var(--text-muted);">${ath.state || 'Unknown Location'}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 18px; font-weight: 800; color: var(--accent-primary);">${ath.best_score || 'N/A'}</div>
                        <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase;">Score</div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="openContact(${ath.id})" class="btn" style="flex: 1; font-size: 13px; padding: 8px; margin: 0; display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <i data-lucide="message-square" style="width: 16px; height: 16px;"></i> Contact
                    </button>
                    <button id="fav-btn-${ath.id}" onclick="toggleFavorite(${ath.id})" class="fav-btn ${favClass}" style="width: 40px; margin: 0;" title="Save to Favorites">
                        <i data-lucide="star" style="width: 18px; height: 18px;"></i>
                    </button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function toggleFavorite(athleteId) {
    const btn = document.getElementById(`fav-btn-${athleteId}`);
    // Optimistic UI update
    const isCurrentlyFav = btn.classList.contains('active');
    
    if (isCurrentlyFav) {
        btn.classList.remove('active');
    } else {
        btn.classList.add('active');
    }

    try {
        const res = await apiFetch('/recruitment/favorites', {
            method: 'POST',
            body: JSON.stringify({ athlete_id: athleteId })
        });
        
        if (!res.ok) throw new Error('Failed to toggle');

        // If we are on the favorites tab and we just un-favorited someone, remove their card
        if (currentTab === 'favorites' && isCurrentlyFav) {
            const card = document.getElementById(`athlete-card-${athleteId}`);
            if (card) {
                card.remove();
            }
            // Check if empty
            const resultsDiv = document.getElementById('search-results');
            if (resultsDiv.children.length === 0) {
                resultsDiv.innerHTML = `<div style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 20px 0;">You have not saved any favorites yet.</div>`;
            }
        }
        
    } catch (e) {
        // Revert UI on failure
        if (isCurrentlyFav) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
        alert('Could not update favorites. Check connection.');
    }
}

function openContact(id) {
    document.getElementById('contact-modal').style.display = 'block';
    document.getElementById('modal-overlay').style.display = 'block';
    document.getElementById('c-athlete-id').value = id;
    document.getElementById('c-msg').textContent = '';
    document.getElementById('c-message').value = '';
}

function closeContact() {
    document.getElementById('contact-modal').style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
}

async function sendContact(e) {
    e.preventDefault();
    const msg = document.getElementById('c-msg');
    msg.textContent = 'Sending...';
    msg.style.color = 'var(--text-secondary)';
    
    try {
        const res = await apiFetch('/recruitment/contact', {
            method: 'POST',
            body: JSON.stringify({
                athlete_id: parseInt(document.getElementById('c-athlete-id').value),
                message: document.getElementById('c-message').value
            })
        });
        
        if (res.ok) {
            msg.textContent = 'Request sent successfully!';
            msg.style.color = '#34d399';
            setTimeout(() => closeContact(), 1500);
        } else {
            const data = await res.json();
            throw new Error(data.message || 'Failed to send');
        }
    } catch (e) {
        msg.textContent = e.message || 'Connection error';
        msg.style.color = '#f87171';
    }
}
