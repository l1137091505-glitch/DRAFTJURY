// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DraftJury
/// @notice One-wallet-one-vote A/B copy duels on BOT Chain.
contract DraftJury {
    enum Category { Headline, Tagline, Ad, EmailSubject, Name, Image }
    enum Confidence { None, Low, Medium, High }

    struct Duel {
        address creator;
        string question;
        Category category;
        string optionA;
        string optionB;
        bool isImage;
        uint8 aiPick;
        Confidence aiConfidence;
        bytes32 aiReasonHash;
        uint64 endsAt;
        uint64 createdAt;
        uint32 votesA;
        uint32 votesB;
        bool ended;
        bool hidden;
    }

    address public immutable curator;
    uint256 public duelCount;
    mapping(uint256 => Duel) private _duels;
    mapping(uint256 => mapping(address => uint8)) public voteOf;
    mapping(uint256 => mapping(address => string)) private _reasons;
    mapping(address => uint256[]) private _created;

    event DuelStarted(uint256 indexed duelId, address indexed creator, uint64 endsAt);
    event PredictionCommitted(uint256 indexed duelId, uint8 aiPick, bytes32 aiReasonHash);
    event VoteCast(uint256 indexed duelId, address indexed voter, uint8 choice, string reason);
    event DuelEnded(uint256 indexed duelId, uint8 winner, uint32 votesA, uint32 votesB);
    event VisibilityChanged(uint256 indexed duelId, bool hidden);

    error InvalidDuration();
    error InvalidChoice();
    error DuelClosed();
    error AlreadyVoted();
    error CreatorCannotVote();
    error NotCreator();
    error NotCurator();

    constructor() { curator = msg.sender; }

    function startDuel(
        string calldata question,
        Category category,
        string calldata optionA,
        string calldata optionB,
        uint8 aiPick,
        bytes32 aiReasonHash,
        uint64 duration
    ) external returns (uint256 duelId) {
        if (duration != 1 days && duration != 3 days && duration != 7 days) revert InvalidDuration();
        if (bytes(question).length == 0 || bytes(optionA).length == 0 || bytes(optionB).length == 0) revert InvalidChoice();
        if (aiPick > 2) revert InvalidChoice();
        duelId = duelCount++;
        Duel storage duel = _duels[duelId];
        duel.creator = msg.sender;
        duel.question = question;
        duel.category = category;
        duel.optionA = optionA;
        duel.optionB = optionB;
        duel.isImage = category == Category.Image;
        duel.aiPick = aiPick;
        duel.aiConfidence = aiPick == 0 ? Confidence.None : Confidence.Medium;
        duel.aiReasonHash = aiReasonHash;
        duel.createdAt = uint64(block.timestamp);
        duel.endsAt = uint64(block.timestamp) + duration;
        _created[msg.sender].push(duelId);
        emit DuelStarted(duelId, msg.sender, duel.endsAt);
        emit PredictionCommitted(duelId, aiPick, aiReasonHash);
    }

    function vote(uint256 duelId, uint8 choice, string calldata reason) external {
        Duel storage duel = _duels[duelId];
        if (duel.creator == address(0) || duel.ended || block.timestamp >= duel.endsAt) revert DuelClosed();
        if (choice != 1 && choice != 2) revert InvalidChoice();
        if (msg.sender == duel.creator) revert CreatorCannotVote();
        if (voteOf[duelId][msg.sender] != 0) revert AlreadyVoted();
        voteOf[duelId][msg.sender] = choice;
        _reasons[duelId][msg.sender] = reason;
        if (choice == 1) duel.votesA++; else duel.votesB++;
        emit VoteCast(duelId, msg.sender, choice, reason);
    }

    function endEarly(uint256 duelId) external {
        Duel storage duel = _duels[duelId];
        if (msg.sender != duel.creator) revert NotCreator();
        if (duel.ended) revert DuelClosed();
        duel.ended = true;
        emit DuelEnded(duelId, winner(duelId), duel.votesA, duel.votesB);
    }

    function setHidden(uint256 duelId, bool hidden) external {
        if (msg.sender != curator) revert NotCurator();
        _duels[duelId].hidden = hidden;
        emit VisibilityChanged(duelId, hidden);
    }

    function getDuel(uint256 duelId) external view returns (Duel memory) { return _duels[duelId]; }
    function getDuels(uint256 offset, uint256 limit) external view returns (Duel[] memory page) {
        uint256 end = offset + limit;
        if (end > duelCount) end = duelCount;
        if (offset >= end) return new Duel[](0);
        page = new Duel[](end - offset);
        for (uint256 i; i < page.length; i++) page[i] = _duels[offset + i];
    }
    function duelsOf(address creator) external view returns (uint256[] memory) { return _created[creator]; }
    function reasonOf(uint256 duelId, address voter) external view returns (string memory) { return _reasons[duelId][voter]; }
    function winner(uint256 duelId) public view returns (uint8) {
        Duel storage duel = _duels[duelId];
        if (duel.votesA == duel.votesB) return 0;
        return duel.votesA > duel.votesB ? 1 : 2;
    }
    function stats(uint256 duelId) external view returns (uint32 votesA, uint32 votesB, uint32 total, uint8 winningOption, bool closed) {
        Duel storage duel = _duels[duelId];
        votesA = duel.votesA; votesB = duel.votesB; total = votesA + votesB;
        winningOption = winner(duelId); closed = duel.ended || block.timestamp >= duel.endsAt;
    }
}
