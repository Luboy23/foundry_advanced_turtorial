// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title LLCFaucet
/// @notice ERC20 水龙头：按地址限频 + 单次限额发放代币
/// @dev 使用 Ownable 做权限控制，SafeERC20 做安全转账
contract LLCFaucet is Ownable {
    using SafeERC20 for IERC20;

    /// @notice 水龙头发放的 ERC20 代币实例
    IERC20 public token;

    /// @notice 代币合约地址（与 token 对应）
    address public tokenAddress;

    /// @notice 每个地址最小领取间隔（秒）
    uint256 public dripInterval;

    /// @notice 单次领取上限（按代币最小单位计）
    uint256 public dripLimit;

    /// @dev 记录每个地址上次领取的时间戳（秒）
    mapping(address => uint256) dripTime;

    error LLCFaucet__IntervalHasNotPassed();
    error LLCFaucet__ExceedLimit();
    error LLCFaucet__FaucetEmpty();
    error LLCFaucet__InvalidAmount();

    /// @notice 用户成功领取时触发
    event LLCFaucet__Drip(address indexed Receiver, uint256 indexed Amount);

    /// @notice 管理员存入代币时触发
    event LLCFaucet__OwnerDeposit(uint256 indexed amount);

    /// @notice 初始化代币、领取间隔、领取上限与所有者
    /// @param _tokenAddress 代币合约地址
    /// @param _dripInterval 领取间隔（秒）
    /// @param _dripLimit 单次领取上限（代币最小单位）
    /// @param _owner 合约所有者
    constructor(
        address _tokenAddress,
        uint256 _dripInterval,
        uint256 _dripLimit,
        address _owner
    ) Ownable(_owner) {
        tokenAddress = _tokenAddress;
        dripInterval = _dripInterval;
        dripLimit = _dripLimit;
        token = IERC20(_tokenAddress);
    }

    /// @notice 领取代币
    /// @param _amount 领取数量（代币最小单位）
    /// @dev 可能因间隔未到、超额或水龙头余额不足而 revert
    function drip(uint256 _amount) external {
        uint256 targetAmount = _amount;

        if (block.timestamp < dripTime[_msgSender()] + dripInterval) {
            revert LLCFaucet__IntervalHasNotPassed();
        }

        if (targetAmount > dripLimit) {
            revert LLCFaucet__ExceedLimit();
        }

        if (token.balanceOf(address(this)) < targetAmount) {
            revert LLCFaucet__FaucetEmpty();
        }

        dripTime[_msgSender()] = block.timestamp;
        token.safeTransfer(_msgSender(), targetAmount);
        emit LLCFaucet__Drip(_msgSender(), targetAmount);
    }

    /// @notice 管理员向水龙头存入代币
    /// @param _amount 存入数量（代币最小单位）
    /// @dev 需要先对水龙头合约进行 approve
    function deposit(uint256 _amount) external onlyOwner {
        if (_amount > token.balanceOf(_msgSender())) {
            revert LLCFaucet__InvalidAmount();
        }

        token.safeTransferFrom(_msgSender(), address(this), _amount);
        emit LLCFaucet__OwnerDeposit(_amount);
    }

    /// @notice 更新领取间隔
    /// @param _newDripInterval 新的间隔（秒）
    function setDripInterval(uint256 _newDripInterval) public onlyOwner {
        dripInterval = _newDripInterval;
    }

    /// @notice 更新单次领取上限
    /// @param _newDripLimit 新上限（代币最小单位）
    function setDripLimit(uint256 _newDripLimit) public onlyOwner {
        dripLimit = _newDripLimit;
    }

    /// @notice 更新代币合约地址
    /// @param _newTokenAddress 新的代币地址
    /// @dev 当前仅更新 tokenAddress，若更换代币需同步更新 token 实例
    function setTokenAddress(address _newTokenAddress) public onlyOwner {
        tokenAddress = _newTokenAddress;
    }

    /// @notice 获取指定地址上次领取时间戳（秒）
    /// @param _user 查询地址
    function getDripTime(address _user) external view returns (uint256) {
        return dripTime[_user];
    }

    /// @notice 获取当前领取间隔（秒）
    function getDripInterval() external view returns (uint256) {
        return dripInterval;
    }

    /// @notice 获取当前单次领取上限（代币最小单位）
    function getDripLimit() external view returns (uint256) {
        return dripLimit;
    }
}
