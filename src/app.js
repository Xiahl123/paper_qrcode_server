const Koa = require('koa'); // 引入 Koa 框架
const Router = require('@koa/router'); // 引入 Koa 路由
const serve = require('koa-static'); // 引入 koa-static，用于处理静态文件
const { koaBody } = require('koa-body'); // 引入 koa-body，用于解析请求体
const fs = require('fs'); // 引入 Node.js 文件系统模块
const path = require('path'); // 引入 Node.js 路径处理模块
const forge = require('node-forge'); // 引入 node-forge 用于加密
const qrcode = require('qrcode'); // 引入 qrcode 用于生成二维码
const csv = require('csv-parser'); // 引入 csv-parser 用于解析 CSV 文件
const JSZip = require('jszip'); // 引入 jszip 用于创建 zip 文件

const app = new Koa(); // 创建 Koa 应用实例
const router = new Router(); // 创建路由实例

const uploadsDir = path.join(__dirname, '..', 'public', 'uploads'); // 上传文件存储目录
const qrcodesDir = path.join(__dirname, '..', 'public', 'qrcodes'); // 二维码图片存储目录

// 确保目录存在，如果不存在则创建
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(qrcodesDir)) fs.mkdirSync(qrcodesDir, { recursive: true });

// 生成 RSA 密钥对
const keys = forge.pki.rsa.generateKeyPair(2048);
const publicKey = keys.publicKey;
const Koa = require('koa'); // 引入 Koa 框架
const Router = require('@koa/router'); // 引入 Koa 路由
const serve = require('koa-static'); // 引入 koa-static，用于处理静态文件
const { koaBody } = require('koa-body'); // 引入 koa-body，用于解析请求体
const cors = require('@koa/cors'); // 引入 @koa/cors，用于处理跨域
const fs = require('fs'); // 引入 Node.js 文件系统模块
// ... existing code ...
const privateKey = keys.privateKey; // 私钥在此示例中未使用，但可用于解密

app.use(cors()); // 使用 cors 中间件，允许所有跨域请求
app.use(serve(path.join(__dirname, '..', 'public'))); // 使用 koa-static 中间件，托管 public 目录下的静态文件
app.use(koaBody({ multipart: true, formidable: { uploadDir: uploadsDir } })); // 使用 koa-body 中间件，处理文件上传

// ... existing code ...

// 定义 POST /upload 路由，用于处理文件上传和二维码生成
router.post('/upload', async (ctx) => {
    const file = ctx.request.files.csv; // 获取上传的 CSV 文件
    const results = []; // 存储 CSV 解析结果
    const qrCodeFiles = []; // 存储生成的二维码文件信息

    // 清空之前的二维码图片
    fs.readdirSync(qrcodesDir).forEach(f => fs.unlinkSync(path.join(qrcodesDir, f)));

    // 创建文件读取流并使用 csv-parser 解析
    const stream = fs.createReadStream(file.filepath)
        .pipe(csv({ headers: false }))
        .on('data', (data) => results.push(data));

    // 等待文件解析完成
    await new Promise((resolve, reject) => {
        stream.on('end', async () => {
            try {
                // 遍历 CSV 数据的每一行
                for (const row of results) {
                    // 遍历行中的每一个单元格
                    for (const cellValue in row) {
                        if (Object.prototype.hasOwnProperty.call(row, cellValue)) {
                            const originalString = row[cellValue]; // 获取单元格的原始字符串
                            if(originalString) {
                                // 使用 RSA-OAEP SHA-256 公钥加密
                                const encrypted = publicKey.encrypt(originalString, 'RSA-OAEP', {
                                    md: forge.md.sha256.create()
                                });
                                const encryptedString = forge.util.encode64(encrypted); // Base64 编码加密后的字符串
                                const safeEncryptedString = encryptedString.replace(/\//g, '_'); // 将文件名中的 / 替换为 _，使其对 URL 安全
                                const qrPath = path.join(qrcodesDir, `${safeEncryptedString}.jpg`); // 定义二维码图片的保存路径
                                
                                // 生成二维码图片并保存
                                await qrcode.toFile(qrPath, encryptedString, { type: 'jpeg' });
                                qrCodeFiles.push({ path: qrPath, name: `${safeEncryptedString}.jpg` });
                            }
                        }
                    }
                }
                // 返回成功信息和二维码路径列表
                ctx.body = {
                    message: 'QR codes generated successfully.',
                    qrCodes: qrCodeFiles.map(f => `/qrcodes/${f.name}`)
                };
                resolve();
            } catch (error) {
                console.error(error);
                ctx.status = 500;
                ctx.body = { error: 'Failed to generate QR codes.' };
                reject(error);
            }
        });
        stream.on('error', reject);
    });
});

// 定义 GET /download-all 路由，用于打包下载所有二维码
router.get('/download-all', async (ctx) => {
    const zip = new JSZip(); // 创建 JSZip 实例
    const files = fs.readdirSync(qrcodesDir); // 读取所有二维码文件名

    if (files.length === 0) {
        ctx.status = 404;
        ctx.body = 'No QR codes to download.';
        return;
    }

    // 将所有二维码文件添加到 zip 实例中
    files.forEach(file => {
        const filePath = path.join(qrcodesDir, file);
        zip.file(file, fs.readFileSync(filePath));
    });

    // 生成 zip 文件的 buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // 设置响应头，告诉浏览器这是一个 zip 文件下载
    ctx.set('Content-Type', 'application/zip');
    ctx.set('Content-Disposition', 'attachment; filename=qrcodes.zip');
    ctx.body = zipBuffer; // 发送 zip 文件
});

app.use(router.routes()).use(router.allowedMethods()); // 加载路由中间件

module.exports = app; // 导出 app 实例
