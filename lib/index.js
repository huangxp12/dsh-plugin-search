/**
 * 插件搜索（plugin-search）——宿主半。
 *
 * 纯 UI 插件：这一半本身不做任何事。它存在的唯一意义是让本包在 Loader 树里成为
 * 一个「已启用的条目」——客户端的 bundle 只对已启用的 Loader 条目提供服务
 * （见 @deepseek-ai/dsh-client-modules 的扫描逻辑）。浏览器半通过 package.json 的
 * `exports["./client"]` 与 `dsh.client` 声明被发现。
 *
 * 因此本插件对宿主是**零副作用**的：不注册工具、不注册路由、不监听会话事件、
 * 不写入任何会话数据。
 */

/** 宿主插件主体：无宿主侧行为。 */
function apply() {}

export { apply };
