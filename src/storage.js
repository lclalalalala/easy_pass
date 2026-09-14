// 设置统一走 chrome.storage.sync：既能跨设备同步，也符合用户对“配置跟着账号走”的预期。
// sync 写入可能失败（配额超限、企业策略禁用同步等），此时降级写到 local，
// 至少保证配置不丢；local 里的副本在 sync 恢复后由下一次成功写入清除。
//
// 读取优先级：local 的降级副本优先于 sync。
// 因为 sync 写入失败时，sync 里可能仍留有上一次的旧值，若让 sync 优先会读回旧配置。

export const SETTINGS_KEYS = ['emails', 'passwordFunction', 'usernameFunction'];

// 旧版本把邮箱存在单个 defaultEmail 里。读出来做一次性迁移，
// 迁移完成后的首次保存会把它清掉，不让它一直同步在用户账号里。
const LEGACY_KEYS = ['defaultEmail'];

const READ_KEYS = [...SETTINGS_KEYS, ...LEGACY_KEYS];

export function createSettingsStore(sync, local) {
    // sync 写入成功后清掉降级副本，避免旧副本继续遮盖新值。
    // 清理失败不影响本次保存结果：数据已经安全落在 sync 里，下次保存会再试一次。
    async function clearFallback() {
        try {
            await local.remove(SETTINGS_KEYS);
        } catch (cleanupError) {
            console.warn('清除 local 降级副本失败:', cleanupError);
        }
    }

    // 迁移完成后清掉旧版本的键，否则它会一直被 Chrome 同步在账号里。
    // 同样是尽力而为：清不掉也不该让保存失败。
    async function clearLegacyKeys() {
        for (const area of [sync, local]) {
            try {
                await area.remove(LEGACY_KEYS);
            } catch (cleanupError) {
                console.warn('清除旧版本的键失败:', cleanupError);
            }
        }
    }

    async function save(settings) {
        try {
            await sync.set(settings);
        } catch (syncError) {
            // local 再失败就让错误抛出去，交给调用方提示用户
            await local.set(settings);
            return { backend: 'local', syncError };
        }
        await clearLegacyKeys();
        await clearFallback();
        return { backend: 'sync' };
    }

    // 返回 { data, readErrors }：两个区域各自容错，任意一个读失败都不让整个加载失败。
    // readErrors 必须回传给调用方，否则读失败与“用户没配过”在界面上无法区分。
    async function load() {
        const [localResult, syncResult] = await Promise.allSettled([
            local.get(READ_KEYS),
            sync.get(READ_KEYS)
        ]);
        const syncData = syncResult.status === 'fulfilled' ? syncResult.value : {};
        const localData = localResult.status === 'fulfilled' ? localResult.value : {};

        return {
            data: { ...syncData, ...localData },
            readErrors: {
                sync: syncResult.status === 'rejected',
                local: localResult.status === 'rejected'
            }
        };
    }

    return { save, load };
}
