// 使用 protobufjs 解析 Google Authenticator 导出的数据
async function parseMigrationURI(uri) {
  try {
    // 移除 URI 前缀并获取 base64 数据
    const data = uri.replace('otpauth-migration://offline?data=', '');
    
    // Base64 URL 解码（替换 URL 安全字符）
    const base64 = decodeURIComponent(data)  // 先进行 URL 解码
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/[^A-Za-z0-9\+\/]/g, '');  // 移除任何非法字符
    
    // 添加必要的填充
    const pad = base64.length % 4;
    const paddedBase64 = pad ? base64 + '='.repeat(4 - pad) : base64;
    
    // 解码 base64 数据
    const decoded = atob(paddedBase64);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }

    // 使用更简单的方式解析二进制数据
    let pos = 0;
    const accounts = [];
    
    while (pos < bytes.length) {
      const tag = bytes[pos] >> 3;
      const wire = bytes[pos] & 0x7;
      pos++;
      
      if (tag === 1 && wire === 2) { // OTP Parameters
        const len = bytes[pos];
        pos++;
        
        let secret = null;
        let name = '';
        let issuer = '';
        
        const end = pos + len;
        while (pos < end) {
          const fieldTag = bytes[pos] >> 3;
          const fieldWire = bytes[pos] & 0x7;
          pos++;
          
          if (fieldTag === 1 && fieldWire === 2) { // Secret
            const secretLen = bytes[pos];
            pos++;
            secret = bytes.slice(pos, pos + secretLen);
            pos += secretLen;
          } else if (fieldTag === 2 && fieldWire === 2) { // Name
            const nameLen = bytes[pos];
            pos++;
            name = new TextDecoder().decode(bytes.slice(pos, pos + nameLen));
            pos += nameLen;
          } else if (fieldTag === 3 && fieldWire === 2) { // Issuer
            const issuerLen = bytes[pos];
            pos++;
            issuer = new TextDecoder().decode(bytes.slice(pos, pos + issuerLen));
            pos += issuerLen;
          } else {
            // 跳过未知字段
            if (fieldWire === 2) {
              const skipLen = bytes[pos];
              pos += skipLen + 1;
            } else {
              pos += 1;
            }
          }
        }
        
        if (secret) {
          accounts.push({
            name: issuer ? `${issuer}:${name}` : name,
            secret: base32Encode(secret)
          });
        }
      } else {
        // 跳过未知字段
        if (wire === 2) {
          const skipLen = bytes[pos];
          pos += skipLen + 1;
        } else {
          pos += 1;
        }
      }
    }
    
    if (accounts.length === 0) {
      throw new Error('未找到有效的账户数据');
    }
    
    return accounts;
  } catch (e) {
    console.error('Migration parse error:', e);
    throw new Error('无效的迁移数据格式');
  }
}

// Base32 编码
function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  // 添加必要的填充
  while (output.length % 8 !== 0) {
    output += '=';
  }
  return output;
} 