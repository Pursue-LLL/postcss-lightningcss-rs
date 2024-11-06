/**
 * @file publish.js
 * @description Local build and publish script
 */

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Configuration
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
      docker: {
        image: 'ghcr.io/napi-rs/napi-rs/nodejs-rust:lts-debian',
        platform: 'linux/amd64',
      },
    },
    {
      platform: 'linux',
      target: 'aarch64-unknown-linux-gnu',
      build: 'yarn build --target aarch64-unknown-linux-gnu',
      outputDir: 'npm/linux-arm64-gnu',
      docker: {
        image: 'ghcr.io/napi-rs/napi-rs/nodejs-rust:lts-debian-aarch64',
        platform: 'linux/arm64',
      },
    },
    {
      platform: 'linux',
      target: 'aarch64-unknown-linux-musl',
      build: 'yarn build --target aarch64-unknown-linux-musl',
      outputDir: 'npm/linux-arm64-musl',
      docker: {
        image: 'ghcr.io/napi-rs/napi-rs/nodejs-rust:lts-alpine',
        platform: 'linux/arm64',
        setup: 'rustup target add aarch64-unknown-linux-musl',
      },
    },
    {
      platform: 'windows',
      target: 'x86_64-pc-windows-msvc',
      build: 'yarn build --target x86_64-pc-windows-msvc',
      outputDir: 'npm/win-x64-msvc',
      setup: 'rustup target add x86_64-pc-windows-msvc',
    },
    {
      platform: 'windows',
      target: 'aarch64-pc-windows-msvc',
      build: 'yarn build --target aarch64-pc-windows-msvc',
      outputDir: 'npm/win-arm64-msvc',
      setup: 'rustup target add aarch64-pc-windows-msvc',
    }
  ],
};

// Execute command
function exec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    console.error(`Command execution failed: ${command}`);
    console.error(error);
    return false;
  }
}

// Create cache directories
function ensureCacheDirs() {
  const userHome = os.homedir();
  const dirs = [
    '.cargo/git/db',
    '.cargo/registry/cache',
    '.cargo/registry/index',
  ];

  dirs.forEach(dir => {
    const fullPath = path.join(userHome, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
}

// Check if Docker image exists
function checkImage(imageName) {
  try {
    execSync(`docker image inspect ${imageName}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Pull Docker image
function pullImage(target) {
  console.log(`Pulling image: ${target.docker.image}`);
  try {
    // Ensure correct platform image
    const pullCommand = `docker pull --platform ${target.docker.platform} ${target.docker.image}`;
    console.log('Pull command:', pullCommand);
    execSync(pullCommand, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error('Failed to pull image:', error);
    return false;
  }
}

// Build in Docker
function buildInDocker(target) {
  const projectRoot = path.join(__dirname, '..');
  const userHome = os.homedir();

  // Check and pull image
  if (!checkImage(target.docker.image)) {
    if (!pullImage(target)) {
      throw new Error(`Unable to pull image: ${target.docker.image}`);
    }
  }

  // Build Docker command array
  const dockerArgs = [
    'docker',
    'run',
    '--pull never',
    '--rm',
    `--platform ${target.docker.platform}`,
    '--user 0:0',
    `-v ${userHome}/.cargo/git/db:/usr/local/cargo/git/db`,
    `-v ${userHome}/.cargo/registry/cache:/usr/local/cargo/registry/cache`,
    `-v ${userHome}/.cargo/registry/index:/usr/local/cargo/registry/index`,
    `-v ${projectRoot}:/build`,
    '-w /build',
    target.docker.image
  ];

  // Build command array
  const commands = [
    'corepack enable',
    'corepack prepare yarn@4.5.1 --activate',
    'yarn install',
    target.docker.setup,
    target.build
  ].filter(Boolean); // Remove empty values

  // Join commands into a string
  const shellCommand = commands.join(' && ');

  // Add shell command to Docker args
  dockerArgs.push('sh', '-c', `"${shellCommand}"`);

  // Build complete Docker command
  const dockerCommand = dockerArgs.join(' ');

  console.log('Executing Docker command:', dockerCommand);

  try {
    return exec(dockerCommand, {
      stdio: 'inherit',  // Show detailed output
      shell: true        // Use shell to execute
    });
  } catch (error) {
    console.error('Docker command execution failed:', error);
    throw error;
  }
}

// Check version format
function checkVersion() {
  try {
    // Read version from package.json
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const { version } = packageJson;

    // Check version type
    const isRelease = /^\d+\.\d+\.\d+$/.test(version);
    const isPreRelease = /^\d+\.\d+\.\d+-.+$/.test(version);

    return { isRelease, isPreRelease, version };
  } catch (error) {
    console.error('Failed to read version');
    console.error(error);
    return { isRelease: false, isPreRelease: false, version: null };
  }
}

// Build function
async function build() {
  console.log('Starting build...');

  // Ensure npm directory exists
  const npmDir = path.join(__dirname, '../npm');
  if (!fs.existsSync(npmDir)) {
    fs.mkdirSync(npmDir, { recursive: true });
  }

  // Ensure Docker cache directories exist
  ensureCacheDirs();

  // Build for each target platform
  for (const target of config.targets) {
    console.log(`Building ${target.platform} - ${target.target}`);

    // Ensure output directory exists
    const outputDir = path.join(__dirname, '..', target.outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Execute setup command if exists
    if (target.setup) {
      console.log(`Executing setup command: ${target.setup}`);
      const setupSuccess = exec(target.setup);
      if (!setupSuccess) {
        console.error(`${target.platform} setup failed`);
        process.exit(1);
      }
    }

    // Execute build command based on Docker requirement
    const buildSuccess = target.docker ? buildInDocker(target) : exec(target.build);

    if (!buildSuccess) {
      console.error(`${target.platform} build failed`);
      process.exit(1);
    }

    // Move build artifacts
    const nodeFiles = fs.readdirSync(path.join(__dirname, '../'))
      .filter((file) => file.endsWith('.node'));

    for (const file of nodeFiles) {
      const sourcePath = path.join(__dirname, '..', file);
      const targetPath = path.join(outputDir, file);

      fs.renameSync(sourcePath, targetPath);
      console.log(`Moved ${file} to ${target.outputDir}`);
    }
  }

  console.log('Build completed');
}

// Publish function
async function publish() {
  console.log('Checking version...');
  const { isRelease, isPreRelease } = checkVersion();

  if (!isRelease && !isPreRelease) {
    console.log('Not a release commit, skipping publish');
    return;
  }
  if (isRelease) {
    exec('yarn publish --access public');
  } else {
    exec('yarn publish --tag next --access public');
  }
}

// Main function
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
    console.log('Usage: node build-and-publish.js [--build] [--publish]');
  }
}

// Run main function
main().catch((error) => {
  console.error('Error occurred:', error);
  process.exit(1);
});