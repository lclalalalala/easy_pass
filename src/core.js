// 提取主域名
import { getDomain } from 'tldts';
function extractMainDomain(hostname) {
    if (!hostname) {
        return null;
    }

    // 先去掉 www.：对未知后缀 tldts 会把 "www.myintranet" 整体当成域名返回
    const host = hostname.replace(/^www\./i, '');

    const domain = getDomain(host);
    if (domain) {
        return domain.split('.')[0]; // 取 'baidu.com' 的第一部分
    }

    // tldts 对 localhost、IP、内网域名等非 ICANN 域名返回 null。
    // 退化成 host 本身，否则会拼出 "null!@#" 这种坏口令。
    return host || null;
}



// 预定义字符串操作函数
function stringOperation(operationStr, variables) {
    // Input Example:
    // {{[domain][0][2][U]}} // 获取第0～2个字符，并大写
    // {{[domain][-2][-1][L]}} // 获取倒数第1～2个字符，并小写
    // {{[domain][1][3][U]}} // 获取倒数第1～3个字符，并大写

    try {
        // 使用正则表达式一次性提取所有参数
        const match = operationStr.match(/\{\{\[(\w+)\]\[(-?\d+)\]\[(-?\d+)\]\[(U|L)\]\}\}/);

        if (!match) {
            throw new Error('Invalid operation format');
        }

        const variableName = match[1];
        const startIndex = parseInt(match[2]);
        const endIndex = parseInt(match[3]);
        const operationType = match[4];

        const variableValue = variables[variableName] || '';

        // 处理字符串切片
        let slicedString;
        if (startIndex >= 0 && endIndex >= 0) {
            // 正数索引：从start到end（包含end）
            slicedString = variableValue.substring(startIndex, endIndex + 1);
        } else if (startIndex < 0 && endIndex < 0) {
            // 负数索引：从倒数start到倒数end
            const actualStart = Math.max(0, variableValue.length + startIndex);
            const actualEnd = Math.min(variableValue.length, variableValue.length + endIndex + 1);
            slicedString = variableValue.substring(actualStart, actualEnd);
        } else {
            // 混合索引不支持，返回空字符串
            slicedString = '';
        }

        // 处理大小写转换
        let operationResult;
        if (operationType === 'U') {
            operationResult = slicedString.toUpperCase();
        } else if (operationType === 'L') {
            operationResult = slicedString.toLowerCase();
        } else {
            operationResult = slicedString;
        }

        return operationResult;

    } catch (error) {
        console.error('字符串操作错误:', error);
        return '';
    }
}

// 安全的函数执行方法
function executePasswordFunction(functionText, variables) {
    try {
        // 使用安全的模板字符串替换变量
        let result = functionText;

        // 首先处理字符串操作 {{[variable][start][end][case]}}
        result = result.replace(/\{\{\[(\w+)\]\[(-?\d+)\]\[(-?\d+)\]\[(U|L)\]\}\}/g, (match) => {
            return stringOperation(match, variables);
        });

        // 然后替换所有普通{{xxx}}格式的变量引用
        result = result.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
            return variables[variableName] || '';
        });

        // 支持简单的数学运算（安全版本）
        result = result.replace(/Math\.(\w+)\((.*?)\)/g, (match, method, args) => {
            if (Math[method] && typeof Math[method] === 'function') {
                const parsedArgs = args.split(',').map(arg => {
                    const trimmed = arg.trim();
                    // 只允许数字和基本数学运算
                    if (/^\d+(\.\d+)?$/.test(trimmed)) {
                        return parseFloat(trimmed);
                    }
                    return 0;
                });
                return Math[method](...parsedArgs);
            }
            return match;
        });

        // 返回最终结果
        return result;
    } catch (error) {
        throw new Error(`函数执行错误: ${error.message}`);
    }
}

// 默认密码生成函数（域名 + 自定义字符 + 随机数字）
function generateDefaultPassword(domain) {
    const customChar = '!@#'; // 自定义字符
    return `${domain}${customChar}`;
}

// 默认用户名生成函数（域名 + 随机字符）
function generateDefaultUsername(domain) {
    const customChar = '!@#'; // 自定义字符
    return `${domain}_${customChar}`;
}

// 复制到剪贴板函数
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('复制失败:', error);
        return false;
    }
}


// 默认邮箱处理：邮箱是全局设置，不随网站变化
function normalizeEmail(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value).trim();
}

// 有意保持宽松的校验：只要求 “本地部分@域名.顶级域”，不追求 RFC 5322 完备
function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

// 邮箱列表：第一个元素就是默认邮箱，顺序即优先级。
// 用单个数组而不是“列表 + 单独的 default 字段”，可以避免出现
// “默认项不在列表里”这种不一致状态。
function dedupeEmails(addresses) {
    const result = [];
    for (const address of addresses) {
        if (!result.some((existing) => existing.toLowerCase() === address.toLowerCase())) {
            result.push(address);
        }
    }
    return result;
}

// 把存储里的数据整理成邮箱列表，兼容旧版本只存一个 defaultEmail 的情况
function normalizeEmailList(raw) {
    const stored = raw && Array.isArray(raw.emails) ? raw.emails : null;
    if (stored) {
        return dedupeEmails(stored.map(normalizeEmail).filter(Boolean));
    }

    // 只有 emails 字段不存在（旧数据）时才迁移。已经存在时即使为空也不再迁移，
    // 否则用户清空邮箱后，残留的 defaultEmail 会把邮箱“复活”。
    const legacy = normalizeEmail(raw && raw.defaultEmail);
    return legacy ? [legacy] : [];
}

// 把设置页里编辑中的行整理成邮箱列表。rows: [{ address, isDefault }]
function buildEmailList(rows) {
    const markedDefault = (rows || []).find((row) => row && row.isDefault);
    const defaultAddress = markedDefault ? normalizeEmail(markedDefault.address) : '';

    const emails = [];
    for (const row of rows || []) {
        const address = normalizeEmail(row && row.address);
        if (!address) continue;
        if (!isValidEmail(address)) {
            return { ok: false, message: `Invalid email address: ${address}` };
        }
        if (!emails.some((existing) => existing.toLowerCase() === address.toLowerCase())) {
            emails.push(address);
        }
    }

    if (emails.length === 0) {
        return { ok: true, emails: [], message: '' };
    }

    // 被标记为默认的邮箱排到第一位；找不到（未选、或那一行是空的）就保持原顺序
    const index = emails.findIndex((address) => address.toLowerCase() === defaultAddress.toLowerCase());
    if (index > 0) {
        const [picked] = emails.splice(index, 1);
        emails.unshift(picked);
    }

    return { ok: true, emails, message: '' };
}

// 在 core.js 文件末尾添加以下导出语句
export {
    extractMainDomain,
    executePasswordFunction,
    generateDefaultPassword,
    generateDefaultUsername,
    copyToClipboard,
    normalizeEmail,
    isValidEmail,
    normalizeEmailList,
    buildEmailList
};