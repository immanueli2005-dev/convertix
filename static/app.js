// State Management variables
let uploadedFiles = [];
let rememberedTargetFormat = null;

// Initial Bootstrapping
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAuthSession();
  initMobileMenu();
  initUploadControls();
  initDashboardControls();
  initAuthFormControls();
});

// ==========================================
// 1. Theme Toggle System (Inversion)
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem('convertix_theme') || 'light';
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('convertix_theme', theme);
  
  // Update icons for all toggles
  const icons = document.querySelectorAll('.theme-toggle-btn i');
  icons.forEach(icon => {
    if (theme === 'dark') {
      icon.className = 'fa-solid fa-sun';
    } else {
      icon.className = 'fa-solid fa-moon';
    }
  });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
}

// ==========================================
// 2. Authentication State Displays
// ==========================================
function initAuthSession() {
  const userEmail = localStorage.getItem('convertix_user_email');
  
  const desktopSignin = document.getElementById('desktop-signin-btn');
  const desktopSignup = document.getElementById('desktop-signup-btn');
  const mobileSignin = document.getElementById('mobile-signin-btn');
  const mobileSignup = document.getElementById('mobile-signup-btn');
  
  const greeting = document.getElementById('dashboard-user-greeting');
  const clearHistoryBtn = document.getElementById('clear-history-btn');

  if (userEmail) {
    if (greeting) {
      greeting.innerHTML = `<i class="fa-solid fa-circle-user"></i> Signed in as <strong>${userEmail}</strong>. Your history is safely logged.`;
    }
    if (clearHistoryBtn) {
      clearHistoryBtn.style.display = 'inline-flex';
    }

    const navAuthDesktop = document.querySelector('.nav-auth-desktop');
    const navAuthMobile = document.querySelector('.nav-auth-mobile .nav-auth');

    const profileHTML = `
      <span style="font-weight:600; font-size:0.9rem; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        <i class="fa-solid fa-user"></i> ${userEmail.split('@')[0]}
      </span>
      <button class="btn btn-outline" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="handleSignOut()">
        <i class="fa-solid fa-arrow-right-from-bracket"></i> Sign Out
      </button>
    `;

    if (navAuthDesktop) {
      if (desktopSignin) desktopSignin.remove();
      if (desktopSignup) desktopSignup.remove();
      
      const userContainer = document.createElement('div');
      userContainer.className = 'nav-user-container';
      userContainer.style.display = 'flex';
      userContainer.style.alignItems = 'center';
      userContainer.style.gap = '0.75rem';
      userContainer.innerHTML = profileHTML;
      navAuthDesktop.appendChild(userContainer);
    }

    if (navAuthMobile) {
      navAuthMobile.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.5rem; text-align:center;">
          <span style="font-weight:600; font-size:1rem; padding: 0.5rem 0;">
            <i class="fa-solid fa-user"></i> ${userEmail}
          </span>
          <button class="btn btn-outline" style="width:100%;" onclick="handleSignOut()">
            <i class="fa-solid fa-arrow-right-from-bracket"></i> Sign Out
          </button>
        </div>
      `;
    }
  } else {
    if (greeting) {
      greeting.innerHTML = `<i class="fa-solid fa-circle-info"></i> Showing history for local guest session. <a href="signin" style="text-decoration:underline; font-weight:700;">Sign in</a> to save permanently.`;
    }
    if (clearHistoryBtn) {
      clearHistoryBtn.style.display = 'none'; // Guest cannot clear database logs on server
    }
  }
}

function handleSignOut() {
  localStorage.removeItem('convertix_user_email');
  showToast('Signed out successfully', 'info');
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// ==========================================
// 3. Toast Notifications Utility
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconClass = 'fa-circle-info';
  if (type === 'success') iconClass = 'fa-circle-check';
  if (type === 'error') iconClass = 'fa-circle-exclamation';
  if (type === 'warning') iconClass = 'fa-triangle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${iconClass}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

// ==========================================
// 4. Mobile Menu Interactivity
// ==========================================
function initMobileMenu() {
  const menuToggleBtn = document.getElementById('menu-toggle-btn');
  const navMenuList = document.getElementById('nav-menu-list');

  if (menuToggleBtn && navMenuList) {
    menuToggleBtn.addEventListener('click', () => {
      navMenuList.classList.toggle('open');
      const icon = menuToggleBtn.querySelector('i');
      if (navMenuList.classList.contains('open')) {
        icon.className = 'fa-solid fa-xmark';
      } else {
        icon.className = 'fa-solid fa-bars';
      }
    });

    document.addEventListener('click', (e) => {
      if (!menuToggleBtn.contains(e.target) && !navMenuList.contains(e.target)) {
        navMenuList.classList.remove('open');
        const icon = menuToggleBtn.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-bars';
      }
    });
  }
}

// ==========================================
// 5. Popular grid setups
// ==========================================
function setupConverter(source, target) {
  rememberedTargetFormat = target;
  
  if (uploadedFiles.length > 0) {
    uploadedFiles.forEach(item => {
      const select = document.getElementById(`target-select-${item.id}`);
      if (select) {
        select.value = target;
        item.targetExt = target;
      }
    });
    showToast(`All target conversion formats configured to ${target.toUpperCase()}`, 'success');
  } else {
    showToast(`Upload files to convert to ${target.toUpperCase()}`, 'info');
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.click();
  }
}

// ==========================================
// 6. Batch Converter Logic
// ==========================================
function initUploadControls() {
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const privacyNotice = document.getElementById('privacy-notice-box');
  
  const fileActionCard = document.getElementById('file-action-card');
  const addMoreBtn = document.getElementById('add-more-btn');
  const batchFileList = document.getElementById('batch-file-list');
  const fileCount = document.getElementById('file-count');
  
  const clearAllBtn = document.getElementById('clear-all-btn');
  const convertAllBtn = document.getElementById('convert-all-btn');
  const downloadAllBtn = document.getElementById('download-all-btn');

  if (!dropzone || !fileInput) return;

  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  addMoreBtn.addEventListener('click', () => {
    fileInput.click();
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleIncomingFiles(files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleIncomingFiles(e.target.files);
    }
  });

  // Upload files to server via POST /upload API
  async function handleIncomingFiles(fileList) {
    if (uploadedFiles.length >= 10) {
      showToast('Maximum batch size is 10 files.', 'warning');
      return;
    }

    const formData = new FormData();
    let appendCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (uploadedFiles.length + appendCount >= 10) {
        showToast('Maximum batch size is 10 files.', 'warning');
        break;
      }
      formData.append('files', file);
      appendCount++;
    }

    if (appendCount === 0) return;

    showToast('Uploading files to server...', 'info');

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        showToast(result.error || 'Failed to upload files', 'error');
        return;
      }

      // Add returned files metadata to state
      result.files.forEach(serverFile => {
        // Find matching local file to render thumbnail previews
        const localFile = Array.from(fileList).find(f => f.name === serverFile.original_name);

        let defaultTarget = 'png';
        if (rememberedTargetFormat) {
          defaultTarget = rememberedTargetFormat;
        } else {
          if (serverFile.format === 'png') defaultTarget = 'jpg';
          else defaultTarget = 'png';
        }

        uploadedFiles.push({
          id: serverFile.id, // e.g. uuid_filename.png
          file: localFile, // For previews
          originalName: serverFile.original_name,
          size: serverFile.size,
          sourceExt: serverFile.format,
          targetExt: defaultTarget,
          progress: 0,
          status: 'ready',
          downloadUrl: null,
          newFileName: null
        });
      });

      rememberedTargetFormat = null;
      showToast(`Successfully uploaded ${result.files.length} files`, 'success');
      renderFileList();

    } catch (err) {
      console.error(err);
      showToast('Network error during file uploads.', 'error');
    }
  }

  // Render file list
  function renderFileList() {
    if (uploadedFiles.length === 0) {
      fileActionCard.style.display = 'none';
      dropzone.style.display = 'block';
      privacyNotice.style.display = 'flex';
      fileInput.value = '';
      return;
    }

    dropzone.style.display = 'none';
    privacyNotice.style.display = 'none';
    fileActionCard.style.display = 'block';
    fileCount.textContent = uploadedFiles.length;

    batchFileList.innerHTML = '';

    uploadedFiles.forEach(item => {
      const file = item.file;
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.id = `file-item-${item.id}`;

      // Preview Thumbnail
      let thumbnailMarkup = '';
      if (file && ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
        const previewUrl = URL.createObjectURL(file);
        thumbnailMarkup = `<img src="${previewUrl}" class="file-thumbnail" alt="preview">`;
      } else {
        thumbnailMarkup = `<div class="file-thumbnail-icon"><i class="fa-regular fa-file-image"></i></div>`;
      }

      const selectDisabled = (item.status === 'converting' || item.status === 'completed') ? 'disabled' : '';
      const showProgress = (item.status === 'converting' || item.status === 'completed');
      
      let rightControlContent = '';
      if (item.status === 'completed') {
        rightControlContent = `
          <a href="${item.downloadUrl}" download="${item.newFileName}" class="btn btn-filled btn-download-item">
            <i class="fa-solid fa-download"></i> Download
          </a>
        `;
      } else {
        rightControlContent = `
          <div class="file-target-group">
            <span class="file-target-label">To</span>
            <select class="select-dropdown" id="target-select-${item.id}" onchange="changeItemTarget('${item.id}', this.value)" ${selectDisabled}>
              <option value="png" ${item.targetExt === 'png' ? 'selected' : ''}>PNG</option>
              <option value="jpg" ${item.targetExt === 'jpg' ? 'selected' : ''}>JPG</option>
              <option value="jpeg" ${item.targetExt === 'jpeg' ? 'selected' : ''}>JPEG</option>
              <option value="webp" ${item.targetExt === 'webp' ? 'selected' : ''}>WebP</option>
            </select>
          </div>
        `;
      }

      const statusText = item.status === 'ready' ? 'Ready to convert' : 
                         item.status === 'converting' ? 'Converting...' : 
                         item.status === 'completed' ? 'Converted' : 'Error';

      fileItem.innerHTML = `
        <div class="file-item-left">
          ${thumbnailMarkup}
          <div class="file-meta">
            <div class="file-title" title="${item.originalName}">${truncateFilename(item.originalName)}</div>
            <div class="file-details-text">${formatBytes(item.size)} • ${item.sourceExt.toUpperCase()}</div>
          </div>
        </div>
        
        <div class="file-item-right">
          ${rightControlContent}
          
          <div class="file-progress-container" style="display: ${showProgress ? 'flex' : 'none'};">
            <div class="file-progress-bar-wrapper">
              <div class="file-progress-bar-fill" id="progress-fill-${item.id}" style="width: ${item.progress}%;"></div>
            </div>
            <span class="file-progress-status" id="progress-status-${item.id}">${statusText}</span>
          </div>

          <button class="btn-file-action" onclick="removeSingleFile('${item.id}')" title="Remove File">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `;

      batchFileList.appendChild(fileItem);
    });

    const isCompleted = uploadedFiles.every(item => item.status === 'completed');
    if (isCompleted) {
      convertAllBtn.style.display = 'none';
      downloadAllBtn.style.display = 'inline-flex';
    } else {
      convertAllBtn.style.display = 'inline-flex';
      downloadAllBtn.style.display = 'none';
    }
  }

  window.changeItemTarget = function(id, val) {
    const item = uploadedFiles.find(i => i.id === id);
    if (item) item.targetExt = val;
  };

  window.removeSingleFile = function(id) {
    uploadedFiles = uploadedFiles.filter(item => item.id !== id);
    showToast('File removed', 'info');
    renderFileList();
  };

  clearAllBtn.addEventListener('click', () => {
    uploadedFiles = [];
    renderFileList();
    showToast('All files cleared', 'info');
  });

  // Batch convert via POST /convert API
  convertAllBtn.addEventListener('click', async () => {
    if (uploadedFiles.length === 0) return;

    convertAllBtn.disabled = true;
    clearAllBtn.disabled = true;
    addMoreBtn.disabled = true;

    // Set converting states and show progress elements
    uploadedFiles.forEach(item => {
      if (item.status !== 'completed') {
        item.status = 'converting';
        item.progress = 10;
      }
    });

    renderFileList();

    // Start progress animation simulation
    const progressIntervals = {};
    uploadedFiles.forEach(item => {
      if (item.status === 'converting') {
        const fill = document.getElementById(`progress-fill-${item.id}`);
        const status = document.getElementById(`progress-status-${item.id}`);
        let p = 10;
        
        progressIntervals[item.id] = setInterval(() => {
          p += 10;
          if (p > 90) p = 90; // Cap simulation until server resolves
          if (fill) fill.style.width = `${p}%`;
          if (status) status.textContent = `Converting (${p}%)`;
        }, 150);
      }
    });

    // Make API request
    try {
      const payload = {
        files: uploadedFiles.map(f => ({ id: f.id, target: f.targetExt })),
        user_id: localStorage.getItem('convertix_user_email') || 'guest'
      };

      const response = await fetch('/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      // Clear all intervals
      Object.keys(progressIntervals).forEach(id => clearInterval(progressIntervals[id]));

      if (!response.ok || !result.success) {
        showToast(result.error || 'Conversion request failed', 'error');
        uploadedFiles.forEach(item => {
          if (item.status === 'converting') item.status = 'error';
        });
        renderFileList();
        return;
      }

      // Update states from results
      result.results.forEach(res => {
        const item = uploadedFiles.find(f => f.id === res.id);
        if (item) {
          if (res.status === 'completed') {
            item.status = 'completed';
            item.progress = 100;
            item.downloadUrl = res.download_url;
            item.newFileName = res.new_name;
          } else {
            item.status = 'error';
          }
        }
      });

      showToast('Conversion process completed!', 'success');

    } catch (err) {
      console.error(err);
      Object.keys(progressIntervals).forEach(id => clearInterval(progressIntervals[id]));
      uploadedFiles.forEach(item => {
        if (item.status === 'converting') item.status = 'error';
      });
      showToast('Network error during conversion.', 'error');
    }

    convertAllBtn.disabled = false;
    clearAllBtn.disabled = false;
    addMoreBtn.disabled = false;
    renderFileList();
  });

  // Download all files bundled inside a single ZIP archive
  downloadAllBtn.addEventListener('click', async () => {
    const completedFiles = uploadedFiles.filter(item => item.status === 'completed' && item.downloadUrl);
    if (completedFiles.length === 0) {
      showToast('No converted files to download.', 'warning');
      return;
    }

    const fileNames = completedFiles.map(item => item.downloadUrl.split('/').pop());

    downloadAllBtn.disabled = true;
    showToast('Bundling files into ZIP archive...', 'info');

    try {
      const response = await fetch('/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileNames })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showToast('ZIP archive created! Downloading...', 'success');
        const link = document.createElement('a');
        link.href = result.download_url;
        link.download = result.zip_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        showToast(result.error || 'Failed to create ZIP archive', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error while bundling ZIP.', 'error');
    }

    downloadAllBtn.disabled = false;
  });

  // Truncate filename helper
  function truncateFilename(name, limit = 22) {
    if (name.length <= limit) return name;
    const parts = name.split('.');
    const ext = parts.pop();
    const rest = parts.join('.');
    return rest.substring(0, limit - ext.length - 4) + '...' + ext;
  }

  // Format File Size helper
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

// ==========================================
// 7. Dashboard History Page API Integration
// ==========================================
async function initDashboardControls() {
  const tableBody = document.getElementById('history-table-body');
  const tableWrapper = document.getElementById('history-table-wrapper');
  const emptyHistory = document.getElementById('empty-history-box');
  
  const searchInput = document.getElementById('search-input');
  const sourceFilter = document.getElementById('source-filter');
  const targetFilter = document.getElementById('target-filter');
  
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const dashboardDownloadAllBtn = document.getElementById('dashboard-download-all-btn');

  if (!tableBody) return; // Exit if not on dashboard page

  const userEmail = localStorage.getItem('convertix_user_email') || 'guest';
  let historyData = [];

  showToast('Loading conversion records...', 'info');

  // Fetch history list from GET /history API
  try {
    const response = await fetch(`/history?user_id=${userEmail}`);
    if (response.ok) {
      historyData = await response.json();
      renderHistoryTable(historyData);
    } else {
      showToast('Failed to load history from database.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Network error loading history.', 'error');
  }

  // Search & Filter listeners
  if (searchInput) searchInput.addEventListener('input', runFilters);
  if (sourceFilter) sourceFilter.addEventListener('change', runFilters);
  if (targetFilter) targetFilter.addEventListener('change', runFilters);

  function runFilters() {
    const query = searchInput.value.toLowerCase();
    const src = sourceFilter.value.toLowerCase();
    const tgt = targetFilter.value.toLowerCase();

    const filtered = historyData.filter(item => {
      const matchQuery = item.filename.toLowerCase().includes(query);
      const matchSrc = src === 'all' || item.source.toLowerCase() === src;
      const matchTgt = tgt === 'all' || item.target.toLowerCase() === tgt;
      return matchQuery && matchSrc && matchTgt;
    });

    renderHistoryTable(filtered);
  }

  function renderHistoryTable(data) {
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
      tableWrapper.style.display = 'none';
      emptyHistory.style.display = 'flex';
      if (dashboardDownloadAllBtn) dashboardDownloadAllBtn.style.display = 'none';
      return;
    }

    tableWrapper.style.display = 'block';
    emptyHistory.style.display = 'none';
    if (dashboardDownloadAllBtn) dashboardDownloadAllBtn.style.display = 'inline-flex';

    data.forEach(item => {
      const row = document.createElement('tr');
      
      // Converted file download route: /download/<item_id>
      const downloadUrl = `/download/${item.id}`;

      row.innerHTML = `
        <td style="font-weight:600;"><i class="fa-regular fa-image" style="margin-right:0.5rem;"></i>${item.filename}</td>
        <td>${item.size}</td>
        <td><span style="font-weight:600;">${item.source}</span> <i class="fa-solid fa-arrow-right" style="font-size:0.8rem; margin:0 0.25rem;"></i> <span style="font-weight:600;">${item.target}</span></td>
        <td>${item.timestamp}</td>
        <td>
          <a href="${downloadUrl}" class="btn btn-outline" style="padding: 0.4rem 0.8rem; font-size:0.85rem;">
            <i class="fa-solid fa-download"></i> Download Again
          </a>
        </td>
      `;

      tableBody.appendChild(row);
    });
  }

  // Clear server logs is restricted to signed-in users on server or localStorage
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      showToast('Clearing server conversion logs is disabled for guest security. Use Sign Out to clear session data.', 'warning');
    });
  }

  if (dashboardDownloadAllBtn) {
    dashboardDownloadAllBtn.addEventListener('click', async () => {
      const query = searchInput ? searchInput.value.toLowerCase() : '';
      const src = sourceFilter ? sourceFilter.value.toLowerCase() : 'all';
      const tgt = targetFilter ? targetFilter.value.toLowerCase() : 'all';

      const filtered = historyData.filter(item => {
        const matchQuery = item.filename.toLowerCase().includes(query);
        const matchSrc = src === 'all' || item.source.toLowerCase() === src;
        const matchTgt = tgt === 'all' || item.target.toLowerCase() === tgt;
        return matchQuery && matchSrc && matchTgt;
      });

      if (filtered.length === 0) {
        showToast('No converted files to download.', 'warning');
        return;
      }

      const fileNames = filtered.map(item => item.id);

      dashboardDownloadAllBtn.disabled = true;
      showToast('Bundling history files into ZIP archive...', 'info');

      try {
        const response = await fetch('/download-zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: fileNames })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          showToast('ZIP archive created! Downloading...', 'success');
          const link = document.createElement('a');
          link.href = result.download_url;
          link.download = result.zip_name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          showToast(result.error || 'Failed to create ZIP archive', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Network error while bundling ZIP.', 'error');
      }

      dashboardDownloadAllBtn.disabled = false;
    });
  }
}

// ==========================================
// 8. Auth Forms Actions (Signin/Signup Page)
// ==========================================
function initAuthFormControls() {
  const signinForm = document.getElementById('signin-form');
  const signupForm = document.getElementById('signup-form');

  if (signinForm) {
    window.handleSignIn = function(event) {
      event.preventDefault();
      const email = document.getElementById('email').value;
      
      const submitBtn = signinForm.querySelector('.btn-auth-submit');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing In...';
      
      setTimeout(() => {
        showToast('Signed in successfully', 'success');
        localStorage.setItem('convertix_user_email', email);
        
        setTimeout(() => {
          window.location.href = '/';
        }, 1200);
      }, 1200);
    };
  }

  if (signupForm) {
    window.handleSignUp = function(event) {
      event.preventDefault();
      const name = document.getElementById('fullname').value;
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
      }

      const submitBtn = signupForm.querySelector('.btn-auth-submit');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...';

      setTimeout(() => {
        showToast('Account created successfully!', 'success');
        
        setTimeout(() => {
          window.location.href = '/signin';
        }, 1200);
      }, 1200);
    };
  }
}
