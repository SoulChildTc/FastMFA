let otpList = [];
let updateInterval = null;  // 用于存储定时器ID
let isDragging = false;    // 用于标记是否正在拖动
let syncSettings = {};     // 用于存储同步设置
let searchQuery = '';      // 当前搜索关键字（小写）
let highlightIndex = -1;   // 键盘高亮项的索引（-1 表示无，相对于 visibleList）
const SEARCH_THRESHOLD = 4; // token 数量 ≥ 此值才显示搜索框

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 从存储中加载密钥
    const result = await chrome.storage.local.get(['otpList', 'syncSettings', 'lastSyncTime']);
    otpList = result.otpList || [];
    syncSettings = result.syncSettings || {};
    const lastSyncTime = result.lastSyncTime || null;
    
    // 渲染OTP列表
    updateOTPDisplay();
    
    // 添加新密钥的事件监听
    document.getElementById('add-secret').addEventListener('click', addNewSecret);
    
    // 添加导出所有功能
    document.getElementById('export-all').addEventListener('click', () => {
      const data = JSON.stringify(otpList, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fastmfa_backup.json';
      a.click();
      URL.revokeObjectURL(url);
    });
    
    // 添加标题点击跳转功能
    document.getElementById('repo-link').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://github.com/SoulChildTc/FastMFA' });
    });

    // 添加云同步功能
    document.getElementById('cloud-sync').addEventListener('click', () => {
      showSyncView();
      loadSyncSettings();
    });

    // 同步页面返回按钮
    document.getElementById('sync-back-main').addEventListener('click', () => {
      document.getElementById('sync-view').style.display = 'none';
      document.getElementById('sync-view').classList.remove('active');
      document.getElementById('main-view').style.display = 'block';
      clearSearch();
    });

    // 同步页面标签切换
    document.getElementById('tab-settings').addEventListener('click', () => {
      document.getElementById('tab-settings').classList.add('active');
      document.getElementById('tab-sync').classList.remove('active');
      document.getElementById('settings-panel').style.display = 'block';
      document.getElementById('sync-panel').style.display = 'none';
    });

    document.getElementById('tab-sync').addEventListener('click', () => {
      document.getElementById('tab-settings').classList.remove('active');
      document.getElementById('tab-sync').classList.add('active');
      document.getElementById('settings-panel').style.display = 'none';
      document.getElementById('sync-panel').style.display = 'block';
      updateSyncStatus(lastSyncTime);
    });

    // 保存同步设置
    document.getElementById('save-sync-settings').addEventListener('click', saveSyncSettings);

    // 上传到云端
    document.getElementById('upload-to-cloud').addEventListener('click', uploadToCloud);

    // 从云端下载
    document.getElementById('download-from-cloud').addEventListener('click', downloadFromCloud);
    
    // 初始化帮助图标提示
    initHelpIconTooltips();
    
    // 搜索框事件绑定
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      highlightIndex = searchQuery ? 0 : -1;
      searchClear.style.display = searchQuery ? 'flex' : 'none';
      updateOTPDisplay();
      // 搜索时禁用拖拽
      const container = document.getElementById('otp-list');
      if (container.sortable) {
        container.sortable.option('disabled', searchQuery !== '');
      }
    });
    
    searchInput.addEventListener('keydown', (e) => {
      const visibleList = getVisibleList();
      if (e.key === 'Escape') {
        e.preventDefault();
        if (searchQuery) {
          clearSearch();
        } else {
          searchInput.blur();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (visibleList.length > 0) {
          copyOtpAt(visibleList[0].originalIndex);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (visibleList.length > 0) {
          highlightIndex = highlightIndex === -1 ? 0 : Math.min(highlightIndex + 1, visibleList.length - 1);
          updateOTPDisplay();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (visibleList.length > 0) {
          highlightIndex = highlightIndex === -1 ? visibleList.length - 1 : Math.max(highlightIndex - 1, 0);
          updateOTPDisplay();
        }
      }
    });
    
    searchClear.addEventListener('click', () => {
      clearSearch();
      searchInput.focus();
    });
    
    // 自动聚焦搜索框（如果可见）
    updateSearchBarVisibility();
    const searchBar = document.getElementById('search-bar');
    if (searchBar.style.display !== 'none') {
      setTimeout(() => searchInput.focus(), 0);
    }
    
    // 启动定时更新
    startUpdateInterval();
  } catch (error) {
    console.error('初始化失败:', error);
    showToast('初始化失败: ' + error);
  }
});

