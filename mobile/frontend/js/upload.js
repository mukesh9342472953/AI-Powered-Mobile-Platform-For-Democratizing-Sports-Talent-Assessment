let currentVideoFile = null;

document.addEventListener("DOMContentLoaded", () => {
    if (typeof renderBottomNav === 'function') {
        renderBottomNav('assessment'); 
    }
    loadVideos();
    loadAssessmentHistory();
});

function previewVideo(e) {
    const file = e.target.files[0];
    const player = document.getElementById('video-preview-player');
    const uploadBtn = document.getElementById('upload-btn');
    const msg = document.getElementById('upload-msg');
    
    if (file) {
        // Validate Format natively
        const allowed = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        
        if (!allowed.includes(ext) && !file.type.startsWith('video/')) {
            msg.textContent = 'Unsupported format. Use mp4, mov, avi, mkv, or webm.';
            msg.style.color = '#f87171';
            currentVideoFile = null;
            uploadBtn.disabled = true;
            return;
        }

        // Validate Size (1GB = 1024*1024*1024)
        if (file.size > 1073741824) {
            msg.textContent = 'File too large. Maximum size is 1GB.';
            msg.style.color = '#f87171';
            currentVideoFile = null;
            uploadBtn.disabled = true;
            return;
        }

        msg.textContent = '';
        currentVideoFile = file;
        const objectUrl = URL.createObjectURL(file);
        player.src = objectUrl;
        player.style.display = 'block';
        uploadBtn.disabled = false;
    } else {
        msg.textContent = 'No file selected.';
        msg.style.color = '#f87171';
        currentVideoFile = null;
        player.src = '';
        player.style.display = 'none';
        uploadBtn.disabled = true;
    }
}

function uploadVideo(e) {
    e.preventDefault();
    if (!currentVideoFile) return;

    const msg = document.getElementById('upload-msg');
    const btn = document.getElementById('upload-btn');
    
    msg.textContent = 'Preparing upload...';
    msg.style.color = 'var(--text-secondary)';
    btn.disabled = true;

    const formData = new FormData();
    formData.append('video', currentVideoFile);
    const token = localStorage.getItem('token');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/videos/upload`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = function(event) {
        if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            msg.textContent = `Uploading ${percentComplete}%`;
        }
    };

    xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
            msg.textContent = 'Upload successful!';
            msg.style.color = '#34d399';
            
            document.getElementById('upload-form').reset();
            document.getElementById('video-preview-player').style.display = 'none';
            document.getElementById('video-preview-player').src = '';
            currentVideoFile = null;
            
            loadVideos();
            setTimeout(() => { msg.textContent = ''; }, 3000);
        } else {
            let errorMsg = 'Upload failed';
            try {
                const res = JSON.parse(xhr.responseText);
                errorMsg = res.message || errorMsg;
            } catch (e) {}
            msg.textContent = errorMsg;
            msg.style.color = '#f87171';
            btn.disabled = false;
        }
    };

    xhr.onerror = function() {
        msg.textContent = 'Network error during upload.';
        msg.style.color = '#f87171';
        btn.disabled = false;
    };

    xhr.send(formData);
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

async function loadVideos() {
    const list = document.getElementById('videos-list');
    try {
        const res = await apiFetch('/videos');
        const data = await res.json();
        
        if (!res.ok) throw new Error();

        if (data.length === 0) {
            list.innerHTML = '<div style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 20px 0;">No videos uploaded yet.</div>';
            return;
        }

        let html = '';
        data.forEach(v => {
            const date = new Date(v.uploaded_at).toLocaleDateString();
            const fileUrl = API_BASE_URL.replace('/api', '') + v.filepath;
            const sizeStr = formatBytes(v.filesize);
            
            html += `
                <div class="video-item" id="video-${v.id}">
                    <div style="display: flex; align-items: center; flex: 1; overflow: hidden; cursor: pointer;" onclick="playVideo('${fileUrl}')">
                        <div class="video-item-thumbnail">
                            <i data-lucide="play-circle"></i>
                        </div>
                        <div class="video-item-info">
                            <div class="video-item-title">${v.original_name || v.filename}</div>
                            <div class="video-item-date">${date} • ${sizeStr}</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button onclick="assessVideo(${v.id})" class="btn" style="padding: 6px 10px; margin: 0; font-size: 11px;">Assess AI</button>
                        <button onclick="deleteVideo(${v.id})" style="background: none; border: none; color: #f87171; cursor: pointer; padding: 8px;">
                            <i data-lucide="trash-2" style="width: 18px; height: 18px;"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
    } catch (e) {
        list.innerHTML = '<div style="color: #f87171; font-size: 13px;">Failed to load videos.</div>';
    }
}

