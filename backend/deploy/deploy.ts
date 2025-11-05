import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedEventsScore = await deploy("EventsScore", {
    from: deployer,
    log: true,
  });

  console.log(`EventsScore contract: `, deployedEventsScore.address);
};
export default func;
func.id = "deploy_eventsScore"; // id required to prevent reexecution
func.tags = ["EventsScore"];

