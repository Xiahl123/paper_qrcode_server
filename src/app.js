const Koa = require('koa'); // 引入 Koa 框架
const Router = require('@koa/router'); // 引入 Koa 路由
const serve = require('koa-static'); // 引入 koa-static，用于处理静态文件
const { koaBody } = require('koa-body'); // 引入 koa-body，用于解析请求体
const cors = require('@koa/cors'); // 引入 @koa/cors，用于处理跨域
const fs = require('fs'); // 引入 Node.js 文件系统模块
const path = require('path'); // 引入 Node.js 路径处理模块
require('dotenv').config(); // 加载环境变量
const crypto = require('crypto'); // 引入 Node.js crypto 用于 AES-GCM 加密
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

// 加载 AES-128-GCM 密钥（Base64 编码，16 字节）
const aesKeyBase64 = process.env.AES_KEY_B64;
let aesKey;

try {
    if (!aesKeyBase64) {
        throw new Error('缺少 AES_KEY_B64 环境变量（Base64 编码的 16 字节密钥）。');
    }

    aesKey = Buffer.from(aesKeyBase64, 'base64');

    if (aesKey.length !== 16) {
        throw new Error('AES_KEY_B64 长度无效，请提供精确 16 字节的 Base64 编码密钥。');
    }

    console.log('AES-128-GCM 密钥加载成功');
} catch (error) {
    console.error(`错误：${error.message}`);
    process.exit(1);
}

// Base85 (Git/Python b85) 编码实现，用于将二进制密文转为可放入二维码的短字符串
const base85Alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';
const base85Encode = (buffer) => {
    let output = '';

    for (let i = 0; i < buffer.length; i += 4) {
        const chunk = buffer.slice(i, i + 4);
        const padding = 4 - chunk.length;
        let value = 0;

        for (let j = 0; j < chunk.length; j++) {
            value = (value << 8) + chunk[j];
        }

        // 尾部零填充，保证按 4 字节块转 32 位整数
        for (let j = 0; j < padding; j++) {
            value <<= 8;
        }

        const encodedChunk = new Array(5);
        for (let k = 4; k >= 0; k--) {
            encodedChunk[k] = base85Alphabet[value % 85];
            value = Math.floor(value / 85);
        }

        // 移除为填充字节产生的尾部字符
        output += encodedChunk.slice(0, 5 - padding).join('');
    }

    return output;
};

app.use(cors()); // 使用 cors 中间件，允许所有跨域请求
app.use(serve(path.join(__dirname, '..', 'public'))); // 使用 koa-static 中间件，托管 public 目录下的静态文件
app.use(koaBody({ multipart: true, formidable: { uploadDir: uploadsDir } })); // 使用 koa-body 中间件，处理文件上传

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
                            if (originalString) {
                                // 使用 AES-128-GCM 加密，输出 Base85 文本
                                const iv = crypto.randomBytes(12); // GCM 推荐 12 字节随机 IV
                                const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, iv);
                                const ciphertext = Buffer.concat([
                                    cipher.update(originalString, 'utf8'),
                                    cipher.final()
                                ]);
                                const authTag = cipher.getAuthTag();

                                // 组合 nonce + ciphertext + tag，与 Python AESGCM.encrypt 输出一致
                                const encryptedBuffer = Buffer.concat([iv, ciphertext, authTag]);
                                const encryptedString = base85Encode(encryptedBuffer);

                                // 使用原始字符串作为文件名（更短且有意义）
                                const safeFileName = originalString.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_'); // 移除特殊字符
                                const qrPath = path.join(qrcodesDir, `${safeFileName}.jpg`); // 定义二维码图片的保存路径
                                
                                // 生成二维码图片并保存（二维码内容仍是加密字符串）
                                await qrcode.toFile(qrPath, encryptedString, { type: 'jpeg' });
                                qrCodeFiles.push({ path: qrPath, name: `${safeFileName}.jpg` });
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
