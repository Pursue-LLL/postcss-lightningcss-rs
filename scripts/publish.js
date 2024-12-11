/**
 * @file publish.js
 * @description 本地构建发布脚本，支持从macos编译linux和windows
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置信息
const config = {
  targets: [
    {
      platform: 'macos',
      target: 'x86_64-apple-darwin',
      build: 'yarn build --target x86_64-apple-darwin',
      outputDir: 'npm/darwin-x64',
      setup: 'rustup target add x86_64-apple-darwin',
    },
    {
      platform: 'macos',
      target: 'aarch64-apple-darwin',
      build: 'yarn build --target aarch64-apple-darwin',
      outputDir: 'npm/darwin-arm64',
      setup: 'rustup target add aarch64-apple-darwin',
    },
    {
      platform: 'linux',
      target: 'x86_64-unknown-linux-gnu',
      build: 'yarn build --target x86_64-unknown-linux-gnu',
      outputDir: 'npm/linux-x64-gnu',
      setup: [
        'rustup target add x86_64-unknown-linux-gnu',
      ],
    },
    {
      platform: 'linux',
      target: 'aarch64-unknown-linux-gnu',
      build: 'yarn build --target aarch64-unknown-linux-gnu',
      outputDir: 'npm/linux-arm64-gnu',
      setup: [
        'rustup target add aarch64-unknown-linux-gnu',
      ],
    },
    {
      platform: 'linux',
      target: 'aarch64-unknown-linux-musl',
      build: 'yarn build --target aarch64-unknown-linux-musl',
      outputDir: 'npm/linux-arm64-musl',
      setup: [
        'rustup target add aarch64-unknown-linux-musl',
      ],
    },
    // {
    //   platform: 'linux',
    //   target: 'x86_64-unknown-linux-musl',
    //   build: 'yarn build --target x86_64-unknown-linux-musl',
    //   outputDir: 'npm/linux-x64-musl',
    //   setup: [
    //     'rustup target add x86_64-unknown-linux-musl',
    //   ],
    // },
    {
      platform: 'windows',
      target: 'x86_64-pc-windows-msvc',
      build: 'yarn build --target x86_64-pc-windows-msvc',
      outputDir: 'npm/win32-x64-msvc',
      setup: 'rustup target add x86_64-pc-windows-msvc',
    },
    {
      platform: 'windows',
      target: 'aarch64-pc-windows-msvc',
      build: 'yarn build --target aarch64-pc-windows-msvc',
      outputDir: 'npm/win32-arm64-msvc',
      setup: 'rustup target add aarch64-pc-windows-msvc',
    }
  ],
};

// 执行命令
function exec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    console.error(`命令执行失败: ${command}`);
    console.error(error);
    return false;
  }
}

// 检查版本号格式
function checkVersion() {
  try {
    // 读取 package.json 获取版本号
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const { version } = packageJson;

    // 判断版本类型
    const isRelease = /^\d+\.\d+\.\d+$/.test(version);
    const isPreRelease = /^\d+\.\d+\.\d+-.+$/.test(version);

    return { isRelease, isPreRelease, version };
  } catch (error) {
    console.error('读取版本号失败');
    console.error(error);
    return { isRelease: false, isPreRelease: false, version: null };
  }
}

// 构建函数
async function build() {
  console.log('----启用 corepack...----');
  exec('corepack enable');
  console.log('----安装依赖...----');
  exec('yarn install');

  // 在检查依赖之前，先备份现有的 config.toml（如果存在的话）
  const cargoConfigPath = path.join(__dirname, '../.cargo/config.toml');
  const cargoConfigBackupPath = path.join(__dirname, '../.cargo/config.toml.backup');

  let hasExistingConfig = false;
  if (fs.existsSync(cargoConfigPath)) {
    console.log('备份现有的 cargo 配置...');
    fs.copyFileSync(cargoConfigPath, cargoConfigBackupPath);
    hasExistingConfig = true;
  }

  try {
    console.log('----检查依赖...----');
    checkDependencies();  // 这里会生成 config.local.toml

    // 将 config.local.toml 复制为 config.toml
    const localConfigPath = path.join(__dirname, '../.cargo/config.local.toml');
    if (fs.existsSync(localConfigPath)) {
      console.log('使用本地配置...');
      fs.copyFileSync(localConfigPath, cargoConfigPath);
    }

    console.log('----开始构建...----');
    // 确保 npm 目录存在
    const npmDir = path.join(__dirname, '../npm');
    if (!fs.existsSync(npmDir)) {
      fs.mkdirSync(npmDir, { recursive: true });
    }

    // 为每个目标平台构建
    for (const target of config.targets) {
      console.log(`构建 ${target.platform} - ${target.target}`);

      // 确保输出目录存在
      const outputDir = path.join(__dirname, '..', target.outputDir);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      if (target.setup) {
        console.log(`执行 setup 命令...`);
        // 处理 setup 命令数组
        const setupCommands = Array.isArray(target.setup) ? target.setup : [target.setup];
        for (const cmd of setupCommands) {
          console.log(`执行: ${cmd}`);
          const setupSuccess = exec(cmd);
          if (!setupSuccess) {
            console.error(`${target.platform} setup 失败: ${cmd}`);
            process.exit(1);
          }
        }
      }

      // 直接执行构建命令
      const buildSuccess = exec(target.build);
      if (!buildSuccess) {
        console.error(`${target.platform} 构建失败`);
        process.exit(1);
      }

      // 移动构建产物，排除 postcss-lightningcss-rs.node
      const nodeFiles = fs.readdirSync(path.join(__dirname, '../'))
        .filter((file) => file.endsWith('.node') && file !== 'postcss-lightningcss-rs.node');

      for (const file of nodeFiles) {
        const sourcePath = path.join(__dirname, '..', file);
        const targetPath = path.join(outputDir, file);

        fs.renameSync(sourcePath, targetPath);
        console.log(`移动 ${file} 到 ${target.outputDir}`);
      }
    }

    console.log('构建完成');
  } finally {
    // 恢复原始配置（如果存在）
    if (hasExistingConfig) {
      fs.copyFileSync(cargoConfigBackupPath, cargoConfigPath);
      fs.unlinkSync(cargoConfigBackupPath);
    } else {
      // 如果原来没有配置，删除临时创建的
      if (fs.existsSync(cargoConfigPath)) {
        fs.unlinkSync(cargoConfigPath);
      }
    }
  }
}

// 发布函数
async function publish() {
  console.log('检查版本...');
  const { isRelease, isPreRelease } = checkVersion();

  if (!isRelease && !isPreRelease) {
    console.log('不是发布提交，跳过发布');
    return;
  }
  if (!isRelease) {
    exec('yarn publish-beta');
  } else {
    exec('yarn publish-release');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const shouldBuild = args.includes('--build');
  const shouldPublish = args.includes('--publish');

  if (shouldBuild) {
    await build();
  }

  if (shouldPublish) {
    await publish();
  }

  if (!shouldBuild && !shouldPublish) {
    console.log('使用方法: node publish.js [--build] [--publish]');
  }
}

// 运行主函数
main().catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});

function generateCargoConfig() {
  console.log('正在生成 cargo 配置文件...');

  // 获取 homebrew 安装路径
  let homebrewPrefix;
  try {
    homebrewPrefix = execSync('brew --prefix', { encoding: 'utf8' }).trim();
    console.log('Homebrew 路径:', homebrewPrefix);

    // 验证链接器是否存在
    const linkers = [
      'x86_64-unknown-linux-gnu-gcc',
      'aarch64-unknown-linux-gnu-gcc',
      'aarch64-linux-musl-cc',
      'x86_64-linux-musl-cc'
    ];

    for (const linker of linkers) {
      const linkerPath = path.join(homebrewPrefix, 'bin', linker);
      if (!fs.existsSync(linkerPath)) {
        console.warn(`警告: 链接器不存在: ${linkerPath}`);
      } else {
        console.log(`找到链接器: ${linkerPath}`);
      }
    }
  } catch (error) {
    console.error('获取 homebrew 路径失败:', error);
    process.exit(1);
  }

  const configContent = `[source.crates-io]
replace-with = 'ustc'

[source.ustc]
registry = "sparse+https://mirrors.ustc.edu.cn/crates.io-index/"

[registries.ustc]
index = "https://mirrors.ustc.edu.cn/crates.io-index/"

# Linux GNU targets
[target.x86_64-unknown-linux-gnu]
linker = "${homebrewPrefix}/bin/x86_64-unknown-linux-gnu-gcc"
rustflags = ["-C", "target-feature=-crt-static"]

[target.aarch64-unknown-linux-gnu]
linker = "${homebrewPrefix}/bin/aarch64-unknown-linux-gnu-gcc"
rustflags = ["-C", "target-feature=-crt-static"]

# Linux MUSL targets
[target.aarch64-unknown-linux-musl]
linker = "${homebrewPrefix}/bin/aarch64-linux-musl-cc"
rustflags = ["-C", "target-feature=-crt-static"]

[target.x86_64-unknown-linux-musl]
linker = "${homebrewPrefix}/bin/x86_64-linux-musl-cc"
rustflags = ["-C", "target-feature=-crt-static"]
`;

  const configPath = path.join(__dirname, '../.cargo/config.local.toml');

  // 确保 .cargo 目录存在
  const cargoDir = path.dirname(configPath);
  if (!fs.existsSync(cargoDir)) {
    fs.mkdirSync(cargoDir, { recursive: true });
  }

  // 写入配置文件
  try {
    fs.writeFileSync(configPath, configContent, 'utf8');
    console.log('已生成 cargo 配置文件:', configPath);
  } catch (error) {
    console.error('生成 cargo 配置文件失败:', error);
    process.exit(1);
  }
}

function checkDependencies() {
  // 安装基本的交叉编译工具，支持从macos编译linux
  if (process.platform === 'darwin') {
    try {
      // 使用中科大源
      const HOMEBREW_CORE_GIT_REMOTE = 'https://mirrors.ustc.edu.cn/homebrew-core.git';
      const HOMEBREW_BOTTLE_DOMAIN = 'https://mirrors.ustc.edu.cn/homebrew-bottles';

      // 安装交叉编译工具链
      const commands = [
        'brew tap messense/macos-cross-toolchains',
        'brew install messense/macos-cross-toolchains/x86_64-unknown-linux-gnu',
        'brew install messense/macos-cross-toolchains/aarch64-unknown-linux-gnu',
        'brew install FiloSottile/musl-cross/musl-cross'
      ];

      for (const cmd of commands) {
        console.log(`执行命令: ${cmd}`);
        execSync(cmd, {
          stdio: 'inherit',
          env: {
            ...process.env,
            HOMEBREW_CORE_GIT_REMOTE,
            HOMEBREW_BOTTLE_DOMAIN
          }
        });
      }

      // 安装完工具链后生成配置文件
      generateCargoConfig();

    } catch (error) {
      console.error('安装交叉编译工具链失败:', error);
      process.exit(1);
    }
  }
}
