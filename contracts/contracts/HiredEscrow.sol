// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HiredEscrow
/// @notice Escrow de missions pour agents IA sur BNB Chain.
///         Un poster (humain ou agent) bloque une récompense (BNB natif ou un ERC20 comme USDT),
///         embauche un agent, valide la livraison ; l'argent part sur le portefeuille de l'agent.
///         Sans réponse du poster 48 h après la livraison, l'agent peut se payer lui-même.
///         Hired ne détient jamais les fonds en dehors de ce contrat et ne peut pas les déplacer.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract HiredEscrow {
    enum Status { Open, Hired, Delivered, Paid, Cancelled, Disputed }

    struct Job {
        address poster;
        address agent;        // portefeuille agentique de l'agent embauché
        address token;        // address(0) = BNB natif
        uint256 reward;       // montant bloqué
        uint64 deadline;      // date limite pour la livraison (0 = aucune)
        uint64 deliveredAt;   // horodatage de la livraison
        Status status;
        string ref;           // identifiant hors-chaîne (ex: id Supabase)
    }

    uint64 public constant AUTO_RELEASE_DELAY = 48 hours;
    uint16 public constant MAX_FEE_BPS = 500; // 5 % max, garde-fou

    address public owner;
    /// @notice Propriétaire proposé, effectif après acceptOwnership() (prévu pour un multisig).
    address public pendingOwner;
    /// @notice Relayer Hired : peut déclarer une livraison ou réclamer POUR un agent
    ///         (les portefeuilles agentiques ne savent pas toujours appeler un contrat).
    ///         Il ne peut jamais rediriger les fonds : ils vont à l'agent embauché ou au poster.
    address public relayer;
    address public feeRecipient;
    uint16 public feeBps; // frais de protocole en points de base, prélevés à la sortie

    uint256 public jobCount;
    mapping(uint256 => Job) public jobs;

    event JobPosted(uint256 indexed id, address indexed poster, address token, uint256 reward, uint64 deadline, string ref);
    event AgentHired(uint256 indexed id, address indexed agent);
    event Delivered(uint256 indexed id, string proof);
    event Paid(uint256 indexed id, address indexed agent, uint256 amount, uint256 fee);
    event Cancelled(uint256 indexed id);
    event Disputed(uint256 indexed id, address by);
    event DisputeResolved(uint256 indexed id, uint256 toAgent, uint256 toPoster);
    event FeeUpdated(uint16 feeBps, address recipient);
    event RelayerUpdated(address relayer);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotPoster();
    error NotAgent();
    error BadStatus();
    error BadAmount();
    error TooEarly();
    error TooLate();
    error NotOwner();
    error TransferFailed();

    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }

    constructor(address _feeRecipient, uint16 _feeBps) {
        require(_feeBps <= MAX_FEE_BPS, "fee too high");
        // un transfer ERC20 vers address(0) revert : tous les paiements USDT seraient bloqués
        require(_feeRecipient != address(0), "fee recipient required");
        owner = msg.sender;
        relayer = msg.sender;
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;
    }

    // ---------- poster ----------

    /// @notice Publie une mission payée en BNB. msg.value est la récompense.
    function postJobNative(uint64 deadline, string calldata ref) external payable returns (uint256 id) {
        if (msg.value == 0) revert BadAmount();
        id = _post(address(0), msg.value, deadline, ref);
    }

    /// @notice Publie une mission payée en ERC20 (USDT). Le poster doit avoir approuvé le montant.
    function postJobToken(address token, uint256 reward, uint64 deadline, string calldata ref) external returns (uint256 id) {
        if (reward == 0 || token == address(0)) revert BadAmount();
        if (!IERC20(token).transferFrom(msg.sender, address(this), reward)) revert TransferFailed();
        id = _post(token, reward, deadline, ref);
    }

    function _post(address token, uint256 reward, uint64 deadline, string calldata ref) internal returns (uint256 id) {
        id = ++jobCount;
        jobs[id] = Job({
            poster: msg.sender, agent: address(0), token: token, reward: reward,
            deadline: deadline, deliveredAt: 0, status: Status.Open, ref: ref
        });
        emit JobPosted(id, msg.sender, token, reward, deadline, ref);
    }

    /// @notice Embauche un agent. Son adresse est le portefeuille qui recevra le paiement.
    function hire(uint256 id, address agent) external {
        Job storage j = jobs[id];
        if (msg.sender != j.poster) revert NotPoster();
        if (j.status != Status.Open) revert BadStatus();
        if (agent == address(0) || agent == j.poster) revert BadAmount();
        j.agent = agent;
        j.status = Status.Hired;
        emit AgentHired(id, agent);
    }

    /// @notice Valide la livraison et paie l'agent.
    function approve(uint256 id) external {
        Job storage j = jobs[id];
        if (msg.sender != j.poster) revert NotPoster();
        if (j.status != Status.Hired && j.status != Status.Delivered) revert BadStatus();
        _pay(id, j);
    }

    /// @notice Annule une mission encore ouverte, ou embauchée mais non livrée après la date limite.
    function cancel(uint256 id) external {
        Job storage j = jobs[id];
        if (msg.sender != j.poster) revert NotPoster();
        if (j.status == Status.Open) {
            // ok
        } else if (j.status == Status.Hired) {
            if (j.deadline == 0 || block.timestamp <= j.deadline) revert TooEarly();
        } else {
            revert BadStatus();
        }
        j.status = Status.Cancelled;
        _send(j.token, j.poster, j.reward);
        emit Cancelled(id);
    }

    /// @notice Le poster conteste une livraison avant la libération automatique.
    function dispute(uint256 id) external {
        Job storage j = jobs[id];
        if (msg.sender != j.poster) revert NotPoster();
        if (j.status != Status.Delivered) revert BadStatus();
        if (block.timestamp >= j.deliveredAt + AUTO_RELEASE_DELAY) revert TooLate();
        j.status = Status.Disputed;
        emit Disputed(id, msg.sender);
    }

    // ---------- agent ----------

    /// @notice L'agent déclare la livraison. `proof` : hash ou lien vers le livrable.
    function deliver(uint256 id, string calldata proof) external {
        Job storage j = jobs[id];
        if (msg.sender != j.agent && msg.sender != relayer) revert NotAgent();
        if (j.status != Status.Hired) revert BadStatus();
        j.status = Status.Delivered;
        j.deliveredAt = uint64(block.timestamp);
        emit Delivered(id, proof);
    }

    /// @notice 48 h après la livraison sans réponse du poster, l'agent se fait payer.
    function claim(uint256 id) external {
        Job storage j = jobs[id];
        if (msg.sender != j.agent && msg.sender != relayer) revert NotAgent();
        if (j.status != Status.Delivered) revert BadStatus();
        if (block.timestamp < j.deliveredAt + AUTO_RELEASE_DELAY) revert TooEarly();
        _pay(id, j);
    }

    // ---------- litiges (arbitre = owner, v1) ----------

    /// @notice Tranche un litige en répartissant la récompense. Les frais s'appliquent à la part agent.
    function resolve(uint256 id, uint256 toAgent) external onlyOwner {
        Job storage j = jobs[id];
        if (j.status != Status.Disputed) revert BadStatus();
        if (toAgent > j.reward) revert BadAmount();
        uint256 toPoster = j.reward - toAgent;
        j.status = Status.Paid;
        uint256 fee = (toAgent * feeBps) / 10_000;
        if (toAgent - fee > 0) _send(j.token, j.agent, toAgent - fee);
        if (fee > 0) _send(j.token, feeRecipient, fee);
        if (toPoster > 0) _send(j.token, j.poster, toPoster);
        emit DisputeResolved(id, toAgent, toPoster);
    }

    // ---------- admin ----------

    function setFee(uint16 _feeBps, address _recipient) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "fee too high");
        require(_recipient != address(0), "fee recipient required");
        feeBps = _feeBps;
        feeRecipient = _recipient;
        emit FeeUpdated(_feeBps, _recipient);
    }

    function setRelayer(address r) external onlyOwner { relayer = r; emit RelayerUpdated(r); }

    /// @notice Étape 1 : propose un nouveau propriétaire. Une faute de frappe ne perd plus le contrat.
    function transferOwnership(address to) external onlyOwner {
        pendingOwner = to;
        emit OwnershipTransferStarted(owner, to);
    }

    /// @notice Étape 2 : le propriétaire proposé (ex. un Safe) accepte.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    // ---------- interne ----------

    function _pay(uint256 id, Job storage j) internal {
        j.status = Status.Paid;
        uint256 fee = (j.reward * feeBps) / 10_000;
        uint256 amount = j.reward - fee;
        _send(j.token, j.agent, amount);
        if (fee > 0) _send(j.token, feeRecipient, fee);
        emit Paid(id, j.agent, amount, fee);
    }

    function _send(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool ok, ) = payable(to).call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            if (!IERC20(token).transfer(to, amount)) revert TransferFailed();
        }
    }
}
