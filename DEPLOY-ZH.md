# DRAFTJURY 部署步骤

## 1. 上传 GitHub

1. 在 GitHub 新建一个公开仓库，例如 `draftjury`。
2. 不要额外勾选 README、License 或 `.gitignore`。
3. 解压 `DRAFTJURY-GITHUB-UPLOAD.zip`。
4. 把解压后的全部内容上传到仓库根目录并提交。

## 2. 在 Remix 新建并编译合约

1. 打开 Remix。
2. 在 `contracts` 文件夹中新建 `DraftJury.sol`。
3. 复制本包 `contracts/src/DraftJury.sol` 的全部代码并保存。
4. 打开 Solidity Compiler。
5. 编译器选择 **0.8.24**，点击 **Compile DraftJury.sol**。

合约是单文件、无外部依赖。编译输出也已放在 `contracts/build`。

## 3. 部署到 BOT Chain Mainnet

先在钱包添加 BOT Chain：

- Network name: `BOT Chain Mainnet`
- RPC URL: `https://rpc.botchain.ai`
- Chain ID: `677`
- Currency symbol: `BOT`
- Block explorer: `https://scan.botchain.ai`

然后：

1. Remix 打开 **Deploy & Run Transactions**。
2. Environment 选择 **Browser Extension / Injected Provider - MetaMask**。
3. 确认钱包网络是 BOT Chain Mainnet。
4. Contract 选择 `DraftJury - DraftJury.sol`。
5. 构造函数没有参数，直接点击 **Deploy**。
6. 在钱包确认交易。
7. 部署完成后复制完整合约地址。

不要上传私钥或助记词。合约地址是公开信息。

## 4. 在 Vercel 部署前端

1. Vercel 选择 **Add New → Project**，导入刚才的 GitHub 仓库。
2. Project Name 可填写小写名称，例如 `draftjury`。
3. **Root Directory 必须选择 `frontend`**。
4. Framework Preset 选择 **Vite**。
5. Build Command 保持 `npm run build`。
6. Output Directory 保持 `dist`。
7. 展开 Environment Variables，添加：

```text
Key: VITE_DRAFTJURY_ADDRESS
Value: 0x你刚部署的完整合约地址
Environment: Production
Type: Config
```

8. 点击 Deploy。

## 5. 如果先部署了网页、后添加地址

进入 Vercel 项目：

1. Settings → Environment Variables，确认 `VITE_DRAFTJURY_ADDRESS` 已保存。
2. Deployments → 找到最新部署 → 三点菜单 → Redeploy。
3. 选择 Production。
4. **不要勾选 Use existing Build Cache**。
5. 点击 Redeploy。

网页顶部不再显示 Preview mode，就代表环境变量已进入构建。

## 6. 网页交互顺序

1. 点击 **Connect wallet**，选择浏览器中的钱包。
2. 如果网络不对，点击 **Add BOT Chain**。
3. 点击 **Start a duel**。
4. 填写问题、类别、Version A、Version B 和投票时长。
5. 点击 Review duel，核对后再进入钱包确认。
6. 换另一个钱包打开网页，在 Live desk 选择 A 或 B，填写理由并投票。
7. 每个钱包每个 Duel 只能投一次，创建者不能投自己的 Duel。
8. 截止后结果自动关闭；创建者也可以点击 **End my duel early** 提前结束。

## 7. 安全说明

- 连接钱包只请求读取账户，不会自动签名或发送交易。
- 创建、投票、提前结束都在独立确认页后才进入钱包。
- 不要输入或上传私钥、助记词、邮箱验证码。
- 项目未经专业安全审计，建议先用少量测试资金验证。
