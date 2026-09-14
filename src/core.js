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



// 生成规则的引用语法（都写在 {{ }} 里）：
//   {{domain}}   整个主域名
//   {{1L}}       第 1 个字符，小写（不写 U/L 就原样保留）
//   {{-1U}}      倒数第 1 个字符，大写
//   {{1_3U}}     第 1~3 个字符，大写（_ 分隔，闭区间）
// 索引是 1-based：1 是第一个字符；负数从末尾数，-1 是最后一个字符。
const REFERENCE_PATTERN = /\{\{([^{}]*)\}\}/g;
const INDEX_EXPRESSION_PATTERN = /^([+-]?\d+)(?:_([+-]?\d+))?([UL])?$/;

// 1-based 索引换算成 0-based 偏移；越界（含根本不存在的“第 0 个”）返回 null
function indexToOffset(index, length) {
    // 域名为空时没有字符可取；1-based 里也不存在第 0 个
    if (length === 0 || index === 0) {
        return null;
    }
    const offset = index > 0 ? index - 1 : length + index;
    // 越出两端时截断到边界（像 Python 切片 s[0:3]）：规则是全局的、各站域名长度不同，
    // x.com 这种只有 1 个字符的主域名也必须能算出可用的密码
    return Math.min(Math.max(offset, 0), length - 1);
}

function applyCase(text, caseType) {
    if (caseType === 'U') return text.toUpperCase();
    if (caseType === 'L') return text.toLowerCase();
    return text;
}

// 解析 {{ }} 里的内容；解析不出来返回 null，由调用方保留原文。
// 保留原文而不是变成空串，是为了让写错的规则一眼可见，
// 而不是悄悄生成一个“看起来正常”的错误密码。
function resolveReference(expression, variables) {
    const trimmed = expression.trim();
    const indexed = trimmed.match(INDEX_EXPRESSION_PATTERN);

    if (indexed) {
        const domain = variables.domain == null ? '' : String(variables.domain);
        const from = indexToOffset(parseInt(indexed[1], 10), domain.length);
        const to = indexed[2] === undefined
            ? from
            : indexToOffset(parseInt(indexed[2], 10), domain.length);

        if (from === null || to === null) {
            return null;
        }

        // 反向区间（如 3_1）按先后顺序归一，不报错
        const start = Math.min(from, to);
        const end = Math.max(from, to);
        return applyCase(domain.substring(start, end + 1), indexed[3] || '');
    }

    // 必须只认自有属性：用 `trimmed in variables` 会顺着原型链匹配到
    // Object.prototype 的成员，把 toString 之类的函数源码拼进密码里
    if (Object.prototype.hasOwnProperty.call(variables, trimmed)) {
        return variables[trimmed] == null ? '' : String(variables[trimmed]);
    }

    return null;
}

// 安全的函数执行方法
function executePasswordFunction(functionText, variables) {
    try {
        // 使用安全的模板字符串替换变量
        let result = functionText;

        // 展开 {{...}} 引用：索引表达式和变量名都写在这里
        result = result.replace(REFERENCE_PATTERN, (match, expression) => {
            const value = resolveReference(expression, variables);
            return value === null ? match : value;
        });

        // 返回最终结果
        return result;
    } catch (error) {
        throw new Error(`函数执行错误: ${error.message}`);
    }
}

// 默认密码生成函数（域名 + 自定义字符 + 随机数字）
// domain 用 ?? '' 兑底：取不到主域名时曾经拼出 "null!@#" 这种密码
function generateDefaultPassword(domain) {
    const customChar = '!@#'; // 自定义字符
    return `${domain ?? ''}${customChar}`;
}

// 默认用户名生成函数（域名 + 随机字符）
function generateDefaultUsername(domain) {
    const customChar = '!@#'; // 自定义字符
    return `${domain ?? ''}_${customChar}`;
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