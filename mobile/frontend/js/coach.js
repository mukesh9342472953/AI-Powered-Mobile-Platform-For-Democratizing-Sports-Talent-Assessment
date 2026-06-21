let allAthletes = [];

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof renderBottomNav === 'function') {
        renderBottomNav('dashboard'); 
    }
    await loadAthletes();
});

async function loadAthletes() {
    const list = document.getElementById('athletes-list');
    try {
        const res = await apiFetch('/coaches/athletes');
        const data = await res.json();
        
        if (!res.ok) throw new Error();

        allAthletes = data; // Store globally for filtering
        renderAthletesList(allAthletes);
        
    } catch (e) {
        list.innerHTML = '<div style="color: #f87171; font-size: 13px;">Failed to load athletes.</div>';
    }
}

function filterAthletes() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const sportFilter = document.getElementById('filter-sport').value;
    
    const filtered = allAthletes.filter(ath => {
        const matchesSearch = ath.name.toLowerCase().includes(searchTerm) || 
                              (ath.district && ath.district.toLowerCase().includes(searchTerm));
        const matchesSport = sportFilter === "" || ath.sport === sportFilter;
        return matchesSearch && matchesSport;
    });
    
    renderAthletesList(filtered);
}

function renderAthletesList(athletes) {
    const list = document.getElementById('athletes-list');
    
    if (athletes.length === 0) {
        list.innerHTML = '<div style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 20px 0;">No athletes found.</div>';
        return;
    }

    let html = '';
    athletes.forEach(ath => {
        const scoreDisplay = ath.best_score ? `<span style="color: var(--accent-primary); font-weight: 600;">Score: ${ath.best_score}</span>` : '<span style="color: var(--text-muted);">No score yet</span>';
        
        html += `
            <div class="athlete-card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: white;">${ath.name}</div>
                        <div style="font-size: 13px; color: var(--text-muted);">${ath.sport || 'Athlete'} • ${ath.district || 'Unknown Location'}</div>
                    </div>
                    <div style="font-size: 12px;">
                        ${scoreDisplay}
                    </div>
                </div>
                
                <div style="display: flex; gap: 8px;">
                    <button onclick="viewProgress(${ath.id})" class="btn btn-outline" style="flex: 1; padding: 8px; font-size: 12px; margin: 0;">Track Progress</button>
                    <button onclick="openFeedback(${ath.id}, '${ath.name.replace(/'/g, "\\'")}')" class="btn" style="flex: 1; padding: 8px; font-size: 12px; margin: 0;">Review</button>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
    
    // re-init lucide icons for newly added elements
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function viewProgress(id) {
    // For a real app, this would route to an athlete detail page. 
    // We will just alert for now or implement a quick modal if requested later.
    alert('Tracking progress for Athlete ID: ' + id + ' (Feature coming soon)');
}

function openFeedback(id, name) {
    const modal = document.getElementById('feedback-modal');
    modal.style.display = 'flex'; // Use flex for centering
    
    document.getElementById('fb-athlete-id').value = id;
    document.getElementById('fb-athlete-name').textContent = name;
    document.getElementById('fb-comments').value = '';
    document.getElementById('fb-msg').textContent = '';
    setRating(5); // Default rating
}

function closeFeedback() {
    document.getElementById('feedback-modal').style.display = 'none';
}

function setRating(val) {
    document.getElementById('fb-rating').value = val;
    const stars = document.querySelectorAll('#star-rating i');
    
    stars.forEach(star => {
        const starVal = parseInt(star.getAttribute('data-val'));
        if (starVal <= val) {
            star.style.fill = '#fbbf24'; // filled
            star.style.color = '#fbbf24';
        } else {
            star.style.fill = 'transparent'; // empty
            star.style.color = 'var(--text-muted)';
        }
    });
}

async function submitFeedback(e) {
    e.preventDefault();
    const msg = document.getElementById('fb-msg');
    msg.textContent = 'Submitting review...';
    msg.style.color = 'var(--text-secondary)';
    
    try {
        const res = await apiFetch('/coaches/feedback', {
            method: 'POST',
            body: JSON.stringify({
                athlete_id: parseInt(document.getElementById('fb-athlete-id').value),
                rating: parseFloat(document.getElementById('fb-rating').value),
                feedback: document.getElementById('fb-comments').value
            })
        });
        
        if (res.ok) {
            msg.textContent = 'Review saved successfully!';
            msg.style.color = '#34d399';
            setTimeout(() => {
                closeFeedback();
            }, 1500);
        } else {
            const data = await res.json();
            throw new Error(data.message || 'Failed to submit');
        }
    } catch (e) {
        msg.textContent = e.message || 'Connection error';
        msg.style.color = '#f87171';
    }
}