async function loadAssessmentHistory() {
    const list = document.getElementById('history-list');
    if (!list) return; // if UI doesn't have it yet

    try {
        const res = await apiFetch('/assessments/history');
        const data = await res.json();
        
        if (!res.ok) throw new Error();

        if (data.length === 0) {
            list.innerHTML = '<div style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 20px 0;">No assessments taken yet.</div>';
            return;
        }

        let html = '';
        data.forEach(a => {
            const date = new Date(a.date).toLocaleDateString();
            html += `
                <div class="card" style="padding: 12px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div>
                            <div style="font-weight: 600; font-size: 14px;">Score: <span style="color: var(--primary); font-size: 16px;">${a.score}%</span></div>
                            <div style="font-size: 11px; color: var(--text-muted);">${a.original_name || 'Video Analysis'}</div>
                        </div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${date}</div>
                    </div>
                    <div style="display: flex; gap: 8px; font-size: 10px; color: var(--text-secondary); flex-wrap: wrap;">
                        <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">SPD: ${a.speed}</span>
                        <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">AGI: ${a.agility}</span>
                        <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">FIT: ${a.fitness}</span>
                        <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">BAL: ${a.balance}</span>
                        <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">END: ${a.endurance}</span>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;
    } catch (e) {
        list.innerHTML = '<div style="color: #f87171; font-size: 13px;">Failed to load history.</div>';
    }
}

async function deleteVideo(id) {
    if (!confirm('Are you sure you want to delete this video?')) return;
    
    try {
        const res = await apiFetch(`/videos/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Failed to delete');
        }
        
        const el = document.getElementById(`video-${id}`);
        if (el) el.remove();
        
        const list = document.getElementById('videos-list');
        if (list.children.length === 0) {
            list.innerHTML = '<div style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 20px 0;">No videos uploaded yet.</div>';
        }
    } catch (e) {
        alert(e.message);
    }
}

async function assessVideo(id) {
    const list = document.getElementById('videos-list');
    const originalHtml = list.innerHTML;
    list.innerHTML = '<div class="processing-ring-container"><div class="loader-ring"></div><div class="pulse-text">AI is analyzing mechanics...</div></div>';
    
    try {
        const res = await apiFetch(`/assessments/analyze/${id}`, { method: 'POST' });
        const data = await res.json();
        
        if (!res.ok) {
            if (data.status === 'Rejected') {
                list.innerHTML = originalHtml;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                showValidationModal(data.selectedSport, data.detectedSport);
                return;
            }
            throw new Error(data.message || 'Assessment failed');
        }
        
        // Success verified display
        list.innerHTML = `
            <div class="processing-ring-container" style="text-align: center; padding: 20px;">
                <div style="color: #34d399; font-size: 48px; margin-bottom: 12px;"><i data-lucide="check-circle" style="width: 48px; height: 48px; stroke: #34d399;"></i></div>
                <h3 style="color: white; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; gap: 6px;">✓ Sport Verified</h3>
                <p style="color: var(--text-secondary); font-size: 13.5px; margin-bottom: 12px;">${data.assessment.sport} video detected successfully.</p>
                <p style="color: var(--text-secondary); font-size: 13.5px; margin-bottom: 16px; font-weight: 500;">Starting AI Assessment...</p>
                <div class="loader-ring" style="width: 24px; height: 24px; border-width: 2px; margin: 0 auto;"></div>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        setTimeout(() => {
            alert(`Assessment complete! You scored ${data.assessment.score}%. Check your dashboard.`);
            window.location.href = 'dashboard.html';
        }, 2000);
        
    } catch (e) {
        alert(e.message);
        loadVideos(); // revert UI on failure
    }
}

function showValidationModal(selected, detected) {
    document.getElementById('val-selected-sport').textContent = selected;
    document.getElementById('val-detected-sport').textContent = detected;
    document.getElementById('val-expected-sport').textContent = selected;
    document.getElementById('validation-modal').style.display = 'block';
    document.getElementById('validation-overlay').style.display = 'block';
}

function closeValidationModal() {
    document.getElementById('validation-modal').style.display = 'none';
    document.getElementById('validation-overlay').style.display = 'none';
}

function triggerUploadInput() {
    closeValidationModal();
    const fileInput = document.getElementById('video-file');
    if (fileInput) {
        fileInput.scrollIntoView({ behavior: 'smooth' });
        fileInput.click();
    }
}

function playVideo(url) {
    const player = document.getElementById('video-preview-player');
    player.src = url;
    player.style.display = 'block';
    player.play();
    player.scrollIntoView({ behavior: 'smooth' });
}
