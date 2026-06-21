let currentLevel = 'district';
let currentPage = 1;
const limit = 20;
let searchTimeout = null;
let currentData = [];

document.addEventListener("DOMContentLoaded", () => {
    if (typeof renderBottomNav === 'function') {
        renderBottomNav('rankings'); 
    }
    fetchLeaderboard();
});

function setFilter(level) {
    currentLevel = level;
    document.getElementById('btn-district').className = 'toggle-btn';
    document.getElementById('btn-state').className = 'toggle-btn';
    document.getElementById('btn-national').className = 'toggle-btn';
    document.getElementById('btn-' + level).className = 'toggle-btn active';
    
    resetAndFetch();
}

function debounceSearch() {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        resetAndFetch();
    }, 400); // 400ms debounce
}

function resetAndFetch() {
    currentPage = 1;
    currentData = [];
    document.getElementById('leaderboard-content').innerHTML = `
        <div class="loader-ring" style="margin: 40px auto; width: 30px; height: 30px; border-width: 3px;"></div>
    `;
    document.getElementById('load-more-btn').style.display = 'none';
    fetchLeaderboard();
}

function loadMore() {
    currentPage++;
    fetchLeaderboard(true);
}

async function fetchLeaderboard(isLoadMore = false) {
    const sport = document.getElementById('leaderboard-sport').value;
    const sort = document.getElementById('leaderboard-sort').value;
    const age = document.getElementById('leaderboard-age').value;
    const search = document.getElementById('leaderboard-search').value || '';
    
    try {
        const queryParams = new URLSearchParams({
            sport: sport,
            level: currentLevel,
            sortBy: sort,
            age: age,
            search: search,
            page: currentPage,
            limit: limit
        });

        const res = await apiFetch(`/leaderboard?${queryParams.toString()}`);
        const result = await res.json();
        
        if (!res.ok || !result.success) throw new Error(result.message || 'Failed to fetch leaderboard');

        const athletes = result.rankings || [];
        
        if (!isLoadMore) {
            currentData = [];
            document.getElementById('leaderboard-content').innerHTML = '';
        }

        if (athletes.length === 0 && currentData.length === 0) {
            document.getElementById('leaderboard-content').innerHTML = `
                <div style="padding: 30px 20px; text-align: center; color: var(--text-secondary);">
                    <i data-lucide="users" style="width: 40px; height: 40px; color: var(--text-muted); margin-bottom: 12px;"></i>
                    <div>No rankings available</div>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            document.getElementById('load-more-btn').style.display = 'none';
            return;
        }

        currentData = [...currentData, ...athletes];
        renderAthletes(athletes);
        
        // Show or hide Load More button
        if (result.hasMore) {
            document.getElementById('load-more-btn').style.display = 'block';
            document.getElementById('load-more-btn').textContent = 'Load More';
        } else {
            document.getElementById('load-more-btn').style.display = 'none';
        }
        
    } catch (e) {
        if (!isLoadMore) {
            document.getElementById('leaderboard-content').innerHTML = `
                <div style="padding: 20px; color: #f87171; text-align: center;">Unable to load leaderboard. Please try again.</div>
            `;
        }
    }
}

function renderAthletes(athletes) {
    const container = document.getElementById('leaderboard-content');
    
    let html = '';
    athletes.forEach(athlete => {
        let rankClass = '';
        if (athlete.active_rank === 1) rankClass = 'first';
        else if (athlete.active_rank === 2) rankClass = 'second';
        else if (athlete.active_rank === 3) rankClass = 'third';

        let scoreVal = athlete.overall_score;
        const sort = document.getElementById('leaderboard-sort').value;
        if (sort === 'speed') scoreVal = athlete.speed_score;
        if (sort === 'fitness') scoreVal = athlete.fitness_score;

        const photoHtml = athlete.profile_photo 
            ? `<img src="${API_BASE_URL.replace('/api', '')}${athlete.profile_photo}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
            : athlete.athlete_name.charAt(0).toUpperCase();

        const locStr = [athlete.district, athlete.state].filter(Boolean).join(', ');

        html += `
            <div class="leader-item">
                <div class="leader-rank ${rankClass}">#${athlete.active_rank}</div>
                <div class="leader-avatar">${photoHtml}</div>
                <div class="leader-info">
                    <div class="leader-name">${athlete.athlete_name} <span style="font-size: 11px; color: var(--text-muted); font-weight: normal; margin-left: 4px;">(${athlete.age}y)</span></div>
                    <div class="leader-loc">${locStr}</div>
                </div>
                <div class="leader-score">${scoreVal}</div>
            </div>
        `;
    });
    
    container.insertAdjacentHTML('beforeend', html);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
