import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function getPackageJson(relPath = 'package.json') {
  const fullPath = path.join(ROOT_DIR, relPath);
  return {
    path: fullPath,
    data: JSON.parse(fs.readFileSync(fullPath, 'utf8'))
  };
}

function savePackageJson(pkgObj) {
  fs.writeFileSync(pkgObj.path, JSON.stringify(pkgObj.data, null, 2) + '\n', 'utf8');
}

function calculateSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function parseSemver(versionStr) {
  const match = versionStr.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null
  };
}

function bumpVersion(typeOrVersion) {
  const rootPkg = getPackageJson('package.json');
  const currentVersion = rootPkg.data.version || '1.0.0';
  let newVersion = '';

  const parsed = parseSemver(currentVersion);
  if (!parsed) {
    throw new Error(`Unable to parse current version: ${currentVersion}`);
  }

  const target = (typeOrVersion || 'patch').toLowerCase();
  if (target === 'patch') {
    newVersion = `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  } else if (target === 'minor') {
    newVersion = `${parsed.major}.${parsed.minor + 1}.0`;
  } else if (target === 'major') {
    newVersion = `${parsed.major + 1}.0.0`;
  } else if (parseSemver(typeOrVersion)) {
    newVersion = typeOrVersion.replace(/^v/, '');
  } else {
    throw new Error(`Invalid bump target "${typeOrVersion}". Use "patch", "minor", "major", or a valid semver string like "1.0.1".`);
  }

  console.log(`\n📦 Bumping version: ${currentVersion} -> ${newVersion}`);

  // 1. Root package.json
  rootPkg.data.version = newVersion;
  savePackageJson(rootPkg);
  console.log(`✓ Updated root package.json to ${newVersion}`);

  // 2. Client package.json
  const clientPkg = getPackageJson('client/package.json');
  clientPkg.data.version = newVersion;
  savePackageJson(clientPkg);
  console.log(`✓ Updated client/package.json to ${newVersion}`);

  // 3. Server package.json
  const serverPkg = getPackageJson('server/package.json');
  serverPkg.data.version = newVersion;
  savePackageJson(serverPkg);
  console.log(`✓ Updated server/package.json to ${newVersion}`);

  return newVersion;
}

function buildBinaries() {
  console.log('\n🔨 Building production client and Windows executables...');
  execSync('npm run dist:exe', { cwd: ROOT_DIR, stdio: 'inherit' });
}

function generateChecksums(version) {
  const releaseDir = path.join(ROOT_DIR, 'release');
  if (!fs.existsSync(releaseDir)) {
    throw new Error(`Release directory ${releaseDir} does not exist. Run "npm run dist:exe" first.`);
  }

  const files = fs.readdirSync(releaseDir);
  const exeFiles = files.filter(f => f.endsWith('.exe'));

  if (exeFiles.length === 0) {
    throw new Error(`No .exe files found in ${releaseDir}.`);
  }

  console.log(`\n🔒 Calculating SHA-256 Checksums for ${exeFiles.length} binary files:`);
  const lines = [];
  const checksumMap = {};

  for (const exe of exeFiles) {
    const fullPath = path.join(releaseDir, exe);
    const hash = calculateSha256(fullPath);
    lines.push(`${hash}  ${exe}`);
    checksumMap[exe] = hash;
    console.log(`  ${exe} -> ${hash}`);
  }

  const checksumFile = path.join(releaseDir, 'SHA256SUMS.txt');
  fs.writeFileSync(checksumFile, lines.join('\n') + '\n', 'utf8');
  console.log(`✓ Checksums saved to ${checksumFile}`);

  return { exeFiles, checksumMap, checksumFile };
}

function generateReleaseNotes(version, checksumMap) {
  let notes = `## Airbound v${version} — Desktop Standalone Release\n\n`;
  notes += `Standalone Windows desktop release for **Microsoft Flight Simulator 2024** career tracking, live telemetry, dynamic dispatch, and fleet management.\n\n`;
  notes += `### 🚀 Highlights\n`;
  notes += `- **Zero-Config Local Database**: Automatically starts an embedded database saving to \`%APPDATA%\\Airbound\\data\\db\`. Zero MongoDB Atlas or cloud configuration required.\n`;
  notes += `- **Keyless Open-Source Maps**: Cockpit Dark (Carto), OpenStreetMap (VFR), and Satellite Imagery (Esri) map layers built-in with one-click toggling.\n`;
  notes += `- **Rent-to-Own Fleet System**: Lease any aircraft from the catalog and earn equity toward full buyout on every commercial flight.\n`;
  notes += `- **Pilot Progression & Dynamic XP**: XP awards with butter landing detection across Light GA, Twins, Jets, and Airliners.\n`;
  notes += `- **Native MSFS SimConnect Bridge**: Direct live flight telemetry tracking (Alt, Heading, Airspeed, Touchdown FPM, Parking Brake, Engines).\n\n`;
  notes += `### 📦 Downloads & Checksums\n\n`;
  notes += `| File | Type | SHA-256 Checksum |\n`;
  notes += `| :--- | :--- | :--- |\n`;

  for (const [file, hash] of Object.entries(checksumMap)) {
    const type = file.includes('Setup') ? 'Windows Installer' : 'Portable Standalone';
    notes += `| **${file}** | ${type} | \`${hash}\` |\n`;
  }

  notes += `\n> **Windows SmartScreen Note**: When launching on Windows for the first time, click **"More Info"** then **"Run anyway"**.\n`;

  return notes;
}

function checkGhCli() {
  const result = spawnSync('gh', ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    console.error('❌ GitHub CLI ("gh") is not installed or not in PATH.');
    console.error('   Install from: https://cli.github.com/ or use GitHub Actions.');
    process.exit(1);
  }

  const authCheck = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
  if (authCheck.status !== 0) {
    console.error('❌ You are not logged into GitHub CLI.');
    console.error('   Run "gh auth login" to authenticate.');
    process.exit(1);
  }
}

function publishToGithub(version, isDraft = false) {
  checkGhCli();
  const tag = `v${version}`;
  const releaseDir = path.join(ROOT_DIR, 'release');

  const { exeFiles, checksumMap, checksumFile } = generateChecksums(version);
  const notes = generateReleaseNotes(version, checksumMap);

  const notesFile = path.join(releaseDir, 'RELEASE_NOTES.md');
  fs.writeFileSync(notesFile, notes, 'utf8');

  const filesToUpload = [
    ...exeFiles.map(f => path.join(releaseDir, f)),
    checksumFile
  ];

  // Include latest.yml if present
  const latestYml = path.join(releaseDir, 'latest.yml');
  if (fs.existsSync(latestYml)) {
    filesToUpload.push(latestYml);
  }

  console.log(`\n🚀 Publishing Release ${tag} to GitHub with ${filesToUpload.length} assets...`);

  const args = [
    'release', 'create', tag,
    ...filesToUpload,
    '--title', `Airbound ${tag}`,
    '--notes-file', notesFile,
    '--clobber'
  ];

  if (isDraft) {
    args.push('--draft');
  }

  const proc = spawnSync('gh', args, { cwd: ROOT_DIR, stdio: 'inherit' });
  if (proc.status !== 0) {
    console.error(`\n❌ Failed to publish release ${tag} via GitHub CLI.`);
    process.exit(1);
  }

  console.log(`\n🎉 Release ${tag} successfully published to GitHub!`);
}

// CLI Dispatcher
const command = process.argv[2] || 'help';
const arg = process.argv[3];

switch (command) {
  case 'bump': {
    const newVer = bumpVersion(arg);
    console.log(`\nNext step: Commit changes and tag with: git commit -am "chore: bump version to v${newVer}" && git tag v${newVer}`);
    break;
  }
  case 'build': {
    buildBinaries();
    break;
  }
  case 'checksums': {
    const rootPkg = getPackageJson('package.json');
    generateChecksums(rootPkg.data.version);
    break;
  }
  case 'publish': {
    const rootPkg = getPackageJson('package.json');
    const isDraft = process.argv.includes('--draft');
    publishToGithub(rootPkg.data.version, isDraft);
    break;
  }
  case 'all': {
    let ver = getPackageJson('package.json').data.version;
    if (arg && arg !== '--draft') {
      ver = bumpVersion(arg);
    }
    buildBinaries();
    const isDraft = process.argv.includes('--draft');
    publishToGithub(ver, isDraft);
    break;
  }
  case 'help':
  default: {
    console.log(`
Airbound Release CLI:
  npm run release:bump [patch|minor|major|<ver>] - Bump version across all packages
  npm run release:build                         - Build React client and Windows .exe packages
  npm run release:publish [--draft]             - Generate checksums and publish current .exe to GitHub Releases
  npm run release [patch|minor|major|<ver>]     - Bump, build, and publish in one command
`);
    break;
  }
}
