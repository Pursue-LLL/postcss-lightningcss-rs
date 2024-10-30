const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置信息
const config = {
  targets: [
    {
      platform: 'macos',
      target: 'x86_64-apple-darwin',
      build: 'napi build --cargo-cwd crates/binding --platform --target x86_64-apple-darwin --release',
      outputDir: 'npm/darwin-x64'
    },
    {
      platform: 'macos',
      target: 'aarch64-apple-darwin',
      build: 'napi build --cargo-cwd crates/binding --platform --target aarch64-apple-darwin --release',
      outputDir: 'npm/darwin-arm64'
    },
    // {
    //   platform: 'windows',
    //   target: 'x86_64-pc-windows-msvc',
    //   build: 'napi build --cargo-cwd crates/binding --target x86_64-pc-windows-msvc --release',
    //   outputDir: 'npm/win32-x64-msvc'
    // },
    // {
    //   platform: 'windows',
    //   target: 'aarch64-pc-windows-msvc',
    //   build: 'napi build --cargo-cwd crates/binding --target aarch64-pc-windows-msvc --release',
    //   outputDir: 'npm/win32-arm64-msvc'
    // },
    // {
    //   platform: 'linux',
    //   target: 'x86_64-unknown-linux-gnu',
    //   build: 'napi build --cargo-cwd crates/binding --target x86_64-unknown-linux-gnu --release',
    //   outputDir: 'npm/linux-x64-gnu'
    // },
    // {
    //   platform: 'linux',
    //   target: 'aarch64-unknown-linux-gnu',
    //   build: 'napi build --cargo-cwd crates/binding --target aarch64-unknown-linux-gnu --release',
    //   outputDir: 'npm/linux-arm64-gnu'
    // },
    // {
    //   platform: 'linux',
    //   target: 'aarch64-unknown-linux-musl',
    //   build: 'napi build --cargo-cwd crates/binding --target aarch64-unknown-linux-musl --release',
    //   outputDir: 'npm/linux-arm64-musl'
    // },

  ]
};

// 执行命令的辅助函数
function exec(command) {
  try {
    execSync(command, { stdio: 'inherit' });
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
    // 读取任意一个平台的 package.json 获取版本号
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const version = packageJson.version;

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
  console.log('开始构建...');

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

    // 执行构建
    if (!exec(target.build)) {
      console.error(`${target.platform} 构建失败`);
      process.exit(1);
    }

    // 移动构建产物
    const nodeFiles = fs.readdirSync(path.join(__dirname, '../'))
      .filter(file => file.endsWith('.node'));

    for (const file of nodeFiles) {
      const sourcePath = path.join(__dirname, '..', file);
      const targetPath = path.join(outputDir, file);

      fs.renameSync(sourcePath, targetPath);
      console.log(`移动 ${file} 到 ${target.outputDir}`);
    }
  }

  console.log('构建完成');
}

// 发布函数
async function publish() {
  console.log('检查版本...');
  const { isRelease, isPreRelease } = checkVersion();

  if (!isRelease && !isPreRelease) {
    console.log('不是发布提交，跳过发布');
    return;
  }
  if (isRelease) {
    if (!exec('npm publish --access public')) {
      hasError = true;
    }
  } else if (isPreRelease) {
    if (!exec('npm publish --tag next --access public')) {
      hasError = true;
    }
  }

  if (hasError) {
    console.error('发布过程中存在错误');
    process.exit(1);
  } else {
    console.log('所有平台发布完成');
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
    console.log('使用方法: node build-and-publish.js [--build] [--publish]');
  }
}

// 运行主函数
main().catch(error => {
  console.error('发生错误:', error);
  process.exit(1);
});
