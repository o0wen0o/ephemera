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
- JSON 导出、导入与按更新时间合并。
- Supabase 邮箱登录、上传本机日记和取回云端日记。
- 响应式桌面与手机布局。
- PWA 安装、离线应用缓存与更新提示。

## Supabase

项目通过 `.env` 中的以下变量连接 Supabase：

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

数据库初始化脚本位于 `supabase/schema.sql`。表启用了 RLS，每位用户只能访问自己的日记。当前云端功能是手动上传与取回；自动同步、离线删除同步和冲突处理将在后续版本补齐。

## 数据保存

日记和分类目录保存在当前浏览器的 `ephemera-journal-v2`，每次分类管理与日记修改通过同一次写入保存。草稿保存在 `ephemera-draft-v1`。

升级时兼容读取 `ephemera-entries-v1` 和更早的原型数据；旧键保留作为升级前副本。新版本保存后以 v2 数据为准。JSON 导出包含分类目录，同时兼容导入旧数组和 v1 备份。需要回退代码时，先导出当前备份，再在旧版本中导入其中的日记，避免回退到过时的旧键内容。

未使用的自定义标签与心情目录目前只在本机和 JSON 备份中保存；日记携带的标签、心情仍可通过现有手动云端备份传递。请勿同时在多个标签页编辑同一份日记。

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
