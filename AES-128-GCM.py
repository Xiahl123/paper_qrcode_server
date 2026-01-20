from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64
import os

class CompactAESCipher:
    def __init__(self, key: bytes = None):
        """初始化，可传入现有密钥或生成新密钥"""
        if key is None:
            # 生成新的 AES-128 密钥（16字节）
            self.key = os.urandom(16)
        else:
            self.key = key
        
        # 创建 AES-GCM 加密器
        self.aesgcm = AESGCM(self.key)
    
    def encrypt(self, plaintext: str) -> str:
        """加密文本，返回紧凑的Base85字符串"""
        # 生成随机nonce（12字节）
        nonce = os.urandom(12)
        
        # 加密（GCM模式自动处理认证）
        ciphertext = self.aesgcm.encrypt(nonce, plaintext.encode(), None)
        
        # 组合 nonce + ciphertext，然后用Base85编码
        combined = nonce + ciphertext
        encrypted_b85 = base64.b85encode(combined).decode()
        
        return encrypted_b85
    
    def decrypt(self, encrypted_b85: str) -> str:
        """解密Base85编码的加密字符串"""
        # Base85解码
        combined = base64.b85decode(encrypted_b85.encode())
        
        # 分离 nonce（前12字节）和 ciphertext
        nonce = combined[:12]
        ciphertext = combined[12:]
        
        # 解密
        plaintext = self.aesgcm.decrypt(nonce, ciphertext, None)
        
        return plaintext.decode()
    
    def get_key(self) -> str:
        """获取密钥的Base64编码（用于存储）"""
        return base64.b64encode(self.key).decode()
    
    @staticmethod
    def load_key(key_b64: str):
        """从Base64编码的密钥创建实例"""
        key = base64.b64decode(key_b64.encode())
        return CompactAESCipher(key)

# 使用示例
if __name__ == "__main__":
    # 1. 创建加密器（首次使用）
    cipher = CompactAESCipher()
    
    # 保存密钥供长期使用
    persistent_key = cipher.get_key()
    print("请保存此密钥供长期使用:", persistent_key)
    
    # 2. 加密测试
    test_messages = [
        "Hello World!",
        "这是一段中文测试消息",
        "A" * 50,  # 长文本测试
        "Short"
    ]
    
    for msg in test_messages:
        encrypted = cipher.encrypt(msg)
        decrypted = cipher.decrypt(encrypted)
        
        print(f"\n原始: {msg}")
        print(f"加密后长度: {len(encrypted)}")
        print(f"加密结果: {encrypted}")
        print(f"解密: {decrypted}")
        print(f"验证: {'✓' if msg == decrypted else '✗'}")
    
    # 3. 长期使用示例（重新加载密钥）
    print("\n" + "="*50)
    print("长期使用示例:")
    
    # 模拟重新加载密钥
    reloaded_cipher = CompactAESCipher.load_key(persistent_key)
    
    # 用相同的密钥加密新消息
    new_message = "这是用相同密钥加密的新消息"
    encrypted_again = reloaded_cipher.encrypt(new_message)
    decrypted_again = reloaded_cipher.decrypt(encrypted_again)
    
    print(f"新消息加密长度: {len(encrypted_again)}")
    print(f"加解密验证: {'✓' if new_message == decrypted_again else '✗'}")