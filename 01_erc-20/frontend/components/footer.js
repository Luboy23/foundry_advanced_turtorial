// 导出默认组件 Footer，用于显示页面的底部内容
export default function Footer() {
  return (
    <>
      {/* 使用 TailwindCSS 定义 Footer 的样式 */}
      <footer className="font-wq w-full text-white text-center mt-auto py-4 text-xl">
        {/* 提示信息，提醒用户不要将该教程直接用于生产环境 */}
        <p>本教程仅供参考，不建议在生产环境中使用</p>

        {/* 提供关于教程的更多信息，并鼓励用户支持作者 */}
        <h2>
          {/* 提醒用户关注哔哩哔哩账号以获取更多 Web3 全栈开发教程 */}
          更多 Web3全栈开发教程请关注b站: lllu_23
          <br />
          {/* 鼓励用户通过 GitHub 点星或哔哩哔哩三连支持作者 */}
          如果这个视频对你有所帮助, 欢迎在 github 给作者一个星星或者在 b站
          三连支持一下 up 主, 非常感谢!!!
        </h2>
      </footer>
    </>
  );
}
