// ... existing code ...
// دوال إدارة طلبات الانضمام
function showJoinRequest(requesterName) {
    const requestDiv = document.createElement('div');
    requestDiv.className = 'join-request';
    requestDiv.setAttribute('data-name', requesterName);
    
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'btn accept';
    acceptBtn.innerHTML = '<i class="fas fa-check"></i> قبول';
    
    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'btn reject';
    rejectBtn.innerHTML = '<i class="fas fa-times"></i> رفض';
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'request-actions';
    actionsDiv.appendChild(acceptBtn);
    actionsDiv.appendChild(rejectBtn);
    
    requestDiv.innerHTML = `
        <span class="requester-name">${requesterName}</span>
    `;
    requestDiv.appendChild(actionsDiv);
    
    // إضافة event listeners
    acceptBtn.addEventListener('click', () => acceptJoinRequest(requesterName));
    rejectBtn.addEventListener('click', () => rejectJoinRequest(requesterName));
    
    requestsList.appendChild(requestDiv);
}

function removeJoinRequest(requesterName) {
    const request = requestsList.querySelector(`[data-name="${requesterName}"]`);
    if (request) {
        request.remove();
    }
}
// ... existing code ...
