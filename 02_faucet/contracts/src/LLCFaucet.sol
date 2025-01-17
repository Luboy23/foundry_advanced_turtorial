// SPDX-License-Identifier: MIT
// 许可证声明：指定合约的版权许可为 MIT，允许代码的自由使用和修改。

pragma solidity ^0.8.20;
// 指定 Solidity 编译器的版本。这里选择的是 0.8.20，确保合约在这一版本下编译通过。

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// 导入 OpenZeppelin 的 IERC20 接口，用于操作 ERC20 标准的代币。
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
// 导入 OpenZeppelin 的 Ownable 合约，用于提供所有者控制权限。
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// 导入 OpenZeppelin 的 SafeERC20 库，用于安全地进行 ERC20 代币的转账操作。

contract LLCFaucet is Ownable {
    using SafeERC20 for IERC20;
    // 使用 SafeERC20 库来增强 ERC20 代币的安全性。

    IERC20 public token;
    // 定义一个 IERC20 类型的变量 token，用于存储要发放的代币合约。

    address public tokenAddress;
    // 定义一个地址类型的变量 tokenAddress，用于存储代币合约的地址。

    uint256 public dripInterval;
    // 定义一个 uint256 类型的变量 dripInterval，用于设置用户请求代币的最小间隔时间。

    uint256 public dripLimit;
    // 定义一个 uint256 类型的变量 dripLimit，用于设置用户每次最多可以领取的代币数量。

    mapping(address => uint256) dripTime;
    // 定义一个映射，将用户地址映射到他们上次领取代币的时间戳。

    error LLCFaucet__IntervalHasNotPassed();
    // 定义一个错误类型，当用户请求代币的间隔时间未过时抛出此错误。

    error LLCFaucet__ExceedLimit();
    // 定义一个错误类型，当用户请求领取的代币数量超过最大限制时抛出此错误。

    error LLCFaucet__FaucetEmpty();
    // 定义一个错误类型，当水龙头中没有足够代币时抛出此错误。

    error LLCFaucet__InvalidAmount();
    // 定义一个错误类型，当存入的代币数量无效时抛出此错误。

    event LLCFaucet__Drip(address indexed Receiver, uint256 indexed Amount);
    // 定义一个事件，当用户成功领取代币时触发，记录接收者地址和领取的代币数量。

    event LLCFaucet__OwnerDeposit(uint256 indexed amount);
    // 定义一个事件，当合约所有者存入代币时触发，记录存入的代币数量。

    constructor(address _tokenAddress, uint256 _dripInterval, uint256 _dripLimit, address _owner) Ownable(_owner) {
        // 合约构造函数，初始化代币合约地址、领取间隔、领取限制以及合约所有者地址。
        tokenAddress = _tokenAddress;
        dripInterval = _dripInterval;
        dripLimit = _dripLimit;
        token = IERC20(_tokenAddress);
        // 使用传入的代币地址初始化 token 变量为 ERC20 代币合约的实例。
    }

    function drip(uint256 _amount) external {
        // 定义 drip 函数，允许用户请求领取代币。

        uint256 targetAmount = _amount;
        // 设置目标领取的代币数量。

        if (block.timestamp < dripTime[_msgSender()] + dripInterval) {
            // 如果当前时间戳小于用户上次领取代币时间加上领取间隔，则抛出错误。
            revert LLCFaucet__IntervalHasNotPassed();
        }

        if (targetAmount > dripLimit) {
            // 如果请求的代币数量大于最大领取限制，则抛出错误。
            revert LLCFaucet__ExceedLimit();
        }

        if (token.balanceOf(address(this)) < targetAmount) {
            // 如果合约中代币余额不足以满足请求的代币数量，则抛出错误。
            revert LLCFaucet__FaucetEmpty();
        }

        dripTime[_msgSender()] = block.timestamp;
        // 更新用户的上次领取代币时间为当前时间戳。

        token.safeTransfer(_msgSender(), targetAmount);
        // 安全地将目标数量的代币转账到请求者地址。

        emit LLCFaucet__Drip(_msgSender(), targetAmount);
        // 触发事件，记录领取代币的用户和领取数量。
    } 

    function deposit(uint256 _amount) external onlyOwner {
        // 定义 deposit 函数，允许合约所有者存入代币。

        if (_amount > token.balanceOf(_msgSender())) {
            // 如果合约所有者存入的代币数量大于其账户余额，则抛出错误。
            revert LLCFaucet__InvalidAmount();
        }

        token.safeTransferFrom(_msgSender(), address(this), _amount);
        // 安全地从合约所有者地址转账代币到合约地址。

        emit LLCFaucet__OwnerDeposit(_amount);
        // 触发事件，记录存入的代币数量。
    }

    function setDripInterval(uint256 _newDripInterval) public onlyOwner {
        // 定义 setDripInterval 函数，允许合约所有者设置新的领取间隔。
        dripInterval = _newDripInterval;
    }

    function setDripLimit(uint256 _newDripLimit) public onlyOwner {
        // 定义 setDripLimit 函数，允许合约所有者设置新的领取限制。
        dripLimit = _newDripLimit;
    }

    function setTokenAddress(address _newTokenAddress) public onlyOwner {
        // 定义 setTokenAddress 函数，允许合约所有者设置新的代币合约地址。
        tokenAddress = _newTokenAddress;
    }

    function getDripTime(address _user) external view returns (uint256) {
        // 定义 getDripTime 函数，返回指定用户的上次领取代币时间。
        return dripTime[_user];
    }

    function getDripInterval() external view returns (uint256) {
        // 定义 getDripInterval 函数，返回当前的领取间隔。
        return dripInterval;
    }

    function getDripLimit() external view returns (uint256) {
        // 定义 getDripLimit 函数，返回当前的领取限制。
        return dripLimit;
    }
}
