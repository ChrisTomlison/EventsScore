import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CONTRACT_NAME = "EventsScore";

// <root>/EventsScore/backend
const rel = "../backend";

// <root>/EventsScore/frontend/abi
const outdir = path.resolve("./abi");

if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir);
}

const dir = path.resolve(rel);
const dirname = path.basename(dir);

const line =
  "\n===================================================================\n";

if (!fs.existsSync(dir)) {
  console.error(
    `${line}Unable to locate ${rel}. Expecting <root>/EventsScore/${dirname}${line}`
  );
  process.exit(1);
}

if (!fs.existsSync(outdir)) {
  console.error(`${line}Unable to locate ${outdir}.${line}`);
  process.exit(1);
}

const deploymentsDir = path.join(dir, "deployments");

function deployOnHardhatNode() {
  if (process.platform === "win32") {
    // Not supported on Windows
    return;
  }
  try {
    execSync(`./deploy-hardhat-node.sh`, {
      cwd: path.resolve("./scripts"),
      stdio: "inherit",
    });
  } catch (e) {
    console.error(`${line}Script execution failed: ${e}${line}`);
    process.exit(1);
  }
}

function readDeployment(chainName, chainId, contractName, optional) {
  const chainDeploymentDir = path.join(deploymentsDir, chainName);

  if (!fs.existsSync(chainDeploymentDir) && chainId === 31337) {
    // Try to auto-deploy the contract on hardhat node!
    deployOnHardhatNode();
  }

  if (!fs.existsSync(chainDeploymentDir)) {
    if (!optional) {
      // Only show error and exit for required deployments
      console.error(
        `${line}Unable to locate '${chainDeploymentDir}' directory.\n\n1. Goto '${dirname}' directory\n2. Run 'npx hardhat deploy --network ${chainName}'.${line}`
      );
      process.exit(1);
    }
    // For optional deployments, silently return undefined
    return undefined;
  }

  const jsonString = fs.readFileSync(
    path.join(chainDeploymentDir, `${contractName}.json`),
    "utf-8"
  );

  const obj = JSON.parse(jsonString);
  obj.chainId = chainId;

  return obj;
}

// Try to read from hardhat network first (for Windows compatibility), then localhost
let deployLocalhost = readDeployment("hardhat", 31337, CONTRACT_NAME, true /* optional */);
if (!deployLocalhost) {
  deployLocalhost = readDeployment("localhost", 31337, CONTRACT_NAME, true /* optional */);
}

// If no deployment found, read ABI from compiled artifacts
if (!deployLocalhost) {
  const artifactPath = path.join(dir, "artifacts", "contracts", `${CONTRACT_NAME}.sol`, `${CONTRACT_NAME}.json`);
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    deployLocalhost = {
      abi: artifact.abi,
      address: "0x0000000000000000000000000000000000000000",
      chainId: 31337
    };
    console.log(`${line}No deployment found. Using ABI from compiled artifacts with placeholder address.${line}`);
  } else {
    console.error(`${line}Unable to locate deployment or compiled artifact for ${CONTRACT_NAME}.${line}`);
    process.exit(1);
  }
}

// Sepolia is optional - automatically skip if not deployed
let deploySepolia = readDeployment("sepolia", 11155111, CONTRACT_NAME, true /* optional */);
if (!deploySepolia) {
  console.log(`${line}Sepolia deployment not found. Skipping Sepolia address mapping.${line}`);
  deploySepolia = { abi: deployLocalhost.abi, address: "0x0000000000000000000000000000000000000000" };
}

// Validate ABI consistency if both deployments exist
if (deployLocalhost && deploySepolia && deploySepolia.address !== "0x0000000000000000000000000000000000000000") {
  if (
    JSON.stringify(deployLocalhost.abi) !== JSON.stringify(deploySepolia.abi)
  ) {
    console.error(
      `${line}Deployments on localhost and Sepolia differ. Cant use the same abi on both networks. Consider re-deploying the contracts on both networks.${line}`
    );
    process.exit(1);
  }
}


const tsCode = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const ${CONTRACT_NAME}ABI = ${JSON.stringify({ abi: deployLocalhost.abi }, null, 2)} as const;
\n`;
// Build addresses object dynamically
const addressesEntries = [];

// Only include localhost/hardhat if it's deployed (not zero address)
if (deployLocalhost && deployLocalhost.address !== "0x0000000000000000000000000000000000000000") {
  addressesEntries.push(
    `"31337": { address: "${deployLocalhost.address}", chainId: 31337, chainName: "hardhat" }`
  );
}

// Only include Sepolia if it's deployed (not zero address)
if (deploySepolia && deploySepolia.address !== "0x0000000000000000000000000000000000000000") {
  addressesEntries.push(
    `"11155111": { address: "${deploySepolia.address}", chainId: 11155111, chainName: "sepolia" }`
  );
}

const tsAddresses = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const ${CONTRACT_NAME}Addresses = { 
  ${addressesEntries.join(",\n  ")}
};
`;

console.log(`Generated ${path.join(outdir, `${CONTRACT_NAME}ABI.ts`)}`);
console.log(`Generated ${path.join(outdir, `${CONTRACT_NAME}Addresses.ts`)}`);
console.log(tsAddresses);

fs.writeFileSync(path.join(outdir, `${CONTRACT_NAME}ABI.ts`), tsCode, "utf-8");
fs.writeFileSync(
  path.join(outdir, `${CONTRACT_NAME}Addresses.ts`),
  tsAddresses,
  "utf-8"
);

