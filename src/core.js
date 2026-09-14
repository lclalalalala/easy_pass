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

// 校验输入框内容，空值视为“清空默认邮箱”的合法操作
function validateEmailInput(raw) {
    const value = normalizeEmail(raw);
    if (!value) {
        return { ok: true, value: '' };
    }
    if (!isValidEmail(value)) {
        return { ok: false, value, message: 'Invalid email address' };
    }
    return { ok: true, value };
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
    validateEmailInput
};