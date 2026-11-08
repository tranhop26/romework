// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IERC20G0 {
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Single-job, intentionally frozen testnet escrow. No refund or recovery.
contract RomeWorkG0 {
    address public immutable token;
    address public immutable client;
    address public immutable freelancer;
    uint256 public immutable amount;
    bytes32 public immutable termsHash;

    enum State { Proposed, Accepted, Funded, Submitted, Approved, Paid }
    State public state;
    uint256 public deposited;
    uint256 public locked;
    uint256 public claimable;
    uint256 public paidOut;
    bytes32 public deliveryHash;
    bool private entered;

    event Transition(address indexed caller, uint8 indexed action, uint8 state);

    constructor(address token_, address client_, address freelancer_, uint256 amount_, bytes32 termsHash_) {
        require(token_.code.length > 0, "token must be contract");
        require(client_ != address(0) && freelancer_ != address(0) && client_ != freelancer_, "invalid roles");
        require(amount_ > 0 && amount_ <= 1_000_000, "invalid amount");
        require(termsHash_ != bytes32(0), "empty terms");
        token = token_;
        client = client_;
        freelancer = freelancer_;
        amount = amount_;
        termsHash = termsHash_;
    }

    modifier nonReentrant() {
        require(!entered, "reentrancy");
        entered = true;
        _;
        entered = false;
    }

    function accept(bytes32 hash) external {
        require(msg.sender == freelancer, "freelancer only");
        require(state == State.Proposed, "wrong state");
        require(hash == termsHash, "terms mismatch");
        state = State.Accepted;
        emit Transition(msg.sender, 1, uint8(state));
    }

    function fund() external nonReentrant {
        require(msg.sender == client, "client only");
        require(state == State.Accepted, "wrong state");
        uint256 beforeBalance = IERC20G0(token).balanceOf(address(this));
        safeCall(abi.encodeWithSignature("transferFrom(address,address,uint256)", client, address(this), amount));
        uint256 afterBalance = IERC20G0(token).balanceOf(address(this));
        require(afterBalance >= beforeBalance && afterBalance - beforeBalance == amount, "balance delta");
        deposited = amount;
        locked = amount;
        state = State.Funded;
        emit Transition(msg.sender, 2, uint8(state));
    }

    function submitDelivery(bytes32 hash) external {
        require(msg.sender == freelancer, "freelancer only");
        require(state == State.Funded, "wrong state");
        require(hash != bytes32(0), "empty delivery");
        deliveryHash = hash;
        state = State.Submitted;
        emit Transition(msg.sender, 3, uint8(state));
    }

    function approve() external {
        require(msg.sender == client, "client only");
        require(state == State.Submitted, "wrong state");
        locked = 0;
        claimable = amount;
        state = State.Approved;
        emit Transition(msg.sender, 4, uint8(state));
    }

    function claim() external nonReentrant {
        require(msg.sender == freelancer, "freelancer only");
        require(state == State.Approved, "wrong state");
        claimable = 0;
        paidOut = amount;
        state = State.Paid;
        safeCall(abi.encodeWithSignature("transfer(address,uint256)", freelancer, amount));
        emit Transition(msg.sender, 5, uint8(state));
    }

    function safeCall(bytes memory data) private {
        (bool success, bytes memory result) = token.call(data);
        require(success && (result.length == 0 || (result.length == 32 && abi.decode(result, (bool)))), "token transfer failed");
    }
}
