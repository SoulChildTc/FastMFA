let otpList = [];
let updateInterval = null;  // 用于存储定时器ID
let isDragging = false;    // 用于标记是否正在拖动

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 从存储中加载密钥
    const result = await chrome.storage.local.get('otpList');
    otpList = result.otpList || [];
    
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
    
    // 添加导入功能
    document.getElementById('import-all').addEventListener('click', () => {
      document.getElementById('import-file').click();
    });
    
    // 启动定时更新
    startUpdateInterval();
  } catch (error) {
    console.error('初始化失败:', error);
    alert('初始化失败，请重试: ' + error);
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
  
  new Sortable(container, {
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
}

// 在更新显示后初始化排序
function updateOTPDisplay() {
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
  
  otpList.forEach((item, index) => {
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
    div.className = 'otp-item';
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
      navigator.clipboard.writeText(otp).then(() => {
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = '复制成功';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2500);
        
        div.classList.add('copied');
        setTimeout(() => div.classList.remove('copied'), 500);
      });
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
        const newName = prompt('请输入新名称', item.name);
        if (newName && newName.trim() !== '') {
          otpList[index].name = newName.trim();
          await chrome.storage.local.set({ otpList });
          updateOTPDisplay();
        }
        menu.remove();
      });
      
      // 删除处理
      menu.querySelector('.delete').addEventListener('click', () => {
        if (confirm('确定要删除这个密钥吗？')) {
          deleteSecret(index);
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
      alert('请输入名称');
      return;
    }
    
    if (!secret) {
      alert('请输入密钥');
      return;
    }
    
    if (!validateSecret(secret)) {
      alert('密钥格式无效，请检查后重试');
      return;
    }
    
    // 验证密钥是否有效
    try {
      generateTOTP(secret);
    } catch (e) {
      alert('密钥无效，请检查后重试');
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
    alert('添加失败，请重试');
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
    if (confirm(`确定要导入 ${importedData.length} 个密钥吗？`)) {
      otpList = [...otpList, ...importedData];
      await chrome.storage.local.set({ otpList });
      updateOTPDisplay();
    }
  } catch (error) {
    alert('导入失败: ' + error.message);
  }
  
  // 清除文件选择
  e.target.value = '';
});

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
      
      alert(`成功导入 ${imported.length} 个密钥`);
    }
  } catch (error) {
    alert('导入失败: ' + error.message);
  }
}); 