# 芸窗 · Ephemera

一款草木绿、纸页感、略带复古气息的日记 PWA，使用 React + TypeScript + Vite + Supabase，支持电脑与手机。日记优先保存在本机，登录并关联账号后可在设备之间同步。

[在线使用](https://ephemera-umber.vercel.app/)

## 功能

- **日记**：新建、编辑、阅读、搜索、收藏，支持卡片与列表展示，以及标签、心情、日期组合筛选。
- **草稿**：独立页面区分「尚未创建」与「修改中」，支持继续编辑、丢弃和卡片／列表展示。写作时即时保存本机草稿，再次点击写日记会优先恢复最近一份尚未创建的草稿。
- **回顾与珍藏**：通过日历浏览记录，集中查看收藏的日记。
- **整理书页**：管理标签与心情，支持新增、改名、合并、移除及关联篇数统计；单篇日记最多 8 个标签，心情可以留空。
- **回收站**：删除日记采用软删除，保留正文，可恢复；清空回收站只清理本机。
- **账号与同步**：邮箱链接登录、退出登录、账号关联、自动与手动同步、离线改动续传及冲突副本。
- **备份**：JSON 导出、导入与按日记 ID 合并，支持用云端数据覆盖本机，并保留覆盖前备份。
- **PWA**：安装入口、离线应用缓存和新版本更新提示。

手机底栏为「日记、草稿｜写日记｜回顾、珍藏」。「整理书页」和「设置与备份」位于侧边菜单。功能说明收在小树苗帮助图标中。

## 本地运行

开发环境使用 Node.js 22.12 或更新版本，以及 pnpm。

```sh
pnpm install
pnpm dev
```

打开 [本地开发页面](http://localhost:5173/)。开发服务器固定使用 5173 端口，端口占用时会报错。

如果终端提示找不到 pnpm，先安装，再重新打开终端：

```sh
npm install -g pnpm
```

Windows 也可以在安装依赖后双击 `start.cmd`。它优先使用本机 Codex 附带的 Node.js，否则使用 PATH 中的 Node.js；不会自动安装依赖。

## Supabase 配置

不配置 Supabase 时仍可使用本机模式。需要登录和云端同步时：

1. 将 `.env.example` 复制为 `.env`，填写项目 URL 和前端匿名密钥：

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```

2. 新数据库在 Supabase SQL Editor 执行 [schema.sql](supabase/schema.sql)。已使用旧版表结构的数据库执行 [同步迁移](supabase/migrations/20260910_sync.sql)。初始化脚本包含策略创建语句，不要反复运行整份脚本，以免同名策略报错。
3. 启用邮箱登录，在 Authentication 的 URL 配置中设置站点地址，并允许登录跳转回该地址。本地开发使用 `http://localhost:5173`。
4. 重启开发服务器，在「设置与备份」中输入邮箱，通过邮件中的链接登录，再确认「关联当前账号」。

`VITE_` 变量会进入前端构建，必须使用前端可公开的匿名密钥，不能填写 `service_role` 密钥。`.env` 已被 Git 忽略。

数据库为 `entries` 表启用了 RLS，按 `auth.uid() = user_id` 限制访问，并撤销匿名角色的表权限。前端账号关联用于避免本机数据同步到错误账号，数据库访问隔离由 RLS 负责。

## 数据与同步规则

| 内容／操作 | 当前行为 |
| --- | --- |
| 日记保存 | 先保存到当前浏览器；已关联账号时自动同步，也可以点击「立即同步」 |
| 离线修改 | 编辑、收藏和软删除进入本机待同步队列，恢复联网后尝试续传 |
| 草稿 | 只保存在当前浏览器，不上传云端，也不包含在日记 JSON 导出中 |
| 分类目录 | 日记携带的标签与心情随日记同步；未使用的自定义目录只保存在本机和 JSON 备份中 |
| 重复数据 | 按日记 ID 整理重复版本，不会仅凭正文相同合并不同日记 |
| 同步冲突 | 两端同时编辑时保留云端原页，将本机版本另存为冲突副本，供手动比较 |
| 删除日记 | 标记删除时间并同步，正文与分类保留在回收站 |
| 清空回收站 | 只清理本机，云端和其他设备内容保留；尚未同步的删除先完成软删除同步，再清理本机副本 |
| 用云端覆盖本机 | 替换本机已保存日记、回收站与同步状态，可能重新取回本机清空过的回收站项目；不会修改云端，也不替换本机草稿与分类目录 |
| 覆盖前备份 | 自动保留一份覆盖前的本机日记快照，可在设置中导出；下一次覆盖会更新这份备份 |
| 账号切换 | 本机数据已关联其他账号时暂停同步，需要登录原账号 |

主要浏览器存储键：

- `ephemera-journal`：日记、分类目录、待同步改动、删除记录与同步版本；快照格式为 version 3。
- `ephemera-drafts`：多份本机草稿。
- `ephemera-journal-owner`：本机数据关联的账号 ID。
- `ephemera-journal-before-cloud`：最近一次云端覆盖前的本机快照。

存储键使用固定名称，不随应用版本变化；数据格式版本记录在快照内部。JSON 导入仍支持旧数组与旧格式备份。开发地址、正式域名、不同浏览器各自拥有独立存储；迁移到正式站时可通过 JSON 备份转移已保存日记。清除浏览器数据会移除本机内容，请定期导出备份，重要草稿先保存为日记。

## 验证与构建

```sh
pnpm exec tsc --noEmit
node --testtests/journal.test.mjs
pnpm exec vite build
pnpm exec vite preview --host 0.0.0.0
```

也可以用 `pnpm build` 连续执行类型检查和生产构建。构建产物位于 `dist/`，预览地址为 [localhost:4173](http://localhost:4173/)。

现有测试覆盖备份格式兼容、本机存储、分类管理、重复记录、软删除、离线队列、同步冲突、本机回收站清空、云端覆盖、草稿与账号关联检查。

PWA 缓存应通过生产构建预览或 HTTPS 部署验证。首次联网加载并完成缓存后才能离线打开；登录与云端同步仍需联网。手机尺寸模拟不能代替真实手机安装与离线验证，单元测试也不能代替两个真实账号的数据库权限隔离验证。

## Vercel 部署

将 GitHub 仓库导入 Vercel，使用以下项目配置：

| 配置项 | 值 |
| --- | --- |
| Framework Preset | Vite |
| Build Command | `pnpm build` |
| Output Directory | `dist` |
| Install Command | 自动检测仓库中的 pnpm 锁文件 |
| 环境变量 | `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` |

环境变量按需应用到 Production 和 Preview，修改后需要重新部署。当前正式站为 [ephemera-umber.vercel.app](https://ephemera-umber.vercel.app/)。

Supabase 的 Site URL 设置为正式站地址，Redirect URLs 加入正式站地址及本地开发地址。若要在预览部署中使用邮箱登录，也需允许对应的预览地址。项目使用当前页面的 origin 作为邮箱登录回跳地址。

连接 Git 仓库后，推送到配置的生产分支会触发 Vercel 部署。已安装的 PWA 可通过应用的新版本提示更新。

## 目录结构

```text
src/
  App.tsx                     页面状态、账号、同步与设置编排
  main.tsx                    应用入口
  components/                 日历、弹窗、确认框、帮助图标、植物插画
  features/
    journal/                  日记编辑器与卡片
    drafts/                   草稿管理页
    collections/              标签与心情管理
  data/                       数据模型、本机存储、草稿与分类规则
  services/                   Supabase 客户端、同步与账号检查
  styles/                     基础布局与交互样式
supabase/
  schema.sql                  数据库初始化与 RLS 策略
  migrations/                 旧数据库升级脚本
public/                       字体、图标、封面等静态资源
tests/                       数据与同步回归测试
```

## 素材

森林封面使用本地资源 `public/garden.jpg`，来自 Unsplash。字体为 Noto Serif SC，许可见 [FONT-LICENSE.txt](public/FONT-LICENSE.txt)。植物线稿与窗形图标为项目内 SVG，界面图标使用 Lucide React。
