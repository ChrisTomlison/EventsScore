import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { EventsScore, EventsScore__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  organizer: HardhatEthersSigner;
  rater1: HardhatEthersSigner;
  rater2: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EventsScore")) as EventsScore__factory;
  const eventsScoreContract = (await factory.deploy()) as EventsScore;
  const eventsScoreContractAddress = await eventsScoreContract.getAddress();

  return { eventsScoreContract, eventsScoreContractAddress };
}

describe("EventsScore", function () {
  let signers: Signers;
  let eventsScoreContract: EventsScore;
  let eventsScoreContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      organizer: ethSigners[1],
      rater1: ethSigners[2],
      rater2: ethSigners[3],
    };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ eventsScoreContract, eventsScoreContractAddress } = await deployFixture());
  });

  it("should create an activity", async function () {
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + 86400; // 24 hours
    const dimensionCount = 3;

    // Create encrypted weights (all equal weights = 1)
    const weights: any[] = [];
    const weightProofs: any[] = [];
    for (let i = 0; i < dimensionCount; i++) {
      const weight = 1;
      const encryptedWeight = await fhevm
        .createEncryptedInput(eventsScoreContractAddress, signers.organizer.address)
        .add32(weight)
        .encrypt();
      weights.push(encryptedWeight.handles[0]);
      weightProofs.push(encryptedWeight.inputProof);
    }

    const tx = await eventsScoreContract
      .connect(signers.organizer)
      .createActivity(startTime, endTime, dimensionCount, weights, weightProofs);
    await tx.wait();

    const activityInfo = await eventsScoreContract.getActivityInfo(0);
    expect(activityInfo.organizer).to.eq(signers.organizer.address);
    expect(activityInfo.startTime).to.eq(startTime);
    expect(activityInfo.endTime).to.eq(endTime);
    expect(activityInfo.dimensionCount).to.eq(dimensionCount);
    expect(activityInfo.exists).to.eq(true);
  });

  it("should submit ratings", async function () {
    const startTime = Math.floor(Date.now() / 1000) - 100;
    const endTime = startTime + 86400;
    const dimensionCount = 3;

    // Create activity
    const weights: any[] = [];
    const weightProofs: any[] = [];
    for (let i = 0; i < dimensionCount; i++) {
      const weight = 1;
      const encryptedWeight = await fhevm
        .createEncryptedInput(eventsScoreContractAddress, signers.organizer.address)
        .add32(weight)
        .encrypt();
      weights.push(encryptedWeight.handles[0]);
      weightProofs.push(encryptedWeight.inputProof);
    }

    await eventsScoreContract
      .connect(signers.organizer)
      .createActivity(startTime, endTime, dimensionCount, weights, weightProofs);

    // Submit rating from rater1
    const scores1: any[] = [];
    const scoreProofs1: any[] = [];
    for (let i = 0; i < dimensionCount; i++) {
      const score = 4; // Rating of 4 for each dimension
      const encryptedScore = await fhevm
        .createEncryptedInput(eventsScoreContractAddress, signers.rater1.address)
        .add32(score)
        .encrypt();
      scores1.push(encryptedScore.handles[0]);
      scoreProofs1.push(encryptedScore.inputProof);
    }

    const tx1 = await eventsScoreContract
      .connect(signers.rater1)
      .submitRating(0, scores1, scoreProofs1);
    await tx1.wait();

    expect(await eventsScoreContract.hasRated(0, signers.rater1.address)).to.eq(true);

    // Submit rating from rater2
    const scores2: any[] = [];
    const scoreProofs2: any[] = [];
    for (let i = 0; i < dimensionCount; i++) {
      const score = 5; // Rating of 5 for each dimension
      const encryptedScore = await fhevm
        .createEncryptedInput(eventsScoreContractAddress, signers.rater2.address)
        .add32(score)
        .encrypt();
      scores2.push(encryptedScore.handles[0]);
      scoreProofs2.push(encryptedScore.inputProof);
    }

    const tx2 = await eventsScoreContract
      .connect(signers.rater2)
      .submitRating(0, scores2, scoreProofs2);
    await tx2.wait();

    expect(await eventsScoreContract.hasRated(0, signers.rater2.address)).to.eq(true);

    // Check total ratings count
    const totalRatingsHandle = await eventsScoreContract.getTotalRatings(0);
    const clearTotalRatings = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      totalRatingsHandle,
      eventsScoreContractAddress,
      signers.organizer
    );
    expect(clearTotalRatings).to.eq(2);
  });

  it("should calculate dimension averages", async function () {
    const startTime = Math.floor(Date.now() / 1000) - 100;
    const endTime = startTime + 86400;
    const dimensionCount = 2;

    // Create activity
    const weights: any[] = [];
    const weightProofs: any[] = [];
    for (let i = 0; i < dimensionCount; i++) {
      const weight = 1;
      const encryptedWeight = await fhevm
        .createEncryptedInput(eventsScoreContractAddress, signers.organizer.address)
        .add32(weight)
        .encrypt();
      weights.push(encryptedWeight.handles[0]);
      weightProofs.push(encryptedWeight.inputProof);
    }

    await eventsScoreContract
      .connect(signers.organizer)
      .createActivity(startTime, endTime, dimensionCount, weights, weightProofs);

    // Rater1: dimension0=3, dimension1=4
    const scores1: any[] = [];
    const scoreProofs1: any[] = [];
    const score1_0 = await fhevm
      .createEncryptedInput(eventsScoreContractAddress, signers.rater1.address)
      .add32(3)
      .encrypt();
    const score1_1 = await fhevm
      .createEncryptedInput(eventsScoreContractAddress, signers.rater1.address)
      .add32(4)
      .encrypt();
    scores1.push(score1_0.handles[0]);
    scores1.push(score1_1.handles[0]);
    scoreProofs1.push(score1_0.inputProof);
    scoreProofs1.push(score1_1.inputProof);

    await eventsScoreContract
      .connect(signers.rater1)
      .submitRating(0, scores1, scoreProofs1);

    // Rater2: dimension0=5, dimension1=5
    const scores2: any[] = [];
    const scoreProofs2: any[] = [];
    const score2_0 = await fhevm
      .createEncryptedInput(eventsScoreContractAddress, signers.rater2.address)
      .add32(5)
      .encrypt();
    const score2_1 = await fhevm
      .createEncryptedInput(eventsScoreContractAddress, signers.rater2.address)
      .add32(5)
      .encrypt();
    scores2.push(score2_0.handles[0]);
    scores2.push(score2_1.handles[0]);
    scoreProofs2.push(score2_0.inputProof);
    scoreProofs2.push(score2_1.inputProof);

    await eventsScoreContract
      .connect(signers.rater2)
      .submitRating(0, scores2, scoreProofs2);

    // Check dimension 0 average: (3 + 5) / 2 = 4
    const dim0SumHandle = await eventsScoreContract.getDimensionAverage(0, 0);
    const clearDim0Sum = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      dim0SumHandle,
      eventsScoreContractAddress,
      signers.organizer
    );
    expect(clearDim0Sum).to.eq(8); // Sum = 3 + 5 = 8

    const dim0CountHandle = await eventsScoreContract.getDimensionCount(0, 0);
    const clearDim0Count = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      dim0CountHandle,
      eventsScoreContractAddress,
      signers.organizer
    );
    expect(clearDim0Count).to.eq(2); // Count = 2

    // Check dimension 1 average: (4 + 5) / 2 = 4.5
    const dim1SumHandle = await eventsScoreContract.getDimensionAverage(0, 1);
    const clearDim1Sum = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      dim1SumHandle,
      eventsScoreContractAddress,
      signers.organizer
    );
    expect(clearDim1Sum).to.eq(9); // Sum = 4 + 5 = 9
  });
});

