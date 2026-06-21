let currentUser = null;
let currentDetails = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof renderBottomNav === 'function') renderBottomNav('profile');
    
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    currentUser = JSON.parse(userStr);
    
    document.getElementById('profile-name').textContent = currentUser.name;
    document.getElementById('profile-email').textContent = currentUser.email;
    
    const roleBadge = document.getElementById('profile-role');
    roleBadge.textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    roleBadge.className = `role-badge ${currentUser.role}`;

    await loadProfileDetails();
});

async function loadProfileDetails() {
    const fieldsContainer = document.getElementById('dynamic-profile-fields');
    try {
        const res = await apiFetch('/profile');
        const data = await res.json();
        
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load profile');

        const userData = data.user;
        currentUser = userData;
        localStorage.setItem('user', JSON.stringify({
            id: userData.id,
            name: userData.name,
            email: userData.email,
            role: userData.role,
            profile_photo: userData.profile_photo
        }));
        
        currentDetails = userData.details || {};
        
        document.getElementById('profile-name').textContent = currentUser.name;
        document.getElementById('profile-email').textContent = currentUser.email;

        renderFormFields(fieldsContainer);
        updateProfilePhotoDisplay();
        
    } catch (e) {
        fieldsContainer.innerHTML = `<div style="color: #f87171; font-size: 13px; text-align: center; padding: 20px;">Unable to load profile. Please try again.</div>`;
    }
}

function renderFormFields(container) {
    let html = `
        <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="edit-name" class="form-input" value="${currentUser.name || ''}" required>
        </div>
        <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="edit-email" class="form-input" value="${currentUser.email || ''}" required>
        </div>
        <hr style="border-color: var(--border-color); margin: 16px 0;">
    `;
    
    if (currentUser.role === 'athlete') {
        html += `
            <div class="form-group">
                <label class="form-label">Sport</label>
                <input type="text" id="edit-sport" class="form-input" value="${currentDetails.sport || ''}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Age</label>
                    <input type="number" id="edit-age" class="form-input" value="${currentDetails.age || ''}" min="5" max="100">
                </div>
                <div class="form-group">
                    <label class="form-label">Gender</label>
                    <select id="edit-gender" class="form-select">
                        <option value="Male" ${currentDetails.gender === 'Male' ? 'selected' : ''}>Male</option>
                        <option value="Female" ${currentDetails.gender === 'Female' ? 'selected' : ''}>Female</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">District</label>
                    <input type="text" id="edit-district" class="form-input" value="${currentDetails.district || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">State</label>
                    <input type="text" id="edit-state" class="form-input" value="${currentDetails.state || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Height (cm)</label>
                    <input type="number" id="edit-height" class="form-input" value="${currentDetails.height || ''}" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Weight (kg)</label>
                    <input type="number" id="edit-weight" class="form-input" value="${currentDetails.weight || ''}" step="0.1">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Achievements</label>
                <textarea id="edit-achievements" class="form-input" style="height: 60px;">${currentDetails.achievements || ''}</textarea>
            </div>
        `;
    } else if (currentUser.role === 'coach') {
        html += `
            <div class="form-group">
                <label class="form-label">Specialization</label>
                <input type="text" id="edit-specialization" class="form-input" value="${currentDetails.specialization || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Experience (Years)</label>
                <input type="number" id="edit-experience" class="form-input" value="${currentDetails.experience || ''}" min="0">
            </div>
        `;
    } else if (currentUser.role === 'recruiter') {
        html += `
            <div class="form-group">
                <label class="form-label">Organization</label>
                <input type="text" id="edit-org" class="form-input" value="${currentDetails.organization || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Sport Interest</label>
                <input type="text" id="edit-sport-interest" class="form-input" value="${currentDetails.sport_interest || ''}">
            </div>
        `;
    }
    
    container.innerHTML = html;
}

async function updateProfile(event) {
    event.preventDefault();
    const msg = document.getElementById('profile-msg');
    msg.textContent = 'Updating profile...';
    msg.style.color = 'var(--text-secondary)';

    try {
        let body = {
            name: document.getElementById('edit-name').value,
            email: document.getElementById('edit-email').value
        };

        if (currentUser.role === 'athlete') {
            body.sport = document.getElementById('edit-sport').value;
            body.age = parseInt(document.getElementById('edit-age').value);
            body.gender = document.getElementById('edit-gender').value;
            body.district = document.getElementById('edit-district').value;
            body.state = document.getElementById('edit-state').value;
            body.height = parseFloat(document.getElementById('edit-height').value);
            body.weight = parseFloat(document.getElementById('edit-weight').value);
            body.achievements = document.getElementById('edit-achievements').value;
        } else if (currentUser.role === 'coach') {
            body.specialization = document.getElementById('edit-specialization').value;
            body.experience = parseInt(document.getElementById('edit-experience').value);
        } else if (currentUser.role === 'recruiter') {
            body.organization = document.getElementById('edit-org').value;
            body.sport_interest = document.getElementById('edit-sport-interest').value;
        }

        const res = await apiFetch('/profile', {
            method: 'PUT',
            body: JSON.stringify(body)
        });

        const data = await res.json();
        if (res.ok) {
            msg.textContent = 'Profile updated securely!';
            msg.style.color = '#34d399';
            await loadProfileDetails(); // Refresh fully
            setTimeout(() => msg.textContent = '', 3000);
        } else {
            throw new Error(data.message || 'Update failed');
        }
    } catch (e) {
        msg.textContent = e.message || 'Connection error';
        msg.style.color = '#f87171';
    }
}

async function changePassword(event) {
    event.preventDefault();
    const msg = document.getElementById('password-msg');
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-new-password').value;

    if (newPass !== confirmPass) {
        msg.textContent = 'Passwords do not match';
        msg.style.color = '#f87171';
        return;
    }

    msg.textContent = 'Updating password...';
    msg.style.color = 'var(--text-secondary)';

    try {
        const res = await apiFetch('/profile/password', {
            method: 'PUT',
            body: JSON.stringify({ newPassword: newPass })
        });
        const data = await res.json();
        
        if (res.ok) {
            msg.textContent = 'Password updated securely';
            msg.style.color = '#34d399';
            document.getElementById('password-form').reset();
            setTimeout(() => msg.textContent = '', 3000);
        } else {
            throw new Error(data.message || 'Failed to update password');
        }
    } catch (e) {
        msg.textContent = e.message;
        msg.style.color = '#f87171';
    }
}

async function uploadProfilePicture(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    const msg = document.getElementById('profile-msg');
    msg.textContent = 'Uploading picture...';
    msg.style.color = 'var(--text-secondary)';

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/profile/image`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await res.json();
        if (res.ok) {
            msg.textContent = 'Profile picture updated';
            msg.style.color = '#34d399';
            
            currentUser.profile_photo = data.profile_photo;
            localStorage.setItem('user', JSON.stringify({
                ...currentUser,
                profile_photo: data.profile_photo
            }));
            updateProfilePhotoDisplay();

            setTimeout(() => msg.textContent = '', 3000);
        } else {
            throw new Error(data.message || 'Upload failed');
        }
    } catch(e) {
        msg.textContent = e.message;
        msg.style.color = '#f87171';
    }
}

function updateProfilePhotoDisplay() {
    if (currentUser && currentUser.profile_photo) {
        const img = document.getElementById('profile-img');
        const icon = document.getElementById('profile-icon');
        if (img && icon) {
            const backendUrl = API_BASE_URL.replace('/api', '');
            img.src = backendUrl + currentUser.profile_photo;
            img.style.display = 'block';
            icon.style.display = 'none';
        }
    }
}
