# Release 流程与密钥配置

本文档说明发布流程中所涉及的密钥/Secret 的用途，以及如何在 GitHub 仓库中配置它们。

---

## 密钥一览

| Secret 名称 | 是否必须 | 用途 |
|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | 否（当前未启用） | 用于对 release 产物进行签名，客户端更新器用对应公钥验证安装包真实性 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 否（当前未启用） | 解锁上述私钥文件的密码（生成密钥时设置，可为空） |
| `GITHUB_TOKEN` | 自动提供 | GitHub Actions 自动注入，用于创建/上传 Release 资产，**无需手动配置** |

---

## TAURI_SIGNING_PRIVATE_KEY 和 TAURI_SIGNING_PRIVATE_KEY_PASSWORD

### 用途

Tauri 提供了内置的**自动更新（Updater）**功能。为防止用户下载到被篡改的安装包，每次构建时需要用一个 **Ed25519 私钥** 对产物进行签名。签名结果会随安装包一起发布（`.sig` 文件）。客户端在收到更新时，会用 `tauri.conf.json` 中配置的**公钥**验证签名，签名不匹配则拒绝更新。

```
构建时：  私钥（存在 GitHub Secret 里）  →  对安装包签名  →  生成 .sig 文件
运行时：  客户端用公钥（写死在 tauri.conf.json 里）  →  验证 .sig  →  安全安装
```

### 生成密钥对

使用 Tauri CLI 一键生成 Ed25519 密钥对：

```bash
npx tauri signer generate -w ~/.tauri/fat-clip.key
```

命令会输出类似内容：

```
Please enter a password to protect the secret key (optional, press Enter to skip): 
Your keypair was generated successfully
Public key: dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk...
Private key path: /home/you/.tauri/fat-clip.key
```

> ⚠️ **私钥文件请妥善保管，不要提交到代码仓库！**

### 配置公钥（写入代码）

将生成的公钥写入 `src-tauri/tauri.conf.json`，放在 `plugins.updater` 节点下：

```json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk...",
      "endpoints": [
        "https://github.com/wosledon/fat-clip/releases/latest/download/latest.json"
      ]
    }
  }
}
```

### 配置私钥（写入 GitHub Secrets）

1. 打开仓库页面，进入 **Settings → Secrets and variables → Actions**
2. 点击 **New repository secret**，添加以下两个 Secret：

   | Name | Value |
   |---|---|
   | `TAURI_SIGNING_PRIVATE_KEY` | 私钥文件的**完整内容**（`cat ~/.tauri/fat-clip.key`） |
   | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 生成密钥时设置的密码（若未设置密码则填空字符串，但仍需创建该 Secret） |

### 不需要自动更新时（当前状态）

当前 `release.yml` 已移除签名相关的 `env` 配置，构建时**不会生成 `.sig` 签名文件**，也不需要在 GitHub Secrets 中配置任何密钥，可直接运行。

### 需要启用自动更新时

当你准备好添加自动更新功能，在 `release.yml` 三个平台的"Build Tauri App"步骤中加回如下 `env`：

```yaml
- name: Build Tauri App
  run: npx tauri build
  env:
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
```

然后按照上方"生成密钥对"和"配置 GitHub Secrets"的步骤完成配置。

---

## GITHUB_TOKEN

`GITHUB_TOKEN` 由 GitHub Actions 在每次 workflow 运行时**自动生成并注入**，不需要手动创建。它用于：

- 调用 GitHub API 创建 Release（`github.rest.repos.createRelease`）
- 上传安装包到 Release（`actions/upload-release-asset`）
- 将 Release 从草稿状态发布为正式版

其有效期仅限当次 workflow 运行，结束后自动失效。

---

## 参考资料

- [Tauri 官方文档 - Updater](https://tauri.app/plugin/updater/)
- [Tauri 官方文档 - Code Signing](https://tauri.app/distribute/sign/)
- [GitHub 文档 - Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