// 启动定时更新
function startUpdateInterval() {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  updateInterval = setInterval(() => {
    if (!isDragging) {  // 只在非拖动状态下更新
      updateOTPDisplay();
    }
  }, 1000);
}

// 初始化拖拽排序（独立初始化）
function initSortable() {
  const container = document.getElementById('otp-list');
  if (!container) return;
  
  if (container.sortable) {
    container.sortable.destroy();
  }
  
  const sortable = new Sortable(container, {
    animation: 150,
    handle: '.otp-content',
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    forceFallback: false,
    fallbackTolerance: 3,
    delay: 0,
    delayOnTouchOnly: false,
    touchStartThreshold: 1,
    animation: 150,
    easing: "cubic-bezier(0.2, 0, 0.13, 1.5)",
    onStart: function() {
      isDragging = true;  // 开始拖动
      document.body.style.cursor = 'grabbing';
    },
    onEnd: async function(evt) {
      isDragging = false;  // 结束拖动
      document.body.style.cursor = '';
      const item = otpList[evt.oldIndex];
      otpList.splice(evt.oldIndex, 1);
      otpList.splice(evt.newIndex, 0, item);
      await chrome.storage.local.set({ otpList });
      updateOTPDisplay();  // 立即更新一次显示
    }
  });
  
  container.sortable = sortable;
  
  // 搜索激活时禁用拖拽
  if (searchQuery) {
    sortable.option('disabled', true);
  }
}

// 清空搜索
function clearSearch() {
  searchQuery = '';
  highlightIndex = -1;
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  searchInput.value = '';
  searchClear.style.display = 'none';
  // 恢复拖拽
  const container = document.getElementById('otp-list');
  if (container.sortable) {
    container.sortable.option('disabled', false);
  }
  updateOTPDisplay();
}

// 获取可见列表（过滤搜索结果，带原始索引）
function getVisibleList() {
  if (!searchQuery) {
    return otpList.map((item, i) => ({ item, originalIndex: i }));
  }
  return otpList
    .map((item, i) => ({ item, originalIndex: i }))
    .filter(({ item }) => item.name.toLowerCase().includes(searchQuery));
}

// 复制指定原始索引的 OTP
function copyOtpAt(originalIndex) {
  const item = otpList[originalIndex];
  const otp = generateTOTP(item.secret);
  navigator.clipboard.writeText(otp).then(() => {
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = '复制成功';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2500);
    
    // 视觉反馈：找到对应的 DOM 元素并添加 copied class
    const otpItems = document.querySelectorAll('.otp-item');
    const visibleList = getVisibleList();
    const visibleIndex = visibleList.findIndex(v => v.originalIndex === originalIndex);
    if (visibleIndex >= 0 && otpItems[visibleIndex]) {
      otpItems[visibleIndex].classList.add('copied');
      setTimeout(() => otpItems[visibleIndex].classList.remove('copied'), 500);
    }
  });
}

// 更新搜索栏可见性
function updateSearchBarVisibility() {
  const searchBar = document.getElementById('search-bar');
  if (otpList.length >= SEARCH_THRESHOLD) {
    searchBar.style.display = 'flex';
  } else {
    searchBar.style.display = 'none';
    if (searchQuery) clearSearch();
  }
}

