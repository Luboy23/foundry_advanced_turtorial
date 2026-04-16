// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import { IAlcoholRoleRegistry } from "./interfaces/IAlcoholRoleRegistry.sol";
import { IAlcoholAgeEligibilityVerifier } from "./interfaces/IAlcoholAgeEligibilityVerifier.sol";

/// @title 酒水商城合约
/// @notice 管理商品、托管 ETH、记录订单和卖家提现。
contract AlcoholMarketplace {
    error ZeroAddress();
    error ZeroProductId();
    error ProductNotFound(bytes32 productId);
    error ProductInactive(bytes32 productId);
    error InvalidPrice(uint256 price);
    error InvalidQuantity(uint32 requested);
    error BuyerNotEligible(address buyer);
    error OutOfStock(bytes32 productId, uint32 requested, uint32 available);
    error IncorrectPayment(uint256 provided, uint256 expected);
    error Unauthorized(address caller);
    error NoPendingBalance(address seller);
    error TransferFailed();
    error SellerUnavailable();

    struct Product {
        bytes32 productId;
        uint256 price;
        uint32 stock;
        bool active;
        string metadataURI;
    }

    struct Order {
        bytes32 orderId;
        bytes32 productId;
        address buyer;
        address seller;
        uint32 quantity;
        uint256 totalPriceWei;
        uint64 purchasedAt;
    }

    IAlcoholRoleRegistry public immutable roleRegistry;
    IAlcoholAgeEligibilityVerifier public immutable eligibilityVerifier;

    mapping(bytes32 => Product) private s_products;
    mapping(bytes32 => Order) private s_orders;
    mapping(address => uint256) private s_pendingBalances;
    uint256 private s_orderNonce;

    event ProductConfigured(
        bytes32 indexed productId,
        uint256 price,
        uint32 stock,
        bool active,
        string metadataURI
    );
    event ProductPurchased(
        bytes32 indexed orderId,
        bytes32 indexed productId,
        address indexed buyer,
        address seller,
        uint32 quantity,
        uint256 totalPriceWei,
        uint32 remainingStock
    );
    event SellerWithdrawal(address indexed seller, uint256 amount);

    constructor(address roleRegistryAddress, address eligibilityVerifierAddress) {
        if (roleRegistryAddress == address(0) || eligibilityVerifierAddress == address(0)) {
            revert ZeroAddress();
        }

        roleRegistry = IAlcoholRoleRegistry(roleRegistryAddress);
        eligibilityVerifier = IAlcoholAgeEligibilityVerifier(eligibilityVerifierAddress);
    }

    modifier onlySeller() {
        if (!roleRegistry.isSeller(msg.sender)) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    function setProduct(
        bytes32 productId,
        uint256 price,
        uint32 stock,
        bool active,
        string calldata metadataURI
    ) external onlySeller {
        if (productId == bytes32(0)) {
            revert ZeroProductId();
        }
        if (price == 0) {
            revert InvalidPrice(price);
        }

        s_products[productId] = Product({
            productId: productId,
            price: price,
            stock: stock,
            active: active,
            metadataURI: metadataURI
        });

        emit ProductConfigured(productId, price, stock, active, metadataURI);
    }

    function setProductStatus(bytes32 productId, bool active) external onlySeller {
        Product storage product = _getProductStorage(productId);
        product.active = active;
        emit ProductConfigured(productId, product.price, product.stock, active, product.metadataURI);
    }

    function updateProductPrice(bytes32 productId, uint256 price) external onlySeller {
        if (price == 0) {
            revert InvalidPrice(price);
        }

        Product storage product = _getProductStorage(productId);
        product.price = price;
        emit ProductConfigured(productId, price, product.stock, product.active, product.metadataURI);
    }

    function updateProductStock(bytes32 productId, uint32 stock) external onlySeller {
        Product storage product = _getProductStorage(productId);
        product.stock = stock;
        emit ProductConfigured(productId, product.price, stock, product.active, product.metadataURI);
    }

    function purchaseProduct(bytes32 productId, uint32 quantity) external payable returns (bytes32 orderId) {
        if (!roleRegistry.isBuyer(msg.sender)) {
            revert Unauthorized(msg.sender);
        }
        // 商城不重新理解生日或 proof，只消费资格验证合约给出的当前有效状态。
        if (!eligibilityVerifier.hasValidEligibility(msg.sender)) {
            revert BuyerNotEligible(msg.sender);
        }
        if (quantity == 0) {
            revert InvalidQuantity(quantity);
        }

        Product storage product = _getProductStorage(productId);
        if (!product.active) {
            revert ProductInactive(productId);
        }
        if (quantity > product.stock) {
            revert OutOfStock(productId, quantity, product.stock);
        }

        uint256 totalPriceWei = product.price * uint256(quantity);
        if (msg.value != totalPriceWei) {
            revert IncorrectPayment(msg.value, totalPriceWei);
        }

        address seller = roleRegistry.getSeller();
        if (seller == address(0) || !roleRegistry.isSeller(seller)) {
            revert SellerUnavailable();
        }

        // 购买成功后，资金先进入商城托管余额，卖家后续再主动提现。
        product.stock -= quantity;
        s_pendingBalances[seller] += msg.value;
        s_orderNonce += 1;

        // orderId 带上 nonce 和时间戳，保证同一买家重复购买同一商品时也能得到不同订单。
        orderId = keccak256(abi.encode(productId, msg.sender, s_orderNonce, block.timestamp));
        s_orders[orderId] = Order({
            orderId: orderId,
            productId: productId,
            buyer: msg.sender,
            seller: seller,
            quantity: quantity,
            totalPriceWei: msg.value,
            purchasedAt: uint64(block.timestamp)
        });

        emit ProductPurchased(orderId, productId, msg.sender, seller, quantity, msg.value, product.stock);
    }

    function withdraw() external onlySeller {
        uint256 amount = s_pendingBalances[msg.sender];
        if (amount == 0) {
            revert NoPendingBalance(msg.sender);
        }

        // 先清余额再转账，避免重入时重复提取同一笔待结算金额。
        s_pendingBalances[msg.sender] = 0;
        (bool success,) = msg.sender.call{ value: amount }("");
        if (!success) {
            revert TransferFailed();
        }

        emit SellerWithdrawal(msg.sender, amount);
    }

    function getProduct(bytes32 productId) external view returns (Product memory) {
        return _getProduct(productId);
    }

    function getOrder(bytes32 orderId) external view returns (Order memory) {
        Order memory order = s_orders[orderId];
        if (order.orderId == bytes32(0)) {
            revert ProductNotFound(orderId);
        }
        return order;
    }

    function pendingBalanceOf(address seller) external view returns (uint256) {
        return s_pendingBalances[seller];
    }

    function _getProduct(bytes32 productId) private view returns (Product memory product) {
        product = s_products[productId];
        if (product.productId == bytes32(0)) {
            revert ProductNotFound(productId);
        }
    }

    function _getProductStorage(bytes32 productId) private view returns (Product storage product) {
        product = s_products[productId];
        if (product.productId == bytes32(0)) {
            revert ProductNotFound(productId);
        }
    }
}
