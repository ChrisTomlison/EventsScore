"use client";

import { ethers } from "ethers";
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";

import { EventsScoreAddresses } from "@/abi/EventsScoreAddresses";
import { EventsScoreABI } from "@/abi/EventsScoreABI";

export type ClearValueType = {
  handle: string;
  clear: string | bigint | boolean;
};

type EventsScoreInfoType = {
  abi: typeof EventsScoreABI.abi;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

function getEventsScoreByChainId(
  chainId: number | undefined
): EventsScoreInfoType {
  if (!chainId) {
    return { abi: EventsScoreABI.abi };
  }

  const entry =
    EventsScoreAddresses[chainId.toString() as keyof typeof EventsScoreAddresses] as
      | { address: string; chainId: number; chainName: string }
      | undefined;

  if (!entry || !("address" in entry) || entry.address === ethers.ZeroAddress) {
    return { abi: EventsScoreABI.abi, chainId };
  }

  return {
    address: entry.address as `0x${string}` | undefined,
    chainId: entry.chainId ?? chainId,
    chainName: entry.chainName,
    abi: EventsScoreABI.abi,
  };
}

function extractHexLike(value: unknown): string | undefined {
  if (typeof value === "string") {
    const s = value.trim();
    if (s.startsWith("0x") && s.length >= 10) {
      return s;
    }
    // Some providers stringify nested JSON into message/body
    try {
      const parsed = JSON.parse(s);
      return extractRevertData(parsed);
    } catch {
      // not JSON
    }
    return undefined;
  }
  if (value && typeof value === "object") {
    // Try common paths first
    const v: any = value;
    const direct =
      v?.data?.data ??
      v?.data?.originalError?.data ??
      v?.data ??
      v?.error?.data?.data ??
      v?.error?.data ??
      v?.error?.error?.data ??
      v?.info?.error?.data?.data ??
      v?.info?.error?.data;
    const foundDirect = extractHexLike(direct);
    if (foundDirect) return foundDirect;

    // Hardhat/Anvil often embed raw JSON in body/message
    const body = extractHexLike(v?.body);
    if (body) return body;
    const message = extractHexLike(v?.message);
    if (message) return message;

    // Fallback: shallow scan object values
    for (const key of Object.keys(v)) {
      const sub = extractHexLike(v[key]);
      if (sub) return sub;
    }
  }
  return undefined;
}

function extractRevertData(error: unknown): string | undefined {
  return extractHexLike(error);
}

function formatDecodedError(decoded: ethers.ErrorDescription): string {
  try {
    // Built-ins
    if (decoded.name === "Error" && decoded.args && decoded.args.length > 0) {
      return String(decoded.args[0]);
    }
    if (decoded.name === "Panic" && decoded.args && decoded.args.length > 0) {
      return `Panic(${decoded.args[0]})`;
    }
    // Custom error with args pretty print
    const args =
      decoded.args && decoded.args.length > 0
        ? `(${decoded.args.map((x: any) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ")})`
        : "()";
    return `${decoded.name}${args}`;
  } catch {
    return decoded.name;
  }
}

function decodeRpcErrorReason(e: any, abi: any): string | undefined {
  // Prefer ethers v6 shortMessage if present
  if (typeof e?.shortMessage === "string" && e.shortMessage.length > 0) {
    // shortMessage often already summarises the revert
    // keep it as a fallback if we fail to decode calldata below
  }

  const revertData = extractRevertData(e);
  if (typeof revertData === "string") {
    try {
      const iface = new ethers.Interface([
        ...abi,
        "error Error(string)",
        "error Panic(uint256)",
      ]);
      const decoded = iface.parseError(revertData);
      if (decoded) {
        return formatDecodedError(decoded);
      }
    } catch {
      // ignore and try other hints
    }
  }

  // Other useful human-readable hints
  if (typeof e?.reason === "string" && e.reason.length > 0) {
    return e.reason;
  }
  if (typeof e?.shortMessage === "string" && e.shortMessage.length > 0) {
    return e.shortMessage;
  }
  if (typeof e?.message === "string" && e.message.length > 0) {
    return e.message;
  }
  return undefined;
}

export const useEventsScore = (parameters: {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  eip1193Provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  sameChain: RefObject<(chainId: number | undefined) => boolean>;
  sameSigner: RefObject<
    (ethersSigner: ethers.JsonRpcSigner | undefined) => boolean
  >;
}) => {
  const {
    instance,
    fhevmDecryptionSignatureStorage,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  } = parameters;

  const [activityInfo, setActivityInfo] = useState<any>(undefined);
  const [dimensionAverages, setDimensionAverages] = useState<Map<number, string>>(new Map());
  const [dimensionCounts, setDimensionCounts] = useState<Map<number, string>>(new Map());
  const [totalRatings, setTotalRatings] = useState<string | undefined>(undefined);
  const [weightedScore, setWeightedScore] = useState<string | undefined>(undefined);
  const [decryptedValues, setDecryptedValues] = useState<Map<string, ClearValueType>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const eventsScoreRef = useRef<EventsScoreInfoType | undefined>(undefined);
  const isLoadingRef = useRef<boolean>(false);
  const isDecryptingRef = useRef<boolean>(false);

  const eventsScore = useMemo(() => {
    const c = getEventsScoreByChainId(chainId);
    eventsScoreRef.current = c;

    // Only show message when chainId is defined and no address is configured
    if (chainId !== undefined && !c.address) {
      setMessage(`EventsScore deployment not found for chainId=${chainId}.`);
    } else if (chainId === undefined || c.address) {
      // Clear message when chainId is undefined or address exists
      setMessage("");
    }

    return c;
  }, [chainId]);

  const isDeployed = useMemo(() => {
    if (!eventsScore) {
      return undefined;
    }
    return (Boolean(eventsScore.address) && eventsScore.address !== ethers.ZeroAddress);
  }, [eventsScore]);

  // Get activity info
  const getActivityInfo = useCallback(async (activityId: number) => {
    if (!eventsScore.address || !ethersReadonlyProvider) {
      return;
    }

    try {
      const contract = new ethers.Contract(
        eventsScore.address,
        eventsScore.abi,
        ethersReadonlyProvider
      );

      const info = await contract.getActivityInfo(activityId);
      setActivityInfo({
        organizer: info.organizer,
        startTime: info.startTime.toString(),
        endTime: info.endTime.toString(),
        dimensionCount: info.dimensionCount.toString(),
        exists: info.exists,
      });
    } catch (e) {
      setMessage(`Failed to get activity info: ${e}`);
    }
  }, [eventsScore, ethersReadonlyProvider]);

  // Get dimension average
  const getDimensionAverage = useCallback(async (activityId: number, dimensionIndex: number) => {
    if (!eventsScore.address || !ethersReadonlyProvider) {
      return;
    }

    try {
      const contract = new ethers.Contract(
        eventsScore.address,
        eventsScore.abi,
        ethersReadonlyProvider
      );

      const handle = await contract.getDimensionAverage(activityId, dimensionIndex);
      setDimensionAverages(prev => {
        const newMap = new Map(prev);
        newMap.set(dimensionIndex, handle);
        return newMap;
      });
    } catch (e) {
      setMessage(`Failed to get dimension average: ${e}`);
    }
  }, [eventsScore, ethersReadonlyProvider]);

  // Get dimension count
  const getDimensionCount = useCallback(async (activityId: number, dimensionIndex: number) => {
    if (!eventsScore.address || !ethersReadonlyProvider) {
      return;
    }

    try {
      const contract = new ethers.Contract(
        eventsScore.address,
        eventsScore.abi,
        ethersReadonlyProvider
      );

      const handle = await contract.getDimensionCount(activityId, dimensionIndex);
      setDimensionCounts(prev => {
        const newMap = new Map(prev);
        newMap.set(dimensionIndex, handle);
        return newMap;
      });
    } catch (e) {
      setMessage(`Failed to get dimension count: ${e}`);
    }
  }, [eventsScore, ethersReadonlyProvider]);

  // Get total ratings
  const getTotalRatings = useCallback(async (activityId: number) => {
    if (!eventsScore.address || !ethersReadonlyProvider) {
      return;
    }

    try {
      const contract = new ethers.Contract(
        eventsScore.address,
        eventsScore.abi,
        ethersReadonlyProvider
      );

      const handle = await contract.getTotalRatings(activityId);
      setTotalRatings(handle);
    } catch (e) {
      setMessage(`Failed to get total ratings: ${e}`);
    }
  }, [eventsScore, ethersReadonlyProvider]);

  // Get weighted score
  const getWeightedScore = useCallback(async (activityId: number) => {
    if (!eventsScore.address || !ethersReadonlyProvider) {
      return;
    }

    try {
      const contract = new ethers.Contract(
        eventsScore.address,
        eventsScore.abi,
        ethersReadonlyProvider
      );

      const handle = await contract.getWeightedTotalScore(activityId);
      setWeightedScore(handle);
    } catch (e) {
      setMessage(`Failed to get weighted score: ${e}`);
    }
  }, [eventsScore, ethersReadonlyProvider]);

  // Decrypt a handle
  const decryptHandle = useCallback(async (handle: string, key: string) => {
    if (isDecryptingRef.current || !instance || !ethersSigner || !eventsScore.address) {
      return;
    }

    if (decryptedValues.has(key) && decryptedValues.get(key)?.handle === handle) {
      return; // Already decrypted
    }

    isDecryptingRef.current = true;
    setIsDecrypting(true);
    setMessage("Starting decryption...");

    try {
      const sig: FhevmDecryptionSignature | null =
        await FhevmDecryptionSignature.loadOrSign(
          instance,
          [eventsScore.address as `0x${string}`],
          ethersSigner,
          fhevmDecryptionSignatureStorage
        );

      if (!sig) {
        setMessage("Unable to build FHEVM decryption signature");
        return;
      }

      setMessage("Calling FHEVM userDecrypt...");

      const res = await instance.userDecrypt(
        [{ handle, contractAddress: eventsScore.address }],
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays
      );

      setDecryptedValues(prev => {
        const newMap = new Map(prev);
        newMap.set(key, { handle, clear: res[handle] });
        return newMap;
      });

      setMessage("Decryption completed!");
    } catch (e) {
      setMessage(`Decryption failed: ${e}`);
    } finally {
      isDecryptingRef.current = false;
      setIsDecrypting(false);
    }
  }, [instance, ethersSigner, eventsScore.address, fhevmDecryptionSignatureStorage, decryptedValues]);

  // Create activity
  const createActivity = useCallback(async (
    startTime: number,
    endTime: number,
    dimensionCount: number,
    weights: number[]
  ): Promise<number | undefined> => {
    if (!eventsScore.address || !instance || !ethersSigner) {
      setMessage("Missing required dependencies: contract address, FHEVM instance, or signer");
      return undefined;
    }

    if (weights.length !== dimensionCount) {
      setMessage(`Weights count (${weights.length}) does not match dimension count (${dimensionCount})`);
      return undefined;
    }

    if (dimensionCount <= 0 || dimensionCount > 10) {
      setMessage(`Invalid dimension count: ${dimensionCount}. Must be between 1 and 10`);
      return undefined;
    }

    if (endTime <= startTime) {
      setMessage(`Invalid time range: end time must be after start time`);
      return undefined;
    }

    setIsSubmitting(true);
    setMessage("Creating activity...");

    try {
      const contract = new ethers.Contract(
        eventsScore.address,
        eventsScore.abi,
        ethersSigner
      );

      // Encrypt weights
      setMessage("Encrypting weights...");
      const encryptedWeights: any[] = [];
      const weightProofs: any[] = [];

      const userAddress = await ethersSigner.getAddress();

      for (let i = 0; i < dimensionCount; i++) {
        if (weights[i] < 0 || weights[i] > 1000) {
          setMessage(`Invalid weight at index ${i}: ${weights[i]}. Must be between 0 and 1000`);
          return undefined;
        }
        
        const weightInput = instance.createEncryptedInput(
          eventsScore.address,
          userAddress
        );
        weightInput.add32(weights[i]);
        const enc = await weightInput.encrypt();
        encryptedWeights.push(enc.handles[0]);
        weightProofs.push(enc.inputProof);
      }

      // Estimate gas before sending transaction
      setMessage("Estimating gas...");
      let gasEstimate: bigint;
      try {
        gasEstimate = await contract.createActivity.estimateGas(
          startTime,
          endTime,
          dimensionCount,
          encryptedWeights,
          weightProofs
        );
        console.log("Gas estimate:", gasEstimate.toString());
      } catch (estimateError: any) {
        console.error("Gas estimation failed:", estimateError);
        let errorMessage = "Gas estimation failed";
        const reason = decodeRpcErrorReason(estimateError, eventsScore.abi);
        if (reason) errorMessage += `: ${reason}`;
        setMessage(errorMessage);
        return undefined;
      }

      // Send transaction
      setMessage("Sending transaction...");
      const tx = await contract.createActivity(
        startTime,
        endTime,
        dimensionCount,
        encryptedWeights,
        weightProofs,
        { gasLimit: gasEstimate + (gasEstimate / BigInt(10)) } // Add 10% buffer
      );

      setMessage(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();
      
      if (!receipt) {
        setMessage("Transaction receipt not found");
        return undefined;
      }

      if (receipt.status === 0) {
        setMessage("Transaction failed (reverted)");
        return undefined;
      }
      
      // Extract activityId from the event
      let activityId: number | undefined = undefined;
      if (receipt.logs) {
        const eventInterface = new ethers.Interface(eventsScore.abi);
        for (const log of receipt.logs) {
          try {
            const parsed = eventInterface.parseLog(log);
            if (parsed && parsed.name === "ActivityCreated") {
              activityId = Number(parsed.args.activityId);
              break;
            }
          } catch (e) {
            // Not the event we're looking for
          }
        }
      }

      if (activityId !== undefined) {
        setMessage(`Activity created successfully! Activity ID: ${activityId}`);
      } else {
        setMessage("Activity created successfully! (Unable to extract Activity ID)");
      }

      return activityId;
    } catch (e: any) {
      console.error("Create activity error:", e);
      let errorMessage = "Failed to create activity";
      const reason = decodeRpcErrorReason(e, eventsScore.abi);
      if (reason) errorMessage += `: ${reason}`;
      else if (typeof e === "string") errorMessage += `: ${e}`;
      else errorMessage += `: ${JSON.stringify(e)}`;
      
      setMessage(errorMessage);
      return undefined;
    } finally {
      setIsSubmitting(false);
    }
  }, [eventsScore, instance, ethersSigner]);

  // Submit rating
  const submitRating = useCallback(async (
    activityId: number,
    scores: number[]
  ) => {
    if (!eventsScore.address || !instance || !ethersSigner) {
      return;
    }

    setIsSubmitting(true);
    setMessage("Submitting rating...");

    try {
      const contract = new ethers.Contract(
        eventsScore.address,
        eventsScore.abi,
        ethersSigner
      );

      const encryptedScores: any[] = [];
      const scoreProofs: any[] = [];

      const userAddress = await ethersSigner.getAddress();

      for (let i = 0; i < scores.length; i++) {
        const scoreInput = instance.createEncryptedInput(
          eventsScore.address,
          userAddress
        );
        scoreInput.add32(scores[i]);
        const enc = await scoreInput.encrypt();
        encryptedScores.push(enc.handles[0]);
        scoreProofs.push(enc.inputProof);
      }

      const tx = await contract.submitRating(
        activityId,
        encryptedScores,
        scoreProofs
      );

      setMessage(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      setMessage("Rating submitted successfully!");
    } catch (e: any) {
      const reason = decodeRpcErrorReason(e, eventsScore.abi);
      setMessage(`Failed to submit rating${reason ? `: ${reason}` : ""}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [eventsScore, instance, ethersSigner]);

  return {
    contractAddress: eventsScore.address,
    isDeployed,
    activityInfo,
    dimensionAverages,
    dimensionCounts,
    totalRatings,
    weightedScore,
    decryptedValues,
    isLoading,
    isDecrypting,
    isSubmitting,
    message,
    getActivityInfo,
    getDimensionAverage,
    getDimensionCount,
    getTotalRatings,
    getWeightedScore,
    decryptHandle,
    createActivity,
    submitRating,
  };
};