// 在更新显示后初始化排序
function updateOTPDisplay() {
  updateSearchBarVisibility();
  const container = document.getElementById('otp-list');
  container.innerHTML = '';
  
  if (otpList.length === 0) {
    // 添加空状态提示
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <div class="empty-icon">🔒</div>
      <div class="empty-text">暂无 TOTP Token</div>
      <div class="empty-subtext">点击右上角"+"添加新的 TOTP Token</div>
    `;
    container.appendChild(emptyState);
    return;
  }
  
  const visibleList = getVisibleList();
  
  if (searchQuery && visibleList.length === 0) {
    // 搜索无结果
    const emptyState = document.createElement('div');
    emptyState.className = 'search-empty';
    emptyState.innerHTML = `
      <div class="search-empty-icon">🔍</div>
      <div class="search-empty-text">未找到匹配的 token</div>
    `;
    container.appendChild(emptyState);
  } else {
    visibleList.forEach(({ item, originalIndex }, visibleIndex) => {
      const otp = generateTOTP(item.secret);
      const timeRemaining = 30 - Math.floor(Date.now() / 1000 % 30);
      const progress = (timeRemaining / 30) * 100;
      
      let codeColor;
      if (timeRemaining > 10) {
        codeColor = '#2196F3';
      } else if (timeRemaining > 5) {
        codeColor = '#FFA726';
      } else {
        codeColor = '#EF5350';
      }
      
      const div = document.createElement('div');
      div.className = 'otp-item' + (highlightIndex === visibleIndex ? ' highlight' : '');
      div.innerHTML = `
        <div class="otp-content">
          <div class="otp-name" title="${item.name}">${item.name}</div>
          <div class="otp-code-row">
            <span class="otp-code" style="color: ${codeColor}">${otp}</span>
          </div>
        </div>
        <div class="time-progress">
          <div class="time-progress-bar" style="width: ${progress}%; background: linear-gradient(90deg, ${codeColor}, ${codeColor}88)"></div>
        </div>
      `;
      
      // 点击复制
      div.addEventListener('click', () => {
        copyOtpAt(originalIndex);
      });
      
      // 右键菜单
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        // 移除任何已存在的上下文菜单
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
          existingMenu.remove();
        }
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
          <div class="menu-item copy-secret">复制密钥</div>
          <div class="menu-item copy-uri">复制 URI</div>
          <div class="menu-item export-single">导出此项</div>
          <div class="menu-item separator rename">重命名</div>
          <div class="menu-item delete">删除</div>
        `;
        
        // 先添加到文档中以获取实际尺寸
        document.body.appendChild(menu);
        
        // 获取容器和菜单的尺寸
        const containerRect = document.querySelector('.container').getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        
        // 计算合适的位置
        let left = e.clientX;
        let top = e.clientY;
        
        // 检查右边界
        if (left + menuRect.width > containerRect.right) {
          left = containerRect.right - menuRect.width - 5;
        }
        
        // 检查下边界
        if (top + menuRect.height > containerRect.bottom) {
          top = containerRect.bottom - menuRect.height - 5;
        }
        
        // 确保不超出左边界和上边界
        left = Math.max(containerRect.left + 5, left);
        top = Math.max(containerRect.top + 5, top);
        
        // 应用计算后的位置
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
        
        // 添加复制密钥功能
        menu.querySelector('.copy-secret').addEventListener('click', () => {
          navigator.clipboard.writeText(item.secret).then(() => {
            const notification = document.createElement('div');
            notification.className = 'copy-notification';
            notification.textContent = '密钥已复制';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 2500);
          });
          menu.remove();
        });
        
        // 添加复制 URI 功能
        menu.querySelector('.copy-uri').addEventListener('click', () => {
          const uri = `otpauth://totp/${encodeURIComponent(item.name)}?secret=${item.secret}`;
          navigator.clipboard.writeText(uri).then(() => {
            const notification = document.createElement('div');
            notification.className = 'copy-notification';
            notification.textContent = 'URI 已复制';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 2500);
          });
          menu.remove();
        });
        
        // 添加导出单个项目功能
        menu.querySelector('.export-single').addEventListener('click', () => {
          const data = JSON.stringify([item], null, 2);
          const blob = new Blob([data], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `fastmfa_${item.name}_backup.json`;
          a.click();
          URL.revokeObjectURL(url);
          menu.remove();
        });
        
        // 重命名处理
        menu.querySelector('.rename').addEventListener('click', async () => {
          const newName = await showPrompt(item.name);
          if (newName) {
            otpList[originalIndex].name = newName;
            await chrome.storage.local.set({ otpList });
            updateOTPDisplay();
          }
          menu.remove();
        });
        
        // 删除处理
        menu.querySelector('.delete').addEventListener('click', async () => {
          if (await showConfirm('确定要删除这个密钥吗？')) {
            deleteSecret(originalIndex);
          }
          menu.remove();
        });
        
        // 点击其他地方关闭菜单
        document.addEventListener('click', function closeMenu(e) {
          if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
          }
        });
      });
      
      container.appendChild(div);
    });
  }
  
  // 在列表更新后重新初始化排序
  initSortable();
  
  // 在列表更新后重新初始化排序
  initSortable();
}

