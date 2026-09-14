// 设置统一走 chrome.storage.sync：既能跨设备同步，也符合用户对“配置跟着账号走”的预期。
// sync 写入可能失败（配额超限、企业策略禁用同步等），此时降级写到 local，
// 至少保证配置不丢；local 里的副本在 sync 恢复后由下一次成功写入清除。
//
// 读取优先级：local 的降级副本优先于 sync。
// 因为 sync 写入失败时，sync 里可能仍留有上一次的旧值，若让 sync 优先会读回旧配置。

export const SETTINGS_KEYS = ['defaultEmail', 'passwordFunction', 'usernameFunction'];

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

    async function save(settings) {
        try {
            await sync.set(settings);
        } catch (syncError) {
            // local 再失败就让错误抛出去，交给调用方提示用户
            await local.set(settings);
            return { backend: 'local', syncError };
        }
        await clearFallback();
        return { backend: 'sync' };
    }

    async function load() {
        // 两个区域各自容错：任意一个读失败都不应该让整个加载失败
        const [localResult, syncResult] = await Promise.allSettled([
            local.get(SETTINGS_KEYS),
            sync.get(SETTINGS_KEYS)
        ]);
        const syncData = syncResult.status === 'fulfilled' ? syncResult.value : {};
        const localData = localResult.status === 'fulfilled' ? localResult.value : {};

        return { ...syncData, ...localData };
    }

    return { save, load };
}
