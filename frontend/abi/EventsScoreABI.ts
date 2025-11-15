
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const EventsScoreABI = {
  "abi": [
    {
      "inputs": [],
      "name": "ZamaProtocolUnsupported",
      "type": "error"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "organizer",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "startTime",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "endTime",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "dimensionCount",
          "type": "uint256"
        }
      ],
      "name": "ActivityCreated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "commenter",
          "type": "address"
        }
      ],
      "name": "CommentSubmitted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "rater",
          "type": "address"
        }
      ],
      "name": "RatingSubmitted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "organizer",
          "type": "address"
        }
      ],
      "name": "WeightsUpdated",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "activities",
      "outputs": [
        {
          "internalType": "address",
          "name": "organizer",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "startTime",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "endTime",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "exists",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "dimensionCount",
          "type": "uint256"
        },
        {
          "internalType": "euint32",
          "name": "totalWeightedScore",
          "type": "bytes32"
        },
        {
          "internalType": "euint32",
          "name": "totalRatings",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "activityCounter",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "comments",
      "outputs": [
        {
          "internalType": "euint32",
          "name": "encryptedComment",
          "type": "bytes32"
        },
        {
          "internalType": "bool",
          "name": "exists",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "confidentialProtocolId",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "startTime",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "endTime",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "dimensionCount",
          "type": "uint256"
        },
        {
          "internalType": "externalEuint32[]",
          "name": "weights",
          "type": "bytes32[]"
        },
        {
          "internalType": "bytes[]",
          "name": "weightProofs",
          "type": "bytes[]"
        }
      ],
      "name": "createActivity",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        }
      ],
      "name": "getActivityInfo",
      "outputs": [
        {
          "internalType": "address",
          "name": "organizer",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "startTime",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "endTime",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "dimensionCount",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "exists",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "userAddress",
          "type": "address"
        }
      ],
      "name": "getComment",
      "outputs": [
        {
          "internalType": "euint32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "dimensionIndex",
          "type": "uint256"
        }
      ],
      "name": "getDimensionAverage",
      "outputs": [
        {
          "internalType": "euint32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "dimensionIndex",
          "type": "uint256"
        }
      ],
      "name": "getDimensionCount",
      "outputs": [
        {
          "internalType": "euint32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        }
      ],
      "name": "getTotalRatings",
      "outputs": [
        {
          "internalType": "euint32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        }
      ],
      "name": "getWeightedTotalScore",
      "outputs": [
        {
          "internalType": "euint32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "userAddress",
          "type": "address"
        }
      ],
      "name": "hasCommented",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "userAddress",
          "type": "address"
        }
      ],
      "name": "hasRated",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "ratings",
      "outputs": [
        {
          "internalType": "euint32",
          "name": "weightedScore",
          "type": "bytes32"
        },
        {
          "internalType": "bool",
          "name": "exists",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        },
        {
          "internalType": "externalEuint32",
          "name": "encryptedComment",
          "type": "bytes32"
        },
        {
          "internalType": "bytes",
          "name": "commentProof",
          "type": "bytes"
        }
      ],
      "name": "submitComment",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        },
        {
          "internalType": "externalEuint32[]",
          "name": "scores",
          "type": "bytes32[]"
        },
        {
          "internalType": "bytes[]",
          "name": "scoreProofs",
          "type": "bytes[]"
        }
      ],
      "name": "submitRating",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "activityId",
          "type": "uint256"
        },
        {
          "internalType": "externalEuint32[]",
          "name": "weights",
          "type": "bytes32[]"
        },
        {
          "internalType": "bytes[]",
          "name": "weightProofs",
          "type": "bytes[]"
        }
      ],
      "name": "updateWeights",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ]
} as const;