// 添加复制功能
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = '复制成功';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
  });
}

// 添加输入验证
function validateSecret(secret) {
  // 移除空格和破折号
  secret = secret.replace(/[\s-]/g, '').toUpperCase();
  // 检查是否是有效的base32字符
  return /^[A-Z2-7]+=*$/.test(secret);
}

async function addNewSecret() {
  try {
    const name = document.getElementById('name').value.trim();
    const secret = document.getElementById('secret').value.replace(/\s/g, '').toUpperCase();
    
    if (!name) {
      showToast('请输入名称');
      return;
    }
    
    if (!secret) {
      showToast('请输入密钥');
      return;
    }
    
    if (!validateSecret(secret)) {
      showToast('密钥格式无效，请检查后重试');
      return;
    }
    
    // 验证密钥是否有效
    try {
      generateTOTP(secret);
    } catch (e) {
      showToast('密钥无效，请检查后重试');
      return;
    }
    
    otpList.push({ name, secret });
    await chrome.storage.local.set({ otpList });
    
    document.getElementById('name').value = '';
    document.getElementById('secret').value = '';
    
    // 添加成功提示
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = '添加成功';
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2500);
    
    // 返回主视图
    document.getElementById('show-main').click();
    
    updateOTPDisplay();
  } catch (error) {
    console.error('添加密钥失败:', error);
    showToast('添加失败，请重试');
  }
}

// 生成TOTP码
function generateTOTP(secret) {
  try {
    return otplib.authenticator.generate(secret);
  } catch (e) {
    return '密钥无效';
  }
}

// 删除密钥
async function deleteSecret(index) {
  otpList.splice(index, 1);
  await chrome.storage.local.set({ otpList });
  updateOTPDisplay();
}

// 视图切换相关代码
document.getElementById('show-add').addEventListener('click', () => {
  const mainView = document.getElementById('main-view');
  const addView = document.getElementById('add-view');
  
  mainView.style.display = 'none';
  addView.style.display = 'block';
  // 触发重排后添加active类
  setTimeout(() => addView.classList.add('active'), 0);
});

document.getElementById('show-main').addEventListener('click', () => {
  const mainView = document.getElementById('main-view');
  const addView = document.getElementById('add-view');
  
  document.getElementById('main-view').style.display = 'block';
  document.getElementById('add-view').style.display = 'none';
  clearSearch();
});

// 添加文件导入处理
document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const importedData = JSON.parse(text);
    
    // 验证导入的数据格式
    if (!Array.isArray(importedData)) {
      throw new Error('无效的据格式');
    }
    
    // 验证每个项目
    importedData.forEach(item => {
      if (!item.name || !item.secret) {
        throw new Error('数据格式不整');
      }
      // 验证密钥
      try {
        generateTOTP(item.secret);
      } catch (e) {
        throw new Error(`密钥 "${item.name}" 无效`);
      }
    });
    
    // 确认导入
    const confirmed = await showConfirm(`确定要导入 ${importedData.length} 个密钥吗？`);
    if (confirmed) {
      otpList = [...otpList, ...importedData];
      await chrome.storage.local.set({ otpList });
      updateOTPDisplay();
      showToast(`成功导入 ${importedData.length} 个密钥`);
    }
  } catch (error) {
    showToast('导入失败: ' + error.message, true);
  }
  
  // 清除文件选择
  e.target.value = '';
});

// 自定义确认弹框（替代原生 confirm）
function showConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.getElementById('import-confirm');
    document.getElementById('import-confirm-msg').textContent = message;
    overlay.style.display = 'flex';

    const cleanup = () => {
      overlay.style.display = 'none';
      document.getElementById('import-confirm-ok').onclick = null;
      document.getElementById('import-confirm-cancel').onclick = null;
    };

    document.getElementById('import-confirm-ok').onclick = () => { cleanup(); resolve(true); };
    document.getElementById('import-confirm-cancel').onclick = () => { cleanup(); resolve(false); };
  });
}

