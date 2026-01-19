# 纸质二维码服务器

这是一个基于 Koa.js 的后端项目，用于从上传的 CSV 文件生成加密的二维码。

## 功能

1.  **上传 CSV 文件**: 用户可以通过前端页面上传一个 CSV 文件。
2.  **解析和加密**: 服务器会解析 CSV 文件中的每一个单元格的字符串。
3.  **RSA 加密**: 每个字符串都将使用 RSA-OAEP SHA-256 进行加密。
4.  **生成二维码**: 为每个加密后的字符串生成一个二维码图片。
5.  **存储图片**: 二维码图片以加密字符串（经过 URL 安全处理）命名，并以 `.jpg` 格式存储在服务器上。
6.  **预览二维码**: 前端页面会显示所有生成的二维码图片以供预览。
7.  **批量下载**: 提供一个 "全部下载" 按钮，可以将所有生成的二维码图片打包成一个 `zip` 文件进行下载。

## 技术栈

-   **后端**:
    -   [Koa.js](https://koajs.com/): Web 框架
    -   [@koa/router](https://github.com/koajs/router): 路由
    -   [koa-body](https://github.com/dlau/koa-body): 请求体解析，用于文件上传
    -   [koa-static](https://github.com/koajs/static): 静态文件服务
    -   [csv-parser](https://github.com/mafintosh/csv-parser): 解析 CSV 文件
    -   [node-forge](https://github.com/digitalbazaar/forge): 用于 RSA 加密
    -   [qrcode](https://github.com/soldair/node-qrcode): 生成二维码
    -   [jszip](https://github.com/Stuk/jszip): 创建 ZIP 文件
-   **前端**:
    -   HTML5
    -   JavaScript (Fetch API)

## 项目结构

```
.
├── public/
│   ├── uploads/      # 存储上传的CSV文件
│   ├── qrcodes/      # 存储生成的二维码图片
│   └── index.html    # 前端上传页面
├── src/
│   ├── app.js        # Koa 应用核心逻辑
│   └── server.js     # 服务器启动脚本
├── package.json      # 项目依赖和脚本
└── README.md         # 项目说明
```

## 如何开始

1.  **安装依赖**:
    在项目根目录下运行以下命令来安装所有必需的 Node.js 模块。

    ```bash
    npm install
    ```

2.  **启动服务器**:
    运行以下命令来启动 Koa 服务器。

    ```bash
    npm start
    ```

    服务器将默认在 `3000` 端口上运行。您将在控制台看到以下消息：
    `Server running on http://localhost:3000`

3.  **使用应用**:
    -   打开您的网络浏览器并访问 [http://localhost:3000](http://localhost:3000)。
    -   点击 "Choose File" 按钮选择一个 `.csv` 文件。
    -   点击 "Upload and Generate" 按钮。
    -   服务器将处理文件，生成加密的二维码，并在页面上显示它们。
    -   点击 "Download All QR Codes" 按钮可以将所有图片打包下载。

## 注意事项

-   每次上传新的 CSV 文件时，服务器会先清空 `public/qrcodes` 目录中所有旧的二维码图片。
-   RSA 密钥对是在服务器启动时在内存中动态生成的。如果服务器重启，密钥将会改变。对于生产环境，您应该考虑生成并持久化存储密钥对。
-   加密后的字符串可能包含在文件名或 URL 中不安全的字符（如 `/`）。代码已将其替换为 `_` 以确保安全。
