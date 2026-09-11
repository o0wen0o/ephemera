export function cloudError(error: unknown): string {
 const value = error as {message?: string; code?: string; status?: number} | null;
 const message = value?.message || '';
 if (/network|fetch|timeout/i.test(message)) return '连接失败，请检查网络后重试。';
 if (value?.status === 429 || /rate.limit|too many/i.test(message)) return '操作太频繁，请稍后再试。';
 if (/expired|invalid.*token|jwt/i.test(message) || value?.status === 401) return '登录已失效，请重新获取登录链接。';
 if (/row.level|permission|42501/i.test(message + value?.code)) return '暂时无法访问云端日记，请重新登录后再试。';
 if (/[\u4e00-\u9fff]/.test(message)) return message;
 return '操作未完成，请稍后重试。本机内容仍然保留。';
}
export function accountMatches(owner: string | null, userId: string): boolean { return owner === userId; }
