# 芸窗 · Ephemera

芸窗是一款草木绿、纸页感、略带复古气息的日记 PWA，使用 React、TypeScript、Vite 和 Supabase，支持电脑与手机。

正式界面采用「日记书桌」，分为日记、回顾、珍藏三个入口。日历集中在回顾页；「整理书页」管理标签和心情；设置集中处理账户、备份和安装。

## 启动

Windows 可直接双击 `启动芸窗.cmd`，然后访问：

<http://localhost:5173/>

也可以在已安装 Node.js 和 pnpm 的终端中运行：

```sh
pnpm install
pnpm dev
```

## 当前功能

- 新建、编辑、阅读、删除和收藏日记。
- 本机即时草稿与本地持久保存。
- 统一日历支持快速选择年月、回到今天、方向键移动日期。
- 天气和心情直接点选；心情可留空，再次点选可取消。
- 标签可搜索、新建、点选和逐个移除；每篇最多 8 个。
- 标签与心情支持新增、改名、合并和移除，并显示相关日记篇数。
- 搜索、标签、心情和日期筛选可组合使用，条件可以单独清除。
- JSON 导出、导入、重复记录整理与按版本合并。
- Supabase 邮箱登录与自动同步；离线编辑、收藏和删除会在恢复联网后续传。
- 云端删除通过墓碑记录传播到其他设备；两端同时编辑时保留云端原页，并把本机内容另存为冲突副本。
- 响应式桌面与手机布局。
- PWA 安装、离线应用缓存与更新提示。

## Supabase

项目通过 `.env` 中的以下变量连接 Supabase：

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

数据库初始化脚本位于 `supabase/schema.sql`。表启用了 RLS，每位用户只能访问自己的日记。

已经创建过数据库的项目，需要在 Supabase SQL Editor 运行一次下面的迁移：

```sql
-- 文件：supabase/migrations/20260910_sync.sql
alter table public.entries add column if not exists deleted_at timestamptz;
create index if not exists entries_user_changed on public.entries(user_id, updated_at desc);
```

同步会在登录、恢复联网、重新聚焦页面及本机内容改变后自动进行，也可以在「设置与备份」中点击「立即同步」。删除仅标记删除时间，完整保留正文与分类；可在设置的回收站恢复，并同步到其他设备。

## 数据保存

日记、分类目录、待同步改动、删除墓碑和最后同步版本保存在当前浏览器的 `ephemera-journal-v2`，每次修改通过同一次写入保存。草稿保存在 `ephemera-draft-v1`。键名保持不变，快照内容已升级为 version 3。

升级时兼容读取 `ephemera-entries-v1` 和更早的原型数据；旧键保留作为升级前副本。新版本保存后以 v2 数据为准。JSON 导出包含分类目录，同时兼容导入旧数组和 v1 备份。需要回退代码时，先导出当前备份，再在旧版本中导入其中的日记，避免回退到过时的旧键内容。

未使用的自定义标签与心情目录目前只在本机和 JSON 备份中保存；日记携带的标签和心情会正常同步。同一篇日记在两台设备同时修改时，芸窗不会直接覆盖：云端版本保留原 ID，本机版本会生成一篇带「冲突副本」标题的新日记，供用户自行比较整理。

开发地址与未来部署地址属于不同的浏览器存储空间。请定期在设置中导出 JSON 备份。

## 构建

```sh
pnpm exec tsc --noEmit
node --test tests/journal.test.mjs
pnpm exec vite build
pnpm exec vite preview --host 0.0.0.0
```

构建产物位于 `dist/`。正式部署需要 HTTPS，并把前端路由回退到 `index.html`。

素材：森林照片来自 Unsplash 公共图片端点；字体为 Google Fonts 的 Noto Serif SC，许可见 `public/FONT-LICENSE.txt`。植物线稿与窗形图标为项目内 SVG。

