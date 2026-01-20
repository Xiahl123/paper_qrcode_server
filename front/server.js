require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

// 动态配置接口，供前端获取环境变量
app.get('/config.js', (req, res) => {
    res.type('application/javascript');
    res.send(`window.APP_CONFIG = { backendUrl: "${backendUrl}" };`);
});

// 托管静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 所有路由返回 index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`前端服务器运行在 http://localhost:${port}`);
});
