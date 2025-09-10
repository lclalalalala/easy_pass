// 提取主域名（如从www.baidu.com提取baidu）
function extractMainDomain(hostname) {
    // 参数验证，确保输入有效
    if (!hostname || typeof hostname !== 'string') {
        return 'Unknown';
    }

    // 移除端口号（如果有）
    const hostnameWithoutPort = hostname.split(':')[0];

    // 按点分割域名部分
    let domainParts = hostnameWithoutPort.split('.');

    // 处理常见的特殊顶级域名（如.co.uk, .com.cn等）
    const specialTLDs = [
        'co.uk', 'co.jp', 'com.cn', 'net.cn', 'org.cn', 'gov.cn',
        'ac.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk',
        'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
        'co.za', 'co.nz', 'co.kr', 'co.il', 'co.th', 'co.id',
        'com.br', 'com.mx', 'com.ar', 'com.co', 'com.pe',
        'ne.jp', 'or.jp', 'ac.jp', 'ad.jp', 'ed.jp',
        'go.jp', 'gr.jp', 'lg.jp', 'net.il', 'ac.il',
        'co.in', 'co.hu', 'co.ve', 'co.ao', 'co.mz'
    ];

    // 根据域名部分数量处理
    if (domainParts.length > 2) {
        // 处理三级及以上域名
        // 检查是否为特殊顶级域名
        for (const tld of specialTLDs) {
            const tldParts = tld.split('.');
            const domainEnding = domainParts.slice(-tldParts.length).join('.');

            if (domainEnding === tld && domainParts.length > tldParts.length) {
                // 如果是特殊顶级域名，保留倒数(tldParts.length + 1)个部分
                return domainParts.slice(-tldParts.length - 1).join('.');
            }
        }

        // 移除常见子域名
        const commonSubdomains = [
            'www', 'ww2', 'www2', 'm', 'mobile', 'wap', 'web',
            'mail', 'smtp', 'pop', 'imap', 'ftp', 'news', 'bbs',
            'blog', 'shop', 'store', 'cloud', 'dev', 'api', 'app',
            'forum', 'admin', 'cdn', 'img', 'image', 'static',
            'test', 'demo', 'stage', 'staging', 'prod', 'production'
        ];

        // 循环检查并移除多个常见子域名
        while (domainParts.length > 2 && commonSubdomains.includes(domainParts[0])) {
            domainParts = domainParts.slice(1);
        }

        // 如果处理后仍有多个部分，返回最后两部分
        if (domainParts.length > 2) {
            return domainParts.slice(-2).join('.');
        }

        // 如果只有两个部分，直接返回主域名部分（即倒数第二个部分）
        if (domainParts.length === 2) {
            return domainParts[0];
        }
    } else if (domainParts.length === 2) {
        // 处理二级域名（如 baidu.com），直接返回主域名部分
        return domainParts[0];
    }

    // 如果只有一个部分，直接返回（理论上不应该出现这种情况）
    if (domainParts.length === 1) {
        return domainParts[0];
    }

    // 返回处理后的域名（默认情况）
    return domainParts.join('.');
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