// 全局 Toast 通知（替代原生 alert）
function showToast(message, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  if (isError) el.classList.add('toast--error');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// 自定义重命名输入框（替代原生 prompt）
function showPrompt(defaultValue) {
  return new Promise(resolve => {
    const overlay = document.getElementById('rename-modal');
    const input = document.getElementById('rename-input');
    input.value = defaultValue;
    overlay.style.display = 'flex';
    setTimeout(() => input.focus(), 100);

    const cleanup = () => { overlay.style.display = 'none'; };

    const confirm = () => {
      const val = input.value.trim();
      cleanup();
      resolve(val || null);
    };

    document.getElementById('rename-ok').onclick = confirm;
    document.getElementById('rename-cancel').onclick = () => { cleanup(); resolve(null); };

    input.onkeydown = (e) => {
      if (e.key === 'Enter') confirm();
      if (e.key === 'Escape') { cleanup(); resolve(null); }
    };
  });
}

// 切换添加方式
document.getElementById('manual-add').addEventListener('click', () => {
  document.getElementById('manual-form').style.display = 'block';
  document.getElementById('uri-form').style.display = 'none';
  document.getElementById('manual-add').classList.add('active');
  document.getElementById('uri-add').classList.remove('active');
});

document.getElementById('uri-add').addEventListener('click', () => {
  document.getElementById('manual-form').style.display = 'none';
  document.getElementById('uri-form').style.display = 'block';
  document.getElementById('manual-add').classList.remove('active');
  document.getElementById('uri-add').classList.add('active');
});

// URI导入处理
document.getElementById('import-uri').addEventListener('click', async () => {
  const uriText = document.getElementById('uri-input').value.trim();
  
  try {
    const imported = [];
    // 支持多行URI
    const uris = uriText.split(/[\r\n]+/).filter(uri => uri.trim());
    
    for (const uri of uris) {
      if (uri.startsWith('otpauth-migration://')) {
        // 处理 Google Authenticator 导出格式
        const migrationData = await parseMigrationURI(uri);
        imported.push(...migrationData);
      } else if (uri.startsWith('otpauth://')) {
        // 处理标准 otpauth 格式
        const url = new URL(uri);
        const secret = url.searchParams.get('secret');
        console.log(url);
        let name = decodeURIComponent(url.pathname.replace(/\/\/totp\//, ''));
        const issuer = url.searchParams.get('issuer');
        
        if (!secret) {
          throw new Error('URI 中未找到密钥');
        }
        
        if (issuer) {
          name = `${issuer}:${name}`;
        }
        
        // 验证密钥
        try {
          generateTOTP(secret);
        } catch (e) {
          throw new Error(`密钥 "${name}" 无效`);
        }
        
        imported.push({ name, secret });
      } else {
        throw new Error('不支持的 URI 格式');
      }
    }
    
    if (imported.length > 0) {
      otpList = [...otpList, ...imported];
      await chrome.storage.local.set({ otpList });
      updateOTPDisplay();
      
      // 清空输入并返回主视图
      document.getElementById('uri-input').value = '';
      document.getElementById('show-main').click();
      
      showToast(`成功导入 ${imported.length} 个密钥`);
    }
  } catch (error) {
    showToast('导入失败: ' + error.message, true);
  }
}); 

// 显示同步视图
function showSyncView() {
  const mainView = document.getElementById('main-view');
  const syncView = document.getElementById('sync-view');
  
  mainView.style.display = 'none';
  syncView.style.display = 'block';
  // 触发重排后添加active类
  setTimeout(() => syncView.classList.add('active'), 0);
  
  // 获取最近同步时间并更新状态
  chrome.storage.local.get('lastSyncTime', (result) => {
    updateSyncStatus(result.lastSyncTime || null);
  });
}

// 加载同步设置
function loadSyncSettings() {
  if (syncSettings.githubToken) {
    document.getElementById('github-token').value = syncSettings.githubToken;
  }
  
  if (syncSettings.gistId) {
    document.getElementById('gist-id').value = syncSettings.gistId;
  }
  
  if (syncSettings.gistFilename) {
    document.getElementById('gist-filename').value = syncSettings.gistFilename;
  }
  
  if (syncSettings.encryptKey) {
    document.getElementById('encrypt-key').value = syncSettings.encryptKey;
  }
}

// 保存同步设置
async function saveSyncSettings() {
  const githubToken = document.getElementById('github-token').value.trim();
  const gistId = document.getElementById('gist-id').value.trim();
  const gistFilename = document.getElementById('gist-filename').value.trim() || 'fastmfa_data.json';
  const encryptKey = document.getElementById('encrypt-key').value.trim();
  
  if (!githubToken) {
    showToast('请输入 GitHub Token');
    return;
  }
  
  if (!encryptKey) {
    if (!await showConfirm('未设置加密密钥，您的数据将以明文形式存储。确定继续吗？')) {
      return;
    }
  }
  
  syncSettings = {
    githubToken,
    gistId,
    gistFilename,
    encryptKey
  };
  
  await chrome.storage.local.set({ syncSettings });
  
  const notification = document.createElement('div');
  notification.className = 'copy-notification';
  notification.textContent = '设置已保存';
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2500);
  
  // 切换到同步标签
  document.getElementById('tab-sync').click();
}

// 更新同步状态
function updateSyncStatus(lastSyncTime) {
  const statusElement = document.getElementById('sync-status');
  const timeElement = document.getElementById('last-sync-time');
  
  if (!syncSettings.githubToken) {
    statusElement.textContent = '未配置同步';
    timeElement.textContent = '';
    return;
  }
  
  if (syncSettings.gistId) {
    statusElement.textContent = '已配置同步';
  } else {
    statusElement.textContent = '已配置 Token，首次同步将创建 Gist';
  }
  
  if (lastSyncTime) {
    const date = new Date(lastSyncTime);
    timeElement.textContent = `上次同步: ${date.toLocaleString()}`;
  } else {
    timeElement.textContent = '尚未同步';
  }
}

// 显示同步结果
function showSyncResult(success, message) {
  const resultElement = document.getElementById('sync-result');
  resultElement.textContent = message;
  resultElement.className = 'sync-result ' + (success ? 'success' : 'error');
  
  // 5秒后隐藏结果
  setTimeout(() => {
    resultElement.className = 'sync-result';
  }, 5000);
}

// 加密数据
function encryptData(data, key) {
  if (!key) return JSON.stringify(data);
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
}

// 解密数据
function decryptData(encryptedData, key) {
  if (!key) return JSON.parse(encryptedData);
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

// 上传到云端
async function uploadToCloud() {
  try {
    if (!syncSettings.githubToken) {
      showSyncResult(false, '请先配置 GitHub Token');
      return;
    }
    
    // 加密数据
    const encryptedData = encryptData(otpList, syncSettings.encryptKey);
    
    // 准备请求头
    const headers = {
      'Authorization': `token ${syncSettings.githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
    
    let gistId = syncSettings.gistId;
    
    if (!gistId) {
      // 创建新的 Gist
      const createResponse = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description: 'FastMFA Sync Data',
          public: false,
          files: {
            [syncSettings.gistFilename]: {
              content: encryptedData
            }
          }
        })
      });
      
      if (!createResponse.ok) {
        throw new Error(`创建 Gist 失败: ${createResponse.status} ${createResponse.statusText}`);
      }
      
      const createResult = await createResponse.json();
      gistId = createResult.id;
      
      // 保存 Gist ID
      syncSettings.gistId = gistId;
      await chrome.storage.local.set({ syncSettings });
      
      // 更新 Gist ID 输入框
      document.getElementById('gist-id').value = gistId;
    } else {
      // 更新现有 Gist
      const updateResponse = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          files: {
            [syncSettings.gistFilename]: {
              content: encryptedData
            }
          }
        })
      });
      
      if (!updateResponse.ok) {
        throw new Error(`更新 Gist 失败: ${updateResponse.status} ${updateResponse.statusText}`);
      }
    }
    
    // 记录同步时间
    const lastSyncTime = Date.now();
    await chrome.storage.local.set({ lastSyncTime });
    
    // 更新同步状态
    updateSyncStatus(lastSyncTime);
    
    showSyncResult(true, '成功上传到云端');
  } catch (error) {
    console.error('上传失败:', error);
    showSyncResult(false, `上传失败: ${error.message}`);
  }
}

// 从云端下载
async function downloadFromCloud() {
  try {
    if (!syncSettings.githubToken || !syncSettings.gistId) {
      showSyncResult(false, '请先配置 GitHub Token 和 Gist ID');
      return;
    }
    
    // 准备请求头
    const headers = {
      'Authorization': `token ${syncSettings.githubToken}`,
      'Accept': 'application/vnd.github.v3+json'
    };
    
    // 获取 Gist 内容
    const response = await fetch(`https://api.github.com/gists/${syncSettings.gistId}`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`获取 Gist 失败: ${response.status} ${response.statusText}`);
    }
    
    const gistData = await response.json();
    const filename = syncSettings.gistFilename;
    
    if (!gistData.files[filename]) {
      throw new Error(`Gist 中未找到文件: ${filename}`);
    }
    
    const encryptedData = gistData.files[filename].content;
    
    try {
      // 尝试解密数据
      const decryptedData = decryptData(encryptedData, syncSettings.encryptKey);
      
      // 确认覆盖本地数据
      if (await showConfirm(`确定要从云端下载并覆盖本地数据吗？将导入 ${decryptedData.length} 个密钥。`)) {
        otpList = decryptedData;
        await chrome.storage.local.set({ otpList });
        updateOTPDisplay();
        
        // 记录同步时间
        const lastSyncTime = Date.now();
        await chrome.storage.local.set({ lastSyncTime });
        
        // 更新同步状态
        updateSyncStatus(lastSyncTime);
        
        showSyncResult(true, `成功从云端下载了 ${decryptedData.length} 个密钥`);
      }
    } catch (decryptError) {
      throw new Error(`解密数据失败，请检查加密密钥是否正确: ${decryptError.message}`);
    }
  } catch (error) {
    console.error('下载失败:', error);
    showSyncResult(false, `下载失败: ${error.message}`);
  }
} 

// 初始化帮助图标提示
function initHelpIconTooltips() {
  // 为所有帮助图标添加鼠标悬浮事件
  const helpIcons = document.querySelectorAll('.help-icon');
  
  helpIcons.forEach(icon => {
    // 移除默认的title属性提示，改为自定义提示
    const tooltipText = icon.getAttribute('title');
    icon.removeAttribute('title');
    icon.setAttribute('data-tooltip', tooltipText);
    
    // 添加鼠标悬浮事件
    icon.addEventListener('mouseenter', showTooltip);
    icon.addEventListener('mouseleave', hideTooltip);
  });
}

// 显示自定义提示
function showTooltip(event) {
  const icon = event.target;
  const tooltipText = icon.getAttribute('data-tooltip');
  
  // 创建提示元素
  const tooltip = document.createElement('div');
  tooltip.className = 'custom-tooltip';
  tooltip.textContent = tooltipText;
  
  // 添加到文档中
  document.body.appendChild(tooltip);
  
  // 计算位置
  const iconRect = icon.getBoundingClientRect();
  const containerRect = document.querySelector('.container').getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  // 默认位置（在图标下方居中）
  let top = iconRect.bottom + 8;
  let left = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2);
  
  // 确保不超出右边界
  if (left + tooltipRect.width > containerRect.right - 10) {
    left = containerRect.right - tooltipRect.width - 10;
  }
  
  // 确保不超出左边界
  if (left < containerRect.left + 10) {
    left = containerRect.left + 10;
  }
  
  // 应用位置
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  
  // 存储提示元素引用
  icon.tooltip = tooltip;
  
  // 添加箭头
  const arrow = document.createElement('div');
  arrow.className = 'tooltip-arrow';
  
  // 计算箭头位置（箭头应该指向图标中心）
  const arrowLeft = iconRect.left + (iconRect.width / 2) - left - 4;
  arrow.style.left = `${arrowLeft}px`;
  
  tooltip.appendChild(arrow);
}

// 隐藏自定义提示
function hideTooltip(event) {
  const icon = event.target;
  if (icon.tooltip) {
    icon.tooltip.remove();
    icon.tooltip = null;
  }
} 