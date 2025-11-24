// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title EventsScore - Encrypted Event Rating System
/// @notice A privacy-preserving event rating system using FHEVM
/// @dev All scores are encrypted and computed on encrypted data
contract EventsScore is ZamaEthereumConfig {
    // Activity structure
    struct Activity {
        address organizer;
        uint256 startTime;
        uint256 endTime;
        bool exists;
        uint256 dimensionCount;
        mapping(uint256 => euint32) dimensionWeights; // Encrypted weights for each dimension
        mapping(uint256 => euint32) dimensionScores; // Encrypted sum of scores for each dimension
        mapping(uint256 => euint32) dimensionCounts; // Encrypted count of ratings for each dimension
        euint32 totalWeightedScore; // Encrypted weighted total score
        euint32 totalRatings; // Encrypted total number of ratings
    }

    // Rating structure
    struct Rating {
        mapping(uint256 => euint32) dimensionScores; // Encrypted scores for each dimension
        euint32 weightedScore; // Encrypted weighted score
        bool exists;
    }

    // Comment structure
    struct Comment {
        euint32 encryptedComment; // Encrypted comment text (stored as euint32)
        bool exists;
    }

    // Mapping from activityId to Activity
    mapping(uint256 => Activity) public activities;
    
    // Mapping from activityId => userAddress => Rating
    mapping(uint256 => mapping(address => Rating)) public ratings;
    
    // Mapping from activityId => userAddress => Comment
    mapping(uint256 => mapping(address => Comment)) public comments;
    
    // Activity counter
    uint256 public activityCounter;

    // Events
    event ActivityCreated(uint256 indexed activityId, address indexed organizer, uint256 startTime, uint256 endTime, uint256 dimensionCount);
    event RatingSubmitted(uint256 indexed activityId, address indexed rater);
    event CommentSubmitted(uint256 indexed activityId, address indexed commenter);
    event WeightsUpdated(uint256 indexed activityId, address indexed organizer);

    /// @notice Create a new activity
    /// @param startTime Start timestamp for rating period
    /// @param endTime End timestamp for rating period
    /// @param dimensionCount Number of rating dimensions
    /// @param weights Encrypted weights for each dimension
    /// @param weightProofs Proofs for the encrypted weights
    /// @return activityId The ID of the created activity
    function createActivity(
        uint256 startTime,
        uint256 endTime,
        uint256 dimensionCount,
        externalEuint32[] calldata weights,
        bytes[] calldata weightProofs
    ) external returns (uint256) {
        require(endTime > startTime, "Invalid time range");
        require(dimensionCount > 0 && dimensionCount <= 10, "Invalid dimension count");
        require(weights.length == dimensionCount, "Weights length mismatch");
        require(weightProofs.length == dimensionCount, "Proofs length mismatch");

        uint256 activityId = activityCounter++;
        Activity storage activity = activities[activityId];
        activity.organizer = msg.sender;
        activity.startTime = startTime;
        activity.endTime = endTime;
        activity.exists = true;
        activity.dimensionCount = dimensionCount;

        // Initialize encrypted weights
        for (uint256 i = 0; i < dimensionCount; i++) {
            euint32 encryptedWeight = FHE.fromExternal(weights[i], weightProofs[i]);
            activity.dimensionWeights[i] = encryptedWeight;
            FHE.allowThis(encryptedWeight);
            FHE.allow(encryptedWeight, msg.sender);
        }

        // Initialize encrypted accumulators
        activity.totalWeightedScore = FHE.asEuint32(0);
        activity.totalRatings = FHE.asEuint32(0);
        FHE.allowThis(activity.totalWeightedScore);
        FHE.allowThis(activity.totalRatings);
        // Grant organizer permission to decrypt these values
        FHE.allow(activity.totalWeightedScore, msg.sender);
        FHE.allow(activity.totalRatings, msg.sender);

        emit ActivityCreated(activityId, msg.sender, startTime, endTime, dimensionCount);
        return activityId;
    }

    /// @notice Submit encrypted ratings for an activity
    /// @param activityId The activity ID
    /// @param scores Encrypted scores for each dimension (1-5)
    /// @param scoreProofs Proofs for the encrypted scores
    function submitRating(
        uint256 activityId,
        externalEuint32[] calldata scores,
        bytes[] calldata scoreProofs
    ) external {
        Activity storage activity = activities[activityId];
        require(activity.exists, "Activity does not exist");
        require(block.timestamp >= activity.startTime && block.timestamp <= activity.endTime, "Rating period invalid");
        require(scores.length == activity.dimensionCount, "Scores length mismatch");
        require(scoreProofs.length == activity.dimensionCount, "Proofs length mismatch");
        require(!ratings[activityId][msg.sender].exists, "Rating already submitted");

        Rating storage rating = ratings[activityId][msg.sender];
        rating.exists = true;

        euint32 weightedScore = FHE.asEuint32(0);

        // Process each dimension
        for (uint256 i = 0; i < activity.dimensionCount; i++) {
            euint32 encryptedScore = FHE.fromExternal(scores[i], scoreProofs[i]);
            rating.dimensionScores[i] = encryptedScore;

            // Add to dimension totals
            activity.dimensionScores[i] = FHE.add(activity.dimensionScores[i], encryptedScore);
            activity.dimensionCounts[i] = FHE.add(activity.dimensionCounts[i], FHE.asEuint32(1));

            // Calculate weighted contribution: weight * score
            euint32 weightedContribution = FHE.mul(activity.dimensionWeights[i], encryptedScore);
            weightedScore = FHE.add(weightedScore, weightedContribution);

            FHE.allowThis(encryptedScore);
            FHE.allowThis(activity.dimensionScores[i]);
            FHE.allowThis(activity.dimensionCounts[i]);
            FHE.allowThis(weightedContribution);
        }

        rating.weightedScore = weightedScore;
        FHE.allowThis(weightedScore);

        // Update activity totals
        activity.totalWeightedScore = FHE.add(activity.totalWeightedScore, weightedScore);
        activity.totalRatings = FHE.add(activity.totalRatings, FHE.asEuint32(1));
        FHE.allowThis(activity.totalWeightedScore);
        FHE.allowThis(activity.totalRatings);
        // Grant organizer permission to decrypt these values
        FHE.allow(activity.totalWeightedScore, activity.organizer);
        FHE.allow(activity.totalRatings, activity.organizer);

        emit RatingSubmitted(activityId, msg.sender);
    }

    /// @notice Submit encrypted comment for an activity
    /// @param activityId The activity ID
    /// @param encryptedComment Encrypted comment text
    /// @param commentProof Proof for the encrypted comment
    function submitComment(
        uint256 activityId,
        externalEuint32 encryptedComment,
        bytes calldata commentProof
    ) external {
        Activity storage activity = activities[activityId];
        require(activity.exists, "Activity does not exist");
        require(block.timestamp >= activity.startTime && block.timestamp <= activity.endTime, "Comment period invalid");
        require(!comments[activityId][msg.sender].exists, "Comment already submitted");

        Comment storage comment = comments[activityId][msg.sender];
        comment.encryptedComment = FHE.fromExternal(encryptedComment, commentProof);
        comment.exists = true;

        FHE.allowThis(comment.encryptedComment);
        FHE.allow(comment.encryptedComment, activity.organizer);

        emit CommentSubmitted(activityId, msg.sender);
    }

    /// @notice Update dimension weights (only organizer)
    /// @param activityId The activity ID
    /// @param weights New encrypted weights for each dimension
    /// @param weightProofs Proofs for the encrypted weights
    function updateWeights(
        uint256 activityId,
        externalEuint32[] calldata weights,
        bytes[] calldata weightProofs
    ) external {
        Activity storage activity = activities[activityId];
        require(activity.exists, "Activity does not exist");
        require(msg.sender == activity.organizer, "Only organizer can update weights");
        require(weights.length == activity.dimensionCount, "Weights length mismatch");
        require(weightProofs.length == activity.dimensionCount, "Proofs length mismatch");

        for (uint256 i = 0; i < activity.dimensionCount; i++) {
            euint32 encryptedWeight = FHE.fromExternal(weights[i], weightProofs[i]);
            activity.dimensionWeights[i] = encryptedWeight;
            FHE.allowThis(encryptedWeight);
            FHE.allow(encryptedWeight, msg.sender);
        }

        emit WeightsUpdated(activityId, msg.sender);
    }

    /// @notice Get encrypted average score for a specific dimension
    /// @param activityId The activity ID
    /// @param dimensionIndex The dimension index
    /// @return The encrypted average score for the dimension
    function getDimensionAverage(uint256 activityId, uint256 dimensionIndex) external view returns (euint32) {
        Activity storage activity = activities[activityId];
        require(activity.exists, "Activity does not exist");
        require(dimensionIndex < activity.dimensionCount, "Invalid dimension index");

        // Average = sum / count (in encrypted form)
        // Note: Division in FHE is complex, so we return both sum and count
        // The actual division should be done after decryption
        // For now, we return the sum and count separately
        return activity.dimensionScores[dimensionIndex];
    }

    /// @notice Get encrypted dimension count
    /// @param activityId The activity ID
    /// @param dimensionIndex The dimension index
    /// @return The encrypted count of ratings for the dimension
    function getDimensionCount(uint256 activityId, uint256 dimensionIndex) external view returns (euint32) {
        Activity storage activity = activities[activityId];
        require(activity.exists, "Activity does not exist");
        require(dimensionIndex < activity.dimensionCount, "Invalid dimension index");

        return activity.dimensionCounts[dimensionIndex];
    }

    /// @notice Get encrypted weighted average score
    /// @param activityId The activity ID
    /// @return The encrypted weighted total score
    function getWeightedTotalScore(uint256 activityId) external view returns (euint32) {
        Activity storage activity = activities[activityId];
        require(activity.exists, "Activity does not exist");

        return activity.totalWeightedScore;
    }

    /// @notice Get encrypted total ratings count
    /// @param activityId The activity ID
    /// @return The encrypted total number of ratings
    function getTotalRatings(uint256 activityId) external view returns (euint32) {
        Activity storage activity = activities[activityId];
        require(activity.exists, "Activity does not exist");

        return activity.totalRatings;
    }

    /// @notice Get activity information
    /// @param activityId The activity ID
    /// @return organizer The organizer address
    /// @return startTime Start timestamp
    /// @return endTime End timestamp
    /// @return dimensionCount Number of dimensions
    /// @return exists Whether the activity exists
    function getActivityInfo(uint256 activityId) external view returns (
        address organizer,
        uint256 startTime,
        uint256 endTime,
        uint256 dimensionCount,
        bool exists
    ) {
        Activity storage activity = activities[activityId];
        return (
            activity.organizer,
            activity.startTime,
            activity.endTime,
            activity.dimensionCount,
            activity.exists
        );
    }

    /// @notice Get encrypted comment for a user
    /// @param activityId The activity ID
    /// @param userAddress The user address
    /// @return The encrypted comment
    function getComment(uint256 activityId, address userAddress) external view returns (euint32) {
        Comment storage comment = comments[activityId][userAddress];
        require(comment.exists, "Comment does not exist");
        return comment.encryptedComment;
    }

    /// @notice Check if a user has submitted a rating
    /// @param activityId The activity ID
    /// @param userAddress The user address
    /// @return Whether the user has submitted a rating
    function hasRated(uint256 activityId, address userAddress) external view returns (bool) {
        return ratings[activityId][userAddress].exists;
    }

    /// @notice Check if a user has submitted a comment
    /// @param activityId The activity ID
    /// @param userAddress The user address
    /// @return Whether the user has submitted a comment
    function hasCommented(uint256 activityId, address userAddress) external view returns (bool) {
        return comments[activityId][userAddress].exists;
    }
}

