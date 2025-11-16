"use client";

import { useState, useEffect } from "react";
import { useFhevm } from "../fhevm/useFhevm";
import { useInMemoryStorage } from "../hooks/useInMemoryStorage";
import { useMetaMaskEthersSigner } from "../hooks/metamask/useMetaMaskEthersSigner";
import { useEventsScore } from "@/hooks/useEventsScore";
import { useActivityMetadata } from "@/hooks/useActivityMetadata";

type ActiveTab = "create" | "query" | "rate" | "stats";

export const EventsScoreApp = () => {
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const {
    provider,
    chainId,
    accounts,
    isConnected,
    connect,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
    initialMockChains,
  } = useMetaMaskEthersSigner();

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const eventsScore = useEventsScore({
    instance: fhevmInstance,
    fhevmDecryptionSignatureStorage,
    eip1193Provider: provider,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  });

  const { saveMetadata, getMetadata, searchActivities } = useActivityMetadata();

  const [activeTab, setActiveTab] = useState<ActiveTab>("create");

  // Create Activity State
  const [newActivityForm, setNewActivityForm] = useState({
    name: "",
    description: "",
    dimensionCount: 3,
    startTime: Math.floor(Date.now() / 1000),
    endTime: Math.floor(Date.now() / 1000) + 86400,
    dimensionNames: ["Quality", "Service", "Value"] as string[],
    weights: [1, 1, 1] as number[],
  });
  const [createdActivityId, setCreatedActivityId] = useState<number | undefined>(undefined);

  // Query Activity State
  const [queryInput, setQueryInput] = useState<string>("");
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const [queryError, setQueryError] = useState<string>("");
  const [isQuerying, setIsQuerying] = useState<boolean>(false);

  // Submit Rating State
  const [ratingActivityId, setRatingActivityId] = useState<number>(0);
  const [selectedDimension, setSelectedDimension] = useState<number | null>(null);
  const [ratingScores, setRatingScores] = useState<Map<number, number>>(new Map());
  const [ratingActivityInfo, setRatingActivityInfo] = useState<any>(null);

  // Statistics State
  const [statsActivityId, setStatsActivityId] = useState<number>(0);
  const [statsActivityInfo, setStatsActivityInfo] = useState<any>(null);
  const [isOrganizer, setIsOrganizer] = useState<boolean>(false);

  // Normalize weights
  const normalizeWeights = (weights: number[]): number[] => {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum === 0) return weights;
    return weights.map(w => w / sum);
  };

  // Handle create activity
  const handleCreateActivity = async () => {
    if (!newActivityForm.name.trim()) {
      eventsScore.message = "Activity name is required";
      return;
    }
    if (!newActivityForm.description.trim()) {
      eventsScore.message = "Activity description is required";
      return;
    }
    if (newActivityForm.dimensionNames.some(name => !name.trim())) {
      eventsScore.message = "All dimension names are required";
      return;
    }

    // Normalize weights and scale to integers (multiply by 1000 for precision)
    const normalizedWeights = normalizeWeights(newActivityForm.weights);
    const scaledWeights = normalizedWeights.map(w => Math.round(w * 1000));
    
    const activityId = await eventsScore.createActivity(
      newActivityForm.startTime,
      newActivityForm.endTime,
      newActivityForm.dimensionCount,
      scaledWeights // Send normalized and scaled weights to contract
    );

    if (activityId !== undefined) {
      saveMetadata(activityId, {
        name: newActivityForm.name,
        description: newActivityForm.description,
        dimensionNames: newActivityForm.dimensionNames,
        normalizedWeights,
      });
      setCreatedActivityId(activityId);
      eventsScore.message = `Activity created successfully! ID: ${activityId}`;
    }
  };

  // Handle query activity
  const handleQueryActivity = async () => {
    setQueryResult(null);
    setQueryResults([]);
    setQueryError("");
    setIsQuerying(true);

    if (!queryInput.trim()) {
      setQueryError("Please enter an activity ID or keyword");
      setIsQuerying(false);
      return;
    }

    // Try as ID first
    const id = parseInt(queryInput);
    if (!isNaN(id)) {
      await eventsScore.getActivityInfo(id);
      if (eventsScore.activityInfo && eventsScore.activityInfo.exists) {
        const metadata = getMetadata(id);
        setQueryResult({
          id,
          ...eventsScore.activityInfo,
          metadata,
        });
      } else {
        setQueryError("Activity not found");
      }
      setIsQuerying(false);
    } else {
      // Search by keyword - get all matching activities
      const activityIds = searchActivities(queryInput);
      if (activityIds.length === 0) {
        setQueryError("No activities found matching the keyword");
        setIsQuerying(false);
        return;
      }

      // Fetch info for all matching activities
      const results: any[] = [];
      for (const activityId of activityIds) {
        await eventsScore.getActivityInfo(activityId);
        if (eventsScore.activityInfo && eventsScore.activityInfo.exists) {
          const metadata = getMetadata(activityId);
          results.push({
            id: activityId,
            ...eventsScore.activityInfo,
            metadata,
          });
        }
      }

      if (results.length === 0) {
        setQueryError("No valid activities found matching the keyword");
      } else {
        setQueryResults(results);
      }
      setIsQuerying(false);
    }
  };

  // Handle load activity for rating
  const handleLoadActivityForRating = async () => {
    if (!ratingActivityId) {
      eventsScore.message = "Please enter an activity ID";
      return;
    }
    await eventsScore.getActivityInfo(ratingActivityId);
    if (eventsScore.activityInfo && eventsScore.activityInfo.exists) {
      setRatingActivityInfo(eventsScore.activityInfo);
      setSelectedDimension(null);
      setRatingScores(new Map());
    } else {
      eventsScore.message = "Activity not found";
      setRatingActivityInfo(null);
    }
  };

  // Handle set score for dimension
  const handleSetDimensionScore = (dimension: number, score: number) => {
    const newScores = new Map(ratingScores);
    newScores.set(dimension, score);
    setRatingScores(newScores);
  };

  // Handle submit rating
  const handleSubmitRating = async () => {
    if (!ratingActivityInfo) {
      eventsScore.message = "Please load activity first";
      return;
    }

    const dimensionCount = parseInt(ratingActivityInfo.dimensionCount);
    const scores = Array(dimensionCount).fill(0);
    
    // Check if all dimensions have scores
    let allScored = true;
    for (let i = 0; i < dimensionCount; i++) {
      if (ratingScores.has(i)) {
        scores[i] = ratingScores.get(i)!;
      } else {
        allScored = false;
      }
    }

    if (!allScored) {
      eventsScore.message = "Please rate all dimensions before submitting";
      return;
    }

    await eventsScore.submitRating(ratingActivityId, scores);
    if (eventsScore.message.includes("successfully")) {
      setSelectedDimension(null);
      setRatingScores(new Map());
    }
  };

  // Handle load activity for stats
  const handleLoadActivityForStats = async () => {
    if (!statsActivityId) {
      eventsScore.message = "Please enter an activity ID";
      return;
    }
    setStatsActivityInfo(null);
    setIsOrganizer(false);
    await eventsScore.getActivityInfo(statsActivityId);
    if (eventsScore.activityInfo && eventsScore.activityInfo.exists) {
      setStatsActivityInfo(eventsScore.activityInfo);
      // Check if current user is organizer
      if (accounts && accounts.length > 0) {
        const userAddress = accounts[0].toLowerCase();
        const organizerAddress = eventsScore.activityInfo.organizer.toLowerCase();
        setIsOrganizer(userAddress === organizerAddress);
        if (userAddress !== organizerAddress) {
          eventsScore.message = "Access denied: You are not the organizer of this activity";
        }
      }
    } else {
      eventsScore.message = "Activity not found";
    }
  };

  // Update dimension names when count changes
  useEffect(() => {
    const currentNames = newActivityForm.dimensionNames;
    const newNames = Array(newActivityForm.dimensionCount)
      .fill("")
      .map((_, i) => currentNames[i] || `Dimension ${i + 1}`);
    const newWeights = Array(newActivityForm.dimensionCount)
      .fill(1)
      .map((_, i) => newActivityForm.weights[i] || 1);

    setNewActivityForm({
      ...newActivityForm,
      dimensionNames: newNames,
      weights: newWeights,
    });
  }, [newActivityForm.dimensionCount]);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="luxury-card rounded-xl p-12 max-w-md w-full mx-4 text-center">
          <div className="w-20 h-20 bg-luxury-green rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-luxury-gold text-4xl font-bold">E</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">
            <span className="text-luxury-gold">Events</span>
            <span className="text-luxury-green">Score</span>
          </h1>
          <p className="text-gray-400 mb-8 text-lg">
            Privacy-Preserving Event Rating System
          </p>
          <p className="text-gray-300 mb-8 text-sm">
            Connect your wallet to start rating events with complete privacy using fully homomorphic encryption
          </p>
          <button
            onClick={connect}
            className="w-full bg-luxury-green hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-green-900/50 text-lg"
          >
            Connect MetaMask Wallet
          </button>
        </div>
      </div>
    );
  }

  if (eventsScore.isDeployed === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="luxury-card rounded-xl p-12 max-w-md w-full mx-4 text-center">
          <div className="w-20 h-20 bg-luxury-green rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-white text-4xl">⚠</span>
          </div>
          <h2 className="text-2xl font-bold text-luxury-green mb-4">
            Contract Not Deployed
          </h2>
          <p className="text-gray-300 mb-3">
            EventsScore contract is not available on this network
          </p>
          <p className="text-gray-400 text-sm mb-2">
            Chain ID: <span className="text-luxury-gold font-mono">{chainId}</span>
          </p>
          <p className="text-gray-400 text-sm">
            Please deploy the contract or switch to a supported network
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Status Bar */}
        <div className="luxury-card rounded-xl p-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">Network:</span>
                <span className="font-mono font-bold text-luxury-gold bg-luxury-darkgray px-3 py-1 rounded-lg">
                  {chainId}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">FHEVM:</span>
                <span
                  className={`font-semibold px-3 py-1 rounded-lg ${
                    fhevmStatus === "ready"
                      ? "bg-green-900/30 text-green-400"
                      : fhevmStatus === "error"
                      ? "bg-green-900/30 text-luxury-green"
                      : "bg-yellow-900/30 text-yellow-400"
                  }`}
                >
                  {fhevmStatus.toUpperCase()}
                </span>
              </div>
            </div>
            {accounts && accounts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">Wallet:</span>
                <span className="font-mono text-sm text-white bg-luxury-darkgray px-3 py-1 rounded-lg">
                  {accounts[0].slice(0, 6)}...{accounts[0].slice(-4)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="luxury-card rounded-xl p-4">
              <nav className="space-y-2">
                <button
                  onClick={() => setActiveTab("create")}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 ${
                    activeTab === "create"
                      ? "bg-luxury-green text-black font-bold"
                      : "text-gray-300 hover:bg-luxury-darkgray"
                  }`}
                >
                  📝 New Activity Registration
                </button>
                <button
                  onClick={() => setActiveTab("query")}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 ${
                    activeTab === "query"
                      ? "bg-luxury-green text-black font-bold"
                      : "text-gray-300 hover:bg-luxury-darkgray"
                  }`}
                >
                  🔍 Query Activity Details
                </button>
                <button
                  onClick={() => setActiveTab("rate")}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 ${
                    activeTab === "rate"
                      ? "bg-luxury-green text-black font-bold"
                      : "text-gray-300 hover:bg-luxury-darkgray"
                  }`}
                >
                  ⭐ Submit Rating
                </button>
                <button
                  onClick={() => setActiveTab("stats")}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 ${
                    activeTab === "stats"
                      ? "bg-luxury-green text-black font-bold"
                      : "text-gray-300 hover:bg-luxury-darkgray"
                  }`}
                >
                  📊 Activity Statistics
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeTab === "create" && (
              <div className="luxury-card rounded-xl p-8">
                <h2 className="text-3xl font-bold mb-6">
                  <span className="text-luxury-gold">New Activity</span>
                  <span className="text-white"> Registration</span>
                </h2>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Activity Name *
                    </label>
                    <input
                      type="text"
                      value={newActivityForm.name}
                      onChange={(e) =>
                        setNewActivityForm({ ...newActivityForm, name: e.target.value })
                      }
                      className="w-full bg-luxury-darkgray border border-luxury-border text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-luxury-green focus:border-transparent"
                      placeholder="Enter activity name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Activity Description *
                    </label>
                    <textarea
                      value={newActivityForm.description}
                      onChange={(e) =>
                        setNewActivityForm({ ...newActivityForm, description: e.target.value })
                      }
                      rows={4}
                      className="w-full bg-luxury-darkgray border border-luxury-border text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-luxury-green focus:border-transparent"
                      placeholder="Enter activity description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Number of Rating Dimensions
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={newActivityForm.dimensionCount}
                      onChange={(e) => {
                        const count = parseInt(e.target.value) || 1;
                        setNewActivityForm({ ...newActivityForm, dimensionCount: count });
                      }}
                      className="w-full bg-luxury-darkgray border border-luxury-border text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-luxury-green focus:border-transparent"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-300">
                      Dimension Names and Weights
                    </label>
                    {newActivityForm.dimensionNames.map((name, idx) => (
                      <div key={idx} className="flex gap-3">
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => {
                            const newNames = [...newActivityForm.dimensionNames];
                            newNames[idx] = e.target.value;
                            setNewActivityForm({ ...newActivityForm, dimensionNames: newNames });
                          }}
                          className="flex-1 bg-luxury-darkgray border border-luxury-border text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-luxury-green focus:border-transparent"
                          placeholder={`Dimension ${idx + 1} name`}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={newActivityForm.weights[idx]}
                          onChange={(e) => {
                            const newWeights = [...newActivityForm.weights];
                            newWeights[idx] = parseFloat(e.target.value) || 0;
                            setNewActivityForm({ ...newActivityForm, weights: newWeights });
                          }}
                          className="w-24 bg-luxury-darkgray border border-luxury-border text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-luxury-green focus:border-transparent"
                          placeholder="Weight"
                        />
                      </div>
                    ))}
                    <div className="bg-luxury-darkgray rounded-lg p-3 text-sm text-gray-400">
                      <p>Normalized weights: {normalizeWeights(newActivityForm.weights).map(w => w.toFixed(3)).join(", ")}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Start Time
                      </label>
                      <input
                        type="datetime-local"
                        value={new Date(newActivityForm.startTime * 1000).toISOString().slice(0, 16)}
                        onChange={(e) => {
                          const timestamp = Math.floor(new Date(e.target.value).getTime() / 1000);
                          setNewActivityForm({ ...newActivityForm, startTime: timestamp });
                        }}
                        className="w-full bg-luxury-darkgray border border-luxury-border text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-luxury-green focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        End Time
                      </label>
                      <input
                        type="datetime-local"
                        value={new Date(newActivityForm.endTime * 1000).toISOString().slice(0, 16)}
                        onChange={(e) => {
                          const timestamp = Math.floor(new Date(e.target.value).getTime() / 1000);
                          setNewActivityForm({ ...newActivityForm, endTime: timestamp });
                        }}
                        className="w-full bg-luxury-darkgray border border-luxury-border text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-luxury-green focus:border-transparent"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleCreateActivity}
                    disabled={eventsScore.isSubmitting}
                    className="w-full bg-luxury-green hover:bg-green-700 text-white font-bold py-4 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-green-900/50"
                  >
                    {eventsScore.isSubmitting ? "⏳ Creating Activity..." : "✓ Register Activity"}
                  </button>

                  {createdActivityId !== undefined && (
                    <div className="bg-luxury-green/10 border border-luxury-green rounded-lg p-4">
                      <p className="text-sm text-white">
                        <span className="font-bold text-luxury-green">✓ Success!</span>
                        <span className="text-gray-300"> Activity has been created</span>
                        <br />
                        <span className="text-gray-400">Activity ID: </span>
                        <span className="font-mono font-bold text-luxury-gold text-lg">#{createdActivityId}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "query" && (
              <div className="luxury-card rounded-xl p-8">
                <h2 className="text-3xl font-bold mb-6">
                  <span className="text-luxury-gold">Query Activity</span>
                  <span className="text-white"> Details</span>
                </h2>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Activity ID or Keyword
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={queryInput}
                        onChange={(e) => setQueryInput(e.target.value)}
                        className="flex-1 bg-luxury-darkgray border border-luxury-border text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-luxury-green focus:border-transparent"
                        placeholder="Enter activity ID or search keyword"
                      />
                      <button
                        onClick={handleQueryActivity}
                        disabled={eventsScore.isLoading || isQuerying}
                        className="bg-luxury-gold hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {eventsScore.isLoading || isQuerying ? "Searching..." : "Search"}
                      </button>
                    </div>
                  </div>

                  {queryError && (
                    <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
                      <p className="text-red-400">{queryError}</p>
                    </div>
                  )}

                  {/* Single Activity Result (by ID) */}
                  {queryResult && (
                    <div className="bg-black/40 rounded-xl p-6 border border-luxury-border">
                      <div className="flex items-center gap-2 mb-4">
                        <h4 className="font-bold text-xl text-luxury-gold">
                          Activity #{queryResult.id}
                        </h4>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            Date.now() < parseInt(queryResult.startTime) * 1000
                              ? "bg-blue-900/30 text-blue-400"
                              : Date.now() > parseInt(queryResult.endTime) * 1000
                              ? "bg-green-900/30 text-luxury-green"
                              : "bg-green-900/30 text-green-400"
                          }`}
                        >
                          {Date.now() < parseInt(queryResult.startTime) * 1000
                            ? "NOT STARTED"
                            : Date.now() > parseInt(queryResult.endTime) * 1000
                            ? "ENDED"
                            : "● ACTIVE"}
                        </span>
                      </div>
                      <div className="space-y-3 text-sm">
                        {queryResult.metadata && (
                          <>
                            <div className="flex justify-between py-2 border-b border-luxury-border">
                              <span className="text-gray-400">Name</span>
                              <span className="font-semibold text-white">{queryResult.metadata.name}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-luxury-border">
                              <span className="text-gray-400">Description</span>
                              <span className="font-semibold text-white">{queryResult.metadata.description}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between py-2 border-b border-luxury-border">
                          <span className="text-gray-400">Organizer</span>
                          <span className="font-mono text-white text-xs">
                            {queryResult.organizer.slice(0, 10)}...
                            {queryResult.organizer.slice(-8)}
                          </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-luxury-border">
                          <span className="text-gray-400">Rating Dimensions</span>
                          <span className="font-bold text-luxury-gold">
                            {queryResult.dimensionCount}
                          </span>
                        </div>
                        {queryResult.metadata && queryResult.metadata.dimensionNames && (
                          <div className="py-2 border-b border-luxury-border">
                            <span className="text-gray-400">Dimension Names:</span>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {queryResult.metadata.dimensionNames.map((name: string, idx: number) => (
                                <span key={idx} className="bg-luxury-green/20 text-luxury-gold px-3 py-1 rounded-lg text-xs font-semibold">
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between py-2 border-b border-luxury-border">
                          <span className="text-gray-400">Start Time</span>
                          <span className="font-semibold text-white">
                            {new Date(parseInt(queryResult.startTime) * 1000).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-gray-400">End Time</span>
                          <span className="font-semibold text-white">
                            {new Date(parseInt(queryResult.endTime) * 1000).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Multiple Activity Results (by keyword) */}
                  {queryResults.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-white">
                          Search Results ({queryResults.length})
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        {queryResults.map((result) => (
                          <div key={result.id} className="bg-black/40 rounded-xl p-6 border border-luxury-border">
                            <div className="flex items-center gap-2 mb-4">
                              <h4 className="font-bold text-xl text-luxury-gold">
                                Activity #{result.id}
                              </h4>
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  Date.now() < parseInt(result.startTime) * 1000
                                    ? "bg-blue-900/30 text-blue-400"
                                    : Date.now() > parseInt(result.endTime) * 1000
                                    ? "bg-green-900/30 text-luxury-green"
                                    : "bg-green-900/30 text-green-400"
                                }`}
                              >
                                {Date.now() < parseInt(result.startTime) * 1000
                                  ? "NOT STARTED"
                                  : Date.now() > parseInt(result.endTime) * 1000
                                  ? "ENDED"
                                  : "● ACTIVE"}
                              </span>
                            </div>
                            <div className="space-y-3 text-sm">
                              {result.metadata && (
                                <>
                                  <div className="flex justify-between py-2 border-b border-luxury-border">
                                    <span className="text-gray-400">Name</span>
                                    <span className="font-semibold text-white">{result.metadata.name}</span>
                                  </div>
                                  <div className="flex justify-between py-2 border-b border-luxury-border">
                                    <span className="text-gray-400">Description</span>
                                    <span className="font-semibold text-white text-right max-w-md">{result.metadata.description}</span>
                                  </div>
                                </>
                              )}
                              <div className="flex justify-between py-2 border-b border-luxury-border">
                                <span className="text-gray-400">Organizer</span>
                                <span className="font-mono text-white text-xs">
                                  {result.organizer.slice(0, 10)}...
                                  {result.organizer.slice(-8)}
                                </span>
                              </div>
                              <div className="flex justify-between py-2 border-b border-luxury-border">
                                <span className="text-gray-400">Rating Dimensions</span>
                                <span className="font-bold text-luxury-gold">
                                  {result.dimensionCount}
                                </span>
                              </div>
                              {result.metadata && result.metadata.dimensionNames && (
                                <div className="py-2 border-b border-luxury-border">
                                  <span className="text-gray-400">Dimension Names:</span>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {result.metadata.dimensionNames.map((name: string, idx: number) => (
                                      <span key={idx} className="bg-luxury-green/20 text-luxury-gold px-3 py-1 rounded-lg text-xs font-semibold">
                                        {name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="flex justify-between py-2 border-b border-luxury-border">
                                <span className="text-gray-400">Start Time</span>
                                <span className="font-semibold text-white text-sm">
                                  {new Date(parseInt(result.startTime) * 1000).toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-gray-400">End Time</span>
                                <span className="font-semibold text-white text-sm">
                                  {new Date(parseInt(result.endTime) * 1000).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "rate" && (
              <div className="luxury-card rounded-xl p-8">
                <h2 className="text-3xl font-bold mb-6">
                  <span className="text-luxury-green">Submit</span>
                  <span className="text-white"> Rating</span>
                </h2>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Activity ID
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        value={ratingActivityId}
                        onChange={(e) => setRatingActivityId(parseInt(e.target.value) || 0)}
                        className="flex-1 bg-luxury-darkgray border border-luxury-border text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-luxury-green focus:border-transparent"
                        placeholder="Enter Activity ID"
                      />
                      <button
                        onClick={handleLoadActivityForRating}
                        disabled={eventsScore.isLoading}
                        className="bg-luxury-gold hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Load
                      </button>
                    </div>
                  </div>

                  {ratingActivityInfo && (
                    <>
                      {/* Activity Information */}
                      <div className="bg-black/40 rounded-xl p-6 border border-luxury-border">
                        <div className="flex items-center gap-2 mb-4">
                          <h4 className="font-bold text-xl text-luxury-gold">
                            Activity #{ratingActivityId}
                          </h4>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              Date.now() < parseInt(ratingActivityInfo.startTime) * 1000
                                ? "bg-blue-900/30 text-blue-400"
                                : Date.now() > parseInt(ratingActivityInfo.endTime) * 1000
                                ? "bg-green-900/30 text-luxury-green"
                                : "bg-green-900/30 text-green-400"
                            }`}
                          >
                            {Date.now() < parseInt(ratingActivityInfo.startTime) * 1000
                              ? "NOT STARTED"
                              : Date.now() > parseInt(ratingActivityInfo.endTime) * 1000
                              ? "ENDED"
                              : "● ACTIVE"}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          {(() => {
                            const metadata = getMetadata(ratingActivityId);
                            return (
                              <>
                                {metadata && (
                                  <>
                                    <div className="flex justify-between py-1 border-b border-luxury-border">
                                      <span className="text-gray-400">Name:</span>
                                      <span className="font-semibold text-white">{metadata.name}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-luxury-border">
                                      <span className="text-gray-400">Description:</span>
                                      <span className="font-semibold text-white text-right max-w-md">{metadata.description}</span>
                                    </div>
                                  </>
                                )}
                              </>
                            );
                          })()}
                          <div className="flex justify-between py-1 border-b border-luxury-border">
                            <span className="text-gray-400">Rating Dimensions:</span>
                            <span className="font-bold text-luxury-gold">
                              {ratingActivityInfo.dimensionCount}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-luxury-border">
                            <span className="text-gray-400">Start Time:</span>
                            <span className="font-semibold text-white text-sm">
                              {new Date(parseInt(ratingActivityInfo.startTime) * 1000).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-gray-400">End Time:</span>
                            <span className="font-semibold text-white text-sm">
                              {new Date(parseInt(ratingActivityInfo.endTime) * 1000).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-black/40 rounded-xl p-5 border border-luxury-border">
                        <p className="text-sm text-gray-400 mb-4">
                          Your ratings are fully encrypted using homomorphic encryption. Nobody can see your individual scores.
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                          <span className="text-green-400 font-semibold">Privacy Protected</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-3">
                          Select Dimension to Rate
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {Array.from({ length: parseInt(ratingActivityInfo.dimensionCount) }).map((_, idx) => {
                            const metadata = getMetadata(ratingActivityId);
                            const dimensionName = metadata?.dimensionNames[idx] || `Dimension ${idx + 1}`;
                            const hasScore = ratingScores.has(idx);
                            const currentScore = ratingScores.get(idx);
                            return (
                              <div key={idx} className="space-y-2">
                                <button
                                  onClick={() => setSelectedDimension(idx)}
                                  className={`w-full p-4 rounded-lg border-2 transition-all duration-300 ${
                                    selectedDimension === idx
                                      ? "border-luxury-green bg-luxury-green/20 text-luxury-green"
                                      : hasScore
                                      ? "border-luxury-gold bg-luxury-gold/10 text-luxury-gold"
                                      : "border-luxury-border bg-luxury-darkgray text-gray-300 hover:border-luxury-green/50"
                                  }`}
                                >
                                  <div className="font-bold">{dimensionName}</div>
                                  <div className="text-xs text-gray-400 mt-1">Dimension {idx + 1}</div>
                                  {hasScore && (
                                    <div className="text-sm font-bold mt-2">Score: {currentScore}</div>
                                  )}
                                </button>
                                {selectedDimension === idx && (
                                  <div className="bg-luxury-darkgray rounded-lg p-3">
                                    <label className="block text-xs text-gray-400 mb-2">Select Score (0-5)</label>
                                    <div className="grid grid-cols-6 gap-1">
                                      {[0, 1, 2, 3, 4, 5].map((score) => (
                                        <button
                                          key={score}
                                          onClick={() => handleSetDimensionScore(idx, score)}
                                          className={`py-2 rounded border-2 transition-all duration-300 font-bold text-sm ${
                                            currentScore === score
                                              ? "border-luxury-green bg-luxury-green text-black"
                                              : "border-luxury-border bg-black text-white hover:border-luxury-green/50"
                                          }`}
                                        >
                                          {score}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-luxury-darkgray rounded-lg p-4">
                        <p className="text-sm text-gray-400 mb-2">Rating Progress:</p>
                        <p className="text-sm text-white">
                          {ratingScores.size} / {parseInt(ratingActivityInfo.dimensionCount)} dimensions rated
                        </p>
                      </div>

                      <button
                        onClick={handleSubmitRating}
                        disabled={eventsScore.isSubmitting || ratingScores.size !== parseInt(ratingActivityInfo.dimensionCount)}
                        className="w-full bg-luxury-green hover:bg-green-700 text-white font-bold py-4 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-green-900/50 text-lg"
                      >
                        {eventsScore.isSubmitting ? "⏳ Submitting..." : "🔒 Submit Encrypted Rating"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === "stats" && (
              <div className="luxury-card rounded-xl p-8">
                <h2 className="text-3xl font-bold mb-6">
                  <span className="text-luxury-gold">Activity</span>
                  <span className="text-white"> Statistics</span>
                </h2>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Activity ID
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        value={statsActivityId}
                        onChange={(e) => setStatsActivityId(parseInt(e.target.value) || 0)}
                        className="flex-1 bg-luxury-darkgray border border-luxury-border text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-luxury-green focus:border-transparent"
                        placeholder="Enter Activity ID"
                      />
                      <button
                        onClick={handleLoadActivityForStats}
                        disabled={eventsScore.isLoading}
                        className="bg-luxury-gold hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Load
                      </button>
                    </div>
                  </div>

                  {statsActivityInfo && (
                    <>
                      {/* Activity Information */}
                      <div className="bg-black/40 rounded-xl p-6 border border-luxury-border">
                        <div className="flex items-center gap-2 mb-4">
                          <h4 className="font-bold text-xl text-luxury-gold">
                            Activity #{statsActivityId}
                          </h4>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              Date.now() < parseInt(statsActivityInfo.startTime) * 1000
                                ? "bg-blue-900/30 text-blue-400"
                                : Date.now() > parseInt(statsActivityInfo.endTime) * 1000
                                ? "bg-green-900/30 text-luxury-green"
                                : "bg-green-900/30 text-green-400"
                            }`}
                          >
                            {Date.now() < parseInt(statsActivityInfo.startTime) * 1000
                              ? "NOT STARTED"
                              : Date.now() > parseInt(statsActivityInfo.endTime) * 1000
                              ? "ENDED"
                              : "● ACTIVE"}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          {(() => {
                            const metadata = getMetadata(statsActivityId);
                            return (
                              <>
                                {metadata && (
                                  <>
                                    <div className="flex justify-between py-1 border-b border-luxury-border">
                                      <span className="text-gray-400">Name:</span>
                                      <span className="font-semibold text-white">{metadata.name}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-luxury-border">
                                      <span className="text-gray-400">Description:</span>
                                      <span className="font-semibold text-white text-right max-w-md">{metadata.description}</span>
                                    </div>
                                  </>
                                )}
                              </>
                            );
                          })()}
                          <div className="flex justify-between py-1 border-b border-luxury-border">
                            <span className="text-gray-400">Organizer:</span>
                            <span className="font-mono text-white text-xs">
                              {statsActivityInfo.organizer.slice(0, 10)}...
                              {statsActivityInfo.organizer.slice(-8)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-luxury-border">
                            <span className="text-gray-400">Rating Dimensions:</span>
                            <span className="font-bold text-luxury-gold">
                              {statsActivityInfo.dimensionCount}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-luxury-border">
                            <span className="text-gray-400">Start Time:</span>
                            <span className="font-semibold text-white text-sm">
                              {new Date(parseInt(statsActivityInfo.startTime) * 1000).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-gray-400">End Time:</span>
                            <span className="font-semibold text-white text-sm">
                              {new Date(parseInt(statsActivityInfo.endTime) * 1000).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {!isOrganizer ? (
                        <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
                          <p className="text-red-400 font-bold text-lg">Access Denied</p>
                          <p className="text-gray-400 mt-2">You are not authorized to view statistics for this activity. Only the organizer can decrypt the results.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-black/40 rounded-xl p-6 border border-luxury-border">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 bg-luxury-gold/20 rounded-lg flex items-center justify-center">
                                <span className="text-luxury-gold text-xl">📊</span>
                              </div>
                              <h3 className="font-bold text-xl text-white">
                                Total Ratings Count
                              </h3>
                            </div>
                            
                            {eventsScore.totalRatings ? (
                              <div className="space-y-4">
                                <div className="bg-luxury-darkgray rounded-lg p-3">
                                  <p className="text-xs text-gray-400 mb-1">Encrypted Handle:</p>
                                  <p className="font-mono text-xs text-gray-300 break-all">
                                    {eventsScore.totalRatings}
                                  </p>
                                </div>
                                <button
                                  onClick={() =>
                                    eventsScore.decryptHandle(
                                      eventsScore.totalRatings!,
                                      `totalRatings-${statsActivityId}`
                                    )
                                  }
                                  disabled={eventsScore.isDecrypting}
                                  className="w-full bg-luxury-green hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {eventsScore.isDecrypting
                                    ? "🔓 Decrypting..."
                                    : "🔓 Decrypt Value"}
                                </button>
                                {eventsScore.decryptedValues.get(
                                  `totalRatings-${statsActivityId}`
                                ) && (
                                  <div className="bg-green-900/20 border border-green-500 rounded-lg p-4 text-center">
                                    <p className="text-sm text-gray-400 mb-1">Decrypted Result:</p>
                                    <p className="text-4xl font-bold text-green-400">
                                      {eventsScore.decryptedValues
                                        .get(`totalRatings-${statsActivityId}`)
                                        ?.clear?.toString()}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-2">Total number of ratings received</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  eventsScore.getTotalRatings(statsActivityId)
                                }
                                disabled={eventsScore.isLoading}
                                className="w-full bg-luxury-gold hover:bg-yellow-500 text-black font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {eventsScore.isLoading ? "Loading..." : "📊 Get Total Ratings"}
                              </button>
                            )}
                          </div>

                          <div className="bg-black/40 rounded-xl p-6 border border-luxury-border">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 bg-luxury-green/20 rounded-lg flex items-center justify-center">
                                <span className="text-luxury-green text-xl">⭐</span>
                              </div>
                              <h3 className="font-bold text-xl text-white">
                                Weighted Score
                              </h3>
                            </div>
                            
                            {eventsScore.weightedScore ? (
                              <div className="space-y-4">
                                <div className="bg-luxury-darkgray rounded-lg p-3">
                                  <p className="text-xs text-gray-400 mb-1">Encrypted Handle:</p>
                                  <p className="font-mono text-xs text-gray-300 break-all">
                                    {eventsScore.weightedScore}
                                  </p>
                                </div>
                                <button
                                  onClick={() =>
                                    eventsScore.decryptHandle(
                                      eventsScore.weightedScore!,
                                      `weightedScore-${statsActivityId}`
                                    )
                                  }
                                  disabled={eventsScore.isDecrypting}
                                  className="w-full bg-luxury-green hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {eventsScore.isDecrypting
                                    ? "🔓 Decrypting..."
                                    : "🔓 Decrypt Value"}
                                </button>
                                {eventsScore.decryptedValues.get(
                                  `weightedScore-${statsActivityId}`
                                ) && (() => {
                                  const rawValue = eventsScore.decryptedValues
                                    .get(`weightedScore-${statsActivityId}`)
                                    ?.clear;
                                  // Convert to number and divide by 1000 to account for weight scaling
                                  const numericValue = typeof rawValue === 'bigint' 
                                    ? Number(rawValue) 
                                    : typeof rawValue === 'string' 
                                    ? parseFloat(rawValue) 
                                    : Number(rawValue) || 0;
                                  const normalizedValue = numericValue / 1000;
                                  const totalRatingsValue = eventsScore.decryptedValues
                                    .get(`totalRatings-${statsActivityId}`)
                                    ?.clear;
                                  const totalRatings = typeof totalRatingsValue === 'bigint'
                                    ? Number(totalRatingsValue)
                                    : typeof totalRatingsValue === 'string'
                                    ? parseFloat(totalRatingsValue)
                                    : Number(totalRatingsValue) || 1;
                                  const averageValue = totalRatings > 0 ? normalizedValue / totalRatings : 0;
                                  
                                  return (
                                    <div className="bg-green-900/20 border border-green-500 rounded-lg p-4 text-center space-y-3">
                                      <div>
                                        <p className="text-sm text-gray-400 mb-1">Total Weighted Score:</p>
                                        <p className="text-3xl font-bold text-green-400">
                                          {normalizedValue.toFixed(2)}
                                        </p>
                                      </div>
                                      {totalRatings > 0 && (
                                        <div className="pt-3 border-t border-green-500/30">
                                          <p className="text-sm text-gray-400 mb-1">Average Weighted Score:</p>
                                          <p className="text-2xl font-bold text-luxury-gold">
                                            {averageValue.toFixed(2)}
                                          </p>
                                          <p className="text-xs text-gray-400 mt-1">
                                            (Total: {normalizedValue.toFixed(2)} / Ratings: {totalRatings})
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  eventsScore.getWeightedScore(statsActivityId)
                                }
                                disabled={eventsScore.isLoading}
                                className="w-full bg-luxury-gold hover:bg-yellow-500 text-black font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {eventsScore.isLoading ? "Loading..." : "⭐ Get Weighted Score"}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Message */}
        {eventsScore.message && (
          <div className="luxury-card rounded-xl p-6 mt-6 border-l-4 border-luxury-gold">
            <div className="flex items-start gap-3">
              <span className="text-2xl">ℹ️</span>
              <div>
                <p className="font-semibold text-luxury-gold mb-1">System Status</p>
                <p className="text-sm text-gray-300">
                  {eventsScore.message}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
